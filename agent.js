/* An agent on the canvas: the stage's side of agent.py. Loaded after the stage's own script, so it shares its names
   (S, SCENES, screens, apply, sceneById...).

   Send to agent (Notes)   the open notes on a design go to an agent. It works on a copy, the next version, which
                            appears beside the original at once and rebuilds live every time the agent saves it.
                            Each note gets a reply and is marked done; its reply links to the version it made.
   /try 3 in a note         that note isn't done with the others: once they land, three agents each make a take on
                            it, on top of the new version, with nothing else on screen changing. They show side by
                            side and each offers Pick, with a line for why. The next /try note starts from the pick.
   Critic                   when every take on a note has landed, the stage takes a picture of each and the critic
                            (critic.py) ranks them against your taste. The cards show its order, a few words of why,
                            and a blue 1 on its top pick. It never picks for you.
   The card                 under each screen an agent is working on, on the canvas: its plan, every step it has
                            made so far (the screen above changes with each one) and what it's doing now. Type in
                            Instead… to redirect that one agent: it stops, keeps its copy and carries on with your
                            line; the others keep going. When it lands the card offers Pick.
   History                  why each version exists: its parent, the notes or the prompt, the pick. Compare shows
                            the before and after; Share writes it as a page for people who aren't designers.

   Nothing here runs without serve.py, and none of it runs while the page is being exported. */
