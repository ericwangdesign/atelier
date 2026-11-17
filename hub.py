"""The shelf: what a team shares about a project, kept as one file an agent can read and write.

A project is a folder. `project.json` in it says what the project is and lists its prototypes:

  {
    "name": "Checkout",                      shown name (default: the folder's)
    "folder": "Payments/Checkout",           the folder it sits in on the shelf (default: the folder it is in on disk)
    "context": "The problem, who it is for, what is decided.",
    "docs": [{"title": "Brief", "url": "https://..."}],
    "pieces": [{"title": "Open questions", "items": ["..."]}, {"title": "Decided", "text": "..."}],
    "comments": [],                          left for whoever adds commenting; Atelier keeps it as it is
    "versions": [
      {"id": "sam-v2", "title": "One-page checkout", "design": "Checkout", "by": "Sam", "at": 1790000000000,
       "from": "eric-v1",                    the version it was remixed from
       "note": "what changed, one line",
       "open": "http://localhost:5173",      where it runs
       "run": "npm run dev",                 how to start it
       "source": "git@host:team/app#sam/one-page",   where its code or file is
       "picture": "shots/sam-v2.png"}        in the project folder
    ]
  }

A version doesn't have to be an Atelier scene: anything with a place to open it counts. A project that has scenes/
gets a version for every scene without anyone listing them (its parent from trail.json); an entry in `versions` with a
scene's id adds to it (who made it, a note).

Folders are the shelf's own: a path like "Payments/Checkout", as deep as you like. A project says which folder it
is in; folders with nothing in them yet are listed in .atelier-shelf.json next to the projects. Moving a project or
a folder on the shelf never moves anything on disk.

Nothing here needs the server: `atelier publish`, `remix`, `shelf`, `context`, `doc`, `folder` and `move`
(bin/atelier) call this file, so an agent publishes from any terminal. Home reads it through
serve.py's /api/hub routes.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.parse import quote

FILE = 'project.json'
SHELF = '.atelier-shelf.json'
PICTURES = ('.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm')
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'


def me():
    """Who is at this computer: ATELIER_USER, or the name git signs commits with."""
    name = os.environ.get('ATELIER_USER', '').strip()
    if not name:
        try:
            name = subprocess.run(['git', 'config', 'user.name'], capture_output=True, text=True, timeout=3).stdout.strip()
        except (OSError, subprocess.SubprocessError):
            name = ''
    return name or os.environ.get('USER', 'Me')


def pretty(name):
    return re.sub(r'[-_]+', ' ', name).strip().title() or name


def slug(text):
    return re.sub(r'[^a-z0-9]+', '-', str(text).lower()).strip('-')[:40]


def read(folder):
    try:
        with open(os.path.join(folder, FILE), encoding='utf-8') as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return {}


def write(folder, data):
    os.makedirs(folder, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=folder, prefix='.' + FILE, suffix='.tmp')
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        f.write(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
    os.replace(tmp, os.path.join(folder, FILE))


def shelf(found, root):
    """Every project on the shelf: id -> (folder, group, has scenes). `found` is serve.found(): the projects with
    scenes. A folder in `root` (or one level into it) with a project.json and no scenes is a project too."""
    out = {k: (d, g, True) for k, (d, g) in found.items()}
    taken = {os.path.realpath(d) for d, _, _ in out.values()}
    if not os.path.isdir(root):
        return out
    for name in sorted(os.listdir(root)):
        top = os.path.join(root, name)
        if name.startswith('.') or not os.path.isdir(top) or os.path.islink(top):
            continue
        if os.path.isfile(os.path.join(top, FILE)) and os.path.realpath(top) not in taken:
            out.setdefault(name, (top, name, False))
        for sub in sorted(os.listdir(top)):
            folder = os.path.join(top, sub)
            if sub.startswith(('.', '_')) or sub in ('node_modules', 'scenes') or not os.path.isfile(os.path.join(folder, FILE)):
                continue
            if os.path.realpath(folder) not in taken:
                out.setdefault(f'{name}-{sub}', (folder, name, False))
    return out


def clean(path):
    """A folder path as the shelf keeps it: 'A/B', no empty or dotted parts."""
    parts = [re.sub(r'\s+', ' ', x).strip() for x in str(path or '').split('/')]
    return '/'.join(x for x in parts if x and x not in ('.', '..'))[:200]


def places(all_):
    """Where every project sits: id -> folder path ('' is the top). project.json's folder says; without one, a project
    inside a folder on disk sits in a folder of that name, and so does the project that folder itself is."""
    nested = {g for pid, (d, g, s) in all_.items() if pid != g}
    out = {}
    for pid, (d, g, s) in all_.items():
        data = read(d)
        if 'folder' in data:
            out[pid] = clean(data['folder'])
        else:
            out[pid] = clean(data.get('team') or (pretty(g) if pid != g or g in nested else ''))
    return out


def folders(root, all_):
    """Every folder on the shelf, parents included, in order."""
    try:
        with open(os.path.join(root, SHELF), encoding='utf-8') as f:
            kept = [clean(x) for x in json.load(f).get('folders', [])]
    except (OSError, json.JSONDecodeError, UnicodeDecodeError, AttributeError):
        kept = []
    out = set()
    for path in kept + list(places(all_).values()):
        parts = path.split('/') if path else []
        out.update('/'.join(parts[:i + 1]) for i in range(len(parts)))
    return sorted(out, key=str.lower)


def _keep(root, paths):
    fd, tmp = tempfile.mkstemp(dir=root, prefix=SHELF, suffix='.tmp')
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        f.write(json.dumps({'folders': sorted(set(paths), key=str.lower)}, indent=2, ensure_ascii=False) + '\n')
    os.replace(tmp, os.path.join(root, SHELF))


def folder_make(root, all_, path):
    path = clean(path)
    if not path:
        raise ValueError('give the folder a name')
    _keep(root, folders(root, all_) + [path])
    return path


def folder_move(root, all_, path, to):
    """Rename a folder or move it into another: everything in it comes along."""
    path, to = clean(path), clean(to)
    known = folders(root, all_)
    if path not in known or not to:
        raise ValueError('no such folder' if path not in known else 'give the folder a name')
    if to == path:
        return to
    if (to + '/').startswith(path + '/'):
        raise ValueError("a folder can't go inside itself")
    if to in known:
        raise ValueError(f'there is already a folder {to}')
    swap = lambda x: to + x[len(path):] if x == path or x.startswith(path + '/') else x
    for pid, place in places(all_).items():
        if swap(place) != place:
            change(all_[pid][0], {'folder': swap(place)})
    _keep(root, [swap(x) for x in known])
    return to


def folder_remove(root, all_, path):
    """Take an empty folder off the shelf."""
    path = clean(path)
    known = folders(root, all_)
    if any(x.startswith(path + '/') for x in known) or path in places(all_).values():
        raise ValueError('move what is in it out first')
    _keep(root, [x for x in known if x != path])


def scene_versions(pid, folder):
    """A version for every scene the project lists, read from the files: title, version, when it changed, and the
    version it came from (trail.json)."""
    base = os.path.join(folder, 'scenes')
    try:
        with open(os.path.join(base, 'index.js'), encoding='utf-8') as f:
            listed = re.search(r'scenes\(\s*\[(.*?)\]', f.read(), re.S)
    except OSError:
        return []
    names = re.findall(r'[\'"]([^\'"]+)[\'"]', listed.group(1)) if listed else []
    try:
        with open(os.path.join(base, 'trail.json'), encoding='utf-8') as f:
            trail = {t.get('id'): t for t in json.load(f) if isinstance(t, dict)}
    except (OSError, json.JSONDecodeError, UnicodeDecodeError, TypeError):
        trail = {}
    out = []
    for n in names:
        path = os.path.join(base, n + '.js')
        try:
            with open(path, encoding='utf-8') as f:
                text = f.read()
            at = os.stat(path).st_mtime_ns // 1_000_000
        except OSError:
            continue
        # the key bare (title: '…') or quoted, as a scene written out as JSON has it ("title": "…")
        find = lambda key: (re.search(r'\b' + key + r'[\'"]?:\s*([\'"])(.*?)(?<!\\)\1', text) or [None, None, ''])[2]
        stem = re.match(r'(.+?)-(v\d+[\w.-]*)$', n)  # a scene with no title: pack-v3 is iteration v3 of "pack"
        t = trail.get(n, {})
        name = find('title') or (stem.group(1) if stem else n)
        out.append({'id': n, 'title': name, 'label': find('version') or (stem.group(2) if stem else ''), 'design': name,
                    'by': '', 'at': at, 'from': t.get('from') if t.get('from') in names else None,
                    'note': t.get('summary') or '', 'open': f'stage.html?project={quote(pid)}&design={quote(n)}', 'run': '',
                    'source': os.path.join(base, n + '.js'), 'picture': '', 'scene': True})
    return out


def versions(pid, folder, scenes=True):
    """Every version of the project: its scenes, then what project.json lists. An entry with a scene's id adds to it."""
    data = read(folder)
    out = scene_versions(pid, folder) if scenes else []
    by_id = {v['id']: v for v in out}
    for v in data.get('versions', []):
        if not isinstance(v, dict) or not v.get('id'):
            continue
        v = {k: v[k] for k in ('id', 'title', 'label', 'design', 'by', 'at', 'from', 'note', 'open', 'run', 'source', 'picture') if v.get(k)}
        if v['id'] in by_id:
            by_id[v['id']].update({k: x for k, x in v.items() if k not in ('open', 'source')})
            continue
        full = {'id': v['id'], 'title': v['id'], 'label': '', 'design': '', 'by': '', 'at': 0, 'from': None, 'note': '',
                'open': '', 'run': '', 'source': '', 'picture': '', 'scene': False, **v}
        out.append(full)
        by_id[full['id']] = full
    owner = data.get('by') or ''
    for v in out:
        v['by'] = v['by'] or owner  # a project one person made says so once
        if v['from'] not in by_id:
            v['from'] = None
        if not v['design']:  # a remix belongs to the design it came from
            root, seen = v, set()
            while root['from'] and root['id'] not in seen:
                seen.add(root['id'])
                root = by_id[root['from']]
            v['design'] = root['design'] or root['title']
    return out


