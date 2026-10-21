"""Serve Atelier on http://localhost:4321, with every project's designs, notes and picks.

    python3 serve.py            (or: python3 serve.py 4400 for another port)

A project is any folder next to this one with a scenes/index.js in it, e.g. ../my-app/scenes/, or one of the
examples in examples/ (a folder next to this one with the same name wins). Atelier is the one tool;
the designs live with their project:

    <project>/scenes/index.js          lists the project's scenes, in order
    <project>/scenes/<name>.js         one scene per design
    <project>/scenes/workspace.json    variants and control values picked in the panel (worth committing)
    <project>/scenes/notes/notes.json  every note (an agent can edit it: set "done": true, change "text")
    <project>/scenes/notes/brief.md    the open notes as a brief, the same text as Copy brief
    <project>/scenes/notes/agent.json  every agent run: what it worked on, what it's doing now, how it ended
    <project>/scenes/trail.json        why each version exists: its parent, the notes or prompt, the pick (worth committing)

Routes:
    /                      the gallery: every project and its designs (index.html)
    /stage.html            the stage (never cached, so a reload always shows the latest edit)
    /p/<project>/<file>    a file from that project's scenes/ folder, and nothing outside it
    /api/projects          GET the projects; POST {"name"} makes a new one from starter/
    /api/wallpapers        GET which wallpaper pictures (dark, light) are in wallpapers/
    /api/taste?project=    GET the taste profile that applies here; POST {act: add|change|forget|on} edits it, {act: reread} relearns from every design
    /api/notes?project=    GET / PUT the project's notes
    /api/state?project=    GET / PUT the project's variants and control values
    /api/capture?project=  POST {"format": png|gif|mp4, "t", "names", "storage"} exports each screen with capture.mjs
                           into <project>/exports/ (served at /x/<project>/<file>)
    /api/duplicate?project= POST {"id"} copies that scene's file as the next version, listed after its family
    /api/snap?project=     POST {"id", "data"} keeps a note's snapshot (a JPEG data URL) as scenes/notes/snaps/<id>.jpg
    /api/agent?project=    GET the agent runs; POST {"design", "notes": [{id, n}], "briefs": {id: lines}} sends notes:
                           plain ones are done in one copy, then each note with /try N gets N takes on top of it
    /api/agent/stop?project= POST {"id"} stops a run
    /api/agent/redirect?project= POST {"id", "text"} stops one run and starts it again on its copy with that line
    /api/critic?project=   POST {"group", "pictures": {id: file in exports/}} ranks the takes on one note (critic.py)
    /api/trail?project=    GET the trail; /api/pick POST {"group", "id", "reason"} keeps one take; the round moves on
    /api/open?project=     POST {"design", "find"} opens the scene file in your editor, at the line that has <find>
    /api/page?project=     POST {"id", "before", "after", "pins"} writes a before and after page into exports/

Only this computer can reach it (it listens on 127.0.0.1).
"""
import datetime
import subprocess
import json
import os
import re
import shutil
import sys
import tempfile
import threading
import agent
import critic
import fixes
import page
import taste
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, unquote, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJECTS = os.environ.get('ATELIER_PROJECTS') or os.environ.get('WORKSPACE_PROJECTS') or os.path.dirname(ROOT)
EXAMPLES = os.path.join(ROOT, 'examples')
STARTER = os.path.join(ROOT, 'starter')


def found():
    """Every project: id -> (its folder, its group). The examples first, so a folder of yours with the same name wins.
    One client is one group, one row on home: a folder next to this one, with its designs in scenes/ and any
    sub-folder that has its own scenes/ (acme/modals/scenes/ is the project acme-modals, in Acme's row).
    A link next to this one that points into another folder here (made for backups) is skipped: its target counts.
    Levels: client (a folder here, a row on home) > project (a scenes/ folder, a card) > design > version."""
    out = {}
    for base in (EXAMPLES, PROJECTS):
        if not os.path.isdir(base):
            continue
        for name in sorted(os.listdir(base)):
            top = os.path.join(base, name)
            if name.startswith('.') or not os.path.isdir(top):
                continue
            if os.path.islink(top) and os.path.realpath(top).startswith(os.path.realpath(base) + os.sep):
                continue
            if os.path.isfile(os.path.join(top, 'scenes', 'index.js')):
                out[name] = (top, name)
            for sub in sorted(os.listdir(top)):
                if not sub.startswith(('.', '_')) and sub not in ('node_modules', 'scenes') \
                        and os.path.isfile(os.path.join(top, sub, 'scenes', 'index.js')):
                    out.setdefault(f'{name}-{sub}', (os.path.join(top, sub), name))
    # the examples are for a first run: once there's a project of your own, they step aside
    if any(not d.startswith(EXAMPLES + os.sep) for d, _ in out.values()):
        out = {k: v for k, v in out.items() if not v[0].startswith(EXAMPLES + os.sep)}
    return out


def project_dirs():
    return {k: v[0] for k, v in found().items()}


def group(name):
    return found().get(name, (None, name))[1]


