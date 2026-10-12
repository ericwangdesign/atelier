/* Claude on the canvas: the stage's side of agent.py. Loaded after the stage's own script, so it shares its names
   (S, SCENES, screens, apply, sceneById...).

   Send to Claude (Notes)   the open notes on a design go to an agent. It works on a copy, the next version, which
                            appears beside the original at once and rebuilds live every time the agent saves it.
                            Each note gets a reply and is marked done; its reply links to the version it made.
   Explore (Agent, or E)    one prompt, two to four agents at once, each on its own copy and its own angle, all on
                            screen side by side. When they land, each screen offers Pick, with a line for why.
   Runs                     what every agent is doing now, and how the last ones ended. Stop is on each.
   History                  why each version exists: its parent, the notes or the prompt, the pick. Compare shows
                            the before and after; Share writes it as a page for people who aren't designers.

   Nothing here runs without serve.py, and none of it runs while the page is being exported. */
window.Agent = (() => {
  if (!PROJECT || CAPTURE) {
    ['notesend', 'exgo'].forEach(id => { const b = $(id); if (b) { b.disabled = true; b.title = 'Needs serve.py'; } });
    return { paint() {}, notesChanged() {}, explore() {} };
  }
  const API = (path, body) => fetch(`/api/${path}?project=${encodeURIComponent(PROJECT)}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
    .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Something went wrong'); return d; });
  const live = r => r.status === 'starting' || r.status === 'working';
  const clock = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const ver = id => { const sc = sceneById(id); return sc ? sc.version || sc.title : id; };
  let runs = [], trail = [], seen = {}, timer = 0, count = 3;
  try { count = +localStorage.getItem('workspace.excount') || 3; } catch {}

  /* ---------- a toast that says what happened, then goes ---------- */
  let toastTimer = 0;
  function say(text, ms = 2600) {
    const t = $('toast'); t.textContent = text; t.hidden = false; clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.textContent = 'Click a screen to pin a note'; t.hidden = !noting && !cutting; }, ms);
  }

  /* ---------- scenes that change while the page is open ----------
     A scene file runs again with a fresh address. It pushes a new copy onto SCENES, which takes the old one's place
     (a new version goes after the last of its family). A file that doesn't run yet (the agent is mid-edit) is skipped,
     and the screen keeps showing the last good one. */
  const loadFile = (id, v) => new Promise(done => {
    const s = document.createElement('script'); s.src = `${SCENE_BASE}${encodeURIComponent(id)}.js?v=${v}`;
    s.onload = s.onerror = () => { s.remove(); done(); }; document.head.append(s);
  });
  async function reload(id, v) {
    const n = SCENES.length, at = SCENES.findIndex(x => x.id === id);
    await loadFile(id, v);
    const fresh = SCENES.length > n ? SCENES.splice(n).filter(x => x.id === id).pop() : null;
    if (!fresh) return false;
    if (at >= 0) SCENES[at] = fresh;
    else { const fam = SCENES.map((x, k) => [x, k]).filter(([x]) => x.title === fresh.title).pop(); SCENES.splice(fam ? fam[1] + 1 : SCENES.length, 0, fresh); }
    vcache.clear();
    screens.forEach(sc => { if ((sc.designs || []).some(d => d.id === id)) sc.key = ''; });
    return true;
  }

  /* ---------- polling: fast while an agent works, slow otherwise ---------- */
  async function poll() {
    clearTimeout(timer);
    let changed = false;
    try {
      const was = new Map(runs.map(r => [r.id, r.status]));
      runs = (await API('agent')).runs || [];
      for (const r of runs) {
        if (r.removed && SCENES.some(x => x.id === r.scene)) { // a run that failed before changing its copy: the copy is gone
          SCENES.splice(SCENES.findIndex(x => x.id === r.scene), 1);
          S.shown = S.shown.filter(id => id !== r.scene); if (!S.shown.length) S.shown = [SCENES[0].id];
          changed = true;
        }
        if (!r.scene || r.mtime === '0') { if (was.has(r.id) && live({ status: was.get(r.id) }) && !live(r)) landed(r); continue; }
        if (seen[r.scene] !== r.mtime) {
          const first = seen[r.scene] === undefined && sceneById(r.scene);
          seen[r.scene] = r.mtime;
          if (!first && await reload(r.scene, r.mtime)) changed = true;
        }
        if (was.has(r.id) && live({ status: was.get(r.id) }) && !live(r)) landed(r);
      }
      if (runs.some(r => !was.has(r.id) || was.get(r.id) !== r.status)) { trail = (await API('trail')).trail || []; trailChanged(); }
    } catch {}
    if (changed) apply(); else paint();
    timer = setTimeout(poll, runs.some(live) ? 900 : 4000);
  }
  function landed(r) {
    if (r.status === 'done') say(r.kind === 'notes' ? `${ver(r.scene)} is ready · ${r.label} answered` : `${r.name || r.angle} landed · ${ver(r.scene)}`);
    else if (r.status === 'failed') say(r.error || 'The agent stopped', 6000);
    if (r.kind === 'notes') pollNotes();
    const group = r.group && runs.filter(x => x.group === r.group);
    if (group && group.every(x => !live(x)) && group.some(x => x.status === 'done')) say(`${group.filter(x => x.status === 'done').length} directions ready. Pick one on its screen.`, 4000);
  }

  /* ---------- send notes ---------- */
  async function sendNotes() {
    if (editing) closeEditor(true);
    const open = S.notes.map((n, k) => [n, k]).filter(([n]) => n.text && !n.done && !n.sent && n.design !== 'url' && sceneById(n.design));
    if (!open.length) return say('No open notes to send');
    const btn = $('notesend'); UI.say(btn, 'Sending…');
    await syncNotes(); // the server reads the notes from disk
    const byDesign = new Map();
    open.forEach(([n, k]) => { const sc = sceneById(n.design), id = sc.base || sc.id; byDesign.set(id, [...(byDesign.get(id) || []), [n, k]]); });
    const made = [];
    try {
      for (const [design, list] of byDesign) {
        const d = await API('agent', { kind: 'notes', design, notes: list.map(([n, k]) => ({ id: n.id, n: k + 1 })), brief: list.map(([n, k]) => noteLines(n, k).join('\n')).join('\n\n') });
        list.forEach(([n]) => { n.sent = d.runs[0].id; });
        made.push([design, d.scenes[0]]);
      }
    } catch (err) { say(err.message, 5000); }
    for (const [, id] of made) await reload(id, Date.now());
    if (made.length) { const [a, b] = made[0]; S.shown = [a, b]; S.view = 'side'; S.rows = 'none'; S.cols = 'shown'; S.zoom = 0; S.pos = {}; }
    UI.say(btn, made.length ? 'Sent' : 'Send to Claude'); setTimeout(() => notesChanged(), 1400);
    await pollNotes(); apply(); poll();
  }

  /* ---------- explore ---------- */
  const base = () => { const d = shownDesigns().find(x => x.id !== 'url'), sc = d && sceneById(d.id); return sc && !sc.placeholder ? sc : null; };
  function explore() {
    if (S.tab !== 'agent') { S.tab = 'agent'; S.folded = S.folded.filter(k => k !== 'explore'); apply(); }
    requestAnimationFrame(() => $('exask').focus());
  }
  async function go() {
    const sc = base(), ask = $('exask').value.trim();
    if (!sc) return say('Put a design on screen first');
    if (!ask) { $('exask').focus(); return say('Say what Claude should try'); }
    const btn = $('exgo'); UI.say(btn, 'Starting…'); btn.disabled = true;
    try {
      const d = await API('agent', { kind: 'explore', design: sc.base || sc.id, prompt: ask, count, focus: focus ? `the part named "${focus.name}"${focus.path ? ` (${focus.path})` : ''}` : '' });
      for (const id of d.scenes) await reload(id, Date.now());
      S.shown = [sc.id, ...d.scenes].slice(0, MAX); S.view = 'side'; S.rows = 'none'; S.cols = 'shown'; S.zoom = 0; S.pos = {};
      $('exask').value = ''; UI.say(btn, 'Exploring');
      apply(); poll();
    } catch (err) { say(err.message, 5000); UI.say(btn, 'Explore', -1); }
    setTimeout(() => { btn.disabled = false; UI.say(btn, 'Explore', -1); }, 1600);
  }
  $('exgo').onclick = go;
  $('exask').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); go(); } e.stopPropagation(); });
  $('excount').onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; count = +b.dataset.v; try { localStorage.setItem('workspace.excount', count); } catch {} paint(); };
  $('exfocus').onclick = () => { clearFocus(); paint(); };
  $('notesend').onclick = sendNotes;

  /* ---------- pick one direction ---------- */
  let picking2 = null;
  function askPick(r, anchor) {
    picking2 = r;
    const pop = $('pickpop'), a = anchor.getBoundingClientRect();
    $('pickt').textContent = `Keep ${r.name || r.angle}, ${ver(r.scene)}?`; $('pickwhy').value = '';
    pop.hidden = false; const w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = clamp(a.left + a.width / 2 - w / 2, 16, innerWidth - w - 16) + 'px';
    pop.style.top = clamp(a.top - h - 10, 16, innerHeight - h - 16) + 'px';
    pop.classList.remove('show'); void pop.offsetWidth; pop.classList.add('show');
    $('pickwhy').focus();
  }
  const closePick = () => { picking2 = null; $('pickpop').classList.remove('show'); setTimeout(() => { if (!picking2) $('pickpop').hidden = true; }, 160); };
  async function pick() {
    const r = picking2; if (!r) return;
    const reason = $('pickwhy').value.trim(); closePick();
    try {
      trail = (await API('pick', { group: r.group, id: r.scene, reason })).trail || trail; trailSeen = ''; window.Taste?.refresh?.(); // a pick is evidence: the Taste tab shows it learning
      S.shown = [r.scene]; S.zoom = 0; S.pos = {}; apply();
      say(`Picked ${r.name || r.angle} · ${ver(r.scene)}`);
    } catch (err) { say(err.message); }
  }
  $('pickyes').onclick = pick; $('pickno').onclick = closePick;
  $('pickwhy').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); pick(); } else if (e.key === 'Escape') closePick(); e.stopPropagation(); });
  addEventListener('pointerdown', e => { if (picking2 && !$('pickpop').contains(e.target) && !e.target.closest('.agpick')) closePick(); }, { capture: true });

  /* ---------- on the screens ----------
     A screen showing a version an agent is working on glows, and a glass chip at its foot says what the agent is
     doing. When it lands the chip says so; an exploration's chip then offers Pick until one is picked. */
  const runFor = id => runs.filter(r => r.scene === id).pop();
  const picked = r => trail.find(e => e.id === r.scene && e.picked);
  const groupPicked = r => r.group && trail.some(e => e.group === r.group && e.picked);
  function chipFor(r) {
    const nm = esc(r.name || r.angle || 'Claude');
    if (live(r)) return `<i class="agspin"></i><span>${esc(r.activity || 'Working')}</span><time>${clock(Date.now() - r.started)}</time><button class="agstop" data-stop="${r.id}" aria-label="Stop" title="Stop">×</button>`;
    if (r.status === 'failed' || r.status === 'stopped') return `<i class="agdot bad"></i><span>${esc(r.status === 'stopped' ? 'Stopped' : r.error || 'Failed')}</span>`;
    if (r.kind === 'explore' && picked(r)) return `<span class="star">★</span><b>${nm}</b>`;
    if (r.kind === 'explore' && !groupPicked(r)) return `<b>${nm}</b><button class="agpick" data-pick="${r.id}">Pick</button>`;
    if (Date.now() - r.ended < 6000) return `<i class="agdot good"></i><span>Done · ${esc(r.label || '')}</span>`;
    return '';
  }
  function paint() {
    screens.forEach(sc => {
      if (!sc.ag) {
        sc.ag = document.createElement('div'); sc.ag.className = 'agchip';
        sc.ring = document.createElement('i'); sc.ring.className = 'agring';
        sc.wrap.append(sc.ag); sc.scaler.append(sc.ring);
        sc.ag.addEventListener('pointerdown', e => e.stopPropagation());
        sc.ag.addEventListener('click', e => {
          const st = e.target.closest('[data-stop]'); if (st) return API('agent/stop', { id: st.dataset.stop }).then(poll);
          const pk = e.target.closest('[data-pick]'); if (pk) askPick(runs.find(r => r.id === pk.dataset.pick), pk);
        });
      }
      const r = (sc.designs || []).map(d => runFor(d.id)).filter(Boolean).pop(), html = r ? chipFor(r) : '';
      if (sc.ag.dataset.h !== html) { sc.ag.innerHTML = html; sc.ag.dataset.h = html; }
      sc.ag.classList.toggle('on', !!html);
      if (sc.agOn !== !!html) { sc.agOn = !!html; fit(); } // the caption shortens to the screen's letter while the chip is there
      // the caption makes room for the chip, and ends in … if it has to
      const on = !!(r && live(r));
      sc.wrap.classList.toggle('agbusy', on); // no Duplicate while an agent is changing the file
      Object.assign(sc.cap.style, html ? { maxWidth: `max(14px, calc(100% - ${(sc.wrap.classList.contains('dupable') && !on ? 28 : 0) + sc.ag.offsetWidth + 8}px))`, overflow: 'hidden', textOverflow: 'ellipsis' } : { maxWidth: '', overflow: '', textOverflow: '' });
      sc.ring.classList.toggle('on', on);
      if (on) sc.ring.style.setProperty('--r', (parseFloat(getComputedStyle(sc.frame).borderTopLeftRadius) || 0) * K + 5 + 'px'); // the frame's corner, at this zoom
      sc.screen.classList.toggle('ag-lost', !!(r && r.kind === 'explore' && groupPicked(r) && !picked(r)));
    });
    panel();
  }

  /* ---------- the panel ---------- */
  function notesChanged() {
    const n = S.notes.filter(x => x.text && !x.done && !x.sent && x.design !== 'url').length, b = $('notesend');
    if (!b || b.querySelector('.say-old')) return;
    UI.say(b, n ? `Send ${n} note${n > 1 ? 's' : ''} to Claude` : 'Send to Claude'); b.disabled = !n;
  }
  const RUNICON = { done: '<i class="agdot good"></i>', failed: '<i class="agdot bad"></i>', stopped: '<i class="agdot"></i>' };
  function panel() {
    const sc = base();
    $('exfrom').textContent = sc ? designName(sc.id) : 'No design on screen';
    $('exmk').textContent = sc ? letter(Math.max(0, shownDesigns().findIndex(d => d.id === sc.id))) : '';
    $('exfocus').hidden = !focus; if (focus) $('exfocus').textContent = `Only ${focus.name} ×`;
    $('excount').querySelectorAll('[data-v]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.v === count));
    const list = runs.slice().reverse().slice(0, 8);
    const rows = list.map(r => `<li data-run="${r.id}" class="${live(r) ? 'live' : ''}">${live(r) ? '<i class="agspin"></i>' : RUNICON[r.status] || '<i class="agdot"></i>'}`
      + `<span class="rb"><span class="rt">${r.kind === 'notes' ? `${esc(r.label)} → ${esc(ver(r.scene))}` : `${esc(r.name || r.angle)} · ${esc(ver(r.scene))}`}</span>`
      + `<span class="nm">${esc(live(r) ? r.activity || 'Working' : r.status === 'done' ? r.summary : r.error || r.status)}</span></span>`
      + `<span class="ver">${clock((r.ended || Date.now()) - r.started)}</span>${live(r) ? `<button class="x" data-stop="${r.id}" aria-label="Stop">×</button>` : ''}</li>`).join('');
    if ($('runlist').dataset.h !== rows) { $('runlist').innerHTML = rows; $('runlist').dataset.h = rows; }
    $('runempty').hidden = !!list.length; $('runlist').hidden = !list.length;
    renderTrail();
    notesChanged();
  }
  $('runlist').onclick = e => {
    const st = e.target.closest('[data-stop]'); if (st) return API('agent/stop', { id: st.dataset.stop }).then(poll);
    const li = e.target.closest('[data-run]'), r = li && runs.find(x => x.id === li.dataset.run); if (!r) return;
    const ids = r.group ? [r.from, ...runs.filter(x => x.group === r.group).map(x => x.scene)] : [r.from, r.scene];
    S.shown = ids.filter(id => sceneById(id)).slice(0, MAX); S.view = 'side'; S.zoom = 0; S.pos = {}; apply();
  };

  /* History: newest first. A round of notes is one entry; an exploration is one entry with a chip per direction. */
  function renderTrail() {
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
      return `<li><span class="tt">Explored <span class="from">from ${esc(ver(from))}</span></span><span class="ts">“${esc(g.list[0].prompt)}”</span>`
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
      // the moment the notes were pinned, so the pins sit on what they were about; an exploration at the moment on screen
      const at = notes.length ? timeAt(notes[0].pos) : t;
      const shot = await fetch('/api/capture?project=' + encodeURIComponent(PROJECT), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format: 'png', t: at, names, storage }) }).then(r => r.json());
      if (!shot.files || shot.files.length < 2) throw new Error(shot.error || 'Could not take the pictures');
      const pins = notes.filter(n => n.step === notes[0].step).map(n => ({ n: S.notes.indexOf(n) + 1, x: n.x * 100, y: n.y * 100, text: n.text, reply: (n.replies.find(r => r.made === id) || {}).text }));
      const sc = sceneById(id), title = e.kind === 'explore' ? `${e.name || e.angle}: ${e.prompt}` : `${sc.title}: what changed in ${sc.version || id}`;
      const d = await API('page', { id, before: shot.files[0].file, after: shot.files[1].file, pins, title, summary: e.summary || '', reason: e.reason || '', labels: [`Before · ${ver(e.from)}`, `After · ${ver(id)}`] });
      window.open(d.url, '_blank'); UI.say(btn, 'Opened');
    } catch (err) { say(err.message, 5000); UI.say(btn, 'Share', -1); }
    Object.assign(S, keep); apply();
    setTimeout(() => UI.say(btn, 'Share', -1), 2000);
  }

  /* What the design list says about a version: the name its direction was given, picked, or passed over. */
  function info(id) {
    const e = trail.filter(x => x.id === id).pop(); if (!e) return null;
    return { name: e.name || '', picked: !!e.picked, lost: !!e.group && !e.picked && trail.some(x => x.group === e.group && x.picked) };
  }
  let trailSeen = '';
  const trailChanged = () => { const k = JSON.stringify(trail); if (k !== trailSeen) { trailSeen = k; renderDesigns(); } };

  setInterval(() => { if (runs.some(r => live(r) || Date.now() - (r.ended || 0) < 7000)) paint(); }, 1000); // the clocks on the chips
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  API('trail').then(d => { trail = d.trail || []; trailChanged(); paint(); }).catch(() => {});
  poll();
  return { paint, notesChanged, explore, info };
})();