def card(pid, folder, group, scenes, place=''):
    """A project, for the menu and home: its name, the folder it sits in, and counts."""
    data, vs = read(folder), versions(pid, folder, scenes)
    name = data.get('name') or (pretty(pid) if pid == group else pretty(pid[len(group) + 1:]).capitalize())
    newest = max([v['at'] for v in vs] + [0])
    try:
        newest = max(newest, os.stat(os.path.join(folder, FILE)).st_mtime_ns // 1_000_000)
    except OSError:
        pass
    return {'id': pid, 'name': name, 'folder': place,
            'context': data.get('context') or '', 'docs': len(data.get('docs') or []), 'versions': len(vs),
            'designs': len({v['design'] for v in vs}), 'people': sorted({v['by'] for v in vs if v['by']}),
            'hasScenes': scenes, 'updated': newest,
            'picture': next((v['picture'] for v in reversed(vs) if v['picture']), '')}


def stack(folder, scenes=True):
    """How the project is coded, in a few words, read from what is in its folder. "stack" in project.json wins."""
    said = read(folder).get('stack')
    if isinstance(said, str) and said.strip():
        return said.strip()
    try:
        names = set(os.listdir(folder))
    except OSError:
        names = set()
    out = []
    if any(n.endswith(('.xcodeproj', '.xcworkspace')) for n in names) or 'Package.swift' in names:
        out.append('Swift')
    if 'package.json' in names:
        try:
            pkg = json.load(open(os.path.join(folder, 'package.json')))
            deps = {**(pkg.get('dependencies') or {}), **(pkg.get('devDependencies') or {})}
        except (OSError, ValueError):
            deps = {}
        for dep, name in (('next', 'Next.js'), ('react', 'React'), ('vue', 'Vue'), ('svelte', 'Svelte'), ('expo', 'Expo'), ('typescript', 'TypeScript'), ('tailwindcss', 'Tailwind')):
            if dep in deps and not (name == 'React' and 'Next.js' in out):
                out.append(name)
        if not deps or not out:
            out.append('JavaScript')
    if names & {'pyproject.toml', 'requirements.txt'}:
        out.append('Python')
    if not out and any(n.endswith('.html') for n in names):
        out.append('HTML, CSS, JavaScript')
    if scenes and os.path.isdir(os.path.join(folder, 'scenes')):
        out.append('Atelier scenes (HTML, CSS, JavaScript)' if not out else 'Atelier scenes')
    return ', '.join(out)


def detail(pid, folder, group, scenes, place=''):
    data = read(folder)
    return {**card(pid, folder, group, scenes, place), 'docs': [d for d in data.get('docs') or [] if isinstance(d, dict) and d.get('url')],
            'pieces': [p for p in data.get('pieces') or [] if isinstance(p, dict) and p.get('title')],
            'versions': versions(pid, folder, scenes), 'dir': folder, 'stack': stack(folder, scenes), 'me': me()}


def change(folder, fields):
    """Set the project's own words: name, folder, context, docs, pieces, by. Everything else in the file stays."""
    data = read(folder)
    for k in ('name', 'context', 'by'):
        if k in fields:
            data[k] = str(fields[k]).strip()
    if 'folder' in fields:
        data['folder'] = clean(fields['folder'])
        data.pop('team', None)  # what a folder was called before there were folders
    for k in ('docs', 'pieces'):
        if isinstance(fields.get(k), list):
            data[k] = [x for x in fields[k] if isinstance(x, dict)]
    write(folder, data)
    return data


def shoot(url, path):
    """A picture of a page that's running, taken in a hidden Chrome. False when there's no Chrome or nothing answers."""
    if not os.path.isfile(CHROME):
        return False
    try:
        subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1440,900',
                        '--virtual-time-budget=4000', f'--screenshot={path}', url], capture_output=True, timeout=30)
    except (OSError, subprocess.SubprocessError):
        return False
    return os.path.isfile(path) and os.path.getsize(path) > 2000


