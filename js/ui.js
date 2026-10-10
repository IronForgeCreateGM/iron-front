'use strict';
// ===== DOM UI: sidebar, minimap, overlay, input, hotkeys =====
const UI = { sel: [], tab: 'bld', placing: null, mode: null, mouse: { x: -1, y: -1, down: false, sx: 0, sy: 0 }, keys: {}, groups: {}, lastGroupKey: null, lastGroupT: 0, msgT: 0, icons: {}, lastClick: 0 };
const $ = id => document.getElementById(id);
function uiMsg(s) { const m = $('msg'); m.textContent = s; m.style.opacity = 1; UI.msgT = 3; }
function drawIcon(t) {
  const c = document.createElement('canvas'); c.width = 96; c.height = 64; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#2a3a52'); g.addColorStop(1, '#0f1622'); x.fillStyle = g; x.fillRect(0, 0, 96, 64);
  x.strokeStyle = 'rgba(120,180,255,.25)'; for (let i = 0; i < 96; i += 8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 64); x.stroke(); }
  const T = '#3d93ff', D = '#2a2f37', M = '#8a939e', L = '#cfd6de', Y = '#e0a820';
  const R = (c, a, b, w, h) => { x.fillStyle = c; x.fillRect(a, b, w, h); }, C = (c, a, b, r) => { x.fillStyle = c; x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); };
  x.save(); x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 6; x.shadowOffsetY = 3;
  switch (t) {
    case 'power': R(M, 22, 34, 52, 20); C(L, 36, 26, 11); C(L, 60, 26, 11); C(T, 36, 26, 5); C(T, 60, 26, 5); break;
    case 'refinery': R(M, 14, 20, 40, 32); R(T, 14, 18, 40, 5); C(Y, 68, 30, 13); C(L, 68, 30, 7); break;
    case 'barracks': R(M, 22, 22, 52, 30); x.fillStyle = T; x.beginPath(); x.moveTo(18, 24); x.lineTo(48, 8); x.lineTo(78, 24); x.fill(); R(D, 42, 38, 12, 14); break;
    case 'factory': R(M, 12, 16, 72, 38); for (let i = 0; i < 3; i++) R(T, 12, 18 + i * 12, 72, 4); R(D, 34, 34, 28, 20); break;
    case 'airpad': C(D, 48, 32, 24); R(L, 38, 20, 5, 24); R(L, 53, 20, 5, 24); R(L, 38, 30, 20, 4); break;
    case 'tech': R(L, 22, 30, 52, 24); x.fillStyle = '#66ccff'; x.beginPath(); x.arc(48, 32, 20, Math.PI, 0); x.fill(); break;
    case 'turret': C(M, 48, 40, 16); C(T, 48, 34, 11); R(D, 52, 31, 30, 6); break;
    case 'aagun': C(M, 48, 40, 16); C(T, 48, 34, 11); x.save(); x.translate(50, 30); x.rotate(-0.8); R(D, 0, -6, 28, 4); R(D, 0, 3, 28, 4); x.restore(); break;
    case 'wall': for (let i = 0; i < 3; i++) R(i % 2 ? M : L, 14 + i * 23, 24, 22, 22); break;
    case 'rifle': case 'rocketeer': case 'engineer': R(T, 40, 22, 16, 22); C(t === 'engineer' ? Y : '#d9a37a', 48, 16, 7); R(D, 42, 44, 5, 14); R(D, 50, 44, 5, 14);
      if (t === 'rifle') R(D, 50, 28, 26, 4); if (t === 'rocketeer') R(M, 30, 18, 40, 7); if (t === 'engineer') R(Y, 30, 26, 10, 14); break;
    case 'scout': R(T, 22, 26, 50, 16); for (const [a, b] of [[28, 22], [62, 22], [28, 44], [62, 44]]) C(D, a, b, 6); R(D, 46, 30, 30, 3); break;
    case 'light': case 'heavy': { const k = t === 'heavy' ? 1.2 : 1; R(D, 48 - 30 * k, 18, 60 * k, 8); R(D, 48 - 30 * k, 42, 60 * k, 8); R(T, 48 - 27 * k, 24, 54 * k, 20); C(T, 44, 34, 10 * k); R(D, 50, 31, 32, 4 + (k > 1 ? 3 : 0)); break; }
    case 'arty': R(D, 20, 20, 56, 8); R(D, 20, 42, 56, 8); R(T, 22, 26, 52, 18); x.save(); x.translate(44, 34); x.rotate(-0.5); R(D, 0, -3, 44, 6); x.restore(); break;
    case 'aa': R(D, 20, 20, 56, 8); R(D, 20, 42, 56, 8); R(T, 22, 26, 52, 18); x.save(); x.translate(46, 34); x.rotate(-0.9); R(D, 0, -6, 30, 4); R(D, 0, 3, 30, 4); x.restore(); C(L, 34, 30, 5); break;
    case 'harv': R(D, 14, 16, 68, 8); R(D, 14, 42, 68, 8); R(Y, 16, 22, 50, 22); R(T, 64, 22, 16, 22); R('#e8b030', 22, 26, 36, 14); break;
    case 'gunship': x.fillStyle = T; x.beginPath(); x.ellipse(52, 34, 22, 10, 0, 0, 7); x.fill(); R(D, 10, 32, 30, 4); R(T, 8, 26, 4, 14); R(D, 20, 16, 64, 3); R(D, 50, 6, 3, 52); break;
    case 'hq': R(M, 18, 16, 60, 38); R(T, 18, 30, 60, 5); R(L, 50, 8, 18, 20); break;
  }
  x.restore(); return c.toDataURL();
}
function uiSetup() {
  for (const t of [...Object.keys(BT), ...Object.keys(UT)]) UI.icons[t] = drawIcon(t);
  const tabs = $('tabs');
  for (const k in CATS) { const b = document.createElement('button'); b.className = 'tab'; b.dataset.cat = k; b.innerHTML = `${CATS[k]}<i></i>`; b.onclick = () => { UI.tab = k; sfx('click'); buildGrid(); }; tabs.appendChild(b); }
  buildGrid();
  $('sellBtn').onclick = () => { UI.mode = UI.mode === 'sell' ? null : 'sell'; UI.placing = null; sfx('click'); };
  $('repBtn').onclick = () => { UI.mode = UI.mode === 'repair' ? null : 'repair'; UI.placing = null; sfx('click'); };
  $('pauseBtn').onclick = () => togglePause();
  $('muteBtn').onclick = () => { AU.muted = !AU.muted; $('muteBtn').textContent = AU.muted ? '🔇' : '🔊'; };
  const cv = $('view');
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('mousemove', e => { UI.mouse.x = e.offsetX; UI.mouse.y = e.offsetY; });
  cv.addEventListener('mouseleave', () => { UI.mouse.x = -1; });
  cv.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  cv.addEventListener('wheel', e => { e.preventDefault(); R3.cam.d = Math.max(12, Math.min(48, R3.cam.d * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', e => { UI.keys[e.key.toLowerCase()] = false; });
  const mm = $('minimap');
  const mmPos = e => { const r = mm.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * MW, y: (e.clientY - r.top) / r.height * MH }; };
  mm.addEventListener('contextmenu', e => e.preventDefault());
  mm.addEventListener('mousedown', e => { const p = mmPos(e); if (e.button === 2) { const u = UI.sel.filter(s => s.kind === 'u'); if (u.length) { orderMove(u, p.x, p.y, false); marker(p.x, p.y); sfx('ack'); } } else { UI.mmDrag = true; R3.cam.x = p.x; R3.cam.y = p.y + 4; } });
  mm.addEventListener('mousemove', e => { if (UI.mmDrag) { const p = mmPos(e); R3.cam.x = p.x; R3.cam.y = p.y + 4; } });
  window.addEventListener('mouseup', () => { UI.mmDrag = false; });
  UI.mmBase = document.createElement('canvas'); UI.mmBase.width = MW; UI.mmBase.height = MH; setTimeout(() => { minimap(); sidebar(); }, 0);
}
function buildGrid() {
  const g = $('grid'); g.innerHTML = '';
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.cat === UI.tab));
  const list = [...Object.keys(BT).filter(t => t !== 'hq' && BT[t].cat === UI.tab), ...Object.keys(UT).filter(t => FROMCAT[UT[t].from] === UI.tab)];
  for (const t of list) {
    const d = BT[t] || UT[t], b = document.createElement('div'); b.className = 'item'; b.dataset.t = t;
    b.title = `${d.n} — $${d.cost}` + (d.req && d.req.length ? `\nRequires: ${d.req.map(r => BT[r].n).join(', ')}` : '') + (UT[t] ? `\nFrom: ${BT[d.from].n}` : '') + (UT[t] && UT[t].wpn ? `\nWeapon: ${W[UT[t].wpn].type} (${W[UT[t].wpn].ground ? 'ground' : ''}${W[UT[t].wpn].air ? ' air' : ''})` : '');
    b.innerHTML = `<img src="${UI.icons[t]}"><div class="nm">${d.n}</div><div class="cost">$${d.cost}</div><div class="prog"></div><div class="cnt"></div><div class="rdy">READY</div><div class="lock">🔒</div>`;
    b.onmousedown = e => { e.preventDefault(); audioInit(); clickItem(t, e.button === 2); };
    b.oncontextmenu = e => e.preventDefault();
    g.appendChild(b);
  }
}
function clickItem(t, right) {
  const P = G.players[0], cat = catOf(t);
  if (right) { if (cancel(0, t)) { sfx('click'); if (UI.placing === t) UI.placing = null; } return; }
  if (BT[t] && P.ready[cat] === t) { UI.placing = t; UI.mode = null; sfx('click'); return; }
  if (!avail(0, t)) { sfx('error'); uiMsg('Requires: ' + ((BT[t] || UT[t]).req.concat(UT[t] ? [UT[t].from] : []).filter(r => !hasBuilt(0, r)).map(r => BT[r].n).join(', ') || 'Command Yard')); return; }
  if (enqueue(0, t)) sfx('click'); else { sfx('error'); uiMsg(BT[t] ? 'Already building a structure' : 'Queue full'); }
}
function pickAt(sx, sy) {
  const w = screenToWorld(sx, sy); if (!w) return null;
  let best = null, bd = 1e9;
  for (const e of G.ents) {
    if (!visibleTo0(e)) continue;
    if (e.kind === 'b') { if (w.x >= e.tx && w.x <= e.tx + e.w && w.y >= e.ty && w.y <= e.ty + e.h) { if (bd > 50) { best = e; bd = 50; } } continue; }
    const p = worldToScreen(e.x, e.y, heightAt(e.x, e.y) + e.z + 0.3), d = Math.hypot(p.x - sx, p.y - sy), rr = 14 + UT[e.t].r * 20;
    if (d < rr && d < bd) { bd = d; best = e; }
  }
  return best;
}
function setSel(list) { G.ents.forEach(e => e.sel = false); UI.sel = list; list.forEach(e => e.sel = true); }
function onDown(e) {
  audioInit();
  const m = UI.mouse; m.x = e.offsetX; m.y = e.offsetY;
  const w = screenToWorld(m.x, m.y);
  if (e.button === 2) {
    if (UI.placing || UI.mode) { UI.placing = null; UI.mode = null; return; }
    if (!w) return;
    const tgt = pickAt(m.x, m.y), units = UI.sel.filter(s => s.kind === 'u' && s.team === 0);
    if (units.length) {
      if (tgt && tgt.team !== 0) { orderAttack(units, tgt); marker(tgt.x, tgt.y, true); }
      else if (tgt && tgt.kind === 'b' && units.some(u => UT[u.t].engineer)) { orderAttack(units.filter(u => UT[u.t].engineer), tgt); }
      else if (tgt && tgt.t === 'refinery' && units.some(u => u.t === 'harv')) { units.filter(u => u.t === 'harv').forEach(h => { h.hst = 'ret'; h.path = []; }); }
      else { orderMove(units, w.x, w.y, UI.keys.control || false); marker(w.x, w.y); }
      sfx('ack');
    } else { const bs = UI.sel.filter(s => s.kind === 'b' && s.team === 0 && ['barracks', 'factory', 'airpad'].includes(s.t)); bs.forEach(b => b.rally = { x: w.x, y: w.y }); if (bs.length) { marker(w.x, w.y); sfx('ack'); } }
    return;
  }
  if (e.button !== 0) return;
  if (UI.placing) {
    const d = BT[UI.placing], tx = Math.floor(w.x - d.w / 2 + 0.5), ty = Math.floor(w.y - d.h / 2 + 0.5);
    if (placeReady(0, BT[UI.placing].cat, tx, ty)) { if (!e.shiftKey || BT[UI.placing].cat !== 'def') UI.placing = null; else { UI.placing = null; } } else { sfx('error'); uiMsg("Can't build there"); }
    return;
  }
  if (UI.mode === 'sell' || UI.mode === 'repair') {
    const t = pickAt(m.x, m.y);
    if (t && t.kind === 'b' && t.team === 0) { if (UI.mode === 'sell') { sellB(t); sfx('click'); } else { t.repair = !t.repair; sfx('click'); } }
    if (!e.shiftKey) UI.mode = null; return;
  }
  if (UI.mode === 'amove') { const units = UI.sel.filter(s => s.kind === 'u' && s.team === 0); if (w && units.length) { orderMove(units, w.x, w.y, true); marker(w.x, w.y, true); sfx('ack'); } UI.mode = null; return; }
  m.down = true; m.sx = m.x; m.sy = m.y; m.shift = e.shiftKey;
}
function onUp(e) {
  const m = UI.mouse; if (!m.down || e.button !== 0) return; m.down = false;
  const x0 = Math.min(m.sx, m.x), x1 = Math.max(m.sx, m.x), y0 = Math.min(m.sy, m.y), y1 = Math.max(m.sy, m.y);
  let list;
  if (x1 - x0 < 6 && y1 - y0 < 6) {
    const t = pickAt(m.x, m.y); list = t ? [t] : [];
    const now = performance.now();
    if (t && t.team === 0 && t.kind === 'u' && now - UI.lastClick < 350 && UI.lastPick === t.t) { // double click: all of type on screen
      const el = R3.renderer.domElement; list = G.ents.filter(o => o.team === 0 && o.t === t.t && (() => { const p = worldToScreen(o.x, o.y, 0); return p.x >= 0 && p.y >= 0 && p.x <= el.clientWidth && p.y <= el.clientHeight; })()); }
    UI.lastClick = now; UI.lastPick = t && t.t;
  } else {
    list = G.ents.filter(o => o.team === 0 && o.kind === 'u' && (() => { const p = worldToScreen(o.x, o.y, heightAt(o.x, o.y) + o.z); return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1; })());
    if (list.some(u => u.t !== 'harv')) list = list.filter(u => u.t !== 'harv');
  }
  if (m.shift) list = [...new Set([...UI.sel, ...list])];
  setSel(list); if (list.length && list[0].team === 0) sfx('ack');
}
function onKey(e) {
  const k = e.key.toLowerCase(); UI.keys[k] = true; UI.keys.control = e.ctrlKey || e.metaKey;
  if (!started) return;
  if (k === 'escape') { if (UI.placing || UI.mode) { UI.placing = null; UI.mode = null; } else togglePause(); return; }
  if (k === 'p') { togglePause(); return; }
  if (paused) return;
  if (/^[1-9]$/.test(k)) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) { UI.groups[k] = UI.sel.filter(s => s.team === 0).map(s => s.id); uiMsg('Group ' + k + ' set'); return; }
    const list = (UI.groups[k] || []).map(byId).filter(Boolean); setSel(list);
    const now = performance.now(); if (UI.lastGroupKey === k && now - UI.lastGroupT < 400 && list.length) { R3.cam.x = list[0].x; R3.cam.y = list[0].y + 4; }
    UI.lastGroupKey = k; UI.lastGroupT = now; return;
  }
  if (k === 's') orderStop(UI.sel.filter(s => s.team === 0));
  if (k === 'a' && UI.sel.some(s => s.kind === 'u')) { UI.mode = 'amove'; uiMsg('Attack-move: left-click target'); }
  if (k === 'h') { const hq = G.ents.find(e => e.team === 0 && e.t === 'hq'); if (hq) { R3.cam.x = hq.x; R3.cam.y = hq.y + 4; } }
  if (k === 'q') { UI.tab = Object.keys(CATS)[(Object.keys(CATS).indexOf(UI.tab) + 1) % 5]; buildGrid(); }
  if (k === 'x') $('sellBtn').onclick(); if (k === 'r') $('repBtn').onclick();
  if (k === 'e') setSel(G.ents.filter(o => o.team === 0 && o.kind === 'u' && UT[o.t].wpn));
}
function uiFrame(dt) {
  const P = G.players[0], m = UI.mouse, el = R3.renderer.domElement, W_ = el.clientWidth, H_ = el.clientHeight;
  // camera scroll
  const sp = dt * R3.cam.d * 0.9;
  if (UI.keys.arrowleft || (m.x >= 0 && m.x < 6)) R3.cam.x -= sp; if (UI.keys.arrowright || (m.x >= 0 && m.x > W_ - 6)) R3.cam.x += sp;
  if (UI.keys.arrowup || (m.x >= 0 && m.y < 6)) R3.cam.y -= sp; if (UI.keys.arrowdown || (m.x >= 0 && m.y > H_ - 6)) R3.cam.y += sp;
  UI.sel = UI.sel.filter(s => s.hp > 0 && !s.dead && (s.team === 0 || visibleTo0(s)));
  // ghost
  if (UI.placing && m.x >= 0) { const w = screenToWorld(m.x, m.y); if (w) { const d = BT[UI.placing], tx = Math.floor(w.x - d.w / 2 + 0.5), ty = Math.floor(w.y - d.h / 2 + 0.5); ghost(UI.placing, tx, ty, canPlace(UI.placing, 0, tx, ty)); } }
  else ghost(null);
  if (UI.placing && P.ready[BT[UI.placing].cat] !== UI.placing) UI.placing = null;
  if (UI.msgT > 0) { UI.msgT -= dt; if (UI.msgT <= 0) $('msg').style.opacity = 0; }
  el.style.cursor = UI.placing ? 'cell' : UI.mode === 'sell' ? 'not-allowed' : UI.mode === 'repair' ? 'help' : UI.mode === 'amove' ? 'crosshair' : 'default';
  UI.t = (UI.t || 0) + dt; if (UI.t > 0.1) { UI.t = 0; sidebar(); }
  if ((UI.mmT = (UI.mmT || 0) + dt) > 0.25) { UI.mmT = 0; minimap(); }
  overlay();
}
function sidebar() {
  const P = G.players[0];
  $('cr').textContent = '$' + Math.floor(P.cr);
  const pb = $('powbar'); const frac = P.gen ? Math.min(1, P.use / P.gen) : 1; pb.style.width = (frac * 100) + '%'; pb.style.background = P.pow < 0 ? '#ff4d3d' : frac > 0.85 ? '#ffc23d' : '#4dff7a';
  $('powtxt').textContent = `${P.use} / ${P.gen}` + (P.pow < 0 ? '  LOW POWER' : '');
  for (const b of document.querySelectorAll('.item')) {
    const t = b.dataset.t, cat = catOf(t), q = P.queues[cat], d = BT[t] || UT[t];
    const ok = avail(0, t); b.classList.toggle('locked', !ok);
    const n = q.filter(i => i.t === t).length, first = q[0] && q[0].t === t ? q[0] : null;
    b.querySelector('.prog').style.height = first ? (100 - first.prog * 100) + '%' : '0%';
    b.querySelector('.cnt').textContent = n > 1 ? n : '';
    b.classList.toggle('ready', P.ready[cat] === t); b.classList.toggle('active', !!first);
    b.classList.toggle('poor', P.cr < d.cost * 0.1);
  }
  document.querySelectorAll('.tab').forEach(b => { const c = b.dataset.cat; b.querySelector('i').textContent = P.ready[c] ? '!' : P.queues[c].length ? '•' : ''; b.classList.toggle('dis', !Object.keys({ ...BT, ...UT }).some(t => t !== 'hq' && catOf(t) === c && avail(0, t))); });
  $('sellBtn').classList.toggle('on', UI.mode === 'sell'); $('repBtn').classList.toggle('on', UI.mode === 'repair');
  // selection info
  const s = UI.sel; let h = '';
  if (s.length === 1) { const e = s[0], d = defOf(e); h = `<img src="${UI.icons[e.t]}"><div><b>${d.n}</b><br>HP ${Math.ceil(e.hp)} / ${e.mhp}` + (e.t === 'harv' ? `<br>Ore ${Math.floor(e.load)}/700` : '') + (e.kind === 'u' && UT[e.t].wpn ? `<br>${W[UT[e.t].wpn].type} weapon` : '') + (e.kind === 'b' ? `<br>Power ${BT[e.t].pow > 0 ? '+' : ''}${BT[e.t].pow}` : '') + (e.team !== 0 ? '<br><span style="color:#f66">Enemy</span>' : '') + '</div>'; }
  else if (s.length > 1) { const c = {}; s.forEach(e => c[e.t] = (c[e.t] || 0) + 1); h = Object.entries(c).map(([t, n]) => `<span class="chip"><img src="${UI.icons[t]}">${n}</span>`).join(''); }
  $('info').innerHTML = h;
}
function minimap() {
  const c = $('minimap'), x = c.getContext('2d'), s = c.width / MW;
  const b = UI.mmBase.getContext('2d'), img = b.createImageData(MW, MH);
  for (let i = 0; i < MW * MH; i++) {
    let r = 52, g = 92, bl = 44; const t = G.map[i];
    if (t === 1) { r = 110; g = 102; bl = 92; } else if (t === 2) { r = 30; g = 80; bl = 120; } else if (G.ore[i] > 0) { r = 200; g = 160; bl = 50; }
    const f = G.vis[i] ? 1 : G.seen[i] ? 0.5 : 0; img.data.set([r * f, g * f, bl * f, 255], i * 4);
  }
  b.putImageData(img, 0, 0); x.imageSmoothingEnabled = false; x.drawImage(UI.mmBase, 0, 0, c.width, c.height);
  for (const e of G.ents) { if (!visibleTo0(e)) continue; x.fillStyle = e.team === 0 ? '#4da3ff' : '#ff4d3d'; if (e.kind === 'b') x.fillRect(e.tx * s, e.ty * s, e.w * s, e.h * s); else x.fillRect(e.x * s - 1.5, e.y * s - 1.5, 3, 3); }
  // camera footprint
  const el = R3.renderer.domElement, cs = [[0, 0], [el.clientWidth, 0], [el.clientWidth, el.clientHeight], [0, el.clientHeight]].map(([a, b2]) => screenToWorld(a, b2));
  if (cs.every(Boolean)) { x.strokeStyle = '#fff'; x.lineWidth = 1; x.beginPath(); cs.forEach((p, i) => i ? x.lineTo(p.x * s, p.y * s) : x.moveTo(p.x * s, p.y * s)); x.closePath(); x.stroke(); }
}
function overlay() {
  const c = $('ov'), x = c.getContext('2d'), el = R3.renderer.domElement;
  if (c.width !== el.clientWidth || c.height !== el.clientHeight) { c.width = el.clientWidth; c.height = el.clientHeight; }
  x.clearRect(0, 0, c.width, c.height);
  for (const e of G.ents) {
    if (!(e.sel || e.hp < e.mhp) || !visibleTo0(e)) continue;
    const top = e.kind === 'b' ? 1.8 : e.z + (UT[e.t].armor === 'inf' ? 0.85 : 0.9);
    const p = worldToScreen(e.x, e.kind === 'b' ? e.ty : e.y, heightAt(e.x, e.y) + top); if (p.behind) continue;
    const w = e.kind === 'b' ? e.w * 22 : Math.max(22, UT[e.t].r * 60), f = Math.max(0, e.hp / e.mhp);
    x.fillStyle = 'rgba(0,0,0,.7)'; x.fillRect(p.x - w / 2 - 1, p.y - 1, w + 2, 6);
    x.fillStyle = f > 0.6 ? '#4dff7a' : f > 0.3 ? '#ffd23d' : '#ff4d3d'; x.fillRect(p.x - w / 2, p.y, w * f, 4);
    if (e.t === 'harv' && e.load > 0) { x.fillStyle = '#e8b030'; x.fillRect(p.x - w / 2, p.y + 5, w * e.load / 700, 2); }
    if (e.sel && e.kind === 'b' && e.rally && e.team === 0) { const r = worldToScreen(e.rally.x, e.rally.y, 0); x.strokeStyle = 'rgba(120,255,140,.7)'; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(p.x, p.y + 20); x.lineTo(r.x, r.y); x.stroke(); x.setLineDash([]); x.fillStyle = '#7f8'; x.fillRect(r.x - 2, r.y - 12, 2, 12); x.fillRect(r.x, r.y - 12, 8, 5); }
    if (e.sel && e.kind === 'u' && e.team === 0 && e.path.length && UI.keys.shift) { x.strokeStyle = 'rgba(120,255,140,.4)'; x.beginPath(); let q = worldToScreen(e.x, e.y, 0); x.moveTo(q.x, q.y); for (const pt of e.path) { q = worldToScreen(pt.x, pt.y, 0); x.lineTo(q.x, q.y); } x.stroke(); }
  }
  const m = UI.mouse;
  if (m.down) { x.strokeStyle = '#7dff9a'; x.fillStyle = 'rgba(125,255,154,.08)'; x.lineWidth = 1; x.fillRect(m.sx, m.sy, m.x - m.sx, m.y - m.sy); x.strokeRect(m.sx, m.sy, m.x - m.sx, m.y - m.sy); }
}