window.Agent = (() => {
  if (!PROJECT || CAPTURE) {
    const b = $('notesend'); if (b) { b.disabled = true; b.title = 'Needs serve.py'; }
    return { paint() {}, notesChanged() {} };
  }
  const API = (path, body) => fetch(`/api/${path}?project=${encodeURIComponent(PROJECT)}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
    .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Something went wrong'); return d; });
  const live = r => r.status === 'starting' || r.status === 'working';
  const clock = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const ver = id => { const sc = sceneById(id); return sc ? sc.version || sc.title : id; };
  let runs = [], trail = [], seen = {}, timer = 0, critic = {};
  const asked = new Set(); // groups of takes this page has sent to the critic
  const groups = new Set(); // groups of takes this page has seen start: a new one goes on screen
  const flashes = new Set();
  const TRY = /(^|\s)\/try(\s+\d)?\b/i;
  const takesOf = text => TRY.test(text || '') ? Math.max(2, Math.min(4, +((text.match(TRY)[2] || '').trim() || 3))) : 0;

  /* ---------- a toast that says what happened, then goes ---------- */
  let toastTimer = 0;
  function say(text, ms = 2600) {
    const t = $('toast'); t.textContent = text; t.hidden = false; clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { if (focus && !noting && !cutting) return focusLabel(); t.textContent = 'Click a screen to pin a note'; t.hidden = !noting && !cutting; }, ms);
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
    fresh.file = id;
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
      const got = await API('agent'); runs = got.runs || []; critic = got.critic || {};
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
          if (!first && await reload(r.scene, r.mtime)) { changed = true; if (live(r)) flashes.add(r.scene); }
        }
        if (was.has(r.id) && live({ status: was.get(r.id) }) && !live(r)) landed(r);
      }
      if (runs.some(r => !was.has(r.id) || was.get(r.id) !== r.status)) { trail = (await API('trail')).trail || []; trailChanged(); }
      // takes that just started (after the plain notes landed, or after a pick): only them, in one row, so each is big
      // enough to judge. The version they came from is one click away (History › Compare all).
      const fresh = runs.filter(r => r.group && live(r) && !groups.has(r.group));
      fresh.forEach(r => groups.add(r.group));
      if (fresh.length) {
        const g = fresh[0].group, mine = runs.filter(r => r.group === g);
        for (const r of mine) if (!sceneById(r.scene)) await reload(r.scene, r.mtime || Date.now());
        S.shown = mine.map(r => r.scene).filter(id => sceneById(id)).slice(0, MAX);
        S.view = 'side'; S.rows = 'none'; S.cols = 'shown'; S.zoom = 0; S.pos = {}; changed = true;
      }
    } catch {}
    if (changed) apply(); else paint();
    if (flashes.size) { screens.forEach(sc => { if ((sc.designs || []).some(d => flashes.has(d.id))) { sc.frame.classList.remove('agflash'); void sc.frame.offsetWidth; sc.frame.classList.add('agflash'); } }); flashes.clear(); }
    timer = setTimeout(poll, runs.some(live) ? 900 : 4000);
  }
  function landed(r) {
    if (r.status === 'done') say(r.kind === 'notes' ? `${ver(r.scene)} is ready · ${r.label} answered` : `${r.name || r.angle} landed · ${ver(r.scene)}`);
    if (r.status === 'done' && r.kind === 'notes' && r.round) say(`${ver(r.scene)} is ready · takes on your /try note next`, 3600);
    else if (r.status === 'failed') say(r.error || 'The agent stopped', 6000);
    if (r.kind === 'notes') pollNotes();
    const group = r.group && runs.filter(x => x.group === r.group);
    if (group && group.every(x => !live(x)) && group.filter(x => x.status === 'done').length > 1) setTimeout(() => askCritic(r.group), 600);
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
        // each note's lines on its own: plain notes go to one agent together, a /try note to its takes alone
        const briefs = Object.fromEntries(list.map(([n, k]) => [n.id, noteLines({ ...n, text: n.text.replace(TRY, ' ').replace(/\s+/g, ' ').trim() }, k).join('\n')]));
        const d = await API('agent', { design, notes: list.map(([n, k]) => ({ id: n.id, n: k + 1 })), briefs });
        list.forEach(([n]) => { n.sent = takesOf(n.text) ? d.round : (d.runs[0] || {}).id; });
        made.push([design, ...d.scenes]);
      }
    } catch (err) { say(err.message, 5000); }
    for (const [, ...ids] of made) for (const id of ids) await reload(id, Date.now());
    // a version beside its original; takes on their own
    if (made.length) { S.shown = (made[0].length > 2 ? made[0].slice(1) : made[0]).slice(0, MAX); S.view = 'side'; S.rows = 'none'; S.cols = 'shown'; S.zoom = 0; S.pos = {}; }
    runs.forEach(r => r.group && groups.add(r.group));
    UI.say(btn, made.length ? 'Sent' : 'Send to agent'); setTimeout(() => notesChanged(), 1400);
    await pollNotes(); apply(); poll();
  }

  $('notesend').onclick = sendNotes;

  /* ---------- pick one take ---------- */
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
    pickNow(r, reason);
  }
  async function pickNow(r, reason) {
    try {
      trail = (await API('pick', { group: r.group, id: r.scene, reason })).trail || trail; trailSeen = ''; window.Taste?.refresh?.(); // a pick is evidence: the Taste tab shows it learning
      S.shown = [r.scene]; S.zoom = 0; S.pos = {}; apply();
      say(`Picked ${r.name || r.angle} · ${ver(r.scene)}`);
    } catch (err) { say(err.message); }
  }
  $('pickyes').onclick = pick; $('pickno').onclick = closePick;
  $('pickwhy').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); pick(); } else if (e.key === 'Escape') closePick(); e.stopPropagation(); });
  addEventListener('pointerdown', e => { if (picking2 && !$('pickpop').contains(e.target) && !e.target.closest('.agpick')) closePick(); }, { capture: true });

  /* ---------- the critic ----------
     A picture of each landed direction, the way Share takes them, then the critic ranks them. If the pictures can't
     be taken (they aren't all on screen, or there's no Chrome), it reads the code instead. */
  async function askCritic(group) {
    if (asked.has(group) || critic[group]) return;
    asked.add(group);
    const mine = runs.filter(x => x.group === group && x.status === 'done').map(x => x.scene), pictures = {};
    const shown = shownDesigns().map(d => d.id);
    if (mine.every(id => shown.includes(id))) {
      try {
        if (stateServer) await saveState();
        const storage = {}; ['workspace', PKEY, 'workspace.glass.3', 'workspace.wallimg'].forEach(k => { try { storage[k] = localStorage.getItem(k); } catch {} });
        const shot = await fetch('/api/capture?project=' + encodeURIComponent(PROJECT), { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ format: 'png', t: DURATION * .6, names: shown.map(id => designName(id)), storage }) }).then(x => x.json());
        (shot.files || []).forEach((f, k) => { if (mine.includes(shown[k])) pictures[shown[k]] = f.file; });
      } catch {}
    }
    try { await API('critic', { group, pictures }); } catch {}
    poll();
  }

  /* ---------- redirect one agent ----------
     The line goes to that agent only. It stops, keeps its copy as it is, and carries on in the same session with
     the line added. The others don't notice. */
  let redirecting = null;
  function askRedirect(r, anchor) {
    if (!r || !live(r)) return;
    redirecting = r;
    const pop = $('redirpop'), a = anchor.getBoundingClientRect();
    $('redirt').textContent = `Redirect ${r.name || r.angle || r.label || 'the agent'}`; $('redirwhy').value = '';
    pop.hidden = false; const w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = clamp(a.left + a.width / 2 - w / 2, 16, innerWidth - w - 16) + 'px';
    pop.style.top = clamp(a.top - h - 10, 16, innerHeight - h - 16) + 'px';
    pop.classList.remove('show'); void pop.offsetWidth; pop.classList.add('show');
    $('redirwhy').focus();
  }
  const closeRedirect = () => { redirecting = null; $('redirpop').classList.remove('show'); setTimeout(() => { if (!redirecting) $('redirpop').hidden = true; }, 160); };
  async function redirect() {
    const r = redirecting, text = $('redirwhy').value.trim(); if (!r) return;
    if (!text) return $('redirwhy').focus();
    closeRedirect();
    try {
      const d = await API('agent/redirect', { id: r.id, text });
      say(d.redirected ? `${r.name || r.angle || 'Agent'} redirected` : 'It finished before the line got there');
    } catch (err) { say(err.message); }
    poll();
  }
  $('rediryes').onclick = redirect; $('redirno').onclick = closeRedirect;
  $('redirwhy').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); redirect(); } else if (e.key === 'Escape') closeRedirect(); e.stopPropagation(); });
  addEventListener('pointerdown', e => { if (redirecting && !$('redirpop').contains(e.target) && !e.target.closest('[data-redir]')) closeRedirect(); }, { capture: true });

  /* ---------- on the screens ----------
     A screen showing a version an agent is working on glows, and a glass chip at its foot says what the agent is
     doing. When it lands the chip says so; an exploration's chip then offers Pick until one is picked. */
  const runFor = id => runs.filter(r => r.scene === id).pop();
  const picked = r => trail.find(e => e.id === r.scene && e.picked);
  const groupPicked = r => r.group && trail.some(e => e.group === r.group && e.picked);
  function chipFor(r) {
    const nm = esc(r.name || r.angle || 'Agent');
    if (live(r)) return `<i class="agspin"></i><span title="${esc(r.plan || '')}">${esc(r.plan || r.activity || 'Working')}</span><time>${clock(Date.now() - r.started)}</time>`
      + `<button class="agstop" data-redir="${r.id}" aria-label="Redirect" title="Redirect">↪</button><button class="agstop" data-stop="${r.id}" aria-label="Stop" title="Stop">×</button>`;
    if (r.status === 'failed' || r.status === 'stopped') return `<i class="agdot bad"></i><span>${esc(r.status === 'stopped' ? 'Stopped' : r.error || 'Failed')}</span>`;
    if (r.group && picked(r)) return `<span class="star">★</span><b>${nm}</b>`;
    if (r.kind === 'try' && !groupPicked(r)) return `<b>${nm}</b><button class="agpick" data-pick="${r.id}">Pick</button>`;
    if (Date.now() - r.ended < 6000) return `<i class="agdot good"></i><span>Done · ${esc(r.label || '')}</span>`;
    return '';
  }
  /* ---------- the card under a screen ----------
     Built once per screen and updated in parts, so what you type survives the clock ticking.
     While it works: the name and time, the plan, the steps so far and the one it's on, and Instead… to redirect it.
     When it lands: the name and Pick, nothing to read. Pick asks why right there (optional). */
  // a landed take waits for its pick; directions from the old Explore stay in History, not on the canvas
  const showCard = r => !!r && (live(r) || (r.kind === 'try' && r.status === 'done' && !groupPicked(r)));
  function makeCard(sc) {
    const c = document.createElement('div'); c.className = 'agcard glass';
    c.innerHTML = '<div class="aghead"></div><p class="agplan"></p><ol class="aglog"></ol>'
      + '<form class="agfield agredir"><input placeholder="Instead…" aria-label="Redirect this agent" autocomplete="off"><button aria-label="Redirect" title="Redirect">↪</button></form>'
      + '<button class="agpickbtn" type="button">Pick</button>'
      + '<form class="agfield agwhy" hidden><input placeholder="Why?" aria-label="Why this one" autocomplete="off"><button class="go">Pick</button></form>';
    c.addEventListener('pointerdown', e => e.stopPropagation());
    c.addEventListener('keydown', e => {
      e.stopPropagation(); // typing here is not a shortcut
      if (e.key === 'Escape' && !c.querySelector('.agwhy').hidden) asking(c, false);
    });
    c.addEventListener('click', e => { const st = e.target.closest('[data-stop]'); if (st) API('agent/stop', { id: st.dataset.stop }).then(poll); });
    c.querySelector('.agredir').addEventListener('submit', async e => {
      e.preventDefault();
      const inp = e.target.querySelector('input'), text = inp.value.trim(), r = runs.find(x => x.id === c.dataset.run);
      if (!text || !r) return inp.focus();
      inp.value = ''; inp.blur();
      try { const d = await API('agent/redirect', { id: r.id, text }); if (!d.redirected) say('It landed before the line got there'); } catch (err) { say(err.message); }
      poll();
    });
    c.querySelector('.agpickbtn').onclick = () => asking(c, true);
    c.querySelector('.agwhy').addEventListener('submit', e => {
      e.preventDefault();
      const r = runs.find(x => x.id === c.dataset.run), why = e.target.querySelector('input');
      if (r) pickNow(r, why.value.trim());
      why.value = ''; asking(c, false);
    });
    sc.wrap.append(c); sc.card = c;
  }
  const rankOf = r => { const k = critic[r.group]; return k && k.status === 'done' ? k.ranks.findIndex(x => x.id === r.scene) : -1; };
  function rankHead(r, nm) {
    const n = rankOf(r);
    return (n >= 0 ? `<span class="agrank${n === 0 ? ' top' : ''}">${n + 1}</span>` : '') + `<b>${nm}</b>`;
  }
  function rankWhy(r) {
    const k = critic[r.group];
    if (!k) return '';
    if (k.status === 'working') return '<span class="ranking">Ranking…</span>';
    if (k.status !== 'done') return '';
    const n = rankOf(r), why = n >= 0 ? k.ranks[n].why : '';
    return esc(why) + (n === 0 && k.close ? ' <span class="close">· close call</span>' : '');
  }
  function asking(c, on) {
    c.querySelector('.agpickbtn').hidden = on; c.querySelector('.agwhy').hidden = !on;
    if (on) c.querySelector('.agwhy input').focus();
  }
  const part = (el, html) => { if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; } };
  function paintCard(sc, r) {
    if (!sc.card) makeCard(sc);
    const c = sc.card, on = showCard(r);
    c.classList.toggle('on', on);
    if (!on) return;
    const going = live(r), nm = esc(r.name || r.angle || r.label || 'Agent');
    if (c.dataset.run !== r.id) { c.dataset.run = r.id; asking(c, false); }
    c.classList.toggle('live', going);
    part(c.querySelector('.aghead'), going
      ? `<b>${nm}</b><time>${clock(Date.now() - r.started)}</time><button class="agx" data-stop="${r.id}" aria-label="Stop" title="Stop">×</button>`
      : rankHead(r, nm));
    part(c.querySelector('.agplan'), going ? esc(r.plan || r.activity || 'Reading the design') : rankWhy(r)); // landed: the critic's few words, then Pick
    c.classList.toggle('top', !going && rankOf(r) === 0);
    const log = going ? (r.log || []).slice(-3) : [];
    part(c.querySelector('.aglog'), log.map((x, k) => `<li class="${x.redirect ? 'redir' : k === log.length - 1 ? 'cur' : ''}">${x.redirect ? '<i>↪</i>' : '<i></i>'}<span>${esc(x.text)}</span></li>`).join(''));
    c.querySelector('.agredir').hidden = !going;
    if (going) { c.querySelector('.agpickbtn').hidden = true; c.querySelector('.agwhy').hidden = true; }
    else if (c.querySelector('.agwhy').hidden) c.querySelector('.agpickbtn').hidden = false;
  }
  /* The zoom leaves room under the screens for the cards. A fixed room, never a measured one: a measured card gets
     taller as the zoom narrows it, which would shrink the zoom again, without end. The card's height is bounded instead. */
  const ROOM = 262;
  let below = 0;
  function makeRoom() {
    const need = screens.some(sc => sc.card && sc.card.classList.contains('on')) ? ROOM : 0;
    if (need !== below) { below = need; window.AG_BELOW = need; fit(); }
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
          const rd = e.target.closest('[data-redir]'); if (rd) return askRedirect(runs.find(r => r.id === rd.dataset.redir), rd);
          const pk = e.target.closest('[data-pick]'); if (pk) askPick(runs.find(r => r.id === pk.dataset.pick), pk);
        });
      }
      const r = (sc.designs || []).map(d => runFor(d.id)).filter(Boolean).pop(), html = r && !showCard(r) ? chipFor(r) : '';
      paintCard(sc, r);
      if (sc.ag.dataset.h !== html) { sc.ag.innerHTML = html; sc.ag.dataset.h = html; }
      sc.ag.classList.toggle('on', !!html);
      if (sc.agOn !== !!html) { sc.agOn = !!html; fit(); } // the caption shortens to the screen's letter while the chip is there
      // the caption makes room for the chip, and ends in … if it has to
      const on = !!(r && live(r));
      sc.wrap.classList.toggle('agbusy', on); // no Duplicate while an agent is changing the file
      Object.assign(sc.cap.style, html ? { maxWidth: `max(14px, calc(100% - ${(sc.wrap.classList.contains('dupable') && !on ? 28 : 0) + sc.ag.offsetWidth + 8}px))`, overflow: 'hidden', textOverflow: 'ellipsis' } : { maxWidth: '', overflow: '', textOverflow: '' });
      sc.ring.classList.toggle('on', on);
      if (on) sc.ring.style.setProperty('--r', (parseFloat(getComputedStyle(sc.frame).borderTopLeftRadius) || 0) * K + 5 + 'px'); // the frame's corner, at this zoom
      sc.screen.classList.toggle('ag-lost', !!(r && r.group && groupPicked(r) && !picked(r)));
    });
    makeRoom();
    panel();
  }

  /* ---------- the panel ---------- */
  /* Under a /try note in the list: waiting for the other notes, making its takes, or the takes ready to pick, with
     Show to put them on screen beside the version they came from. */
  function tryStatus() {
    document.querySelectorAll('#notelist [data-try]').forEach(el => {
      const id = +el.dataset.try, mine = runs.filter(r => r.kind === 'try' && (r.notes || []).includes(id));
      const g = mine.length ? mine.at(-1).group : '', takes = mine.filter(r => r.group === g), done = takes.filter(r => r.status === 'done');
      const html = !takes.length ? '<i class="agspin"></i>Waiting for the other notes'
        : takes.some(live) ? `<i class="agspin"></i>Making ${takes.length} takes`
        : done.length ? `${done.length} takes ready · <button class="link" data-takes="${esc(g)}">Show</button>` : 'The takes failed';
      if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
    });
  }
  $('notelist').addEventListener('click', e => {
    const b = e.target.closest('[data-takes]'); if (!b) return;
    const takes = runs.filter(r => r.group === b.dataset.takes);
    S.shown = takes.map(r => r.scene).filter(id => sceneById(id)).slice(0, MAX);
    S.view = 'side'; S.rows = 'none'; S.cols = 'shown'; S.zoom = 0; S.pos = {}; apply();
  });
  function notesChanged() {
    tryStatus();
    const n = S.notes.filter(x => x.text && !x.done && !x.sent && x.design !== 'url').length, b = $('notesend');
    if (!b || b.querySelector('.say-old')) return;
    UI.say(b, n ? `Send ${n} note${n > 1 ? 's' : ''} to agent` : 'Send to agent'); b.disabled = !n;
  }
  function panel() {
    tryStatus();
    renderTrail();
    notesChanged();
  }

  /* History: newest first. A round of notes is one entry; the takes on a /try note are one entry with a chip per take.
     Explorations from before /try show the same way. */
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
      const head = g.list[0].kind === 'try' ? `Note ${esc(g.list[0].note || '')}, ${g.list.length} takes` : 'Explored';
      return `<li><span class="tt">${head} <span class="from">from ${esc(ver(from))}</span></span><span class="ts">“${esc(g.list[0].prompt)}”</span>`
        + `<span class="chips">${g.list.map(e => `<button class="chip${e.picked ? ' on' : win ? ' lost' : ''}" data-cmp="${esc(from)}|${esc(e.id)}" title="${esc([e.summary, ...(e.redirects || []).map(x => '↪ ' + x.text)].filter(Boolean).join('\n'))}">${esc(e.name || e.angle)}${(e.redirects || []).length ? ` <span class="rd">↪${e.redirects.length}</span>` : ''}</button>`).join('')}</span>`
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
      const sc = sceneById(id), title = e.group ? `${e.name || e.angle}: ${e.prompt}` : `${sc.title}: what changed in ${sc.version || id}`;
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
  return { paint, notesChanged, info, askCritic };
})();
