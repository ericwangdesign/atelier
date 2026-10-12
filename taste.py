"""Taste: what the designer likes, learned from what they do, and read by every agent before it starts.

Every pick (and the reason given) and every round of notes is evidence. After each one, a small model reads the
profile and the new evidence and answers with what it learned: a new line, more support for a line already there,
or a line this contradicts. Lines are short and concrete ("light grounds, one strong accent"), each keeps the
evidence it came from, and the designer can edit, add, forget or switch the whole thing off.

    taste.json   next to this file, never committed: {"on", "lines": [...], "events": [...], "last": {...}}

A line is {id, text, scope ('all' or a project), by ('learned' or 'you'), count, from: [evidence], at, updated}.
Angle stats (which kind of direction gets picked) are counted from the projects' trails, not learned.
"""
import json
import os
import re
import shlex
import shutil
import subprocess
import tempfile
import threading
import time

LOCK = threading.Lock()
MAX_LINES = 40
MAX_EVENTS = 80
STATE = {'learning': 0}  # how many learn passes are running


def now():
    return int(time.time() * 1000)


class Taste:
    def __init__(self, path, write_atomic, read_json):
        self.path, self.write_atomic, self.read_json = path, write_atomic, read_json

    # ---------- the file ----------
    def load(self):
        data = self.read_json(self.path, {})
        if not isinstance(data, dict):
            data = {}
        data.setdefault('on', True)
        data['lines'] = [l for l in data.get('lines', []) if isinstance(l, dict) and l.get('text')]
        data['events'] = [e for e in data.get('events', []) if isinstance(e, dict)][-MAX_EVENTS:]
        return data

    def save(self, data):
        self.write_atomic(self.path, json.dumps(data, indent=2, ensure_ascii=False) + '\n')

    def view(self, project, stats):
        """What the page shows: the lines that apply here (this project's and everywhere's), newest first."""
        with LOCK:
            data = self.load()
        lines = [l for l in data['lines'] if l.get('scope', 'all') in ('all', project)]
        lines.sort(key=lambda l: -(l.get('at') or 0))  # newest first, by when it was added: rows don't jump when edited
        return {'on': data['on'], 'lines': lines, 'stats': stats, 'learning': STATE['learning'] > 0,
                'last': data.get('last'), 'evidence': len(data['events'])}

    # ---------- what the designer does by hand ----------
    def edit(self, body):
        """add {text, scope} / change {id, text?, scope?} / forget {id} / on {on}."""
        with LOCK:
            data = self.load()
            act = body.get('act')
            if act == 'on':
                data['on'] = bool(body.get('on'))
            elif act == 'add':
                text = clean(body.get('text'))
                if not text:
                    return 400, {'error': 'say what you like'}
                data['lines'].append({'id': f't{now()}', 'text': text, 'scope': str(body.get('scope') or 'all'),
                                      'by': 'you', 'count': 1, 'from': [], 'at': now(), 'updated': now()})
            elif act in ('change', 'forget'):
                line = next((l for l in data['lines'] if l.get('id') == body.get('id')), None)
                if not line:
                    return 404, {'error': 'no such line'}
                if act == 'forget':
                    data['lines'].remove(line)
                else:
                    if body.get('text') is not None:
                        text = clean(body.get('text'))
                        if not text:
                            return 400, {'error': 'say what you like'}
                        line.update(text=text, by='you')  # an edited line is the designer's now: never dropped by learning
                    if body.get('scope'):
                        line['scope'] = str(body['scope'])
                    line['updated'] = now()
            else:
                return 400, {'error': 'act is add, change, forget or on'}
            self.save(data)
        return 200, {'ok': True}

    # ---------- what agents read ----------
    def brief(self, project, lean=True):
        """The profile as a prompt section, or '' when it's off or empty. lean=False is for directions whose angle
        should come first: they know the taste, and may break it."""
        with LOCK:
            data = self.load()
        if not data['on']:
            return ''
        lines = [l for l in data['lines'] if l.get('scope', 'all') in ('all', project)]
        lines.sort(key=lambda l: (l.get('by') != 'you', -(l.get('count') or 1)))
        if not lines:
            return ''
        said = '\n'.join(f"- {l['text']}" + (' (they wrote this themselves)' if l.get('by') == 'you' else f" (seen {l.get('count', 1)}×)" if (l.get('count') or 1) > 1 else '') for l in lines[:20])
        how = ("Follow it unless the brief asks for something else." if lean else
               "Know it, but your angle comes first: where your angle pulls against it, follow your angle.")
        return f"""What this designer likes, learned from their past picks and notes. {how}
{said}
"""

    # ---------- learning ----------
    def learn(self, event):
        """Keep the evidence, then learn from it in the background."""
        event = {**event, 'at': now()}
        with LOCK:
            data = self.load()
            data['events'] = (data['events'] + [event])[-MAX_EVENTS:]
            self.save(data)
            STATE['learning'] += 1
        threading.Thread(target=self._learn, args=(event,), daemon=True).start()

    def _learn(self, event):
        try:
            with LOCK:
                data = self.load()
            lines = [l for l in data['lines'] if l.get('scope', 'all') in ('all', event.get('project'))]
            out = ask_model(learn_prompt(lines, event))
            if out is None:
                return
            with LOCK:
                data = self.load()
                learned = apply(data, out, event)
                if learned:
                    data['last'] = {'text': learned[0], 'kind': learned[1], 'at': now(), 'project': event.get('project')}
                self.save(data)
        finally:
            with LOCK:
                STATE['learning'] -= 1


