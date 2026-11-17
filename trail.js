/* History on the stage. Loaded after the stage's own script, so it shares its names (S, SCENES, screens, apply,
   sceneById...). Atelier has no agent of its own: notes leave as a brief (Copy brief), and a session outside saves
   the next version and adds a line to scenes/trail.json (AGENTS.md says how).

   History                  why each version exists: its parent and the notes behind it. Compare shows the before
                            and after; Share writes it as a page for people who aren't designers.
   A version that arrives   a new entry in trail.json whose scene file isn't loaded yet is loaded and put on screen
                            beside the version it came from, without a refresh.

   Nothing here runs without serve.py, and none of it runs while the page is being exported. */
window.Trail = (() => {
  if (!PROJECT || CAPTURE) return { paint() {}, info() { return null; } };
  const API = (path, body) => fetch(`/api/${path}?project=${encodeURIComponent(PROJECT)}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
    .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Something went wrong'); return d; });
  const ver = id => { const sc = sceneById(id); return sc ? sc.version || sc.title : id; };
  let trail = [], timer = 0, first = true;
  const tried = new Set(); // entries whose file wasn't there (or didn't run) when we looked: not asked for again

  /* ---------- a toast that says what happened, then goes ---------- */
  let toastTimer = 0;
  function say(text, ms = 2600) {
    const t = $('toast'); t.textContent = text; t.hidden = false; clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { if (focus && !noting && !cutting) return focusLabel(); t.textContent = 'Click a screen to pin a note'; t.hidden = !noting && !cutting; }, ms);
  }

  /* ---------- a scene file that arrives while the page is open ----------
     It runs with a fresh address and pushes itself onto SCENES; it goes after the last of its family. A file that
     doesn't run yet (it is mid-edit) is skipped. */
  const loadFile = (id, v) => new Promise(done => {
    const s = document.createElement('script'); s.src = `${SCENE_BASE}${encodeURIComponent(id)}.js?v=${v}`;
    s.onload = s.onerror = () => { s.remove(); done(); }; document.head.append(s);
  });
  async function load(id) {
    const n = SCENES.length;
    await loadFile(id, Date.now());
    const fresh = SCENES.length > n ? SCENES.splice(n).filter(x => x.id === id).pop() : null;
    if (!fresh) return false;
    fresh.file = id;
    const fam = SCENES.map((x, k) => [x, k]).filter(([x]) => x.title === fresh.title).pop();
    SCENES.splice(fam ? fam[1] + 1 : SCENES.length, 0, fresh);
    vcache.clear();
    return true;
  }

  async function poll() {
    clearTimeout(timer);
    try {
      const got = (await API('trail')).trail || [];
      if (JSON.stringify(got) !== JSON.stringify(trail)) {
        trail = got;
        const fresh = first ? [] : trail.filter(e => e.id && !sceneById(e.id) && !tried.has(e.id));
        let shown = null;
        for (const e of fresh) { tried.add(e.id); if (await load(e.id)) shown = e; }
        if (shown) {
          S.shown = [shown.from, shown.id].filter(id => sceneById(id)); S.view = 'side'; S.rows = 'none'; S.cols = 'shown'; S.zoom = 0; S.pos = {};
          say(`${ver(shown.id)} is ready`); apply();
        }
        renderDesigns(); paint();
      }
    } catch {}
    first = false;
    timer = setTimeout(poll, document.hidden ? 15000 : 3000);
  }

  /* History: newest first. A round of notes is one entry. Takes and explorations from when Atelier ran agents show
     as one entry with a chip per version. */
  function paint() {
    const items = [], groups = new Map();
    trail.forEach(e => { if (!e.group) items.push({ at: e.at, e }); else { if (!groups.has(e.group)) { const g = { at: e.at, group: e.group, list: [] }; groups.set(e.group, g); items.push(g); } groups.get(e.group).list.push(e); } });
    const html = items.sort((a, b) => b.at - a.at).slice(0, 20).map(it => {
      if (it.e) {
        const e = it.e, notes = (e.notes || []).map(n => esc(n.text)).join(' · ');
        return `<li><span class="tt">${esc(ver(e.id))} <span class="from">from ${esc(ver(e.from))}</span></span>`
          + `<span class="nm">${notes ? `Notes: ${notes}` : ''}</span>${e.summary ? `<span class="ts">${esc(e.summary)}</span>` : ''}`
          + `<span class="tacts"><button class="link" data-cmp="${esc(e.from)}|${esc(e.id)}">Compare</button>${e.status === 'done' ? `<button class="link" data-share="${esc(e.id)}">Share</button>` : ''}</span></li>`;
      }
      const g = it, win = g.list.find(e => e.picked), from = g.list[0].from;
      const head = g.list[0].kind === 'try' ? `Note ${esc(g.list[0].note || '')}, ${g.list.length} takes` : 'Explored';
      return `<li><span class="tt">${head} <span class="from">from ${esc(ver(from))}</span></span><span class="ts">“${esc(g.list[0].prompt)}”</span>`
        + `<span class="chips">${g.list.map(e => `<button class="chip${e.picked ? ' on' : win ? ' lost' : ''}" data-cmp="${esc(from)}|${esc(e.id)}" title="${esc(e.summary || '')}">${esc(e.name || e.angle)}</button>`).join('')}</span>`
        + (win && win.reason ? `<span class="nm">Why: ${esc(win.reason)}</span>` : '')
        + `<span class="tacts"><button class="link" data-cmp="${esc(from)}|${g.list.map(e => esc(e.id)).join('|')}">Compare all</button>${win ? `<button class="link" data-share="${esc(win.id)}">Share</button>` : ''}</span></li>`;
    }).join('');
    if ($('traillist').dataset.h !== html) { $('traillist').innerHTML = html; $('traillist').dataset.h = html; }
    $('trailempty').hidden = !!items.length; $('traillist').hidden = !items.length;
  }
  $('traillist').onclick = e => {
    const c = e.target.closest('[data-cmp]');
    if (c) { S.shown = c.dataset.cmp.split('|').filter(id => sceneById(id)).slice(0, MAX); S.view = 'side'; S.rows = 'none'; S.cols = 'shown'; S.zoom = 0; S.pos = {}; return apply(); }
    const sh = e.target.closest('[data-share]'); if (sh) share(sh.dataset.share, sh);
  };

  /* Share: both designs as pictures (the same export as Prototype › Export), then a page with the change, the notes
     that asked for it and the replies, written into exports/ next to them, plus a Writing canvas block. */
  async function share(id, btn) {
    const e = trail.find(x => x.id === id); if (!e || !sceneById(e.from) || !sceneById(id)) return say('Both versions need to be here to share');
    UI.say(btn, 'Making…');
    const keep = { shown: S.shown, view: S.view, rows: S.rows, cols: S.cols };
    S.shown = [e.from, id]; S.view = 'side'; S.rows = 'none'; S.cols = 'shown'; apply(); save();
    try {
      if (stateServer) await saveState();
      const storage = {}; ['workspace', PKEY, 'workspace.glass.3', 'workspace.wallimg'].forEach(k => { try { storage[k] = localStorage.getItem(k); } catch {} });
      const names = [designName(e.from), designName(id)], notes = S.notes.filter(n => (n.replies || []).some(r => r.made === id));
      // the moment the notes were pinned, so the pins sit on what they were about; otherwise the moment on screen
      const at = notes.length ? timeAt(notes[0].pos) : t;
      const shot = await fetch('/api/capture?project=' + encodeURIComponent(PROJECT), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format: 'png', t: at, names, storage }) }).then(r => r.json());
      if (!shot.files || shot.files.length < 2) throw new Error(shot.error || 'Could not take the pictures');
      const pins = notes.filter(n => n.step === notes[0].step).map(n => ({ n: S.notes.indexOf(n) + 1, x: n.x * 100, y: n.y * 100, text: n.text, reply: (n.replies.find(r => r.made === id) || {}).text }));
      const sc = sceneById(id), title = e.group ? `${e.name || e.angle}: ${e.prompt}` : `${sc.title}: what changed in ${sc.version || id}`;
      const d = await API('page', { id, before: shot.files[0].file, after: shot.files[1].file, pins, title, summary: e.summary || '', reason: e.reason || '', labels: [`Before · ${ver(e.from)}`, `After · ${ver(id)}`] });
      window.open(d.url, '_blank'); UI.say(btn, 'Opened');
    } catch (err) { say(err.message, 5000); UI.say(btn, 'Share', -1); }
    Object.assign(S, keep); apply();
    setTimeout(() => UI.say(btn, 'Share', -1), 2000);
  }

  /* What the design list says about a version: the name it was given, picked, or passed over. */
  function info(id) {
    const e = trail.filter(x => x.id === id).pop(); if (!e) return null;
    return { name: e.name || '', picked: !!e.picked, lost: !!e.group && !e.picked && trail.some(x => x.group === e.group && x.picked) };
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  poll();
  return { paint, info };
})();
