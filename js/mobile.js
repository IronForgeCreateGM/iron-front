'use strict';
// v6.1 MOBILE PLAY (iPhone/Android, landscape-first). Desktop is untouched unless the mobile UI is on.
//  - camera: 1-finger drag pans (with inertia), pinch zooms (+2-finger pan), tap minimap jumps
//  - build bar (Clash-style cards): tap = queue / start placing; ghost follows the finger; big ✓ / ✗; walls = drag a chain
//  - army: tap unit = select (double-tap = all of that type on screen), Army / Idle / Type / Box buttons; tap ground = attack-move,
//    tap enemy = attack; Stop / Hold / Home / Rally
//  - helpers (toggles, on by default): auto-harvesters, auto-rally, idle auto-engage, auto-repair, one-tap power
//    Every helper only issues normal player commands for YOUR OWN units through NET.issue -> lockstep-safe online.
const MOB = { on: false, touch: typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0), tab: 'bld', g: null,
  auto: { harv: true, rally: true, engage: true, repair: false, power: true }, rally: null, box: false, mode: null, vel: { x: 0, y: 0 }, autoT: 0, harvPeak: 0, wantPower: false, perfT: 0, ft: [], stopped: new Set() };
try { const s = JSON.parse(localStorage.getItem('ifMobAuto') || 'null'); if (s) Object.assign(MOB.auto, s); } catch (e) {}
function mobDetect() { // phone / small tablet: coarse primary pointer + small viewport
  try { const coarse = matchMedia('(pointer: coarse)').matches, small = Math.max(screen.width, screen.height) <= 1400 && Math.min(screen.width, screen.height) <= 1100; return coarse && small; } catch (e) { return false; } }
