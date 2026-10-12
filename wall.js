/* The wallpaper, shared by home and the stage. Its settings (wall, color, dim) live with the stage's in
   localStorage 'workspace'. A picked image is shrunk to fit 2560 × 2560 and kept as a JPEG in 'workspace.wallimg',
   so it survives reloads and moving between home and the stage. */
window.Wall = (() => {
  const KEY = 'workspace.wallimg';
  let mem;
  const image = () => { if (mem === undefined) try { mem = localStorage.getItem(KEY); } catch { mem = null; } return mem; };
  /* paints el from a settings object, and returns the wallpaper actually shown (an image falls back to dark if none is kept) */
  function apply(el, s) {
    const img = image(), w = s.wall === 'image' && !img ? 'dark' : (s.wall || 'dark');
    document.documentElement.dataset.wall = w;
    el.style.backgroundImage = w === 'image' ? `url(${img})` : '';
    el.style.backgroundColor = w === 'color' ? s.color : '';
    document.documentElement.style.setProperty('--dim', s.dim || 0);
    return w;
  }
  async function save(file) {
    if (!file || !file.type.startsWith('image/')) return false;
    let img;
    try { img = await createImageBitmap(file); } catch { return false; } // decodes off the page, so it works even while the tab is in the background; not every image type decodes
    const k = Math.min(1, 2560 / img.width, 2560 / img.height), c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); img.close();
    mem = c.toDataURL('image/jpeg', .85);
    try { localStorage.setItem(KEY, mem); } catch { try { localStorage.removeItem(KEY); } catch {} } // too big to keep: it shows for this visit, and no older image comes back instead
    return true;
  }
  // which wallpaper pictures exist (none in a fresh copy); remembered, so the picture shows from the first frame
  try { const k = localStorage.getItem('workspace.photos'); if (k != null) document.documentElement.dataset.photos = k; } catch {}
  fetch('/api/wallpapers').then(r => r.ok ? r.json() : []).then(list => {
    const k = list.join(' '); document.documentElement.dataset.photos = k;
    try { localStorage.setItem('workspace.photos', k); } catch {}
  }).catch(() => {});
  const OPTIONS = [['dark', 'Dark'], ['light', 'Light'], ['gradient', 'Glow'], ['color', 'Colour'], ['image', 'Image…']];
  return { apply, save, OPTIONS };
})();