def publish(pid, folder, v, scenes=True):
    """Add a version, or change the one with this id. Returns it. A picture is copied into the project's shots/; with
    none given and a page that's running, one is taken."""
    data = read(folder)
    known = {x['id'] for x in versions(pid, folder, scenes)}
    vid = slug(v.get('id') or '') if v.get('id') not in known else v['id']
    if not vid:
        stem, n = slug(f"{v.get('by') or me()}-{v.get('title') or 'version'}"), 1
        vid = stem
        while vid in known:
            n += 1
            vid = f'{stem}-{n}'
    entry = next((x for x in data.get('versions', []) if isinstance(x, dict) and x.get('id') == vid), None)
    if entry is None:
        entry = {'id': vid, 'at': int(time.time() * 1000)}
        data.setdefault('versions', []).append(entry)
    is_scene = vid in {x['id'] for x in scene_versions(pid, folder)} if scenes else False
    entry.setdefault('by', v.get('by') or me())
    for k in ('title', 'label', 'design', 'by', 'from', 'note', 'open', 'run', 'source'):
        if v.get(k):
            entry[k] = str(v[k]).strip()
    if entry.get('from') and entry['from'] not in known:
        raise ValueError(f"no version {entry['from']} in {pid} to come from (it has: {', '.join(sorted(known)) or 'none yet'})")
    picture = v.get('picture')
    if picture:
        if not os.path.isfile(picture) or not picture.lower().endswith(PICTURES):
            raise ValueError(f'{picture} is not a picture or clip ({", ".join(PICTURES)})')
        os.makedirs(os.path.join(folder, 'shots'), exist_ok=True)
        name = vid + os.path.splitext(picture)[1].lower()
        shutil.copy(picture, os.path.join(folder, 'shots', name))
        entry['picture'] = 'shots/' + name
    elif not is_scene and not entry.get('picture') and str(entry.get('open', '')).startswith(('http://', 'https://')):
        os.makedirs(os.path.join(folder, 'shots'), exist_ok=True)
        if shoot(entry['open'], os.path.join(folder, 'shots', vid + '.png')):
            entry['picture'] = f'shots/{vid}.png'
    write(folder, data)
    return next(x for x in versions(pid, folder, scenes) if x['id'] == vid)