def project_name(name):
    """A project's own name: the client's for a folder's own scenes/ (Acme), the sub-folder's for one inside a
    client (acme-checkout is "Checkout", in the client Acme)."""
    g = group(name)
    return pretty(name) if name == g else re.sub(r'[-_]+', ' ', name[len(g) + 1:]).strip().capitalize()


def projects():
    return sorted(project_dirs(), key=str.lower)


def project_dir(name):
    return project_dirs().get(name)


def scenes_dir(name):
    d = project_dir(name)
    return os.path.join(d, 'scenes') if d else None


def mtime(path):
    try:
        return os.stat(path).st_mtime_ns
    except FileNotFoundError:
        return 0


def version(path):
    """A file's version for the page: its mtime in ns, as text, since JavaScript numbers can't hold 19 digits exactly
    (a number would come back rounded, and every save would look like a conflict)."""
    return str(mtime(path))


def read_json(path, default):
    """The file's JSON, or default when it's missing, broken, or the wrong shape (one bad file mustn't take down every project)."""
    try:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        return data if type(data) is type(default) else default
    except (FileNotFoundError, json.JSONDecodeError, UnicodeDecodeError):
        return default


WRITES = threading.RLock()  # requests run in parallel: a version check and its write happen as one step


def write_atomic(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix='.' + os.path.basename(path), suffix='.tmp')
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        f.write(text)
    os.replace(tmp, path)


def updated(name):
    """When anything in the project's scenes/ last changed, in ms, for the gallery's "edited" line."""
    base, newest = scenes_dir(name), 0
    for folder, _, files in os.walk(base):
        for f in files:
            newest = max(newest, mtime(os.path.join(folder, f)))
    return newest // 1_000_000


def summary(name):
    """What the gallery shows before it loads anything: names, counts and when it changed, so rows keep their size."""
    base = scenes_dir(name)
    scenes = listed(base)[0]
    state = read_json(os.path.join(base, 'workspace.json'), {})
    notes = read_json(os.path.join(base, 'notes', 'notes.json'), [])
    variants = [v for v in state.get('variants', []) if isinstance(v, dict) and v.get('base') in scenes]
    return {'id': name, 'name': project_name(name), 'group': group(name), 'client': pretty(group(name)), 'updated': updated(name), 'scenes': scenes, 'variants': len(variants),
            'designs': len({title(base, n) for n in scenes}),
            'open': sum(1 for n in notes if isinstance(n, dict) and not n.get('done') and n.get('text')),
            'fonts': os.path.isfile(os.path.join(base, 'fonts.css')),
            'path': os.path.relpath(base, PROJECTS).replace(os.sep, '/') + '/',
            'working': sum(1 for r in agent.runs_for(name, base) if r.get('status') in ('starting', 'working'))}


def title(base, name):
    """A scene's title, read from its file: scenes with one title are versions of one design, bundled in the gallery."""
    try:
        with open(os.path.join(base, name + '.js'), encoding='utf-8') as f:
            found = re.search(r'title:\s*([\'"])(.*?)(?<!\\)\1', f.read())
        return found.group(2) if found else name
    except OSError:
        return name


def listed(base):
    """The scene names in index.js, in order, and the file's text."""
    with open(os.path.join(base, 'index.js'), encoding='utf-8') as f:
        text = f.read()
    found = re.search(r'scenes\(\s*\[(.*?)\]', text, re.S)
    return (re.findall(r'[\'"]([^\'"]+)[\'"]', found.group(1)) if found else []), text


def duplicate(base, src, file=''):
    """Copy the file that makes <src> as the next version of its family (agent-v1 -> agent-v3 when v2 exists), list it
    after the family, and return the new id. The copy differs only in its id and version, so it can be changed on its
    own. It always works: a design whose id isn't its file's name is found by the file that makes it, and one whose id
    is computed (built from a shared template) gets a line at the end that names the copy."""
    names, index = listed(base)
    lit = lambda i: re.compile(r'\bid:\s*([\'"])' + re.escape(i) + r'\1')
    read = lambda n: open(os.path.join(base, n + '.js'), encoding='utf-8').read() if os.path.isfile(os.path.join(base, n + '.js')) else ''
    owner = (src if src in names and read(src) else file if file in names and read(file)
             else next((n for n in names if lit(src).search(read(n))), None))
    if not owner:
        return None, 'no such design'
    text = read(owner)
    stem = re.sub(r'-v\d+$', '', src)
    family = [n for n in names if n == stem or re.fullmatch(re.escape(stem) + r'-v\d+', n)] or [owner]
    top = 1
    for n in family:  # the highest version in the family, from the ids and the files' version: 'vN'
        m = re.fullmatch(r'.*-v(\d+)', n)
        top = max(top, int(m.group(1)) if m else 1)
        v = re.search(r'\bversion:\s*[\'"]v(\d+)[\'"]', read(n))
        top = max(top, int(v.group(1)) if v else 1)
    n = top + 1
    while f'{stem}-v{n}' in names or os.path.exists(os.path.join(base, f'{stem}-v{n}.js')):
        n += 1
    new, ver = f'{stem}-v{n}', f'v{n}'
    if lit(src).search(text):
        text = lit(src).sub(lambda m: f"id: {m.group(1)}{new}{m.group(1)}", text, count=1)
        if re.search(r'\bversion:\s*[\'"][^\'"]*[\'"]', text):
            text = re.sub(r'(\bversion:\s*)([\'"])[^\'"]*\2', lambda m: f"{m.group(1)}{m.group(2)}{ver}{m.group(2)}", text, count=1)
        else:
            text = re.sub(r'(\bid:\s*[\'"]' + re.escape(new) + r'[\'"],?)', lambda m: m.group(1).rstrip(',') + f", version: '{ver}',", text, count=1)
    else:  # the id is computed: let the file make its scene, then name the copy
        text = text.rstrip() + f"\n/* Atelier: this copy's own id and version. */\n{{ const s = SCENES[SCENES.length - 1]; s.id = '{new}'; s.version = '{ver}'; }}\n"
    note = f'/* {new}: a copy of {owner}.js made in Atelier on {datetime.date.today()}, to change on its own and compare side by side. */\n'
    write_atomic(os.path.join(base, new + '.js'), note + text)
    after = [x for x in names if x in family][-1] if any(x in family for x in names) else owner  # at the end of its family
    found = re.search(r'scenes\(\s*\[(.*?)\]', index, re.S)  # only inside the list, never in a comment above it
    inner = re.sub(r'([\'"])' + re.escape(after) + r'\1', lambda m: f"{m.group(0)}, {m.group(1)}{new}{m.group(1)}", found.group(1), count=1)
    index = index[:found.start(1)] + inner + index[found.end(1):]
    write_atomic(os.path.join(base, 'index.js'), index)
    return new, None