function mobSet(on, save) {
  MOB.on = !!on; document.body.classList.toggle('mobile', MOB.on); if (save !== false) try { localStorage.setItem('ifMobile', MOB.on ? '1' : '0'); } catch (e) {}
  const b = document.getElementById('mobileBtn'); if (b) b.textContent = '📱 Touch controls: ' + (MOB.on ? 'On' : 'Off');
  const w = document.getElementById('mobWatchBtn'); if (w) w.style.display = MOB.on ? '' : 'none';
  if (MOB.on) mobBuildHud();
  const ctx = document.getElementById('ctx'); if (ctx) { const host = MOB.on ? document.getElementById('mCtx') : document.getElementById('side'); if (host && ctx.parentNode !== host) host.appendChild(ctx); }
  if (typeof R3 !== 'undefined' && R3.renderer && MOB.on) mobPerf();
}
function mobPerf() { // iPhone preset: DPR cap 1.5, no shadows/bloom/grass, lighter particles, 30 fps cap, shorter draw distance
  if (typeof UI !== 'undefined' && UI.set) { UI.set.quiet = true; UI.set.quietFps = UI.set.mobFps || '30'; }
  QUALITY.mobile = Object.assign({}, QUALITY.low, { pr: Math.min(1.5, window.devicePixelRatio || 1), shadows: false, bloom: false, fxaa: false, msaa: 0, grass: 0, fx: 0.35, label: 'Mobile' });
  R3.auto = false; applyQuality('mobile');
  if (R3.camera && R3.camera.far > 170) { R3.camera.far = 170; R3.camera.updateProjectionMatrix(); }
}
function mobWatch4v4() { // all-bot 4v4 on Volcano Crown XL, spectated
  homeShow('bots'); const ms = document.getElementById('mapSel'); ms.value = 'volcano8'; ms.dispatchEvent(new Event('change'));
  lobbySet([['si', 'A'], ['chief', 'A'], ['hard', 'A'], ['si', 'A'], ['hard', 'B'], ['si', 'B'], ['chief', 'B'], ['hard', 'B']]);
  document.getElementById('startBtn').click();
}
// ---------- HUD ----------
const MCMDS = [['army', '⚔', 'Army'], ['idle', '💤', 'Idle'], ['type', '👥', 'Type'], ['box', '⬚', 'Box'], ['stop', '✋', 'Stop'], ['hold', '⚓', 'Hold'], ['home', '🏠', 'Home'], ['rally', '🚩', 'Rally'], ['siege', '🎯', 'Siege']];
const MTABS = [['bld', '🏗'], ['def', '🛡'], ['inf', '🪖'], ['veh', '🚙'], ['air', '✈']];
const MAUTO = [['harv', '⛏ Auto-harvesters (rebuild lost ones)'], ['rally', '🚩 New units go to the rally point'], ['engage', '⚔ Idle units engage nearby enemies'], ['repair', '🔧 Auto-repair damaged buildings'], ['power', '⚡ Power helper (one tap builds + places Power)']];
function mobBuildHud() {
  if (document.getElementById('mHud')) return; const v = document.getElementById('view'); if (!v) return;
  const h = document.createElement('div'); h.id = 'mHud';
  h.innerHTML = `<div id="mTop"><button id="mMenu" class="mb">☰</button><div class="mres"><b id="mCr">$0</b><i id="mGas">◆ 0</i><div class="mpw"><div id="mPow"></div></div><span id="mPowT"></span></div>
    <button id="mPowerBtn" class="mb warn" style="display:none">⚡ +Power</button><button id="mAutoBtn" class="mb">🤖</button></div>
    <div id="mAlerts"></div><div id="mSel"></div><div id="mCtx"></div>
    <div id="mCmd">${MCMDS.map(([k, i, n]) => `<button class="mb mc" data-k="${k}"><span>${i}</span><small>${n}</small></button>`).join('')}</div>
    <div id="mPlace"><button id="mNo" class="mb big no">✗</button><button id="mOk" class="mb big ok">✓</button></div>
    <div id="mBar"><div id="mTabs">${MTABS.map(([k, i]) => `<button class="tab mtab" data-cat="${k}">${i}<i></i></button>`).join('')}</div><div id="mCards"></div></div>
    <div id="mAuto"><b>🤖 Helpers</b>${MAUTO.map(([k, n]) => `<label><input type="checkbox" data-k="${k}"> ${n}</label>`).join('')}<label><input type="checkbox" id="mFps60"> 60 fps (smoother, more battery)</label><button id="mAutoClose" class="mb">Done</button></div>
    <div id="mRotate"><div>📱↻<br>Rotate your phone to landscape</div></div>`;
  v.appendChild(h);
  const $m = id => document.getElementById(id), tapB = (el, f) => { el.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); audioInit(); f(e); }); };
  tapB($m('mMenu'), () => togglePause());
  tapB($m('mAutoBtn'), () => { const p = $m('mAuto'); p.style.display = p.style.display === 'block' ? 'none' : 'block'; });
  tapB($m('mAutoClose'), () => { $m('mAuto').style.display = 'none'; });
  h.querySelectorAll('#mAuto input[data-k]').forEach(c => { c.checked = !!MOB.auto[c.dataset.k]; c.onchange = () => { MOB.auto[c.dataset.k] = c.checked; try { localStorage.setItem('ifMobAuto', JSON.stringify(MOB.auto)); } catch (e) {} }; });
  { const f = $m('mFps60'); f.checked = (UI.set && UI.set.mobFps) === '60'; f.onchange = () => { UI.set.mobFps = f.checked ? '60' : '30'; UI.set.quietFps = UI.set.mobFps; try { saveSet(); } catch (e) {} }; }
  tapB($m('mPowerBtn'), () => mobPowerTap());
  tapB($m('mOk'), () => mobConfirm()); tapB($m('mNo'), () => mobCancel());
  h.querySelectorAll('.mc').forEach(b => tapB(b, () => mobCmd(b.dataset.k)));
  h.querySelectorAll('.mtab').forEach(b => tapB(b, () => { MOB.tab = b.dataset.cat; sfx('click'); mobCards(); }));
  ['mousedown', 'mouseup', 'mousemove', 'contextmenu'].forEach(ev => h.addEventListener(ev, e => e.stopPropagation())); // compat mouse events from taps must not reach the battlefield handlers
  ['mTop', 'mCmd', 'mBar', 'mPlace', 'mAuto', 'mSel', 'mCtx', 'mAlerts'].forEach(id => { const el = $m(id); ['touchstart', 'touchmove', 'touchend'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation(), { passive: true })); });
}
function mobCards() {
  const c = document.getElementById('mCards'); if (!c || typeof G === 'undefined' || !G.players || !G.players[ME]) return; c.innerHTML = '';
  document.querySelectorAll('.mtab').forEach(b => b.classList.toggle('on', b.dataset.cat === MOB.tab));
  for (const t of listFor(MOB.tab)) { const b = document.createElement('div'); b.className = 'item mcard'; b.innerHTML = itemHTML(t); b.dataset.t = t; mobWireCard(b, t); c.appendChild(b); }
  c.scrollLeft = 0;
}
function mobWireCard(b, t) { // tap = build/queue; long-press = tooltip; horizontal swipe scrolls the bar
  let lp = null, sx = 0, sy = 0, moved = false, long = false;
  b.addEventListener('pointerdown', e => { audioInit(); sx = e.clientX; sy = e.clientY; moved = false; long = false; clearTimeout(lp); lp = setTimeout(() => { long = true; showTip(t, b); mobTipPos(b); }, 450); });
  b.addEventListener('pointermove', e => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 12) { moved = true; clearTimeout(lp); } });
  const up = e => { clearTimeout(lp); if (long) { const P = G.players[ME], c = catOf(t); if (P.queues[c].some(q => q.t === t) || (BT[t] && P.ready[c] === t)) { clickItem(t, true, false); uiMsg('Cancelled one ' + (BT[t] || UT[t]).n + ' (long-press cancels)'); } setTimeout(() => { UI.tip.style.display = 'none'; }, 1400); return; } if (moved || e.type === 'pointercancel') return; mobCardTap(t); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('contextmenu', e => e.preventDefault());
}
function mobTipPos(b) { const r = b.getBoundingClientRect(); UI.tip.style.right = 'auto'; UI.tip.style.left = Math.max(8, Math.min(innerWidth - 300, r.left)) + 'px'; UI.tip.style.top = Math.max(8, r.top - UI.tip.offsetHeight - 8) + 'px'; }
function mobCardTap(t) {
  const P = G.players[ME], cat = catOf(t);
  if (BT[t] && P.ready[cat] === t) { UI.placing = t; UI.mode = null; mobStartPlace(); sfx('click'); return; }
  clickItem(t, false, false);
  if (UI.mode === 'wall') { MOB.mode = 'wall'; uiMsg('Walls: drag on the ground to lay a chain · ✗ when done'); }
  if (UI.placing) mobStartPlace();
}
function mobStartPlace() { const el = R3.renderer.domElement; UI.mouse.x = el.clientWidth * 0.5; UI.mouse.y = el.clientHeight * 0.45; MOB.ghostW = null; MOB.placeFor = UI.placing; if (UI.placing) uiMsg('Drag the building into place, then tap ✓'); }
function mobConfirm() {
  if (UI.mode === 'wall') { mobCancel(); return; }
  if (!UI.placing) return; const w = screenToWorld(UI.mouse.x, UI.mouse.y); if (!w) return;
  const d = BT[UI.placing], tx = Math.floor(w.x - d.w / 2 + 0.5), ty = Math.floor(w.y - d.h / 2 + 0.5), cat = d.cat;
  const ok = NET.online ? canPlace(UI.placing, ME, tx, ty) && (NET.issue({ c: 'place', cat, x: tx, y: ty }), true) : NET.issue({ c: 'place', cat, x: tx, y: ty });
  if (ok) { UI.placing = null; MOB.placeFor = null; sfx('ack'); } else { sfx('error'); uiMsg("Can't build there — drag the ghost to a green spot"); }
}
function mobCancel() { UI.placing = null; MOB.placeFor = null; UI.mode = null; UI.wallA = null; MOB.mode = null; MOB.box = false; UI.mouse.x = -1; }
function myArmy() { return G.ents.filter(e => e.team === ME && e.kind === 'u' && e.hp > 0 && UT[e.t].wpn && e.t !== 'harv'); }
function selUnits() { return UI.sel.filter(s => s.kind === 'u' && s.team === ME); }
function mobHome() { return G.ents.find(e => e.team === ME && e.t === 'hq') || G.ents.find(e => e.team === ME && e.t === 'cc') || G.ents.find(e => e.team === ME && e.kind === 'b'); }
function mobCmd(k) {
  const us = selUnits();
  if (k === 'army') { const a = myArmy(); setSel(a); uiMsg(a.length ? `⚔ Army selected (${a.length}) — tap the ground to attack-move` : 'No combat units yet'); }
  else if (k === 'idle') { const l = idleList('army'); if (l.length) { setSel(l); jumpTo(l[0].x, l[0].y); uiMsg(`💤 ${l.length} idle units`); } else uiMsg('No idle units'); }
  else if (k === 'type') { const ts = new Set(us.map(u => u.t)); if (!ts.size) { uiMsg('Select a unit first (or double-tap one)'); return; } setSel(G.ents.filter(o => o.team === ME && o.kind === 'u' && ts.has(o.t) && inView(o.x, o.y))); }
  else if (k === 'box') { MOB.box = !MOB.box; if (MOB.box) uiMsg('⬚ Drag a box to select units'); }
  else if (k === 'siege') { if (!unloadAll() && !toggleSiege()) { sfx('error'); uiMsg('Select Howler artillery to deploy Siege Mode (or a Medevac to unload all)'); } }
  else if (k === 'stop') { if (us.length) { NET.issue({ c: 'stop', u: ids(us) }); us.forEach(u => MOB.stopped.add(u.id)); sfx('ack'); } }
  else if (k === 'hold') { if (us.length) { const st = us.every(u => u.stance === 'hold') ? 'aggr' : 'hold'; NET.issue({ c: 'stance', u: ids(us), s: st }); uiMsg(st === 'hold' ? '⚓ Hold position' : '⚔ Aggressive'); sfx('ack'); } }
  else if (k === 'home') { const h = mobHome(); if (us.length && h) { NET.issue({ c: 'move', u: ids(us), x: h.x + (MW / 2 > h.x ? 4 : -4), y: h.y + (MH / 2 > h.y ? 4 : -4), am: false }); uiMsg('🏠 Retreating to base'); sfx('ack'); } else if (h) jumpTo(h.x, h.y); }
  else if (k === 'rally') { MOB.mode = MOB.mode === 'rally' ? null : 'rally'; if (MOB.mode) uiMsg('🚩 Tap the ground to set the rally point for new units'); }
  sfx('click');
}
function mobPowerTap() { const P = G.players[ME]; if (P.ready.bld === 'power') { MOB.wantPower = true; return; } if (P.queues.bld.some(q => q.t === 'power')) { MOB.wantPower = true; uiMsg('⚡ Power Plant on the way — it will be placed automatically'); return; }
  if (P.queues.bld.length || P.ready.bld) { uiMsg('Finish the current structure first'); sfx('error'); return; } clickItem('power', false, false); MOB.wantPower = true; uiMsg('⚡ Building a Power Plant — auto-placed when ready'); }
