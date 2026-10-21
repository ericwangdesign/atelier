"""Taste: what the designer likes, learned from what they do, and read by every agent before it starts.

The evidence is a design's whole journey: every version from the first to the latest, the notes that asked for each,
the takes on a /try note and which one was picked, and why. One round on its own says little; the run says what was
asked for twice, what got pushed too far and pulled back, and where it ended up. Each time a version lands from
notes, or a take is picked, a small model reads the profile and that design's journey so far, and answers: a new
line, more support for a line already there, or a line this contradicts. A line counts the designs that back it,
so rereading the same design never inflates it. Re-read all rebuilds the learned lines from every design's history.
Lines are short and concrete ("light grounds, one strong accent"), each keeps the journeys it came from, and the
designer can edit, add, forget or switch the whole thing off.

    taste.json   next to this file, never committed: {"on", "lines": [...], "events": [...], "last": {...}}
    taste.md     written with it on every save, for every Claude session (Eric's global CLAUDE.md points at it): the one
                 list of his taste, in Atelier and out of it. Sessions add to it with `atelier taste add "..."` (below).

A line is {id, text, scope ('all' or a project), by ('learned' or 'you'), count, from: [evidence], at, updated}.
Evidence is {kind: 'journey', project, design, first, last, at}: count is how many different designs back the line.
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

import agents

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
        try:
            self.write_atomic(re.sub(r'\.json$', '', self.path) + '.md', markdown(data))
        except OSError:
            pass

    def view(self, project):
        """What the page shows: the lines that apply here (this project's and everywhere's), newest first."""
        with LOCK:
            data = self.load()
        lines = [l for l in data['lines'] if l.get('scope', 'all') in ('all', project)]
        lines.sort(key=lambda l: -(l.get('at') or 0))  # newest first, by when it was added: rows don't jump when edited
        return {'on': data['on'], 'lines': lines, 'learning': STATE['learning'] > 0, 'rereading': STATE.get('reread'),
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
        """The profile as a prompt section, or '' when it's off or empty. lean=False is for takes after the first:
        they know the taste, and may break it, so the takes still differ."""
        with LOCK:
            data = self.load()
        if not data['on']:
            return ''
        lines = [l for l in data['lines'] if l.get('scope', 'all') in ('all', project)]
        lines.sort(key=lambda l: (l.get('by') != 'you', -(l.get('count') or 1)))
        if not lines:
            return ''
        said = '\n'.join(f"- {l['text']}" + (' (they wrote this themselves)' if l.get('by') == 'you' else f" (seen {l.get('count', 1)}×)" if (l.get('count') or 1) > 1 else '') for l in lines[:20])
        how = ("Follow it unless the note asks for something else." if lean else
               "Know it, but your take comes first: where your take pulls against it, follow your take.")
        return f"""What this designer likes, learned from how their past designs changed. {how}
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

    def reread(self, journeys):
        """Rebuild the learned lines from every design's journey, one after another, in the background. The
        designer's own lines stay. journeys: [event] as journey() makes them, oldest first."""
        if STATE.get('reread') or not journeys:
            return False
        with LOCK:
            data = self.load()
            data['lines'] = [l for l in data['lines'] if l.get('by') == 'you']
            data['events'] = []
            self.save(data)
            STATE['learning'] += 1
            STATE['reread'] = {'done': 0, 'of': len(journeys)}

        def go():
            try:
                for ev in journeys:
                    ev = {**ev, 'at': now()}
                    with LOCK:
                        data = self.load()
                        data['events'] = (data['events'] + [ev])[-MAX_EVENTS:]
                        self.save(data)
                        STATE['learning'] += 1
                    self._learn(ev)
                    STATE['reread']['done'] += 1
            finally:
                with LOCK:
                    STATE['learning'] -= 1
                    STATE['reread'] = None
        threading.Thread(target=go, daemon=True).start()
        return True

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


def markdown(data):
    """taste.md: the lines as a page any Claude session can read before design work. Eric's own lines first."""
    def row(l):
        n = l.get('count') or 1
        said = next((f.get('why') for f in l.get('from', []) if f.get('kind') == 'said' and f.get('why')), '')
        how = "Eric's own" + (f": {said}" if said else '') if l.get('by') == 'you' else f"learned from {n} design{'s' if n > 1 else ''}"
        return f"- {l['text']} ({how})"
    lines = sorted(data['lines'], key=lambda l: (l.get('by') != 'you', -(l.get('count') or 1)))
    out = ['# Design taste', '',
           "Eric's taste, one list for Atelier's agents and every Claude session. Written from atelier/taste.json on every",
           'change; never edit this file. Read it before design work (a screen, a page, a component, a vault page). When',
           'Eric gives design feedback that is a lasting rule, not a one-off fix, add it: `atelier taste add "the rule"`',
           '(add `--why "what he said"`), and tell him. Atelier also learns lines on its own from how designs change.', '']
    if not data.get('on', True):
        out += ['Switched off in Atelier for now: its agents ignore it. Sessions still read it.', '']
    every = [l for l in lines if l.get('scope', 'all') == 'all']
    out += ['## Everywhere', ''] + [row(l) for l in every] + ['']
    for p in sorted({l.get('scope') for l in lines} - {'all', None}):
        out += [f'## Only in {p}', ''] + [row(l) for l in lines if l.get('scope') == p] + ['']
    return '\n'.join(out)


def clean(text):
    return re.sub(r'\s+', ' ', str(text or '')).strip().rstrip('.')[:140]


