/* Small motion shared by home and the stage (the rules come from Emil Kowalski's Animations on the Web).

   UI.say(button, text, dir)  changes a button's label with a crossfade: the old text drifts 8px up and out while the
                              new text rises 8px into place, both at once, with a light blur so the two read as one
                              change. dir -1 plays it the other way, for going back (Copied → Copy values).
                              About 280ms on a strong ease-out with no overshoot; a new change takes over mid-way.
                              With reduced motion, the text just fades.

   Press feedback (scale .97 while held) is in ui.css. */
window.UI = (() => {
  const EASE = 'cubic-bezier(.19, 1, .22, 1)', IN = 280, OUT = 200, SHIFT = 8;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  /* the label a button shows, ignoring text that is still on its way out */
  const label = btn => { const n = btn.querySelector(':scope > .say-new'); return n ? n.textContent : btn.textContent; };
  function say(btn, text, dir = 1) {
    if (!btn) return;
    const old = label(btn);
    if (old === text) return;
    btn.replaceChildren(); // a change mid-way takes over from where it is
    const now = document.createElement('span'), was = document.createElement('span');
    now.className = 'say-new'; now.textContent = text;
    was.className = 'say-old'; was.textContent = old; was.setAttribute('aria-hidden', 'true');
    btn.append(now, was);
    const move = y => calm.matches ? 'none' : `translateY(${y}px)`, soft = calm.matches ? 'none' : 'blur(2px)';
    now.animate([{ opacity: 0, transform: move(SHIFT * dir), filter: soft }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: IN, easing: EASE });
    const gone = () => was.remove();
    was.animate([{ opacity: 1, transform: 'none', filter: 'none' }, { opacity: 0, transform: move(-SHIFT * dir), filter: soft }], { duration: OUT, easing: EASE, fill: 'forwards' })
      .finished.then(gone, gone);
    setTimeout(gone, OUT + 80); // animations pause in a background tab; the leaving text still goes
  }
  return { say, label };
})();