function mobSpot(t) { const hq = mobHome(); if (!hq) return null; try { return aiSpot(G.players[ME], t, hq, []); } catch (e) { return null; } }
// ---------- touch on the battlefield ----------
function mobInitTouch() {
  const cv = document.getElementById('view'); if (!cv || cv.__mob) return; cv.__mob = true;
  const T = MOB.T = { pts: new Map(), mode: null, moved: false, d0: 0, z0: 0, t0: 0, sx: 0, sy: 0, lastTap: 0, lastTapT: null, samples: [] };
  const rel = (x, y) => { const r = R3.renderer.domElement.getBoundingClientRect(); return { x: x - r.left, y: y - r.top }; };
  const mid = () => { const p = [...T.pts.values()]; return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }; };
  const dist = () => { const p = [...T.pts.values()]; return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); };
  const panBy = (a, b) => { const A = screenToWorld(a.x, a.y), B = screenToWorld(b.x, b.y); if (!A || !B) return null; const dx = B.x - A.x, dy = B.y - A.y; R3.cam.tx -= dx; R3.cam.ty -= dy; R3.cam.x -= dx; R3.cam.y -= dy; if (typeof DIR !== 'undefined') DIR.auto = false; return { dx, dy }; };
  cv.addEventListener('touchstart', e => { if (!MOB.on) return; e.preventDefault(); audioInit();
    for (const t of e.changedTouches) { const p = rel(t.clientX, t.clientY); T.pts.set(t.identifier, p); }
    MOB.vel.x = MOB.vel.y = 0; T.samples = [];
    if (T.pts.size === 1) { const p = [...T.pts.values()][0]; T.moved = false; T.t0 = performance.now(); T.sx = p.x; T.sy = p.y;
      if (UI.placing && UI.mouse.x >= 0 && Math.hypot(p.x - UI.mouse.x, p.y - UI.mouse.y) < 90) { T.mode = 'ghost'; T.gx = UI.mouse.x - p.x; T.gy = UI.mouse.y - p.y; }
      else if (UI.mode === 'wall' && !G.spectate) { T.mode = 'wall'; UI.mouse.x = p.x; UI.mouse.y = p.y; const w = screenToWorld(p.x, p.y); UI.wallA = w ? [Math.floor(w.x), Math.floor(w.y)] : null; }
      else if (MOB.box && !G.spectate) { T.mode = 'box'; const m = UI.mouse; m.x = m.sx = p.x; m.y = m.sy = p.y; m.down = true; m.shift = false; }
      else T.mode = 'pan'; }
    else if (T.pts.size === 2) { if (T.mode === 'box') UI.mouse.down = false; if (T.mode === 'wall') UI.wallA = null; T.mode = 'pinch'; T.d0 = dist(); T.z0 = R3.cam.td; T.m0 = mid(); T.moved = true; } }, { passive: false });
  cv.addEventListener('touchmove', e => { if (!MOB.on) return; e.preventDefault();
    const prev = new Map(T.pts); for (const t of e.changedTouches) T.pts.set(t.identifier, rel(t.clientX, t.clientY));
    if (T.pts.size === 1) { const [id, p] = [...T.pts][0], q = prev.get(id); if (!q) return; if (Math.hypot(p.x - T.sx, p.y - T.sy) > 10) T.moved = true;
      if (T.mode === 'ghost') { UI.mouse.x = p.x + T.gx; UI.mouse.y = p.y + T.gy; }
      else if (T.mode === 'wall' || T.mode === 'box') { UI.mouse.x = p.x; UI.mouse.y = p.y; }
      else if (T.mode === 'pan' && T.moved) { const d = panBy(q, p); if (d) { const now = performance.now(); T.samples.push([now, d.dx, d.dy]); while (T.samples.length && now - T.samples[0][0] > 90) T.samples.shift(); } } }
    else if (T.pts.size >= 2 && T.d0) { const z = Math.max(6, Math.min(G.spectate || G.watch ? 110 : 64, T.z0 * T.d0 / Math.max(10, dist()))); R3.cam.td = z; if (typeof DIR !== 'undefined') DIR.userZoom = true; const m = mid(); panBy(T.m0, m); T.m0 = m; } }, { passive: false });
  const end = e => { if (!MOB.on) return; e.preventDefault(); const lifted = [...e.changedTouches].map(t => rel(t.clientX, t.clientY)); for (const t of e.changedTouches) T.pts.delete(t.identifier);
    if (T.pts.size === 1 && T.mode === 'pinch') { T.mode = 'pan'; T.moved = true; T.d0 = 0; return; }
    if (T.pts.size) return; const p = lifted[0] || { x: T.sx, y: T.sy };
    if (T.mode === 'wall') { if (UI.wallA) { UI.mouse.x = p.x; UI.mouse.y = p.y; const tl = wallTiles(); UI.wallA = null; const ok = tl.filter(([x, y]) => canPlace('wall', ME, x, y)); if (ok.length) { NET.issue({ c: 'walls', t: ok }); sfx('ack'); } else { sfx('error'); uiMsg("Can't build walls there"); } } }
    else if (T.mode === 'box') { UI.mouse.x = p.x; UI.mouse.y = p.y; onUp({ button: 0 }); MOB.box = false; }
    else if (T.mode === 'pan' && !T.moved && performance.now() - T.t0 < 450) mobTap(p.x, p.y);
    else if (T.mode === 'pan' && T.samples.length > 1) { const s = T.samples, dt = Math.max(16, s[s.length - 1][0] - s[0][0]) / 1000; let dx = 0, dy = 0; for (const q of s) { dx += q[1]; dy += q[2]; } MOB.vel.x = -dx / dt; MOB.vel.y = -dy / dt; const sp = Math.hypot(MOB.vel.x, MOB.vel.y), mx = R3.cam.d * 3; if (sp > mx) { MOB.vel.x *= mx / sp; MOB.vel.y *= mx / sp; } }
    T.mode = null; T.d0 = 0; };
  cv.addEventListener('touchend', end, { passive: false }); cv.addEventListener('touchcancel', end, { passive: false });
  const mm = document.getElementById('minimap');
  const mmT = e => { if (!MOB.on) return; e.preventDefault(); e.stopPropagation(); const t = e.touches[0] || e.changedTouches[0], r = mm.getBoundingClientRect(); jumpTo((t.clientX - r.left) / r.width * MW, (t.clientY - r.top) / r.height * MH, true); MOB.vel.x = MOB.vel.y = 0; if (typeof DIR !== 'undefined') DIR.auto = false; };
  mm.addEventListener('touchstart', mmT, { passive: false }); mm.addEventListener('touchmove', mmT, { passive: false });
}
function mobTap(x, y) {
  const r = R3.renderer.domElement.getBoundingClientRect(), fake = b => ({ button: b, clientX: x + r.left, clientY: y + r.top, preventDefault() {}, altKey: false, shiftKey: false });
  if (G.spectate) { const now = performance.now(); if (now - MOB.T.lastTap < 400) { DIR.auto = true; DIR.userZoom = true; DIR.hold = 0; uiMsg('🎥 Following the action (drag to take over)'); } MOB.T.lastTap = now; return; }
  if (UI.placing) { UI.mouse.x = x; UI.mouse.y = y; MOB.ghostSet = true; return; } // tap moves the ghost there
  if (MOB.mode === 'rally') { const w = screenToWorld(x, y); if (w) { MOB.rally = { x: w.x, y: w.y }; MOB.rallied = {}; const bs = G.ents.filter(e => e.team === ME && e.kind === 'b' && ['barracks', 'factory', 'airfield'].includes(e.t)); if (bs.length) NET.issue({ c: 'rally', b: ids(bs), x: w.x, y: w.y }); marker(w.x, w.y); uiMsg('🚩 Rally point set'); sfx('ack'); } MOB.mode = null; return; }
  if (UI.mode) { UI.mouse.x = x; UI.mouse.y = y; onDown(fake(0)); return; } // sell / repair / nuke / unload / attack-move modes
  const t = pickAt(x, y), now = performance.now();
  if (t && t.team === ME) {
    if (MOB.T.lastTapT === t.t && now - MOB.T.lastTap < 380) { setSel(sameTypeOnScreen(t)); uiMsg('👥 All ' + (BT[t.t] || UT[t.t]).n + ' on screen' + (t.kind === 'b' ? (UPG[t.t] ? ' — Upgrade all below' : PRODB.includes(t.t) ? ' — tap ground for a shared rally point' : '') : '')); }
    else if ((t.kind === 'b' || t.cargo) && UI.sel.some(s => s.kind === 'u' && s.team === ME && s !== t && !s.cargo) && (t.cargo || t.t === 'refinery')) { onDown(fake(2)); }
    else setSel([t]);
    MOB.T.lastTap = now; MOB.T.lastTapT = t.t; sfx('click'); return; }
  MOB.T.lastTap = now; MOB.T.lastTapT = null;
  if (UI.sel.some(s => s.team === ME)) { const kc = UI.keys.control; UI.keys.control = true; try { onDown(fake(2)); } finally { UI.keys.control = kc; } return; } // ground = attack-move, enemy = attack, derrick = capture
  setSel(t ? [t] : []);
}
// ---------- per-frame (called from uiFrame) ----------
function mobFrame(dt) {
  if (G !== MOB.g) mobGameInit();
  const on = MOB.on && !G.spectate && !G.watch; document.body.classList.toggle('mplay', on);
  // inertia
  if (MOB.T && !MOB.T.pts.size && (Math.abs(MOB.vel.x) + Math.abs(MOB.vel.y)) > 0.05) { R3.cam.tx += MOB.vel.x * dt; R3.cam.ty += MOB.vel.y * dt; R3.cam.x = R3.cam.tx; R3.cam.y = R3.cam.ty; const k = Math.exp(-dt * 4.5); MOB.vel.x *= k; MOB.vel.y *= k; }
  R3.cam.tx = Math.max(-4, Math.min(MW + 4, R3.cam.tx)); R3.cam.ty = Math.max(-4, Math.min(MH + 10, R3.cam.ty));
  // frame-time telemetry (for the perf readout / tests)
  MOB.ft.push(dt * 1000); if (MOB.ft.length > 120) MOB.ft.shift();
  if (!on) return;
  { const P = G.players[ME], r = P.ready.bld; if (r && r !== MOB.lastReady && !UI.placing && !UI.mode && !(MOB.wantPower && r === 'power')) UI.placing = r; MOB.lastReady = r; } // structure done -> straight into placement
  if (UI.placing && MOB.placeFor !== UI.placing) mobStartPlace(); // a Defense finished -> auto placement mode
  if (UI.placing && UI.mouse.x >= 0) { // v6.2: the ghost stays on its ground spot while you pan/zoom
    const drag = MOB.T && MOB.T.mode === 'ghost';
    if (drag || MOB.ghostSet || !MOB.ghostW) { const w = screenToWorld(UI.mouse.x, UI.mouse.y); if (w) MOB.ghostW = w; MOB.ghostSet = false; }
    else { const p = worldToScreen(MOB.ghostW.x, MOB.ghostW.y, heightAt(MOB.ghostW.x, MOB.ghostW.y)); UI.mouse.x = p.x; UI.mouse.y = p.y; } }
  else if (!UI.placing) MOB.ghostW = null;
  const placing = !!UI.placing || UI.mode === 'wall';
  document.getElementById('mPlace').style.display = placing ? 'flex' : 'none'; document.getElementById('mOk').style.display = UI.placing ? '' : 'none';
  if (!UI.placing && UI.mode !== 'wall' && UI.mouse.x >= 0 && !(MOB.T && MOB.T.mode === 'box')) UI.mouse.x = -1;
  if ((MOB.hudT = (MOB.hudT || 0) + dt) > 0.25) { MOB.hudT = 0; mobHud(); }
  if ((MOB.autoT += dt) > 1) { MOB.autoT = 0; try { mobAuto(); } catch (e) { console.error(e); } }
}
function mobGameInit() {
  MOB.g = G; MOB.rally = null; MOB.rallied = {}; MOB.harvPeak = 0; MOB.wantPower = false; MOB.box = false; MOB.mode = null; MOB.placeFor = null; MOB.engT = {};
  if (MOB.on) { mobBuildHud(); mobCards(); mobPerf(); const ctx = document.getElementById('ctx'), host = document.getElementById('mCtx'); if (ctx && host && ctx.parentNode !== host) host.appendChild(ctx); }
}
function mobHud() {
  const P = G.players[ME], $m = id => document.getElementById(id);
  $m('mCr').textContent = '$' + Math.floor(P.cr); $m('mGas').textContent = '◆ ' + Math.floor(P.gas);
  const frac = P.gen ? Math.min(1, P.use / P.gen) : 1, pw = $m('mPow'); pw.style.width = (frac * 100) + '%'; pw.style.background = P.pow < 0 ? '#ff4d3d' : frac > 0.85 ? '#ffc23d' : '#4dff7a';
  $m('mPowT').textContent = P.pow < 0 ? 'LOW POWER' : '⚡' + (P.gen - P.use);
  $m('mPowerBtn').style.display = MOB.auto.power && (P.pow < 15 || MOB.wantPower) && avail(ME, 'power') ? '' : 'none'; $m('mPowerBtn').classList.toggle('busy', MOB.wantPower);
  if (MOB.tabsKey !== P.fac + listFor(MOB.tab).length) { MOB.tabsKey = P.fac + listFor(MOB.tab).length; mobCards(); }
  // selection chip
  const s = UI.sel.filter(e => e.hp > 0), su = s.filter(e => e.kind === 'u' && e.team === ME);
  const sh = !s.length ? '' : su.length > 1 ? `<span>⚔ ${su.length} selected</span>` : `<span>${(BT[s[0].t] || UT[s[0].t]).n}${foe(s[0].team, ME) ? ' (enemy)' : ''}</span>`;
  const sel = $m('mSel'); if (sel.dataset.h !== sh) { sel.dataset.h = sh; sel.innerHTML = sh ? sh + '<button class="mb x">✕</button>' : ''; const x = sel.querySelector('.x'); if (x) x.onclick = () => setSel([]); }
  sel.style.display = sh ? 'flex' : 'none';
  const ctx = $m('ctx'); $m('mCtx').style.display = !UI.placing && s.length && s.every(e => e.team === ME) && (s.length === 1 || s.every(e => e.kind === 'b')) && ctx && ctx.innerHTML.trim() ? 'block' : 'none';
  document.querySelectorAll('.mc').forEach(b => b.classList.toggle('on', (b.dataset.k === 'box' && MOB.box) || (b.dataset.k === 'rally' && MOB.mode === 'rally') || (b.dataset.k === 'hold' && su.length && su.every(u => u.stance === 'hold'))));
  document.querySelectorAll('.mc[data-k="siege"]').forEach(b => { const a = s.filter(u => u.kind === 'u' && u.team === ME && UT[u.t].siege); b.style.display = a.length ? '' : 'none'; b.classList.toggle('on', a.length > 0 && a.every(u => u.sg === 2)); });
  // alerts (tap -> jump)
  const ih = idleList('harv').length; let ah = UI.alerts.slice(0, 3).map((a, i) => `<span class="mal bad" data-a="${i}">⚠ ${a.txt}</span>`).join(''); if (ih) ah += `<span class="mal" data-idle="harv">⛏ ${ih} idle</span>`;
  const al = $m('mAlerts'); if (al.dataset.h !== ah) { al.dataset.h = ah; al.innerHTML = ah; al.querySelectorAll('.mal').forEach(el => el.onclick = () => { if (el.dataset.idle) selectIdle(el.dataset.idle); else { const a = UI.alerts[+el.dataset.a]; if (a) { jumpTo(a.x, a.y, true); MOB.vel.x = MOB.vel.y = 0; } } }); }
}
// ---------- helpers (automation) — normal commands for MY units only ----------
function mobAuto() {
  if (G.over || G.spectate || NET.desync) return; const P = G.players[ME]; if (!P || P.out || P.ai) return;
  const mine = G.ents.filter(e => e.team === ME && e.hp > 0), A = MOB.auto;
  if (A.harv) { const hv = mine.filter(e => e.t === 'harv').length, ref = mine.filter(e => e.t === 'refinery' && e.sell < 0).length; MOB.harvPeak = Math.max(MOB.harvPeak, hv);
    const want = Math.min(Math.max(MOB.harvPeak, ref), ref * 2); const queued = P.queues.veh.some(q => q.t === 'harv') || (P.queues.bld || []).some(q => q.t === 'harv');
    if (ref && hv < want && !queued && avail(ME, 'harv') && P.cr >= UT.harv.cost && canEnqueue(ME, 'harv')) NET.issue({ c: 'enq', t: 'harv', n: 1 }); }
  if (A.rally) { if (!MOB.rally) { const h = mobHome(); if (h) { const dx = MW / 2 - h.x, dy = MH / 2 - h.y, d = Math.hypot(dx, dy) || 1; MOB.rally = { x: h.x + dx / d * 7, y: h.y + dy / d * 7 }; } }
    if (MOB.rally) { const need = mine.filter(e => e.kind === 'b' && ['barracks', 'factory', 'airfield'].includes(e.t) && e.sell < 0 && !(MOB.rallied[e.id] && MOB.rallied[e.id] === MOB.rally) && !(e.rally && Math.hypot(e.rally.x - MOB.rally.x, e.rally.y - MOB.rally.y) < 0.5));
      if (need.length) { NET.issue({ c: 'rally', b: ids(need), x: MOB.rally.x, y: MOB.rally.y }); need.forEach(b => MOB.rallied[b.id] = MOB.rally); } } }
  for (const id of MOB.stopped) { const u = byId(id); if (!u || u.hp <= 0 || u.order !== 'idle' || u.path.length) MOB.stopped.delete(id); } // a new order clears the 'explicitly stopped' mark
  if (A.engage) { const idle = mine.filter(e => e.kind === 'u' && UT[e.t].wpn && e.t !== 'harv' && !UT[e.t].engineer && e.stance !== 'hold' && !MOB.stopped.has(e.id) && e.order === 'idle' && (e.idleT || 0) > 2.5 && !e.tgt && !(e.path && e.path.length) && G.time > (MOB.engT[e.id] || 0));
    if (idle.length) { const foes = G.ents.filter(o => foe(o.team, ME) && o.hp > 0 && (o.kind === 'u' || BT[o.t].wpn) && visibleTo0(o));
      const groups = new Map(); for (const u of idle) { let best = null, bd = 13; for (const f of foes) { const d = Math.hypot(f.x - u.x, f.y - u.y); if (d < bd) { bd = d; best = f; } } if (best) { (groups.get(best) || groups.set(best, []).get(best)).push(u); } MOB.engT[u.id] = G.time + 4; }
      for (const [f, us] of groups) NET.issue({ c: 'move', u: ids(us), x: f.x, y: f.y, am: true }); } }
  if (A.repair && P.cr > 600) { const hurt = mine.filter(e => e.kind === 'b' && !e.repair && e.hp < e.mhp * 0.6 && e.sell < 0 && e.t !== 'wall'); for (const b of hurt.slice(0, 2)) NET.issue({ c: 'repair', b: b.id, on: true }); }
  if (MOB.wantPower && P.ready.bld === 'power') { const sp = mobSpot('power'); if (sp) { NET.issue({ c: 'place', cat: 'bld', x: sp[0], y: sp[1] }); MOB.wantPower = false; if (UI.placing === 'power') { UI.placing = null; MOB.placeFor = null; } uiMsg('⚡ Power Plant placed'); } }
  if (MOB.wantPower && !P.ready.bld && !P.queues.bld.some(q => q.t === 'power')) MOB.wantPower = false;
}
// ---------- lifecycle: pause offline on hide, context loss, rejoin hint ----------
function mobLifecycle() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { MOB.hiddenAt = performance.now(); if (started && !NET.online && !G.over && !paused && MOB.on) togglePause(); return; }
    const away = performance.now() - (MOB.hiddenAt || performance.now()); if (typeof AU !== 'undefined' && AU.ctx && AU.ctx.state !== 'running') try { AU.ctx.resume(); } catch (e) {}
    if (started && NET.online && away > 3000 && typeof ONL !== 'undefined' && !ONL.host) setTimeout(() => { const peers = ONL.room && ONL.room.getPeers ? Object.keys(ONL.room.getPeers()).length : 1; if (!peers || (G.players[ME] && G.players[ME].ai)) mobRejoinBanner(); }, 2500);
  });
  const cv = R3.renderer.domElement;
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); MOB.lost = true; uiMsg('Graphics paused (GPU context lost) — restoring…'); }, false);
  cv.addEventListener('webglcontextrestored', () => { MOB.lost = false; try { applyQuality(R3.qName || 'mobile'); } catch (e) {} uiMsg('Graphics restored'); }, false);
}
function mobRejoinBanner() { let b = document.getElementById('mRejoin'); if (!b) { b = document.createElement('div'); b.id = 'mRejoin'; document.body.appendChild(b); }
  b.innerHTML = `Connection to the host was lost while the app was in the background.<br><button class="mb big">🔄 Rejoin match</button>`; b.style.display = 'block';
  b.querySelector('button').onclick = () => { const q = new URLSearchParams(location.search); q.set('room', ONL.code); const n = document.getElementById('pname'); if (n && n.value) q.set('name', n.value); location.href = location.pathname + '?' + q.toString(); }; }
