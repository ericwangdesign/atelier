"""Notes on Atelier itself: ⌥N anywhere in the tool pins a note for Claude, in the same place and shape as the vault's
(vault/fixes/<id>.json, one file per note, written by the vault reader's fixes.js too). The layer that draws them is the
vault reader's notes-layer.js, served here as it is, so there is one copy. Claude fixes the thing in this folder and
sets status 'done' with a one-line reply; the pin shows the reply until it's cleared.

Both paths can be moved with ATELIER_VAULT and ATELIER_NOTES_LAYER. Without the vault (the public copy), the routes
answer 404 and the stage simply has no ⌥N."""
import datetime
import json
import os
import random
import re
import string
import time

HOME = os.path.expanduser('~')
VAULT = os.environ.get('ATELIER_VAULT') or os.path.join(HOME, 'Documents', 'Projects', 'vault')
DIR = os.path.join(VAULT, 'fixes')
LAYER = os.environ.get('ATELIER_NOTES_LAYER') or os.path.join(HOME, 'Documents', 'Projects', 'Side Projects', 'vault-reader', 'notes-layer.js')
ID = re.compile(r'^f[\w-]{4,40}$')


def ready():
    return os.path.isdir(VAULT) and os.path.isfile(LAYER)


def _file(fid):
    if not ID.match(fid or ''):
        raise ValueError('bad id')
    return os.path.join(DIR, fid + '.json')


def _read(path):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _write(n):
    os.makedirs(DIR, exist_ok=True)
    tmp = _file(n['id']) + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(n, f, indent=2, ensure_ascii=False)
        f.write('\n')
    os.replace(tmp, _file(n['id']))


def _now():
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')


def listing(path=''):
    if not os.path.isdir(DIR):
        return []
    out = [_read(os.path.join(DIR, f)) for f in os.listdir(DIR) if f.endswith('.json')]
    return sorted((n for n in out if n and (not path or n.get('path') == path)), key=lambda n: n.get('at', ''))


def _num(v):
    try:
        return round(float(v))
    except (TypeError, ValueError):
        return 0


def _frac(v):
    try:
        return round(float(v), 3)
    except (TypeError, ValueError):
        return 0


def add(b):
    text = str(b.get('text') or '').strip()[:4000]
    if not text:
        raise ValueError('a note needs words')
    fid = 'f' + _b36(int(time.time() * 1000)) + ''.join(random.choices(string.ascii_lowercase + string.digits, k=4))
    p, bx, el, v = b.get('point'), b.get('box'), b.get('el'), b.get('view')
    n = {
        'id': fid, 'at': _now(), 'about': str(b.get('about') or 'atelier')[:80],
        'url': str(b.get('url') or '')[:800], 'path': str(b.get('path') or '/')[:600], 'title': str(b.get('title') or '')[:200],
        'text': text, 'kind': 'area' if b.get('kind') == 'area' else 'pin',
        'point': {'x': _num(p.get('x')), 'y': _num(p.get('y'))} if isinstance(p, dict) else None,
        'box': {k: _num(bx.get(k)) for k in ('x', 'y', 'w', 'h')} if isinstance(bx, dict) else None,
        'el': {'sel': str(el.get('sel') or '')[:600], 'tag': str(el.get('tag') or '')[:40], 'text': str(el.get('text') or '')[:160],
               'rx': _frac(el.get('rx')), 'ry': _frac(el.get('ry'))} if isinstance(el, dict) else None,
        'view': {'w': _num(v.get('w')), 'h': _num(v.get('h')), 'theme': str(v.get('theme') or '')[:10],
                 'sx': _num(v.get('sx')), 'sy': _num(v.get('sy'))} if isinstance(v, dict) else None,
        'status': 'open', 'reply': '', 'doneAt': '',
    }
    _write(n)
    return n


def patch(fid, b):
    n = _read(_file(fid))
    if not n:
        raise KeyError('no such note')
    if isinstance(b.get('text'), str) and b['text'].strip():
        n['text'] = b['text'].strip()[:4000]
    if b.get('status') in ('open', 'done'):
        n['status'] = b['status']
        n['doneAt'] = _now() if b['status'] == 'done' else ''
    if isinstance(b.get('reply'), str):
        n['reply'] = b['reply'][:600]
    _write(n)
    return n


def remove(fid):
    path = _file(fid)
    if os.path.isfile(path):
        os.remove(path)
    return {'ok': True}


def _b36(n):
    digits = string.digits + string.ascii_lowercase
    s = ''
    while n:
        n, r = divmod(n, 36)
        s = digits[r] + s
    return s or '0'