def brief(pid, folder, group, scenes, vid, place=''):
    """What an agent needs to remix one version on someone's own computer, and how to put the result back."""
    d = detail(pid, folder, group, scenes, place)
    v = next((x for x in d['versions'] if x['id'] == vid), None)
    if not v:
        return None
    name = ' '.join(x for x in (v['title'], v['label']) if x)
    lines = [f'Remix "{name}"' + (f" by {v['by']}" if v['by'] else '') + f", from the project {d['name']}" + (f" ({d['folder']})" if d['folder'] else '') + '.', '']
    if d['context']:
        lines += ['Context', d['context'], '']
    if d['docs']:
        lines += ['Docs'] + [f"- {x.get('title') or x['url']}: {x['url']}" for x in d['docs']] + ['']
    lines += ['This version']
    if v['note']:
        lines.append(f"- What it is: {v['note']}")
    if v['scene']:
        lines += [f"- It is an Atelier scene: {v['source']}",
                  f"- Open: http://localhost:4321/{v['open']}", '',
                  'What to do',
                  '1. Copy the scene file as the next version in the same folder and list it in index.js (AGENTS.md in the atelier folder says how). Never change the original.',
                  '2. Make my changes on the copy with me.',
                  f'3. When I say publish, run: atelier publish "{pid}" --id <the new scene id> --from {v["id"]} --note "what changed, one line"']
    else:
        for label, key in (('Open', 'open'), ('Run', 'run'), ('Source', 'source')):
            if v[key]:
                lines.append(f'- {label}: {v[key]}')
        lines += ['', 'What to do',
                  '1. Get the source running on my computer, as a copy (a new folder or branch). Never change the original.',
                  '2. Make my changes with me.',
                  f'3. When I say publish, run: atelier publish "{pid}" --title "<a name for my take>" --from {v["id"]} '
                  '--open <where mine runs> --run "<how to start it>" --source <where its code is> --note "what changed, one line"',
                  '   Add --picture <file> for a screenshot or clip; without it Atelier takes one from --open.']
    return '\n'.join(lines) + '\n'


