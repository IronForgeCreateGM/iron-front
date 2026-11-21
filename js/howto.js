'use strict';
// ===== v7.9.16 First-run "How to play" (App Store readiness): 5 short cards for brand-new players =====
// Shown once on a fresh launch (after the title screen), skippable, remembered on this device only
// (localStorage 'ifHowtoSeen' — no account, nothing sent anywhere, works offline). Re-open any time
// with ❓ How to play on the menu or the pause screen. Touch wording when the mobile UI is on or the
// pointer is coarse; mouse/keyboard wording otherwise. Skipped for deep links (?room=…) and automated
// runs unless ?howto=1; ?howto=0 never auto-shows. UI only: no sim/AI/replay change.
const HOWTO = {
  KEY: 'ifHowtoSeen', i: 0, open: false, prevFocus: null,
  touch() { try { return document.body.classList.contains('mobile') || (window.matchMedia && matchMedia('(pointer:coarse)').matches); } catch (e) { return false; } },
  cards() {
    const t = HOWTO.touch();
    return [
      { ic: '🏗', h: 'Build your base', p: t
        ? 'Tap a card in the build bar, then tap the ground near your base and press ✓. You pay when you place it, then it builds on the spot.'
        : 'Click a building in the panel on the right, then click the ground near your base. You pay when you place it, then it builds on the spot.' },
      { ic: '⚡', h: 'Power first, then money', p: 'Start with a <b>Power Plant</b>, then an <b>Ore Refinery</b> — its harvester gathers ore and turns it into cash. Add another Power Plant when the POWER bar runs low.' },
      { ic: '🪖', h: 'Make an army', p: 'The <b>Barracks</b> trains infantry. A <b>War Factory</b> (needs a Refinery and Barracks) builds tanks. Mix them: bullets shred infantry, cannons beat armour, rockets hit armour and aircraft.' },
      { ic: '🎯', h: 'Move and attack', p: t
        ? 'Tap a unit to select it (double-tap = every unit of that type), or tap <b>Army</b>. Tap the ground to attack-move, tap an enemy to attack. Drag to look around, pinch to zoom.'
        : 'Drag a box to select units. Right-click the ground to move, right-click an enemy to attack, <kbd>F</kbd> + click to attack-move. <kbd>WASD</kbd> or the screen edge moves the view, the wheel zooms.' },
      { ic: '🏆', h: 'Win the battle', p: 'Destroy every enemy base and production building. There is no time limit and you can pause any time. New? Start with <b>Play vs Bots</b> against an Easy AI.' }
    ];
  },
  seen() { try { return localStorage.getItem(HOWTO.KEY) === '1'; } catch (e) { return false; } },
  mark() { try { localStorage.setItem(HOWTO.KEY, '1'); } catch (e) {} },
  el() {
    let o = document.getElementById('howto'); if (o) return o;
    o = document.createElement('div'); o.id = 'howto'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-labelledby', 'howtoH');
    o.innerHTML = '<div class="htCard"><div class="htTop"><span class="htKick">HOW TO PLAY</span><button type="button" id="howtoSkip" class="htSkip">Skip</button></div>'
      + '<div id="howtoIc" class="htIc" aria-hidden="true"></div><h2 id="howtoH"></h2><p id="howtoP"></p><div id="howtoDots" class="htDots" aria-hidden="true"></div>'
      + '<div class="htNav"><button type="button" id="howtoBack">← Back</button><button type="button" id="howtoNext" class="htNext">Next →</button></div>'
      + '<div class="htFoot">Open this again from ❓ How to play on the menu.</div></div>';
    document.body.appendChild(o);
    const stop = e => e.stopPropagation(); // never let taps fall through to the menu or the 3D view
    ['pointerdown', 'pointerup', 'mousedown', 'touchstart', 'touchend', 'click', 'wheel', 'contextmenu'].forEach(ev => o.addEventListener(ev, stop));
    o.querySelector('#howtoSkip').onclick = () => HOWTO.close();
    o.querySelector('#howtoBack').onclick = () => HOWTO.go(HOWTO.i - 1);
    o.querySelector('#howtoNext').onclick = () => { if (HOWTO.i >= HOWTO.cards().length - 1) HOWTO.close(); else HOWTO.go(HOWTO.i + 1); };
    o.addEventListener('keydown', e => { e.stopPropagation(); });
    return o;
  },
  go(i) {
    const cs = HOWTO.cards(); HOWTO.i = Math.max(0, Math.min(cs.length - 1, i)); const c = cs[HOWTO.i], o = HOWTO.el();
    o.querySelector('#howtoIc').textContent = c.ic; o.querySelector('#howtoH').textContent = c.h; o.querySelector('#howtoP').innerHTML = c.p;
    o.querySelector('#howtoDots').innerHTML = cs.map((_, k) => `<i class="${k === HOWTO.i ? 'on' : ''}"></i>`).join('');
    const b = o.querySelector('#howtoBack'); b.style.visibility = HOWTO.i ? 'visible' : 'hidden';
    const n = o.querySelector('#howtoNext'); n.textContent = HOWTO.i === cs.length - 1 ? 'Got it — let\u2019s play' : 'Next →';
    o.querySelector('#howtoSkip').style.visibility = HOWTO.i === cs.length - 1 ? 'hidden' : 'visible';
    o.dataset.step = String(HOWTO.i + 1);
  },
  show() {
    const o = HOWTO.el(); HOWTO.prevFocus = document.activeElement; HOWTO.open = true; o.style.display = 'flex'; HOWTO.go(0);
    try { typeof hideTip === 'function' && hideTip(); } catch (e) {}
    setTimeout(() => { try { o.querySelector('#howtoNext').focus({ preventScroll: true }); } catch (e) {} }, 0);
  },
  close() {
    const o = document.getElementById('howto'); if (o) o.style.display = 'none'; HOWTO.open = false; HOWTO.mark();
    try { HOWTO.prevFocus && HOWTO.prevFocus.focus && HOWTO.prevFocus.focus({ preventScroll: true }); } catch (e) {}
  },
  key(e) { // capture phase: arrows/Enter/Esc drive the cards; nothing reaches the game hotkeys while open
    if (!HOWTO.open) return; e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); HOWTO.close(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); HOWTO.go(HOWTO.i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); HOWTO.go(HOWTO.i - 1); }
    else if (e.key === 'Enter' && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); document.getElementById('howtoNext').click(); }
  },
  auto() { // first launch only
    const q = new URLSearchParams(location.search), f = q.get('howto');
    if (f === '0') return false; if (f === '1') return true;
    if ([...q.keys()].length || (typeof navigator !== 'undefined' && navigator.webdriver)) return false;
    return !HOWTO.seen();
  },
  init() {
    addEventListener('keydown', HOWTO.key, true);
    document.querySelectorAll('.howtoBtn').forEach(b => { b.onclick = e => { e.preventDefault(); e.stopPropagation(); HOWTO.show(); }; });
    if (HOWTO.auto()) HOWTO.show(); // sits under the title screen (z-index), so it is there when the player taps TAP TO DEPLOY
  }
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', HOWTO.init); else HOWTO.init();
