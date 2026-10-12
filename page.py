"""A version's before and after, as a page to send to someone who isn't a designer, for serve.py.

The stage exports both designs as PNGs first (the same export as Prototype › Export), then posts here. This writes
two files into <project>/exports/, next to the pictures:

    <version>.html          one page: the change, the notes that asked for it, flip or slide between the two
    <version>.canvas.json   the same before and after as a Writing canvas beforeAfter block, to drop into a canvas page
"""
import html
import json
import os
import re


def esc(s):
    return html.escape(str(s or ''), quote=True)


def write_page(write_atomic, name, base, body):
    folder = os.path.join(os.path.dirname(base), 'exports')
    vid = re.sub(r'[^a-z0-9-]+', '-', str(body.get('id', '')).lower()).strip('-')[:60]
    before, after = os.path.basename(str(body.get('before', ''))), os.path.basename(str(body.get('after', '')))
    if not vid or not before or not after:
        return 400, {'error': 'send {"id", "before", "after"}: the version and its two pictures'}
    if not os.path.isfile(os.path.join(folder, before)) or not os.path.isfile(os.path.join(folder, after)):
        return 400, {'error': 'export the two pictures first'}
    title = str(body.get('title') or 'What changed')[:120]
    sub = str(body.get('summary') or '')[:300]
    why = str(body.get('reason') or '')[:300]
    labels = body.get('labels') if isinstance(body.get('labels'), list) else ['Before', 'After']
    pins = [p for p in body.get('pins', []) if isinstance(p, dict)][:12]
    clean = [{'n': int(p.get('n') or k + 1), 'x': max(0, min(100, float(p.get('x', 0)))), 'y': max(0, min(100, float(p.get('y', 0)))),
              'text': str(p.get('text', ''))[:240], 'reply': str(p.get('reply', ''))[:240]} for k, p in enumerate(pins)]

    spec = {'type': 'beforeAfter', 'title': title,
            'before': {'label': labels[0], 'src': before, 'alt': labels[0],
                       'pins': [{'x': p['x'], 'y': p['y'], 'text': p['text']} for p in clean]},
            'after': {'label': labels[1] if len(labels) > 1 else 'After', 'src': after, 'alt': 'After',
                      'pins': [{'x': p['x'], 'y': p['y'], 'text': p['reply'] or p['text']} for p in clean]},
            'caption': why or sub, 'start': 'after', 'wide': True}
    write_atomic(os.path.join(folder, f'{vid}.canvas.json'), json.dumps(spec, indent=2, ensure_ascii=False) + '\n')

    pin_html = ''.join(f'<i class="pin" style="left:{p["x"]}%;top:{p["y"]}%">{p["n"]}</i>' for p in clean)
    reply = lambda p: '<p class="r">' + esc(p['reply']) + '</p>' if p['reply'] else ''
    rows = ''.join(f'<li><b>{p["n"]}</b><div><p>{esc(p["text"])}</p>{reply(p)}</div></li>' for p in clean)
    page = TEMPLATE.format(title=esc(title), sub=esc(sub), why=f'<p class="why">{esc(why)}</p>' if why else '',
                           before=esc(before), after=esc(after), l0=esc(labels[0]), l1=esc(labels[1] if len(labels) > 1 else 'After'),
                           pins=pin_html, rows=f'<ol class="notes">{rows}</ol>' if rows else '', project=esc(name))
    write_atomic(os.path.join(folder, f'{vid}.html'), page)
    return 200, {'url': f'/x/{name}/{vid}.html', 'canvas': f'/x/{name}/{vid}.canvas.json'}