# ---- the commands (bin/atelier): publish, remix, shelf, context, doc ----

def _args(argv):
    """['a', '--from', 'b', 'c'] -> (['a', 'c'], {'from': 'b'})"""
    plain, named, i = [], {}, 0
    while i < len(argv):
        if argv[i].startswith('--') and i + 1 < len(argv):
            named[argv[i][2:]] = argv[i + 1]
            i += 2
        else:
            plain.append(argv[i])
            i += 1
    return plain, named


def _find(all_, word):
    """The project a word names: its id, or the only one whose id or name has the word in it."""
    if word in all_:
        return word
    hits = [k for k, (d, g, s) in all_.items() if word.lower() in k.lower() or word.lower() == (read(d).get('name') or '').lower()]
    return hits[0] if len(hits) == 1 else None


def main(argv):
    import serve
    cmd, (plain, named) = (argv[0] if argv else 'shelf'), _args(argv[1:])
    all_ = shelf(serve.found(), serve.PROJECTS)
    where = places(all_)
    if cmd == 'shelf':
        for pid in sorted(all_, key=lambda k: (where[k].lower(), k.lower())):
            c = card(pid, *all_[pid], where[pid])
            print(f"{pid}  ·  {c['name']}" + (f"  ·  in {c['folder']}" if c['folder'] else '') + f"  ·  {c['versions']} version{'' if c['versions'] == 1 else 's'}")
            if plain and pid == _find(all_, plain[0]):
                for v in versions(pid, all_[pid][0], all_[pid][2]):
                    print(f"    {v['id']}  {v['title']} {v['label']}".rstrip() + (f"  by {v['by']}" if v['by'] else '') + (f"  from {v['from']}" if v['from'] else ''))
        return 0
    if cmd == 'folder':
        try:
            print('Folder ' + folder_make(serve.PROJECTS, all_, ' '.join(plain)) + ' is on the shelf.')
            return 0
        except ValueError as e:
            print(e)
            return 1
    if not plain:
        print('Name the project: atelier ' + cmd + ' <project> …  (atelier shelf lists them)')
        return 1
    pid = _find(all_, plain[0])
    if cmd == 'publish' and not pid:  # a project nobody has made yet: a folder with just its project.json
        pid = slug(plain[0])
        folder = os.path.join(serve.PROJECTS, pid)
        write(folder, {'name': named.get('name') or pretty(pid), 'folder': clean(named.get('folder', ''))})
        all_ = shelf(serve.found(), serve.PROJECTS)
        pid = next(k for k, (d, g, s) in all_.items() if os.path.realpath(d) == os.path.realpath(folder))
        print(f'New project {pid} in {folder}')
    if not pid:
        print(f'No project "{plain[0]}". atelier shelf lists them.')
        return 1
    folder, group, scenes = all_[pid]
    try:
        if cmd == 'publish':
            v = publish(pid, folder, named, scenes)
            print(f"Published {v['id']} to {pid}" + (f", from {v['from']}" if v['from'] else '') + (', with a picture' if v['picture'] else '') + '.')
            print(f'See it: http://localhost:{serve.PORT}/#/p/{pid}')
        elif cmd == 'remix':
            if len(plain) < 2:
                print('Name the version: atelier remix <project> <version>  (atelier shelf <project> lists them)')
                return 1
            text = brief(pid, folder, group, scenes, plain[1], where.get(pid, ''))
            print(text if text else f'No version {plain[1]} in {pid}.')
            return 0 if text else 1
        elif cmd == 'move':
            change(folder, {'folder': ' '.join(plain[1:])})
            print(f"{pid} is in {clean(' '.join(plain[1:])) or 'the top of the shelf'} now.")
        elif cmd == 'context':
            change(folder, {'context': ' '.join(plain[1:])})
            print(f'Context set on {pid}.')
        elif cmd == 'doc':
            if len(plain) < 3:
                print('atelier doc <project> "<title>" <link>')
                return 1
            docs = [d for d in read(folder).get('docs', []) if isinstance(d, dict) and d.get('url') != plain[2]]
            change(folder, {'docs': docs + [{'title': plain[1], 'url': plain[2]}]})
            print(f'Doc added to {pid}.')
        else:
            print('atelier publish | remix | shelf | context | doc | folder | move')
            return 1
    except ValueError as e:
        print(e)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
