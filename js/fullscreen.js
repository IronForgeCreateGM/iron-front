'use strict';
// ===== v7.6.2 Full screen: Fullscreen API where it exists (iPad, Mac, Android, desktop); iPhone Safari has none, so tip "Add to Home Screen" =====
const FS = {
  el: () => document.documentElement,
  sup() { const d = FS.el(); return !!((d.requestFullscreen || d.webkitRequestFullscreen) && (document.fullscreenEnabled || document.webkitFullscreenEnabled)); },
  on: () => !!(document.fullscreenElement || document.webkitFullscreenElement),
  app: () => !!((window.matchMedia && (matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches)) || navigator.standalone === true),
  iphone: () => /iPhone|iPod/.test(navigator.userAgent),
  TIP: 'For full screen on iPhone: tap Share, then Add to Home Screen, and open Iron Front from the icon.',
  tip(force) {
    if (!force && localStorage.getItem('ifFsTip')) return; localStorage.setItem('ifFsTip', '1');
    let t = document.getElementById('fsTip'); if (!t) { t = document.createElement('div'); t.id = 'fsTip'; t.setAttribute('role', 'status'); document.body.appendChild(t); t.onclick = () => { t.style.display = 'none'; }; }
    t.innerHTML = '📲 ' + FS.TIP + ' <b>✕</b>'; t.style.display = 'block'; clearTimeout(FS.tt); FS.tt = setTimeout(() => { t.style.display = 'none'; }, 12000);
  },
  async toggle() {
    try {
      if (FS.on()) { if (document.exitFullscreen) await document.exitFullscreen(); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); return; }
      if (FS.sup()) { const d = FS.el(); if (d.requestFullscreen) await d.requestFullscreen({ navigationUI: 'hide' }); else d.webkitRequestFullscreen(); try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (e) { } return; }
    } catch (e) { }
    FS.tip(true); // iPhone Safari (or a refused request): explain the home-screen route
  },
  upd() { const on = FS.on(); document.querySelectorAll('.fsBtn').forEach(b => { b.textContent = on ? '⛶ Exit full screen' : '⛶ Full screen'; b.style.display = (FS.app() && !FS.sup()) ? 'none' : ''; }); document.body.classList.toggle('fs', on || FS.app()); },
  init() {
    document.querySelectorAll('.fsBtn').forEach(b => { b.onclick = e => { e.stopPropagation(); FS.toggle(); }; });
    document.addEventListener('fullscreenchange', FS.upd); document.addEventListener('webkitfullscreenchange', FS.upd); FS.upd();
    if (FS.iphone() && !FS.app() && !FS.sup()) setTimeout(() => FS.tip(false), 1500); // one-time tip on iPhone Safari
  }
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', FS.init); else FS.init();