TEMPLATE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>
:root {{ --bg: #f2f2f2; --card: #fff; --fg: #141414; --sub: #5e5e5e; --line: rgb(0 0 0 / .08); --pin: #0069d1; --pinfg: #fff; color-scheme: light; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg: #0d0d0d; --card: #181818; --fg: #f2f2f2; --sub: #9a9a9a; --line: rgb(255 255 255 / .08); --pin: #4da6ff; --pinfg: #05070d; color-scheme: dark; }} }}
* {{ box-sizing: border-box; }}
body {{ margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.55 Geist, "Inter", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }}
main {{ max-width: 1120px; margin: 0 auto; padding: 56px 16px 80px; }}
h1 {{ margin: 0; font-size: 28px; line-height: 1.2; font-weight: 600; letter-spacing: -.02em; max-width: 720px; }}
.sub {{ margin: 8px 0 0; color: var(--sub); max-width: 640px; }}
.why {{ margin: 16px 0 0; padding: 12px 16px; border-radius: 12px; background: var(--card); max-width: 640px; }}
.why::before {{ content: "Why this one"; display: block; color: var(--sub); font-size: 12px; }}
.bar {{ display: flex; gap: 4px; margin: 32px 0 12px; padding: 3px; width: max-content; border-radius: 999px; background: var(--card); }}
.bar button {{ height: 30px; padding: 0 14px; border: 0; border-radius: 999px; background: none; color: var(--sub); font: inherit; font-size: 13px; cursor: pointer; }}
.bar button[aria-pressed="true"] {{ background: var(--bg); color: var(--fg); }}
.stage {{ position: relative; border-radius: 16px; overflow: hidden; background: var(--card); box-shadow: 0 0 0 1px var(--line); user-select: none; touch-action: pan-y; }}
.stage img {{ display: block; width: 100%; height: auto; }}
.stage .b {{ position: absolute; inset: 0; transition: opacity .35s cubic-bezier(.23, 1, .32, 1); }}
.stage .b img {{ height: 100%; object-fit: cover; object-position: top left; }}
.stage[data-show="before"] .b {{ opacity: 0; }}
.stage[data-mode="slide"] .b {{ opacity: 1; clip-path: inset(0 0 0 var(--split, 50%)); transition: none; }}
.split {{ display: none; position: absolute; top: 0; bottom: 0; left: var(--split, 50%); width: 2px; margin-left: -1px; background: #fff; box-shadow: 0 0 8px rgb(0 0 0 / .4); cursor: ew-resize; }}
.stage[data-mode="slide"] .split {{ display: block; }}
.tag {{ position: absolute; top: 12px; height: 24px; padding: 0 10px; border-radius: 999px; background: rgb(20 20 24 / .72); color: #fff; font-size: 12px; line-height: 24px; backdrop-filter: blur(12px); }}
.tag.l {{ left: 12px; }} .tag.r {{ right: 12px; }}
.stage[data-mode="flip"][data-show="after"] .tag.l, .stage[data-mode="flip"][data-show="before"] .tag.r {{ display: none; }}
.stage[data-mode="flip"] .tag.r {{ left: 12px; right: auto; }}
.pin {{ position: absolute; translate: -50% -50%; min-width: 24px; height: 24px; padding: 0 6px; border-radius: 999px; background: var(--pin); color: var(--pinfg); font: 600 12px/24px system-ui; font-style: normal; text-align: center; box-shadow: 0 2px 8px rgb(0 0 0 / .3); }}
.notes {{ list-style: none; margin: 24px 0 0; padding: 0; display: grid; gap: 12px; max-width: 720px; }}
.notes li {{ display: flex; gap: 12px; }}
.notes b {{ flex: none; width: 24px; height: 24px; border-radius: 50%; background: var(--pin); color: var(--pinfg); font-size: 12px; line-height: 24px; text-align: center; }}
.notes p {{ margin: 0; }} .notes .r {{ color: var(--sub); }}
.notes .r::before {{ content: "→ "; }}
.hint {{ margin: 8px 0 0; color: var(--sub); font-size: 13px; }}
footer {{ margin-top: 48px; color: var(--sub); font-size: 12px; }}
@media (prefers-reduced-motion: reduce) {{ .stage .b {{ transition: none; }} }}
</style></head>
<body><main>
<h1>{title}</h1>
<p class="sub">{sub}</p>
{why}
<div class="bar" role="group" aria-label="View"><button data-m="flip" aria-pressed="true">Flip</button><button data-m="slide" aria-pressed="false">Slide</button></div>
<div class="stage" id="st" data-mode="flip" data-show="after">
  <img src="{before}" alt="{l0}">
  <div class="b"><img src="{after}" alt="{l1}"></div>
  {pins}
  <span class="tag l">{l0}</span><span class="tag r">{l1}</span><i class="split"></i>
</div>
<p class="hint" id="hint">Tap the picture to flip between {l0} and {l1}.</p>
{rows}
<footer>Made in Atelier · {project}</footer>
</main>
<script>
const st = document.getElementById('st'), hint = document.getElementById('hint');
document.querySelectorAll('.bar button').forEach(b => b.onclick = () => {{
  st.dataset.mode = b.dataset.m; document.querySelectorAll('.bar button').forEach(x => x.setAttribute('aria-pressed', x === b));
  hint.textContent = b.dataset.m === 'flip' ? 'Tap the picture to flip between {l0} and {l1}.' : 'Drag across the picture to move the split.';
}});
st.addEventListener('click', () => {{ if (st.dataset.mode === 'flip') st.dataset.show = st.dataset.show === 'after' ? 'before' : 'after'; }});
st.addEventListener('pointermove', e => {{ if (st.dataset.mode !== 'slide' || (e.pointerType !== 'mouse' && !e.buttons)) return;
  const r = st.getBoundingClientRect(); st.style.setProperty('--split', Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100)) + '%'); }});
</script>
</body></html>
"""
