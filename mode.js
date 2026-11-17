/* Light or dark, before the first paint. Loaded as a plain blocking script in <head> by home and the stage, so the
   page never flashes the other theme. The choice is the Theme setting ('auto', 'light' or 'dark'), kept with the
   stage's settings in localStorage 'workspace'.mode; Auto follows the Mac and changes with it.
   :root gets data-mode="light" or "dark"; a 'modechange' event tells the page (the wallpaper follows it). */
window.Mode = (() => {
  const root = document.documentElement, dark = matchMedia('(prefers-color-scheme: dark)');
  const read = () => { try { return JSON.parse(localStorage.getItem('workspace') || '{}').mode || 'auto'; } catch { return 'auto'; } };
  let pref = read();
  const resolved = () => pref === 'auto' ? (dark.matches ? 'dark' : 'light') : pref;
  function paint() {
    const m = resolved();
    if (root.dataset.mode === m) return;
    root.dataset.mode = m;
    dispatchEvent(new CustomEvent('modechange', { detail: m }));
  }
  /* set('light' | 'dark' | 'auto'): saves it with the stage's settings, so home and the stage agree */
  function set(p) {
    pref = p;
    try { const w = JSON.parse(localStorage.getItem('workspace') || '{}'); w.mode = p; localStorage.setItem('workspace', JSON.stringify(w)); } catch {}
    paint();
  }
  dark.addEventListener('change', () => { if (pref === 'auto') paint(); });
  addEventListener('storage', (e) => { if (e.key === 'workspace') { const p = read(); if (p !== pref) { pref = p; paint(); } } });
  paint();
  return { get pref() { return pref; }, get mode() { return resolved(); }, set, OPTIONS: [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']] };
})();