window.addEventListener('load', () => {
  let saved = null; try { saved = localStorage.getItem('ifMobile'); } catch (e) {}
  const qs = new URLSearchParams(location.search).get('mobile');
  const hint = document.getElementById('mobHint');
  document.getElementById('mobileBtn').onclick = () => { mobSet(!MOB.on); if (hint) hint.style.display = 'none'; };
  document.getElementById('mobWatchBtn').onclick = mobWatch4v4;
  document.getElementById('mobMenuBtn').onclick = () => { if (typeof togglePause === 'function') togglePause(); };
  document.addEventListener('gesturestart', e => { if (MOB.on) e.preventDefault(); }); // iOS page pinch
  document.addEventListener('dblclick', e => { if (MOB.on) e.preventDefault(); }, { passive: false }); // no double-tap zoom
  document.addEventListener('touchstart', () => { try { audioInit(); } catch (e) {} }, { once: true, passive: true }); // iOS audio unlock
  mobSet(qs != null ? qs === '1' : saved != null ? saved === '1' : mobDetect(), qs == null && saved != null);
  setInterval(() => { const m = document.getElementById('menu'); document.body.classList.toggle('inmenu', !!m && getComputedStyle(m).display !== 'none'); }, 250);
  const iv = setInterval(() => { if (typeof R3 !== 'undefined' && R3.renderer) { clearInterval(iv); mobInitTouch(); mobLifecycle(); if (MOB.on) mobPerf(); } }, 300);
});
