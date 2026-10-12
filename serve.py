"""Serve Atelier on http://localhost:4321, with every project's designs, notes and picks.

    python3 serve.py            (or: python3 serve.py 4400 for another port)

A project is any folder next to this one with a scenes/index.js in it, e.g. ../my-app/scenes/, or one of the
examples in examples/ (a folder next to this one with the same name wins). Atelier is the one tool;
the designs live with their project:

    <project>/scenes/index.js          lists the project's scenes, in order
    <project>/scenes/<name>.js         one scene per design
    <project>/scenes/workspace.json    variants and control values picked in the panel (worth committing)
    <project>/scenes/notes/notes.json  every note (Claude can edit it: set "done": true, change "text")
    <project>/scenes/notes/brief.md    the open notes as a brief, the same text as Copy brief
    <project>/scenes/notes/agent.json  every agent run: what it worked on, what it's doing now, how it ended
    <project>/scenes/trail.json        why each version exists: its parent, the notes or prompt, the pick (worth committing)

Routes:
    /                      the gallery: every project and its designs (index.html)
    /stage.html            the stage (never cached, so a reload always shows the latest edit)
    /p/<project>/<file>    a file from that project's scenes/ folder, and nothing outside it
    /api/projects          GET the projects; POST {"name"} makes a new one from starter/
    /api/wallpapers        GET which wallpaper pictures (dark, light) are in wallpapers/
    /api/taste?project=    GET the taste profile that applies here; POST {act: add|change|forget|on} edits it
    /api/notes?project=    GET / PUT the project's notes
    /api/state?project=    GET / PUT the project's variants and control values
    /api/capture?project=  POST {"format": png|gif|mp4, "t", "names", "storage"} exports each screen with capture.mjs
                           into <project>/exports/ (served at /x/<project>/<file>)
    /api/duplicate?project= POST {"id"} copies that scene's file as the next version, listed after its family
    /api/snap?project=     POST {"id", "data"} keeps a note's snapshot (a JPEG data URL) as scenes/notes/snaps/<id>.jpg
    /api/agent?project=    GET the agent runs; POST {"kind": "notes", "design", "notes", "brief"} answers notes on a copy,
                           POST {"kind": "explore", "design", "prompt", "count", "focus"} starts 2 to 4 agents on copies
    /api/agent/stop?project= POST {"id"} stops a run
    /api/trail?project=    GET the trail; /api/pick POST {"group", "id", "reason"} keeps one direction of an exploration
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
import page
import taste
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJECTS = os.environ.get('ATELIER_PROJECTS') or os.environ.get('WORKSPACE_PROJECTS') or os.path.dirname(ROOT)
EXAMPLES = os.path.join(ROOT, 'examples')
STARTER = os.path.join(ROOT, 'starter')


def project_dirs():
    """Every project: name -> its folder. The examples first, so a folder of yours with the same name wins."""
    out = {}
    for base in (EXAMPLES, PROJECTS):
        if not os.path.isdir(base):
            continue
        for name in os.listdir(base):
            if not name.startswith('.') and os.path.isfile(os.path.join(base, name, 'scenes', 'index.js')):
                out[name] = os.path.join(base, name)
    return out


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
    return {'id': name, 'name': pretty(name), 'updated': updated(name), 'scenes': scenes, 'variants': len(variants),
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


def duplicate(base, src):
    """Copy <src>.js as the next version of its family (agent-v1 -> agent-v3 when v2 exists), list it after the family,
    and return the new id. The copy differs only in its id and version, so it can be changed on its own."""
    names, index = listed(base)
    path = os.path.join(base, src + '.js')
    if src not in names or not os.path.isfile(path):
        return None, 'no such design'
    with open(path, encoding='utf-8') as f:
        text = f.read()
    if not re.search(r'\bid:\s*([\'"])' + re.escape(src) + r'\1', text):
        return None, f'{src}.js has no id: \'{src}\''
    stem = re.sub(r'-v\d+$', '', src)
    family = [n for n in names if n == stem or re.fullmatch(re.escape(stem) + r'-v\d+', n)]
    top = 1
    for n in family:  # the highest version in the family, from the ids and the files' version: 'vN'
        m = re.fullmatch(r'.*-v(\d+)', n)
        top = max(top, int(m.group(1)) if m else 1)
        try:
            with open(os.path.join(base, n + '.js'), encoding='utf-8') as f:
                v = re.search(r'\bversion:\s*[\'"]v(\d+)[\'"]', f.read())
            top = max(top, int(v.group(1)) if v else 1)
        except FileNotFoundError:
            pass
    n = top + 1
    while f'{stem}-v{n}' in names or os.path.exists(os.path.join(base, f'{stem}-v{n}.js')):
        n += 1
    new, ver = f'{stem}-v{n}', f'v{n}'
    text = re.sub(r'(\bid:\s*)([\'"])' + re.escape(src) + r'\2', lambda m: f"{m.group(1)}{m.group(2)}{new}{m.group(2)}", text, count=1)
    if re.search(r'\bversion:\s*[\'"][^\'"]*[\'"]', text):
        text = re.sub(r'(\bversion:\s*)([\'"])[^\'"]*\2', lambda m: f"{m.group(1)}{m.group(2)}{ver}{m.group(2)}", text, count=1)
    else:
        text = re.sub(r'(\bid:\s*[\'"]' + re.escape(new) + r'[\'"],?)', lambda m: m.group(1).rstrip(',') + f", version: '{ver}',", text, count=1)
    note = f'/* {new}: a copy of {src}.js made in Atelier on {datetime.date.today()}, to change on its own and compare side by side. */\n'
    write_atomic(os.path.join(base, new + '.js'), note + text)
    after = [x for x in names if x in family][-1]  # at the end of its family, so versions stay in order
    found = re.search(r'scenes\(\s*\[(.*?)\]', index, re.S)  # only inside the list, never in a comment above it
    inner = re.sub(r'([\'"])' + re.escape(after) + r'\1', lambda m: f"{m.group(0)}, {m.group(1)}{new}{m.group(1)}", found.group(1), count=1)
    index = index[:found.start(1)] + inner + index[found.end(1):]
    write_atomic(os.path.join(base, 'index.js'), index)
    return new, None


RUNNER = None  # made once write_atomic and read_json exist, below


def agent_post(name, base, body):
    """Start agents. Every run works on a fresh copy of the design, so what you made is never overwritten."""
    kind, design = body.get('kind'), str(body.get('design', ''))
    if kind not in ('notes', 'explore'):
        return 400, {'error': 'kind is notes or explore'}
    if design not in listed(base)[0]:
        return 400, {'error': 'no such design'}
    at = agent.now()
    if kind == 'notes':
        notes = [n for n in body.get('notes', []) if isinstance(n, dict) and isinstance(n.get('id'), int)]
        if not notes:
            return 400, {'error': 'no open notes on this design'}
        new, err = duplicate(base, design)
        if not new:
            return 400, {'error': err}
        ids, numbers = [n['id'] for n in notes], {str(n['id']): n.get('n') for n in notes}
        stored = read_json(os.path.join(base, 'notes', 'notes.json'), [])
        texts = [{'n': numbers[str(x['id'])], 'text': x.get('text', '')} for x in stored if isinstance(x, dict) and x.get('id') in ids]
        RUNNER.trail_add(base, {'id': new, 'from': design, 'kind': 'notes', 'at': at, 'notes': texts, 'status': 'working'})
        prompt = agent.notes_prompt(new, design, [n.get('n') for n in notes], str(body.get('brief', ''))[:20000], TASTE.brief(name))

        def sent(run):
            RUNNER.notes_change(base, lambda ns: [n.__setitem__('sent', run['id']) for n in ns if isinstance(n, dict) and n.get('id') in ids])
        run = RUNNER.start(name, base, kind='notes', scene=new, parent=design, prompt=prompt, notes=ids, numbers=numbers,
                           label=f"{len(ids)} note{'s' if len(ids) > 1 else ''}", prepare=sent)
        return 200, {'runs': [agent.public(run)], 'scenes': [new]}
    ask = str(body.get('prompt', '')).strip()[:1000]
    if not ask:
        return 400, {'error': 'say what to try'}
    try:
        count = max(2, min(4, int(body.get('count', 3))))
    except (TypeError, ValueError):
        count = 3
    focus = str(body.get('focus', '') or '')[:300]
    group, runs, made = f'x{at}', [], []
    for k in range(count):
        new, err = duplicate(base, design)
        if not new:
            return 400, {'error': err}
        made.append(new)
        label, angle = agent.ANGLES[k]
        RUNNER.trail_add(base, {'id': new, 'from': design, 'kind': 'explore', 'at': at, 'group': group, 'prompt': ask,
                                'angle': label, 'focus': focus, 'status': 'working'})
        # the first direction leans on the designer's taste; the others know it, and their angle comes first
        prompt = agent.explore_prompt(new, design, ask, k + 1, count, angle, focus, TASTE.brief(name, lean=k == 0))
        runs.append(agent.public(RUNNER.start(name, base, kind='explore', scene=new, parent=design, prompt=prompt,
                                              group=group, angle=label, label=label)))
    return 200, {'runs': runs, 'scenes': made, 'group': group}


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
        if route == '/api/projects':
            return self.send_json(200, [summary(p) for p in projects()])
        if route == '/api/wallpapers':  # the wallpaper pictures that are there, so the page never asks for a missing one
            return self.send_json(200, [n for n in ('dark', 'light') if os.path.isfile(os.path.join(ROOT, 'wallpapers', n + '.jpg'))])
        if route == '/api/taste':
            return self.send_json(200, TASTE.view(parse_qs(urlparse(self.path).query).get('project', [''])[0], taste_stats()))
        if route in ('/api/agent', '/api/trail'):
            files = self.project_files()
            if not files:
                return self.send_json(404, {'error': 'no such project'})
            base, name = os.path.dirname(files[2]), parse_qs(urlparse(self.path).query).get('project', [''])[0]
            if route == '/api/agent':
                return self.send_json(200, {'runs': agent.runs_for(name, base)})
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

    def do_POST(self):
        if urlparse(self.path).path == '/api/capture':  # takes as long as the flow plays: outside the lock
            return self.capture()
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
            # The page says which version it last saw. If the file changed since (Claude edited it), refuse,
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
            return self.send_json(*TASTE.edit(body))
        if route in ('/api/agent', '/api/agent/stop', '/api/pick', '/api/open', '/api/page'):
            files, body = self.project_files(), self.body()
            if not files or body is None:
                return self.send_json(404, {'error': 'no such project'})
            base, name = os.path.dirname(files[2]), parse_qs(urlparse(self.path).query).get('project', [''])[0]
            if route == '/api/agent':
                return self.send_json(*agent_post(name, base, body))
            if route == '/api/agent/stop':
                return self.send_json(200, {'stopped': RUNNER.stop(str(body.get('id', '')))})
            if route == '/api/pick':
                group, pick, reason = str(body.get('group', '')), str(body.get('id', '')), str(body.get('reason', ''))[:300]
                RUNNER.trail_update(base, lambda e: e.get('group') == group,
                                    lambda e: e.update(picked=e.get('id') == pick, reason=reason if e.get('id') == pick else e.get('reason', ''), pickedAt=agent.now()))
                mine = [e for e in read_json(os.path.join(base, 'trail.json'), []) if isinstance(e, dict) and e.get('group') == group]
                chosen = next((e for e in mine if e.get('id') == pick), None)
                if chosen:  # a pick, and why, is the clearest thing the designer tells us about their taste
                    keep = lambda e: {'name': e.get('name', ''), 'angle': e.get('angle', ''), 'summary': e.get('summary', '')}
                    TASTE.learn({'kind': 'pick', 'project': name, 'id': pick, 'ask': chosen.get('prompt', ''), 'said': reason,
                                 'chosen': keep(chosen), 'others': [keep(e) for e in mine if e is not chosen and e.get('status') == 'done']})
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
                return self.send_json(409, {'error': 'Claude is working on this design. Duplicate it when it lands.'})
            new, err = duplicate(os.path.dirname(files[2]), str(body.get('id', '')))
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
TASTE = taste.Taste(os.path.join(ROOT, 'taste.json'), write_atomic, read_json)


def taste_stats():
    """Which kind of direction gets picked, over every project's trail."""
    return taste.angle_stats(read_json(os.path.join(scenes_dir(p), 'trail.json'), []) for p in projects())


def learn_from_run(run, base):
    """A notes round that landed is evidence: what the designer asked to change."""
    if run['kind'] != 'notes' or run['status'] != 'done':
        return
    entry = next((e for e in read_json(os.path.join(base, 'trail.json'), []) if isinstance(e, dict) and e.get('id') == run['scene']), {})
    notes = [n.get('text', '') for n in entry.get('notes', []) if isinstance(n, dict) and n.get('text')]
    if notes:
        TASTE.learn({'kind': 'notes', 'project': run['project'], 'id': run['scene'], 'notes': notes, 'summary': run.get('summary', '')})


RUNNER.on_done = learn_from_run


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4321
    print(f'Atelier on http://localhost:{port}  (projects: {", ".join(projects()) or "none yet"})')
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