RUNNER = None  # made once write_atomic and read_json exist, below


TRY = re.compile(r'(?i)(?:^|\s)/try(?:\s+(\d))?\b')


def try_count(text):
    """How many takes a note asks for: '/try 3' is 3, a bare '/try' is 3, no /try is 0. Between 2 and 4."""
    m = TRY.search(str(text or ''))
    return max(2, min(4, int(m.group(1) or 3))) if m else 0


def rounds_change(base, change):
    """notes/rounds.json: one entry per Send. A round does its plain notes first, then the /try notes one at a time,
    each from the version the one before ended on. Kept on disk so a pick after a restart still moves it on."""
    path = os.path.join(base, 'notes', 'rounds.json')
    with WRITES:
        rounds = read_json(path, [])
        out = change(rounds)
        write_atomic(path, json.dumps(rounds[-40:], indent=2, ensure_ascii=False) + '\n')
    threading.Thread(target=publish_waiting, daemon=True).start()
    return out


WAITING = os.path.join(fixes.VAULT, '_machines', 'atelier.json')


def publish_waiting():
    """Takes waiting for a pick, for the vault's Today (vault/_machines/atelier.json, read by today.js), so a round
    left while the takes ran shows up under Needs you, on the phone too. Written only when it changed."""
    if not os.path.isdir(os.path.dirname(os.path.dirname(WAITING))):
        return
    out = []
    for name in projects():
        base = scenes_dir(name)
        if not base:
            continue
        trail = read_json(os.path.join(base, 'trail.json'), [])
        for r in read_json(os.path.join(base, 'notes', 'rounds.json'), []):
            if r.get('status') != 'working' or not r.get('group') or not r.get('queue'):
                continue
            takes = [e for e in trail if isinstance(e, dict) and e.get('group') == r['group']]
            if not takes or any(e.get('status') in ('starting', 'working') for e in takes) or any(e.get('picked') for e in takes):
                continue
            done = [e for e in takes if e.get('status') == 'done']
            if len(done) < 2:
                continue
            note = r['queue'][0]
            at = max((e.get('at') for e in takes if e.get('at')), default='', key=str)
            if isinstance(at, (int, float)) or str(at).isdigit():  # agent.now() is epoch ms
                at = datetime.datetime.fromtimestamp(int(at) / 1000, datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
            out.append({'id': r['group'], 'project': name, 'design': r.get('design', ''), 'note': note.get('n'), 'takes': len(done),
                        'at': str(at), 'url': f"http://localhost:{PORT}/stage.html?project={quote(name)}"})
    text = json.dumps({'waiting': sorted(out, key=lambda w: w['at'])}, indent=2) + '\n'
    try:
        with open(WAITING, encoding='utf-8') as f:
            if f.read() == text:
                return
    except OSError:
        pass
    os.makedirs(os.path.dirname(WAITING), exist_ok=True)
    write_atomic(WAITING, text)


def agent_post(name, base, body):
    """Send notes. Plain notes are done together in one new version; each /try note then gets its takes, on top of
    that version, with nothing else on screen changing. Every run works on a fresh copy, so nothing is overwritten."""
    design = str(body.get('design', ''))
    if design not in listed(base)[0]:
        return 400, {'error': 'no such design'}
    briefs = body.get('briefs') if isinstance(body.get('briefs'), dict) else {}
    notes = [n for n in body.get('notes', []) if isinstance(n, dict) and isinstance(n.get('id'), int)]
    if not notes:
        return 400, {'error': 'no open notes on this design'}
    stored = {x.get('id'): x for x in read_json(os.path.join(base, 'notes', 'notes.json'), []) if isinstance(x, dict)}
    for n in notes:
        n['try'] = try_count(stored.get(n['id'], {}).get('text', ''))
        n['brief'] = str(briefs.get(str(n['id']), ''))[:6000]
    plain, tries = [n for n in notes if not n['try']], [n for n in notes if n['try']]
    at = agent.now()
    rnd = {'id': f'q{at}', 'project': name, 'design': design, 'base': design, 'at': at, 'status': 'working',
           'queue': [{'id': n['id'], 'n': n.get('n'), 'try': n['try'], 'brief': n['brief']} for n in tries], 'group': '', 'wait': ''}
    if tries:  # the /try notes show as waiting until their takes land and one is picked
        RUNNER.notes_change(base, lambda ns: [x.__setitem__('sent', rnd['id']) for x in ns if isinstance(x, dict) and x.get('id') in [t['id'] for t in tries]])
    runs, scenes = [], []
    if plain:
        run = start_notes(name, base, design, plain, rnd['id'] if tries else '')  # a round id says takes come next
        if run.get('status') == 'failed':
            rounds_change(base, lambda rs: rs.append({**rnd, 'status': 'failed'}))
            reopen_round(base, rnd['id'])
            return 400, {'error': run.get('error') or 'Could not start'}
        rnd['wait'] = run['id']
        runs.append(agent.public(run)); scenes.append(run['scene'])
    rounds_change(base, lambda rs: rs.append(rnd))
    if not plain:
        made = start_takes(name, base, rnd['id'])
        runs += made; scenes += [r['scene'] for r in made]
    return 200, {'runs': runs, 'scenes': scenes, 'round': rnd['id']}


def start_notes(name, base, design, notes, round_id=''):
    """One agent for every plain note on a design, in one new version."""
    new, err = duplicate(base, design)
    if not new:
        return {'status': 'failed', 'error': err}
    ids, numbers = [n['id'] for n in notes], {str(n['id']): n.get('n') for n in notes}
    stored = read_json(os.path.join(base, 'notes', 'notes.json'), [])
    texts = [{'n': numbers[str(x['id'])], 'text': x.get('text', '')} for x in stored if isinstance(x, dict) and x.get('id') in ids]
    RUNNER.trail_add(base, {'id': new, 'from': design, 'kind': 'notes', 'at': agent.now(), 'notes': texts, 'status': 'working'})
    prompt = agent.notes_prompt(new, design, [n.get('n') for n in notes], '\n\n'.join(n['brief'] for n in notes), TASTE.brief(name))

    def sent(run):
        RUNNER.notes_change(base, lambda ns: [n.__setitem__('sent', run['id']) for n in ns if isinstance(n, dict) and n.get('id') in ids])
    run = RUNNER.start(name, base, kind='notes', scene=new, parent=design, prompt=prompt, notes=ids, numbers=numbers,
                       label=f"{len(ids)} note{'s' if len(ids) > 1 else ''}", prepare=sent, round=round_id)
    return run


def start_takes(name, base, round_id):
    """The takes on the next /try note in a round, from the version the round is on. Ends the round when none are left."""
    rnd = next((r for r in read_json(os.path.join(base, 'notes', 'rounds.json'), []) if r.get('id') == round_id), None)
    if not rnd or rnd.get('status') != 'working' or rnd.get('group'):  # takes already going for this round
        return []
    if not rnd['queue']:
        rounds_change(base, lambda rs: [r.update(status='done', group='') for r in rs if r.get('id') == round_id])
        return []
    note, src = rnd['queue'][0], rnd['base']
    if src not in listed(base)[0]:
        src = rnd['design']
    group, at, runs = f'g{agent.now()}', agent.now(), []
    text = re.sub(r'\s+', ' ', TRY.sub(' ', next((x.get('text', '') for x in read_json(os.path.join(base, 'notes', 'notes.json'), [])
                                               if isinstance(x, dict) and x.get('id') == note['id']), ''))).strip()
    for k in range(note['try']):
        new, err = duplicate(base, src)
        if not new:
            break
        RUNNER.trail_add(base, {'id': new, 'from': src, 'kind': 'try', 'at': at, 'group': group, 'prompt': text,
                                'note': note.get('n'), 'noteId': note['id'], 'angle': f'Take {k + 1}', 'status': 'working'})
        prompt = agent.try_prompt(new, src, note['brief'], k + 1, note['try'], TASTE.brief(name, lean=k == 0))
        run = RUNNER.start(name, base, kind='try', scene=new, parent=src, prompt=prompt, group=group,
                           notes=[note['id']], numbers={str(note['id']): note.get('n')}, angle=f'Take {k + 1}', label=f'Take {k + 1}', round=round_id)
        runs.append(agent.public(run))
    rounds_change(base, lambda rs: [r.update(group=group, base=src) for r in rs if r.get('id') == round_id])
    return runs


def reopen_round(base, round_id):
    """A round that can't go on leaves its /try notes open, so they can be sent again."""
    RUNNER.notes_change(base, lambda ns: [n.pop('sent', None) for n in ns if isinstance(n, dict) and n.get('sent') == round_id])


def round_picked(name, base, group, pick, summary):
    """A take was picked: its note is answered, the round moves to that version, and the next /try note starts."""
    rnd = next((r for r in read_json(os.path.join(base, 'notes', 'rounds.json'), []) if r.get('group') == group and r.get('status') == 'working'), None)
    if not rnd or not rnd['queue']:
        return
    note = rnd['queue'][0]

    def answer(notes):
        for n in notes:
            if isinstance(n, dict) and n.get('id') == note['id']:
                n.setdefault('replies', []).append({'who': 'You', 'text': f'Picked: {summary}' if summary else 'Picked', 'at': agent.now(), 'made': pick})
                n['done'] = True
                n.pop('sent', None)
    RUNNER.notes_change(base, answer)
    rounds_change(base, lambda rs: [r.update(base=pick, queue=r['queue'][1:], group='') for r in rs if r.get('id') == rnd['id']])
    start_takes(name, base, rnd['id'])


def open_in_editor(path, find):
    """Open a file at the first line that has <find>, in the first editor found: Cursor, VS Code, Zed, else the default app."""
    line = 1
    if find:
        try:
            with open(path, encoding='utf-8') as f:
                for i, text in enumerate(f, 1):
                    if find in text:
                        line = i
                        break
        except OSError:
            pass
    for cli, args in (('cursor', ['-g', f'{path}:{line}']), ('code', ['-g', f'{path}:{line}']), ('zed', [f'{path}:{line}'])):
        exe = shutil.which(cli)
        if exe:
            subprocess.Popen([exe, *args], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return line
    subprocess.Popen(['open', '-t', path] if sys.platform == 'darwin' else ['xdg-open', path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return line


def pretty(name):
    return re.sub(r'[-_]+', ' ', name).strip().title() or name


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def translate_path(self, path):
        clean = unquote(urlparse(path).path)
        if clean.startswith('/x/'):  # a project's exports
            name, _, sub = clean[3:].partition('/')
            if name not in projects():
                return os.path.join(ROOT, '.missing')
            base = os.path.realpath(os.path.join(project_dir(name), 'exports'))
            target = os.path.realpath(os.path.join(base, sub))
            return target if target.startswith(base + os.sep) else os.path.join(ROOT, '.missing')
        if clean.startswith('/p/'):
            name, _, sub = clean[3:].partition('/')
            base = scenes_dir(name)
            if not base:
                return os.path.join(ROOT, '.missing')
            base = os.path.realpath(base)
            target = os.path.realpath(os.path.join(base, sub))
            return target if target.startswith(base + os.sep) else os.path.join(ROOT, '.missing')
        return super().translate_path(path)

    def send_json(self, code, body):
        data = json.dumps(body).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        """The request's JSON object, or None. Only application/json is read: other websites can send a browser
        to localhost, but not with that type without asking first, so they can't write here."""
        if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
            return None
        try:
            data = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or b'{}')
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
            return None
        return data if isinstance(data, dict) else None

    def project_files(self):
        """The project named in ?project=, as (notes.json, brief.md, workspace.json), or None."""
        name = parse_qs(urlparse(self.path).query).get('project', [''])[0]
        base = scenes_dir(name)
        if not base:
            return None
        return os.path.join(base, 'notes', 'notes.json'), os.path.join(base, 'notes', 'brief.md'), os.path.join(base, 'workspace.json')

    def do_GET(self):
        route = urlparse(self.path).path
        if route == '/notes-layer.js':  # notes on Atelier itself (⌥N), the vault reader's own file: see fixes.py
            if not fixes.ready():
                return self.send_json(404, {'error': 'no vault here'})
            with open(fixes.LAYER, 'rb') as f:
                data = f.read()
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            return self.wfile.write(data)
        if route == '/api/fixes':
            if not fixes.ready():
                return self.send_json(404, {'error': 'no vault here'})
            return self.send_json(200, fixes.listing(parse_qs(urlparse(self.path).query).get('path', [''])[0]))
        if route == '/api/projects':
            return self.send_json(200, [summary(p) for p in projects()])
        if route == '/api/wallpapers':  # the wallpaper pictures that are there, so the page never asks for a missing one
            return self.send_json(200, [n for n in ('dark', 'light') if os.path.isfile(os.path.join(ROOT, 'wallpapers', n + '.jpg'))])
        if route == '/api/taste':
            return self.send_json(200, TASTE.view(parse_qs(urlparse(self.path).query).get('project', [''])[0]))
        if route in ('/api/agent', '/api/trail'):
            files = self.project_files()
            if not files:
                return self.send_json(404, {'error': 'no such project'})
            base, name = os.path.dirname(files[2]), parse_qs(urlparse(self.path).query).get('project', [''])[0]
            if route == '/api/agent':
                return self.send_json(200, {'runs': agent.runs_for(name, base), 'critic': critic.load(base)})
            return self.send_json(200, {'trail': read_json(os.path.join(base, 'trail.json'), [])})
        if route in ('/api/notes', '/api/state'):
            files = self.project_files()
            if not files:
                return self.send_json(404, {'error': 'no such project'})
            if route == '/api/notes':
                return self.send_json(200, {'notes': read_json(files[0], []), 'version': version(files[0])})
            return self.send_json(200, {'state': read_json(files[2], {}), 'version': version(files[2])})
        return super().do_GET()

    def do_PUT(self):
        with WRITES:
            return self.put()

    def fix(self, method):
        """POST /api/fixes, PATCH and DELETE /api/fixes/<id>: notes on Atelier itself, kept in the vault (fixes.py)."""
        route = urlparse(self.path).path
        if not fixes.ready():
            return self.send_json(404, {'error': 'no vault here'})
        fid = route[len('/api/fixes/'):] if route.startswith('/api/fixes/') else ''
        try:
            if method == 'DELETE' and fid:
                return self.send_json(200, fixes.remove(fid))
            b = self.body()
            if b is None:
                return self.send_json(400, {'error': 'send JSON'})
            if method == 'POST' and not fid:
                return self.send_json(200, fixes.add(b))
            if method == 'PATCH' and fid:
                return self.send_json(200, fixes.patch(fid, b))
        except KeyError as e:
            return self.send_json(404, {'error': str(e)})
        except ValueError as e:
            return self.send_json(400, {'error': str(e)})
        return self.send_json(404, {'error': 'no such route'})

    def do_PATCH(self):
        if urlparse(self.path).path.startswith('/api/fixes/'):
            return self.fix('PATCH')
        return self.send_json(404, {'error': 'no such route'})

    def do_DELETE(self):
        if urlparse(self.path).path.startswith('/api/fixes/'):
            return self.fix('DELETE')
        return self.send_json(404, {'error': 'no such route'})

    def do_POST(self):
        if urlparse(self.path).path == '/api/capture':  # takes as long as the flow plays: outside the lock
            return self.capture()
        if urlparse(self.path).path == '/api/fixes':
            return self.fix('POST')
        with WRITES:
            return self.post()

    def capture(self):
        name = parse_qs(urlparse(self.path).query).get('project', [''])[0]
        body = self.body()
        if name not in projects() or body is None:
            return self.send_json(404, {'error': 'no such project'})
        fmt = body.get('format')
        if fmt not in ('png', 'gif', 'mp4'):
            return self.send_json(400, {'error': 'format is png, gif or mp4'})
        node = shutil.which('node') or next((p for p in ('/opt/homebrew/bin/node', '/usr/local/bin/node') if os.path.exists(p)), None)
        if not node:
            return self.send_json(500, {'error': 'Export needs Node (node was not found)'})
        names = body.get('names') if isinstance(body.get('names'), list) else []
        stamp, files = f'{datetime.datetime.now():%Y%m%d-%H%M%S}', []
        for n in names[:6] or ['stage']:  # one file per screen
            stem = re.sub(r'[^a-z0-9]+', '-', str(n).lower()).strip('-')[:60] or 'stage'
            file = f'{stem}-{stamp}.{fmt}'
            while file in files:
                file = file.replace(f'.{fmt}', f'-2.{fmt}')
            files.append(file)
        folder = os.path.join(project_dir(name), 'exports')
        os.makedirs(folder, exist_ok=True)
        try:
            t = float(body.get('t') or 0)
        except (TypeError, ValueError):
            t = 0
        storage = body.get('storage') if isinstance(body.get('storage'), dict) else {}
        job = {'url': f'http://localhost:{self.server.server_port}/stage.html?project={name}&capture=1&t={t:.3f}',
               'storage': {k: v for k, v in storage.items() if isinstance(k, str) and (v is None or isinstance(v, str))},
               'format': fmt, 'outs': [os.path.join(folder, f) for f in files]}
        try:
            run = subprocess.run([node, os.path.join(ROOT, 'capture.mjs')], input=json.dumps(job), capture_output=True, text=True, timeout=300)
        except subprocess.TimeoutExpired:
            return self.send_json(500, {'error': 'Export took too long'})
        made = [f for f in files if os.path.exists(os.path.join(folder, f))]
        if run.returncode != 0 or not made:
            lines = (run.stderr or run.stdout or 'Export failed').strip().splitlines()
            msg = next((l for l in lines if 'Error' in l), lines[-1] if lines else 'Export failed')
            return self.send_json(500, {'error': msg[:300]})
        return self.send_json(200, {'files': [{'file': f, 'url': f'/x/{name}/{f}'} for f in made]})

    def put(self):
        route = urlparse(self.path).path
        files = self.project_files()
        if route not in ('/api/notes', '/api/state') or not files:
            return self.send_json(404, {'error': 'not found'})
        body = self.body()
        if body is None:
            return self.send_json(400, {'error': 'bad json'})
        if route == '/api/notes':
            notes, brief, base = body.get('notes'), body.get('brief', ''), body.get('version')
            if not isinstance(notes, list) or not isinstance(brief, str):
                return self.send_json(400, {'error': 'notes must be a list'})
            # The page says which version it last saw. If the file changed since (an agent edited it), refuse,
            # and hand back what is on disk, so nobody's edit is silently overwritten.
            if base is not None and str(base) != version(files[0]):
                return self.send_json(409, {'notes': read_json(files[0], []), 'version': version(files[0])})
            write_atomic(files[0], json.dumps(notes, indent=2, ensure_ascii=False) + '\n')
            ignore = os.path.join(os.path.dirname(files[0]), '.gitignore')
            if not os.path.exists(ignore):  # notes are working chatter: never committed with the project
                write_atomic(ignore, '*\n')
            write_atomic(files[1], brief + '\n')
            return self.send_json(200, {'version': version(files[0])})
        state, base = body.get('state'), body.get('version')
        if not isinstance(state, dict):
            return self.send_json(400, {'error': 'state must be an object'})
        if base is not None and str(base) != version(files[2]):  # changed on disk since the page read it: same as notes
            return self.send_json(409, {'state': read_json(files[2], {}), 'version': version(files[2])})
        write_atomic(files[2], json.dumps(state, indent=2, ensure_ascii=False) + '\n')
        return self.send_json(200, {'version': version(files[2])})

    def post(self):
        route = urlparse(self.path).path
        if route == '/api/taste':
            body = self.body() or {}
            if body.get('scope') == 'project':  # "this project" is stored as the project's name
                body['scope'] = parse_qs(urlparse(self.path).query).get('project', [''])[0] or 'all'
            if body.get('act') == 'reread':  # every design with a history, in every project, oldest first
                return self.send_json(200, {'started': TASTE.reread(all_journeys())})
            return self.send_json(*TASTE.edit(body))
        if route in ('/api/agent', '/api/agent/stop', '/api/agent/redirect', '/api/critic', '/api/pick', '/api/open', '/api/page'):
            files, body = self.project_files(), self.body()
            if not files or body is None:
                return self.send_json(404, {'error': 'no such project'})
            base, name = os.path.dirname(files[2]), parse_qs(urlparse(self.path).query).get('project', [''])[0]
            if route == '/api/agent':
                return self.send_json(*agent_post(name, base, body))
            if route == '/api/agent/stop':
                return self.send_json(200, {'stopped': RUNNER.stop(str(body.get('id', '')))})
            if route == '/api/critic':
                pics = body.get('pictures') if isinstance(body.get('pictures'), dict) else {}
                pics = {str(k): str(v) for k, v in pics.items() if isinstance(v, str)}
                return self.send_json(200, {'started': CRITIC.start(base, str(body.get('group', '')), pics, TASTE.brief(name))})
            if route == '/api/agent/redirect':
                return self.send_json(200, {'redirected': RUNNER.redirect(str(body.get('id', '')), body.get('text', ''))})
            if route == '/api/pick':
                group, pick, reason = str(body.get('group', '')), str(body.get('id', '')), str(body.get('reason', ''))[:300]
                RUNNER.trail_update(base, lambda e: e.get('group') == group,
                                    lambda e: e.update(picked=e.get('id') == pick, reason=reason if e.get('id') == pick else e.get('reason', ''), pickedAt=agent.now()))
                mine = [e for e in read_json(os.path.join(base, 'trail.json'), []) if isinstance(e, dict) and e.get('group') == group]
                chosen = next((e for e in mine if e.get('id') == pick), None)
                if chosen:  # a pick, and why, joins the design's journey: taste rereads it
                    learn_journey(name, base, pick)
                    round_picked(name, base, group, pick, chosen.get('name') or chosen.get('summary', ''))
                return self.send_json(200, {'trail': read_json(os.path.join(base, 'trail.json'), [])})
            if route == '/api/open':
                design = str(body.get('design', ''))
                if design not in listed(base)[0]:
                    return self.send_json(400, {'error': 'no such design'})
                return self.send_json(200, {'line': open_in_editor(os.path.join(base, design + '.js'), str(body.get('find', ''))[:120])})
            return self.send_json(*page.write_page(write_atomic, name, base, body))
        if urlparse(self.path).path == '/api/snap':
            files = self.project_files()
            body = self.body() or {}
            data, nid = str(body.get('data', '')), str(body.get('id', ''))
            prefix = 'data:image/jpeg;base64,'
            if not files:
                return self.send_json(404, {'error': 'no such project'})
            if not nid.isdigit() or not data.startswith(prefix) or len(data) > 4_000_000:
                return self.send_json(400, {'error': 'send {"id": <note id>, "data": <JPEG data URL>}'})
            import base64
            try:
                raw = base64.b64decode(data[len(prefix):], validate=True)
            except ValueError:
                return self.send_json(400, {'error': 'not base64'})
            snaps = os.path.join(os.path.dirname(files[2]), 'notes', 'snaps')
            os.makedirs(snaps, exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=snaps, suffix='.tmp')
            with os.fdopen(fd, 'wb') as f:
                f.write(raw)
            os.replace(tmp, os.path.join(snaps, nid + '.jpg'))
            return self.send_json(200, {'file': f'snaps/{nid}.jpg'})
        if urlparse(self.path).path == '/api/duplicate':
            files = self.project_files()
            body = self.body() or {}
            if not files:
                return self.send_json(404, {'error': 'no such project'})
            if agent.busy(parse_qs(urlparse(self.path).query).get('project', [''])[0], str(body.get('id', ''))):
                return self.send_json(409, {'error': 'An agent is working on this design. Duplicate it when it lands.'})
            new, err = duplicate(os.path.dirname(files[2]), str(body.get('id', '')), str(body.get('file', '')))
            return self.send_json(200, {'id': new}) if new else self.send_json(400, {'error': err})
        if urlparse(self.path).path != '/api/projects':
            return self.send_json(404, {'error': 'not found'})
        body = self.body() or {}
        name = re.sub(r'[^a-z0-9]+', '-', str(body.get('name', '')).lower()).strip('-')[:40]
        if not name:
            return self.send_json(400, {'error': 'give the project a name'})
        scenes = os.path.join(PROJECTS, name, 'scenes')
        if os.path.exists(os.path.join(scenes, 'index.js')):
            return self.send_json(409, {'error': f'{name} already has scenes', 'id': name})
        os.makedirs(scenes, exist_ok=True)
        for f in os.listdir(STARTER):
            shutil.copy(os.path.join(STARTER, f), os.path.join(scenes, f))
        return self.send_json(200, {'id': name, 'name': pretty(name)})

    def log_message(self, fmt, *args):
        if '/api/' not in str(args[0] if args else ''):  # keep the polling quiet
            super().log_message(fmt, *args)


RUNNER = agent.Runner(write_atomic, read_json, WRITES)
CRITIC = critic.Critic(write_atomic, read_json, WRITES)
TASTE = taste.Taste(os.path.join(ROOT, 'taste.json'), write_atomic, read_json)


def learn_journey(project, base, scene):
    """Taste rereads one design's whole journey, now that it has a new step."""
    ev = taste.journey(project, read_json(os.path.join(base, 'trail.json'), []), scene, title(base, scene))
    if ev:
        TASTE.learn(ev)


def all_journeys():
    """Every design with a history, in every project, oldest first: what Re-read all learns from."""
    out = []
    for p in projects():
        base = scenes_dir(p)
        trail = read_json(os.path.join(base, 'trail.json'), [])
        last = {}
        for e in trail:
            if isinstance(e, dict) and e.get('status') == 'done':
                last[taste.stem(e.get('id'))] = e
        for fam, e in last.items():
            ev = taste.journey(p, trail, e['id'], title(base, e['id']))
            if ev:
                out.append((e.get('at') or 0, ev))
    return [ev for _, ev in sorted(out, key=lambda x: x[0])]


def learn_from_run(run, base):
    """When a run ends. A notes round that landed is evidence of taste, and its round moves on to the /try notes.
    A take whose group has all landed gets its critic: the page sends pictures of the takes first; if no page does
    within 30s (none is open), the critic reads the code instead. A group where every take failed lets its note go."""
    project, rid = run['project'], run.get('round', '')
    if run['kind'] == 'try' and run.get('group'):
        group = run['group']
        with agent.LOCK:
            mine = [r for r in agent.RUNS.values() if r.get('group') == group]
        if any(r['status'] in ('starting', 'working') for r in mine):
            return
        if not any(r['status'] == 'done' for r in mine):
            reopen_round(base, rid)
            rounds_change(base, lambda rs: [r.update(status='failed') for r in rs if r.get('id') == rid])
            return
        if sum(r['status'] == 'done' for r in mine) == 1:  # one take is no choice: it's the answer
            one = next(r for r in mine if r['status'] == 'done')
            RUNNER.trail_update(base, lambda e: e.get('id') == one['scene'], lambda e: e.update(picked=True, pickedAt=agent.now()))
            learn_journey(project, base, one['scene'])
            round_picked(project, base, group, one['scene'], one.get('name') or one.get('summary', ''))
            return
        threading.Timer(30, lambda: CRITIC.start(base, group, {}, TASTE.brief(project))).start()
        publish_waiting()  # every take has landed: Today shows it under Needs you
        return
    if run['kind'] != 'notes':
        return
    if rid:
        if run['status'] == 'done':
            rounds_change(base, lambda rs: [r.update(base=run['scene'], wait='') for r in rs if r.get('id') == rid])
            start_takes(project, base, rid)
        else:
            reopen_round(base, rid)
            rounds_change(base, lambda rs: [r.update(status='failed') for r in rs if r.get('id') == rid])
    if run['status'] != 'done':
        return
    learn_journey(project, base, run['scene'])


RUNNER.on_done = learn_from_run


PORT = int(sys.argv[1]) if __name__ == '__main__' and len(sys.argv) > 1 else 4321

if __name__ == '__main__':
    port = PORT
    try:
        server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    except OSError as e:
        if e.errno != 48:  # 48: address in use
            raise
        import urllib.request
        try:
            urllib.request.urlopen(f'http://localhost:{port}/api/projects', timeout=1)
            print(f'Atelier is already running on http://localhost:{port}. Use `atelier` to open it, or `atelier stop` first.')
        except OSError:
            print(f'Port {port} is taken by something else. Try: python3 serve.py {port + 1}')
        sys.exit(1)
    print(f'Atelier on http://localhost:{port}  (projects: {", ".join(projects()) or "none yet"})')
    threading.Thread(target=publish_waiting, daemon=True).start()
    server.serve_forever()