def clean(text):
    return re.sub(r'\s+', ' ', str(text or '')).strip().rstrip('.')[:140]


def apply(data, out, event):
    """Fold the model's answer into the profile. Returns what to tell the designer: (line, 'new' | 'more'), or None."""
    ev = {k: event.get(k) for k in ('kind', 'project', 'id', 'at')}
    lines = data['lines']
    byid = {l.get('id'): l for l in lines}
    told, added = [], []
    for lid in out.get('support') or []:
        l = byid.get(lid)
        if l:
            l['count'] = (l.get('count') or 1) + 1
            l['from'] = (l.get('from') or [])[-9:] + [ev]
            l['updated'] = now()
            told.append(l['text'])
    for lid in out.get('contradict') or []:
        l = byid.get(lid)
        if l and l.get('by') != 'you':  # what the designer wrote is never dropped by learning
            l['count'] = (l.get('count') or 1) - 1
            l['updated'] = now()
            if l['count'] <= 0:
                lines.remove(l)
    for add in (out.get('add') or [])[:2]:
        text = clean(add.get('text') if isinstance(add, dict) else add)
        if not text or any(text.lower() == l['text'].lower() for l in lines):
            continue
        scope = event.get('project') if isinstance(add, dict) and add.get('scope') == 'project' else 'all'
        lines.append({'id': f't{now()}{len(lines)}', 'text': text, 'scope': scope, 'by': 'learned', 'count': 1,
                      'from': [ev], 'at': now(), 'updated': now()})
        added.append(text)
    if len(lines) > MAX_LINES:  # the weakest learned lines go first
        learned = sorted((l for l in lines if l.get('by') != 'you'), key=lambda l: ((l.get('count') or 1), l.get('updated') or 0))
        for l in learned[:len(lines) - MAX_LINES]:
            lines.remove(l)
    return (added[0], 'new') if added else (told[0], 'more') if told else None