def apply(data, out, event):
    """Fold the model's answer into the profile. Returns what to tell the designer: (line, 'new' | 'more'), or None."""
    ev = {k: event.get(k) for k in ('kind', 'project', 'id', 'design', 'first', 'last', 'at') if event.get(k) is not None}
    key = lambda f: (f.get('project'), f.get('design') or f.get('id'))  # one design, however many times it's reread
    lines = data['lines']
    byid = {l.get('id'): l for l in lines}
    told, added = [], []
    for lid in out.get('support') or []:
        l = byid.get(lid)
        if l:
            had = [f for f in (l.get('from') or []) if key(f) != key(ev)]
            l['from'] = (had + [ev])[-10:]  # this design's newest reading replaces its older one
            l['count'] = max(1, len({key(f) for f in l['from']})) if l.get('by') != 'you' else l.get('count', 1)
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
    if event['kind'] == 'journey':
        what = f"""How one design changed, from its first version to its latest ({event.get('design', 'a design')}):
{event.get('text', '')}

Read it as a whole. What they asked for more than once, what they pushed and then pulled back, which takes they
picked over which, and the reasons they gave say the most. One small fix on its own says little."""
    elif event['kind'] == 'pick':
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
two lines, only if the evidence really says it; support every line already there that this journey backs. A line about this product's own content or brand is scope "project";
a preference that would hold on any design is scope "all". Contradict a line only if this clearly goes against it.

Answer with this JSON block and nothing else:

```json
{{"add": [{{"text": "...", "scope": "all"}}], "support": ["t…"], "contradict": [], "learned": "one short line for the designer on what you took from this, or empty"}}
```"""


def ask_model(prompt):
    """One short answer from a small model, no tools. Same agent rules as the runs: ATELIER_AGENT replaces Claude."""
    custom = agents.custom()
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


def stem(scene_id):
    """A design's family: today-v4 and today-v1 are both 'today'."""
    return re.sub(r'-v\d+$', '', str(scene_id or ''))


def journey(project, trail, scene_id, title=''):
    """The evidence for one design: every step of its trail, oldest first, written so a small model can read the run.
    None when there's nothing to read yet. A group of takes (or an old exploration) is one step."""
    fam = stem(scene_id)
    steps = sorted((e for e in trail if isinstance(e, dict) and stem(e.get('id')) == fam and e.get('status') == 'done'),
                   key=lambda e: e.get('at') or 0)
    if not steps:
        return None
    ver = lambda i: (re.search(r'-(v\d+)$', str(i or '')) or [None, 'v1'])[1]
    lines, seen = [], set()
    for e in steps:
        if e.get('group'):
            if e['group'] in seen:
                continue
            seen.add(e['group'])
            mine = [x for x in steps if x.get('group') == e['group']]
            win = next((x for x in mine if x.get('picked')), None)
            what = 'Takes on the note' if e.get('kind') == 'try' else 'Explored'
            lines.append(f"{what} \"{e.get('prompt', '')}\", from {ver(e.get('from'))}:")
            for x in mine:
                mark = 'PICKED' if x is win else 'passed over' if win else 'not picked yet'
                lines.append(f"  - {ver(x['id'])} \"{x.get('name') or x.get('angle', '')}\" ({mark}): {x.get('summary', '')}")
            if win and win.get('reason'):
                lines.append(f"  Why they picked it: {win['reason']}")
        else:
            notes = '; '.join(f"\"{n.get('text', '')}\"" for n in e.get('notes', []) if isinstance(n, dict) and n.get('text'))
            lines.append(f"{ver(e['id'])} from {ver(e.get('from'))}. Notes: {notes or '(none)'}. What changed: {e.get('summary', '')}")
        for r in e.get('redirects') or []:
            lines.append(f"  Redirected while it worked: \"{r.get('text', '')}\"")
    text = '\n'.join(lines)
    if len(text) > 6000:  # the newest steps matter most
        text = '…\n' + text[-6000:]
    return {'kind': 'journey', 'project': project, 'design': title or fam, 'id': fam,
            'first': steps[0].get('from') or steps[0]['id'], 'last': steps[-1]['id'], 'text': text}


if __name__ == '__main__':
    # atelier taste                      the lines, as taste.md has them
    # atelier taste add "rule" [--why "what Eric said"] [--scope project]
    # Writes taste.json beside this file (or $ATELIER_TASTE), the same file the Atelier server reads.
    import argparse
    import sys
    ap = argparse.ArgumentParser(prog='atelier taste')
    ap.add_argument('act', nargs='?', default='list', choices=['list', 'add'])
    ap.add_argument('text', nargs='?', default='')
    ap.add_argument('--why', default='')
    ap.add_argument('--scope', default='all')
    a = ap.parse_args()
    path = os.environ.get('ATELIER_TASTE') or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'taste.json')

    def read_json(p, default):
        try:
            with open(p, encoding='utf-8') as f:
                return json.load(f)
        except (OSError, ValueError):
            return default

    def write_atomic(p, text):
        tmp = p + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            f.write(text)
        os.replace(tmp, p)
    t = Taste(path, write_atomic, read_json)
    if a.act == 'add':
        text = clean(a.text)
        if not text:
            sys.exit('Say the rule: atelier taste add "rows get air between them"')
        data = t.load()
        if any(l['text'].lower() == text.lower() for l in data['lines']):
            print(f'Already there: {text}')
            sys.exit(0)
        data['lines'].append({'id': f't{now()}', 'text': text, 'scope': a.scope, 'by': 'you', 'count': 1,
                              'from': [{'kind': 'said', 'why': clean(a.why), 'at': now()}] if a.why else [], 'at': now(), 'updated': now()})
        t.save(data)
        print(f'Added to taste: {text}')
    else:
        t.save(t.load())  # writes taste.md fresh
        print(markdown(t.load()))

