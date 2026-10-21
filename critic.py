"""The critic: when the takes on a /try note land, one agent looks at every take and ranks them, for serve.py.

The pain it answers: three or four takes land at once and you have to study every one before you can pick.
The critic does that first pass with your taste in hand. It looks at a picture of each take (the stage exports
them, the same way Share does), reads the brief and your taste profile, and answers with an order, a few words of
why for each, and whether the top two are too close to call. You look at its first pick first; it never picks for you.

It changes no files. It runs headless Claude with only Read, in the project's folder (where the pictures are), with
none of the designer's own settings. Set ATELIER_AGENT to run another command instead: it gets the prompt on stdin,
with ATELIER_TASK=critic.

Results are kept in scenes/notes/critic.json (never committed, like the notes): {group: {status, ranks, close, ...}}.
"""
import json
import os
import re
import shlex
import shutil
import subprocess
import threading
import time

import agents

LOCK = threading.Lock()


def now():
    return int(time.time() * 1000)


def path(base):
    return os.path.join(base, 'notes', 'critic.json')


def load(base):
    try:
        with open(path(base), encoding='utf-8') as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError, UnicodeDecodeError):
        return {}


def prompt_for(ask, items, taste, pictures):
    seen = ('Look at each picture with Read before you judge: the picture is the design, the code is only how it was made.'
            if pictures else 'There are no pictures this time: read each design\'s file with Read and judge what it would look like.')
    lines = '\n'.join(f"- {it['id']}: \"{it['name']}\". {it['summary']}" + (f" Picture: {it['picture']}" if it.get('picture') else f" File: scenes/{it['id']}.js")
                      for it in items)
    return f"""You're the critic in Atelier, a stage where a designer reviews designs and leaves notes on them.
They left a note they were unsure about and asked for a few takes on it: {ask}

These takes just landed, each made by its own agent from the same starting point. Each changes only what the note is
about; the rest of the design is the same in all of them:
{lines}

{seen}

{taste or 'You know nothing yet about this designer\'s taste: judge on craft and on how well each answers the brief.'}

Rank them, best first, the way this designer would. Judge what's on screen: hierarchy, spacing, type, colour, and how
well it answers the note. For each, say why in at most 6 words, about what you see (never "better" or
"cleaner" on its own). Say close: true when the top two are too close to call.

Answer with this JSON block and nothing else:

```json
{{"ranks": [{{"id": "...", "why": "at most 6 words"}}], "close": false}}
```"""


def ask_model(prompt, cwd):
    """One answer, Read only. Same agent rules as the runs: ATELIER_AGENT replaces Claude."""
    custom = agents.custom()
    try:
        if custom:
            p = subprocess.run(shlex.split(custom), input=prompt, capture_output=True, text=True, timeout=240, cwd=cwd,
                               env={**os.environ, 'ATELIER_TASK': 'critic'})
            text, cost = p.stdout, None
        else:
            claude = shutil.which('claude') or next((c for c in (
                '/opt/homebrew/bin/claude', '/usr/local/bin/claude', os.path.expanduser('~/.local/bin/claude'),
                os.path.expanduser('~/.claude/local/claude')) if os.path.exists(c)), None)
            if not claude:
                return None, 'Claude Code was not found'
            cmd = [claude, '-p', prompt, '--output-format', 'json', '--setting-sources', '', '--strict-mcp-config',
                   '--permission-mode', 'acceptEdits', '--allowedTools', 'Read', '--tools', 'Read',
                   '--model', os.environ.get('ATELIER_CRITIC_MODEL', 'sonnet')]
            p = subprocess.run(cmd, capture_output=True, text=True, timeout=240, cwd=cwd)
            try:
                out = json.loads(p.stdout)
                text, cost = out.get('result') or '', out.get('total_cost_usd')
            except json.JSONDecodeError:
                text, cost = p.stdout, None
    except subprocess.TimeoutExpired:
        return None, 'The critic took too long'
    except OSError as e:
        return None, f'Could not start the critic: {e}'
    found = re.findall(r'```(?:json)?\s*(\{.*?\})\s*```', text or '', re.S) or re.findall(r'(\{.*\})', text or '', re.S)
    for chunk in reversed(found):
        try:
            data = json.loads(chunk)
            if isinstance(data, dict):
                data['_cost'] = cost
                return data, ''
        except json.JSONDecodeError:
            continue
    return None, 'The critic gave no ranking'


class Critic:
    """serve.py hands it the helpers it already has."""

    def __init__(self, write_atomic, read_json, writes_lock):
        self.write_atomic, self.read_json, self.writes = write_atomic, read_json, writes_lock

    def _set(self, base, group, value):
        with LOCK:
            data = load(base)
            data[group] = value
            self.write_atomic(path(base), json.dumps(data, indent=2, ensure_ascii=False) + '\n')

    def start(self, base, group, pictures, taste):
        """Rank the takes on one note. pictures: {scene id: file name in the project's exports/}. Returns False if it
        already ran or there's nothing to rank."""
        trail = [e for e in self.read_json(os.path.join(base, 'trail.json'), []) if isinstance(e, dict) and e.get('group') == group]
        done = [e for e in trail if e.get('status') == 'done']
        if len(done) < 2 or load(base).get(group, {}).get('status') in ('working', 'done'):
            return False
        project = os.path.dirname(base)
        items = []
        for e in done:
            pic = pictures.get(e['id'])
            pic = os.path.join(project, 'exports', os.path.basename(pic)) if pic else ''
            items.append({'id': e['id'], 'name': e.get('name') or e.get('angle') or e['id'], 'summary': e.get('summary', ''),
                          'picture': pic if pic and os.path.isfile(pic) else ''})
        self._set(base, group, {'status': 'working', 'at': now(), 'ranks': [], 'close': False, 'pictures': all(i['picture'] for i in items)})
        threading.Thread(target=self._go, args=(base, group, items, taste, project), daemon=True).start()
        return True

    def _go(self, base, group, items, taste, project):
        data, err = ask_model(prompt_for(done_ask(self.read_json, base, group), items, taste, all(i['picture'] for i in items)), project)
        ids = [i['id'] for i in items]
        ranks = []
        for r in (data or {}).get('ranks') or []:
            if isinstance(r, dict) and r.get('id') in ids and r['id'] not in [x['id'] for x in ranks]:
                ranks.append({'id': r['id'], 'why': re.sub(r'\s+', ' ', str(r.get('why') or '')).strip().rstrip('.')[:60]})
        if data is not None and len(ranks) < len(ids):  # anything it left out goes last, in the order it was made
            ranks += [{'id': i, 'why': ''} for i in ids if i not in [x['id'] for x in ranks]]
        self._set(base, group, {'status': 'done' if ranks else 'failed', 'at': now(), 'ranks': ranks, 'close': bool((data or {}).get('close')),
                                'error': '' if ranks else (err or 'The critic gave no ranking'), 'cost': (data or {}).get('_cost'),
                                'pictures': all(i['picture'] for i in items)})


def done_ask(read_json, base, group):
    for e in read_json(os.path.join(base, 'trail.json'), []):
        if isinstance(e, dict) and e.get('group') == group and e.get('prompt'):
            return e['prompt']
    return 'a change'