def learn_prompt(lines, event):
    have = '\n'.join(f"{l['id']}: {l['text']}" for l in lines) or '(nothing yet)'
    if event['kind'] == 'pick':
        said = event.get('said') or "(they didn't say)"
        others = '\n'.join(f"- {o.get('name') or o.get('angle')} ({o.get('angle')}): {o.get('summary', '')}" for o in event.get('others', []))
        what = f"""They asked for: {event.get('ask', '')}
Several agents made one direction each. They picked:
- {event['chosen'].get('name') or event['chosen'].get('angle')} ({event['chosen'].get('angle')}): {event['chosen'].get('summary', '')}
Over these:
{others}
Why, in their words: {said}"""
    else:
        notes = '\n'.join(f"- {n}" for n in event.get('notes', []))
        what = f"""They reviewed a design and asked for these changes:
{notes}
What was changed: {event.get('summary', '')}"""
    return f"""You keep a designer's taste profile: short, concrete lines about what they like, learned from what they do.
Each line is how they want things to look, read or move, in under 12 words: "light grounds with one strong accent",
"type one step smaller than feels safe", "motion only where it explains". Name what you can see (colour, type, layout, spacing, density, motion, copy),
never a judgement ("clearest", "better", "wins") and never generic ("likes clean design"). Their own words are
the strongest evidence: turn what they said into what it looks like.

The profile now:
{have}

New evidence ({event['kind']}):
{what}

What does this tell you about their taste? Prefer supporting a line that's there over adding a near-copy. Add at most
two lines, only if the evidence really says it. A line about this product's own content or brand is scope "project";
a preference that would hold on any design is scope "all". Contradict a line only if this clearly goes against it.

Answer with this JSON block and nothing else:

```json
{{"add": [{{"text": "...", "scope": "all"}}], "support": ["t…"], "contradict": [], "learned": "one short line for the designer on what you took from this, or empty"}}
```"""


def ask_model(prompt):
    """One short answer from a small model, no tools. Same agent rules as the runs: ATELIER_AGENT replaces Claude."""
    custom = (os.environ.get('ATELIER_AGENT') or os.environ.get('WORKSPACE_AGENT') or '').strip()
    try:
        if custom:
            p = subprocess.run(shlex.split(custom), input=prompt, capture_output=True, text=True, timeout=120,
                               env={**os.environ, 'ATELIER_TASK': 'taste'})
            text = p.stdout
        else:
            claude = shutil.which('claude') or next((p for p in (
                '/opt/homebrew/bin/claude', '/usr/local/bin/claude', os.path.expanduser('~/.local/bin/claude'),
                os.path.expanduser('~/.claude/local/claude')) if os.path.exists(p)), None)
            if not claude:
                return None
            model = os.environ.get('ATELIER_TASTE_MODEL', 'haiku')
            # no tools, no settings, no MCP, a one-line system prompt, run from an empty place: it reads only the
            # profile and the evidence, not your CLAUDE.md or memory, and costs about a hundredth of a full session
            p = subprocess.run([claude, '-p', prompt, '--output-format', 'json', '--model', model, '--tools', '',
                                '--system-prompt', 'You keep a designer\'s taste profile. Answer with the JSON block asked for.',
                                '--setting-sources', '', '--strict-mcp-config'],
                               capture_output=True, text=True, timeout=120, cwd=tempfile.gettempdir())
            try:
                text = json.loads(p.stdout).get('result') or ''
            except json.JSONDecodeError:
                text = p.stdout
    except (OSError, subprocess.TimeoutExpired):
        return None
    found = re.findall(r'```(?:json)?\s*(\{.*?\})\s*```', text or '', re.S) or re.findall(r'(\{.*\})', text or '', re.S)
    for chunk in reversed(found):
        try:
            data = json.loads(chunk)
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            continue
    return None


def angle_stats(trails):
    """Which kind of direction gets picked, from every exploration that ended in a pick: {angle: [picked, offered]}."""
    out = {}
    for trail in trails:
        groups = {}
        for e in trail:
            if isinstance(e, dict) and e.get('kind') == 'explore' and e.get('group') and e.get('status') == 'done':
                groups.setdefault(e['group'], []).append(e)
        for g in groups.values():
            if not any(e.get('picked') for e in g):
                continue
            for e in g:
                a = out.setdefault(e.get('angle') or '?', [0, 0])
                a[1] += 1
                a[0] += 1 if e.get('picked') else 0
    return out
