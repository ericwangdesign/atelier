"""Taste: what the designer likes, in one list every agent session reads before design work.

Nothing in Atelier learns it: the designer writes, edits and forgets lines on the Taste tab, and a session adds a
rule the designer gave it with `atelier taste add "..."` (below). Lines are short and concrete ("light grounds, one
strong accent"), and the whole list can be switched off.

    taste.json   next to this file, never committed: {"on", "lines": [...], "events": [...], "last": {...}}
    taste.md     written with it on every save: the same list as plain text, for any agent session to read.

A line is {id, text, scope ('all' or a project), by ('learned' or 'you'), count, from: [evidence], at, updated}.
Lines marked 'learned', and their evidence, are from when Atelier learned taste from runs; they are kept as they are.
"""
import json
import os
import re
import threading
import time

LOCK = threading.Lock()
MAX_LINES = 40
MAX_EVENTS = 80


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
        return {'on': data['on'], 'lines': lines, 'learning': False, 'rereading': None,  # nothing learns any more; the page still reads these
               
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


def markdown(data):
    """taste.md: the lines as a page any Claude session can read before design work. Eric's own lines first."""
    def row(l):
        n = l.get('count') or 1
        said = next((f.get('why') for f in l.get('from', []) if f.get('kind') == 'said' and f.get('why')), '')
        how = "Eric's own" + (f": {said}" if said else '') if l.get('by') == 'you' else f"learned from {n} design{'s' if n > 1 else ''}"
        return f"- {l['text']} ({how})"
    lines = sorted(data['lines'], key=lambda l: (l.get('by') != 'you', -(l.get('count') or 1)))
    out = ['# Design taste', '',
           "Eric's taste, one list for every agent session. Written from atelier/taste.json on every",
           'change; never edit this file. Read it before design work (a screen, a page, a component, a vault page). When',
           'Eric gives design feedback that is a lasting rule, not a one-off fix, add it: `atelier taste add "the rule"`',
           '(add `--why "what he said"`), and tell him. Nothing in Atelier learns lines on its own.', '']
    if not data.get('on', True):
        out += ['Switched off in Atelier for now. Sessions still read it.', '']
    every = [l for l in lines if l.get('scope', 'all') == 'all']
    out += ['## Everywhere', ''] + [row(l) for l in every] + ['']
    for p in sorted({l.get('scope') for l in lines} - {'all', None}):
        out += [f'## Only in {p}', ''] + [row(l) for l in lines if l.get('scope') == p] + ['']
    return '\n'.join(out)


def clean(text):
    return re.sub(r'\s+', ' ', str(text or '')).strip().rstrip('.')[:140]


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

