/* Taste: the stage's side of taste.py. Loaded after agent.js, and shares the stage's names ($, esc, PROJECT).

   The Taste tab lists what Claude has learned you like, from your picks and the reasons you give, and from the
   notes you send. Every run reads it first. Click a line to edit it (then it's yours, and learning never drops
   it), × forgets it, the scope switches between this project and everywhere, and you can add your own. A toast
   says what was learned, a few seconds after a pick or a round of notes lands. */
window.Taste = (() => {
  if (!PROJECT || CAPTURE) return {};
  const API = body => fetch(`/api/taste?project=${encodeURIComponent(PROJECT)}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
    .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Something went wrong'); return d; });
  const ANGLES = ['Direct', 'Bold', 'Quiet', 'Moving'];
  let data = null, drawn = '', since = Date.now(), timer = 0, toastTimer = 0;

  function say(text, ms = 4200) {
    const t = $('toast'); t.textContent = text; t.hidden = false; clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.textContent = 'Click a screen to pin a note'; t.hidden = !noting && !cutting; }, ms);
  }

  async function refresh() {
    clearTimeout(timer);
    try { data = await API(); } catch { timer = setTimeout(refresh, 8000); return; }
    const last = data.last;
    if (last && last.at > since) { // something was learned since we last looked
      since = last.at;
      say(last.kind === 'more' ? `More sure: ${last.text}` : `Learned: ${last.text}`);
    }
    render();
    timer = setTimeout(refresh, data.learning ? 1500 : 5000); // closer while a learning pass is running
  }

  /* ---------- the tab ---------- */
  const fromWhat = l => {
    if (l.by === 'you') return 'Yours';
    const picks = (l.from || []).filter(f => f.kind === 'pick').length, notes = (l.from || []).filter(f => f.kind === 'notes').length;
    const part = (n, w) => n ? `${n} ${w}${n > 1 ? 's' : ''}` : '';
    return 'From ' + ([part(picks, 'pick'), part(notes, 'round') && part(notes, 'round') + ' of notes'].filter(Boolean).join(' and ') || 'what you did');
  };
  function render() {
    if (!data) return;
    if (document.querySelector('.tl .tt[contenteditable="true"]')) return; // never redraw under an edit
    const key = JSON.stringify([data.on, data.lines, data.learning, data.stats]);
    $('tastelearn').hidden = !data.learning;
    if (key === drawn) return; drawn = key;
    $('tasteon').checked = data.on;
    $('tastelist').closest('.sect').classList.toggle('tasteoff', !data.on);
    $('tastelist').innerHTML = data.lines.map(l => {
      const n = Math.min(5, l.count || 1);
      // how sure only means something for a learned line: yours is sure by definition
      const sure = l.by === 'you' ? '' : `<span class="str" title="How sure: seen ${l.count || 1}×">${[0, 1, 2, 3, 4].map(i => `<i${i < n ? ' class="on"' : ''}></i>`).join('')}</span>`;
      return `<li class="tl" data-id="${esc(l.id)}">
        <span class="tt" title="Click to edit">${esc(l.text)}</span>
        <span class="tm">${sure}
          <span>${esc(fromWhat(l))}</span>·<button class="scope" title="Switch between this project and everywhere">${l.scope === 'all' ? 'Everywhere' : 'This project'}</button></span>
        <button class="x" aria-label="Forget" title="Forget">×</button></li>`;
    }).join('');
    $('tasteempty').hidden = !!data.lines.length;
    // which kind of direction you pick, out of how many times it was offered
    const st = data.stats || {}, names = [...ANGLES.filter(a => st[a]), ...Object.keys(st).filter(a => !ANGLES.includes(a) && a !== '?')];
    const best = Math.max(0, ...names.map(a => st[a][1] >= 2 ? st[a][0] / st[a][1] : 0));
    $('anglestats').innerHTML = names.map(a => { const [p, o] = st[a], r = o ? p / o : 0;
      return `<div class="ang${best > 0 && r === best ? ' top' : ''}"><span>${esc(a)}</span><span class="bar"><i style="transform:scaleX(${r.toFixed(3)})"></i></span><span class="n">${p} of ${o}</span></div>`; }).join('');
    $('anglesempty').textContent = names.length ? 'Out of the times each was offered.' : 'Shows up once you pick from an exploration.';
  }

  /* ---------- editing ---------- */
  const act = body => API(body).then(refresh).catch(err => say(err.message));
  $('tasteon').onchange = e => { act({ act: 'on', on: e.target.checked }); say(e.target.checked ? 'Runs read your taste again' : 'Runs ignore your taste for now'); };
  $('tasteadd').onkeydown = e => {
    if (e.key !== 'Enter' || !e.target.value.trim()) return;
    act({ act: 'add', text: e.target.value }); e.target.value = '';
  };
  $('tastelist').addEventListener('click', e => {
    const li = e.target.closest('.tl'); if (!li) return;
    const line = data.lines.find(l => l.id === li.dataset.id); if (!line) return;
    if (e.target.closest('.x')) { li.classList.add('leaving'); setTimeout(() => act({ act: 'forget', id: line.id }), 180); return; }
    if (e.target.closest('.scope')) return act({ act: 'change', id: line.id, scope: line.scope === 'all' ? 'project' : 'all' });
    const tt = e.target.closest('.tt'); if (!tt || tt.isContentEditable) return;
    tt.contentEditable = 'true'; tt.focus();
    const r = document.createRange(); r.selectNodeContents(tt); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    const done = keep => {
      tt.contentEditable = 'false'; tt.onkeydown = tt.onblur = null;
      const text = tt.textContent.trim();
      if (keep && text && text !== line.text) act({ act: 'change', id: line.id, text }); else { tt.textContent = line.text; drawn = ''; render(); }
    };
    tt.onkeydown = k => { k.stopPropagation(); if (k.key === 'Enter') { k.preventDefault(); done(true); } if (k.key === 'Escape') done(false); };
    tt.onblur = () => done(true);
  });
  // the stage's keys (N, X, Space...) stay out of the add field
  $('tasteadd').addEventListener('keydown', e => e.stopPropagation());

  refresh();
  return { refresh };
})();
