'use strict';
// ===== DOM UI: sidebar, context panel, alerts, minimap, overlay, input, hotkeys, settings =====
const HOTKEYS = ['t', 'y', 'u', 'i', 'o', 'j', 'k', 'l'];
const UI = { sel: [], tab: 'bld', placing: null, mode: null, mouse: { x: -1, y: -1, down: false, sx: 0, sy: 0 }, keys: {}, groups: {}, lastGroupKey: null, lastGroupT: 0, msgT: 0, lastClick: 0, pings: [], alerts: [], gridList: [],
  set: Object.assign({ edge: 1, hbars: 'smart', fps: false, vol: 0.45, quality: 'auto', bri: 0, con: 1.15, sat: 1.22 }, JSON.parse(localStorage.getItem('if_settings') || '{}')) };
const $ = id => document.getElementById(id);
function saveSet() { localStorage.setItem('if_settings', JSON.stringify(UI.set)); localStorage.setItem('if_quality', UI.set.quality); }
function uiMsg(s) { const m = $('msg'); if (!m) return; m.textContent = s; m.style.opacity = 1; UI.msgT = 3; }
function icon(t) { return (R3.portraits && R3.portraits[t]) || ''; }
const ANN = { last: {}, q: [], t: 0 };
function announce(txt, key, gap) { if (G.time - (ANN.last[key] ?? -999) < (gap || 10)) return; ANN.last[key] = G.time; ANN.q.push(txt); if (ANN.q.length > 3) ANN.q.shift(); }
function annFrame(dt) { const el = document.getElementById('announce'); if (!el) return; ANN.t -= dt; if (ANN.t <= 0 && ANN.q.length) { el.textContent = ANN.q.shift(); el.classList.add('on'); ANN.t = 2.6; } else if (ANN.t <= 0.4) el.classList.remove('on'); }
function uiAlert(ev) {
  sfx('alert'); UI.pings.push({ x: ev.x, y: ev.y, t: 3 });
  UI.alerts.unshift({ txt: ev.harv ? 'Harvester under attack' : 'Under attack', x: ev.x, y: ev.y, t: 8 }); UI.alerts.length = Math.min(UI.alerts.length, 2);
  uiMsg(ev.harv ? 'Our harvester is under attack!' : 'We are under attack!');
}
function uiSetup() {
  const tabs = $('tabs');
  for (const k in CATS) { const b = document.createElement('button'); b.className = 'tab'; b.dataset.cat = k; b.innerHTML = `${CATS[k]}<i></i>`; b.onclick = () => { UI.tab = k; sfx('click'); buildGrid(); }; tabs.appendChild(b); }
  buildGrid();
  $('sellBtn').onclick = () => { UI.mode = UI.mode === 'sell' ? null : 'sell'; UI.placing = null; sfx('click'); };
  $('repBtn').onclick = () => { UI.mode = UI.mode === 'repair' ? null : 'repair'; UI.placing = null; sfx('click'); };
  $('pauseBtn').onclick = () => togglePause();
  $('setBtn').onclick = () => openSettings(true);
  $('quietBtn').onclick = () => toggleQuiet(); $('quietBtn').classList.toggle('on', !!UI.set.quiet); if (UI.set.quiet) applyQuality('quiet');
  { const qf = $('setQuietFps'); qf.value = UI.set.quietFps || '60'; qf.onchange = () => { UI.set.quietFps = qf.value; saveSet(); }; const qc = $('setQuiet'); qc.checked = !!UI.set.quiet; qc.onchange = () => toggleQuiet(qc.checked); }
  $('muteBtn').onclick = () => { AU.muted = !AU.muted; $('muteBtn').textContent = AU.muted ? '🔇' : '🔊'; };
  const cv = $('view');
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); const nx = e.clientX - r.left, ny = e.clientY - r.top;
    if (UI.pan) { const a = screenToWorld(UI.mouse.x, UI.mouse.y), b = screenToWorld(nx, ny); if (a && b) { R3.cam.tx -= b.x - a.x; R3.cam.ty -= b.y - a.y; R3.cam.x -= b.x - a.x; R3.cam.y -= b.y - a.y; } }
    UI.mouse.x = nx; UI.mouse.y = ny; });
  cv.addEventListener('mouseleave', () => { UI.mouse.x = -1; });
  cv.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  cv.addEventListener('wheel', e => { e.preventDefault(); R3.cam.td *= e.deltaY > 0 ? 1.12 : 0.89; }, { passive: false });
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', e => { UI.keys[e.key.toLowerCase()] = false; UI.keys.shift = e.shiftKey; UI.keys.control = e.ctrlKey || e.metaKey; });
  window.addEventListener('blur', () => { UI.keys = {}; });
  const mm = $('minimap');
  const mmPos = e => { const r = mm.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * MW, y: (e.clientY - r.top) / r.height * MH }; };
  mm.addEventListener('contextmenu', e => e.preventDefault());
  mm.addEventListener('mousedown', e => { const p = mmPos(e); if (e.button === 2) { const u = UI.sel.filter(s => s.kind === 'u' && s.team === ME); if (u.length) { NET.issue({ c: 'move', u: ids(u), x: p.x, y: p.y, am: UI.mode === 'amove', q: e.shiftKey }); marker(p.x, p.y); sfx('ack'); } } else { UI.mmDrag = true; jumpTo(p.x, p.y); } });
  mm.addEventListener('mousemove', e => { if (UI.mmDrag) { const p = mmPos(e); jumpTo(p.x, p.y, true); } });
  window.addEventListener('mouseup', () => { UI.mmDrag = false; });
  UI.mmBase = document.createElement('canvas'); UI.mmBase.width = MW; UI.mmBase.height = MH;
  // tooltip
  UI.tip = $('tip');
  // settings
  const q = $('setQuality'); q.value = UI.set.quality; q.onchange = () => { UI.set.quality = q.value; saveSet(); R3.auto = q.value === 'auto'; applyQuality(q.value === 'auto' ? detectQuality() : q.value); };
  const ed = $('setEdge'); ed.value = UI.set.edge; ed.oninput = () => { UI.set.edge = +ed.value; saveSet(); };
  const hb = $('setHB'); hb.value = UI.set.hbars; hb.onchange = () => { UI.set.hbars = hb.value; saveSet(); };
  const fp = $('setFps'); fp.checked = UI.set.fps; fp.onchange = () => { UI.set.fps = fp.checked; saveSet(); };
  const vo = $('setVol'); vo.value = UI.set.vol; vo.oninput = () => { UI.set.vol = +vo.value; AU.vol = UI.set.vol; if (AU.master) AU.master.gain.value = AU.vol; saveSet(); };
  AU.vol = UI.set.vol;
  for (const [id, k, u] of [['setBri', 'bri', 'uBri'], ['setCon', 'con', 'uCon'], ['setSat', 'sat', 'uSat']]) { const el = $(id); el.value = UI.set[k]; POST.final.uniforms[u].value = UI.set[k]; el.oninput = () => { UI.set[k] = +el.value; POST.final.uniforms[u].value = UI.set[k]; saveSet(); }; }
  $('setClose').onclick = () => openSettings(false);
  setTimeout(() => { minimap(); sidebar(); }, 0);
}
function openSettings(on) { $('settings').style.display = on ? 'flex' : 'none'; }
function jumpTo(x, y, instant) { R3.cam.tx = x; R3.cam.ty = y + R3.cam.d * 0.18; if (instant) { R3.cam.x = R3.cam.tx; R3.cam.y = R3.cam.ty; } }
function listFor(cat) { const f = G.players[ME].fac, ok = t => !(BT[t] || UT[t]).fac || (BT[t] || UT[t]).fac === f; return [...Object.keys(BT).filter(t => t !== 'hq' && BT[t].cat === cat && ok(t)), ...Object.keys(UT).filter(t => FROMCAT[UT[t].from] === cat && ok(t))]; }
function itemHTML(t, hk) { const d = BT[t] || UT[t]; return `<img src="${icon(t)}"><div class="nm">${d.n}</div><div class="cost">$${d.cost}${d.gas ? `<i class="gas"> ◆${d.gas}</i>` : ""}</div>${hk ? `<div class="hk">${hk.toUpperCase()}</div>` : ''}<div class="prog"></div><div class="cnt"></div><div class="rdy">READY</div><div class="lock">🔒</div>`; }
function wireItem(b, t) {
  b.dataset.t = t;
  b.onmousedown = e => { e.preventDefault(); audioInit(); clickItem(t, e.button === 2, e.shiftKey); };
  b.oncontextmenu = e => e.preventDefault();
  b.onmouseenter = () => showTip(t, b); b.onmouseleave = () => { UI.tip.style.display = 'none'; };
}
function buildGrid() {
  const g = $('grid'); g.innerHTML = '';
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.cat === UI.tab));
  UI.gridList = listFor(UI.tab);
  UI.gridList.forEach((t, i) => { const b = document.createElement('div'); b.className = 'item'; b.innerHTML = itemHTML(t, HOTKEYS[i]); wireItem(b, t); g.appendChild(b); });
}
function counters(wpn) {
  if (!wpn) return { good: [], bad: [] }; const m = DMG[W[wpn].type], names = { inf: 'Infantry', light: 'Light vehicles', heavy: 'Armor', bldg: 'Structures', air: 'Aircraft' };
  const ok = a => (a === 'air' ? W[wpn].air : W[wpn].ground);
  return { good: Object.keys(m).filter(a => m[a] >= 1 && ok(a)).map(a => names[a]), bad: Object.keys(m).filter(a => (m[a] <= 0.35 || !ok(a))).map(a => names[a]) };
}
function showTip(t, el) {
  const d = BT[t] || UT[t], u = UT[t], wpn = u ? u.wpn : BT[t].wpn, c = counters(wpn), i = UI.gridList.indexOf(t);
  let h = `<b>${d.n}</b> <span class="c">$${d.cost}</span>${d.gas ? ` <span class="gas">◆${d.gas}</span>` : ''} <span class="dim">· ${d.time}s</span>${i >= 0 && HOTKEYS[i] ? ` <kbd>${HOTKEYS[i].toUpperCase()}</kbd>` : ''}<br>`;
  h += `HP ${d.hp}` + (u ? ` · ${u.armor} armor · speed ${u.sp}` : ` · power ${d.pow > 0 ? '+' : ''}${d.pow}`) + '<br>';
  if (wpn) h += `Weapon: ${W[wpn].type}, ${W[wpn].dmg} dmg, range ${W[wpn].rng}${W[wpn].splash ? ', splash' : ''}<br>`;
  if (c.good.length) h += `<span class="g">Strong vs: ${c.good.join(', ')}</span><br>`; if (c.bad.length) h += `<span class="r">Weak / can't hit: ${c.bad.join(', ')}</span><br>`;
  if (u && u.engineer) h += 'Captures enemy structures, repairs your own.<br>';
  if (UPG[t]) h += `<span class="dim">Upgradable to level 3 (+dmg, +range) when selected.</span><br>`;
  if (d.fac) h += `<span class="g">${FACTIONS[d.fac].flag} ${FACTIONS[d.fac].n} special.</span> ${FACTIONS[d.fac].desc}<br>`;
  if (t === 'extractor') h += `Must be placed on a Plasma Gas vent (glowing teal). Produces ${GAS_RATE} gas/s.<br>`;
  if (u && u.heal) h += 'Heals nearby infantry.<br>'; if (u && u.mech) h += 'Walker: fires rockets at ground and air.<br>'; if (u && u.jet) h += 'Bomb/missile runs, returns to Airfield to rearm.<br>';
  if (t === 'harv') h += `Carries ${HARV_CAP} ore. Built at War Factory or Command Yard.<br>`;
  const req = (d.req || []).filter(r => r !== '__never'); if (req.length) h += `<span class="dim">Requires: ${req.map(r => BT[r].n).join(', ')}</span><br>`;
  h += `<span class="dim">${BT[t] ? 'Click to build, then place' : 'Shift+click: queue 5'} · Right-click: cancel</span>`;
  UI.tip.innerHTML = h; UI.tip.style.display = 'block'; const r = el.getBoundingClientRect(); UI.tip.style.top = Math.max(8, Math.min(innerHeight - 200, r.top)) + 'px'; UI.tip.style.right = (innerWidth - r.left + 8) + 'px';
}
function clickItem(t, right, shift) {
  const P = G.players[ME], cat = catOf(t);
  if (right) { const n = NET.online ? (P.queues[cat].some(q => q.t === t) || P.ready[cat] === t ? 1 : 0) : 0; const r = NET.issue({ c: 'cancel', t, n: shift ? 5 : 1 }); if (NET.online ? n : r) { sfx('click'); if (UI.placing === t) UI.placing = null; } return; }
  if (t === 'wall') { if (!avail(ME, t)) { sfx('error'); uiMsg('Walls require a Barracks'); return; } UI.mode = 'wall'; UI.placing = null; UI.wallA = null; sfx('click'); uiMsg('Wall: click-drag to lay a chain ($' + BT.wall.cost + '/segment, straight or diagonal). Shift keeps the tool. Right-click/Esc to stop.'); return; }
  if (BT[t] && P.ready[cat] === t) { UI.placing = t; UI.mode = null; sfx('click'); return; }
  if (!avail(ME, t)) { sfx('error'); const d = BT[t] || UT[t]; uiMsg('Requires: ' + [...(d.req || []), ...(UT[t] ? [UT[t].from] : [])].filter(r => r !== '__never' && !hasBuilt(ME, r)).map(r => BT[r].n).join(', ')); return; }
  const cnt = shift && UT[t] ? 5 : 1; let n; if (NET.online) { n = canEnqueue(ME, t) ? 1 : 0; if (n) NET.issue({ c: 'enq', t, n: cnt }); } else n = NET.issue({ c: 'enq', t, n: cnt });
  if (n) sfx('click'); else { sfx('error'); const gq = (BT[t] || UT[t]).gas || 0; uiMsg(gq > P.gas ? `Need ${gq} Plasma Gas (build a Gas Extractor on a vent)` : BT[t] ? (BT[t].cat === 'def' ? 'Defense queue full (5)' : 'Already building a structure') : 'Queue full (' + queueCap(ME, cat) + ' — build more production to raise it)'); }
}
function pickAt(sx, sy) {
  const w = screenToWorld(sx, sy); if (!w) return null;
  let best = null, bd = 1e9;
  for (const e of G.ents) {
    if (!visibleTo0(e)) continue;
    if (e.kind === 'b') { if (w.x >= e.tx && w.x <= e.tx + e.w && w.y >= e.ty - 0.6 && w.y <= e.ty + e.h) { if (bd > 40) { best = e; bd = 40; } } continue; }
    const rs = R3.rs.get(e.id) || e, p = worldToScreen(rs.x, rs.y, (rs.z || 0) + 0.3), d = Math.hypot(p.x - sx, p.y - sy), rr = 12 + UT[e.t].r * 900 / R3.cam.d;
    if (d < rr && d < bd) { bd = d; best = e; }
  }
  return best;
}
const TABFOR = { barracks: 'inf', factory: 'veh', airpad: 'air', hq: 'bld' };
function setSel(list) {
  G.ents.forEach(e => e.sel = false); UI.sel = list; list.forEach(e => e.sel = true);
  if (list.length === 1 && list[0].kind === 'b' && list[0].team === ME && TABFOR[list[0].t] && UI.tab !== TABFOR[list[0].t]) { UI.tab = TABFOR[list[0].t]; buildGrid(); }
  UI.ctxKey = null;
}
function onDown(e) {
  audioInit();
  const m = UI.mouse; const r = $('view').getBoundingClientRect(); m.x = e.clientX - r.left; m.y = e.clientY - r.top;
  if (e.button === 1) { e.preventDefault(); UI.pan = true; return; }
  const w = screenToWorld(m.x, m.y);
  if (e.altKey && w && !G.spectate) { e.preventDefault(); const en = G.ents.some(o => foe(o.team, ME) && visibleTo0(o) && Math.hypot(o.x - w.x, o.y - w.y) < 6); NET.issue({ c: 'ping', x: w.x, y: w.y, k: en ? 'attack' : 'defend' }); UI.pings.push({ x: w.x, y: w.y, t: 3 }); marker(w.x, w.y, en); uiMsg(en ? 'Ping: attack here!' : 'Ping: help here!'); sfx('alert'); return; }
  if (e.button === 2) {
    if (UI.placing || UI.mode) { UI.placing = null; UI.mode = null; return; }
    if (!w) return;
    const tgt = pickAt(m.x, m.y), units = UI.sel.filter(s => s.kind === 'u' && s.team === ME);
    if (units.length) {
      if (tgt && tgt.cargo && tgt.team === ME && units.some(u => canBoard(u, tgt))) { NET.issue({ c: 'board', u: ids(units.filter(u => canBoard(u, tgt))), tr: tgt.id }); uiMsg('Boarding ' + tgt.cargo.length + ' aboard · ' + (UT[tgt.t].cap - cargoUsed(tgt)) + ' slots free'); }
      else if (tgt && foe(tgt.team, ME)) { NET.issue({ c: 'attack', u: ids(units), t: tgt.id }); marker(tgt.x, tgt.y, true); }
      else if (tgt && tgt.kind === 'b' && units.some(u => UT[u.t].engineer)) { NET.issue({ c: 'attack', u: ids(units.filter(u => UT[u.t].engineer)), t: tgt.id }); }
      else if (tgt && tgt.t === 'refinery' && units.some(u => u.t === 'harv')) { units.filter(u => u.t === 'harv').forEach(h => { h.hst = 'ret'; h.path = []; }); }
      else { NET.issue({ c: 'move', u: ids(units), x: w.x, y: w.y, am: UI.keys.control || false, q: e.shiftKey }); marker(w.x, w.y); }
      sfx('ack');
    } else { const bs = UI.sel.filter(s => s.kind === 'b' && s.team === ME && ['barracks', 'factory', 'airpad', 'hq'].includes(s.t)); if (bs.length) NET.issue({ c: 'rally', b: ids(bs), x: w.x, y: w.y }); if (bs.length) { marker(w.x, w.y); sfx('ack'); uiMsg('Rally point set'); } }
    return;
  }
  if (e.button !== 0) return;
  if (UI.placing) {
    const d = BT[UI.placing], tx = Math.floor(w.x - d.w / 2 + 0.5), ty = Math.floor(w.y - d.h / 2 + 0.5);
    if (NET.online ? canPlace(UI.placing, ME, tx, ty) && (NET.issue({ c: 'place', cat: BT[UI.placing].cat, x: tx, y: ty }), true) : NET.issue({ c: 'place', cat: BT[UI.placing].cat, x: tx, y: ty })) UI.placing = null; else { sfx('error'); uiMsg("Can't build there"); }
    return;
  }
  if (UI.mode === 'unload') { if (w) { UI.sel.filter(s => s.cargo && s.team === ME).forEach(tr => NET.issue({ c: 'unload', tr: tr.id, x: w.x, y: w.y })); marker(w.x, w.y); sfx('ack'); } UI.mode = null; return; }
  if (UI.mode === 'wall') { if (w) { UI.wallA = [Math.floor(w.x), Math.floor(w.y)]; } return; }
  if (UI.mode === 'sell' || UI.mode === 'repair') {
    const t = pickAt(m.x, m.y);
    if (t && t.kind === 'b' && t.team === ME) { if (UI.mode === 'sell') { NET.issue({ c: 'sell', b: t.id }); sfx('click'); } else { NET.issue({ c: 'repair', b: t.id, on: !t.repair }); sfx('click'); } }
    if (!e.shiftKey) UI.mode = null; return;
  }
  if (UI.mode === 'amove') { const units = UI.sel.filter(s => s.kind === 'u' && s.team === ME); if (w && units.length) { NET.issue({ c: 'move', u: ids(units), x: w.x, y: w.y, am: true, q: e.shiftKey }); marker(w.x, w.y, true); sfx('ack'); } if (!e.shiftKey) UI.mode = null; return; }
  m.down = true; m.sx = m.x; m.sy = m.y; m.shift = e.shiftKey;
}
function onUp(e) {
  if (e.button === 1) { UI.pan = false; return; }
  if (e.button === 0 && UI.mode === 'wall' && UI.wallA) { const tl = wallTiles(); UI.wallA = null; const ok = tl.filter(([x, y]) => canPlace('wall', ME, x, y)); if (ok.length) { NET.issue({ c: 'walls', t: ok }); sfx('ack'); } else { sfx('error'); uiMsg("Can't build walls there"); } if (!e.shiftKey) UI.mode = null; return; }
  const m = UI.mouse; if (!m.down || e.button !== 0) return; m.down = false;
  const x0 = Math.min(m.sx, m.x), x1 = Math.max(m.sx, m.x), y0 = Math.min(m.sy, m.y), y1 = Math.max(m.sy, m.y);
  let list;
  if (x1 - x0 < 6 && y1 - y0 < 6) {
    const t = pickAt(m.x, m.y); list = t ? [t] : [];
    const now = performance.now();
    if (t && t.team === ME && t.kind === 'u' && now - UI.lastClick < 350 && UI.lastPick === t.t) list = G.ents.filter(o => o.team === ME && o.t === t.t && inView(o.x, o.y));
    UI.lastClick = now; UI.lastPick = t && t.t;
  } else {
    list = G.ents.filter(o => o.team === ME && o.kind === 'u' && (() => { const rs = R3.rs.get(o.id) || o, p = worldToScreen(rs.x, rs.y, (rs.z || 0) + 0.2); return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1; })());
    if (list.some(u => u.t !== 'harv')) list = list.filter(u => u.t !== 'harv');
  }
  if (m.shift) list = [...new Set([...UI.sel, ...list])];
  setSel(list); if (list.length && list[0].team === ME) sfx('ack');
}
function onKey(e) {
  const k = e.key.toLowerCase(); UI.keys[k] = true; UI.keys.control = e.ctrlKey || e.metaKey; UI.keys.shift = e.shiftKey;
  if (!started) return;
  if (k === 'escape') { if ($('settings').style.display === 'flex') openSettings(false); else if (UI.placing || UI.mode) { UI.placing = null; UI.mode = null; } else togglePause(); return; }
  if (k === 'p') { togglePause(); return; }
  if (G.watch && k === 'c') { DIR.auto = !DIR.auto; DIR.tagT = -9; return; }
  if (G.watch && 'wasd'.includes(k) && k.length === 1) return;
  if (paused) return;
  if (/^[1-9]$/.test(k)) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) { UI.groups[k] = UI.sel.filter(s => s.team === ME).map(s => s.id); uiMsg('Group ' + k + ' set'); return; }
    const list = (UI.groups[k] || []).map(byId).filter(Boolean); setSel(list);
    const now = performance.now(); if (UI.lastGroupKey === k && now - UI.lastGroupT < 400 && list.length) jumpTo(list[0].x, list[0].y);
    UI.lastGroupKey = k; UI.lastGroupT = now; return;
  }
  const hi = HOTKEYS.indexOf(k); if (hi >= 0 && UI.gridList[hi] && !e.ctrlKey && !e.metaKey) { clickItem(UI.gridList[hi], false, e.shiftKey); return; }
  if (k === 'd') { const trs = UI.sel.filter(s => s.cargo && s.team === ME); if (trs.length) { if (e.shiftKey) trs.forEach(tr => NET.issue({ c: 'unload', tr: tr.id, x: tr.x, y: tr.y })); else { UI.mode = 'unload'; uiMsg('Unload: click where to drop (Shift+D drops right here). Carrying ' + trs.reduce((a, t) => a + t.cargo.length, 0)); } return; } }
  if (k === 's') orderStop(UI.sel.filter(s => s.team === ME));
  if (k === 'g') { doFormation(e.shiftKey); return; }
  if (k === 'v') { toggleStance(); return; }
  if (k === 'z') { doUpgrade(); return; }
  if (k === 'a' && UI.sel.some(s => s.kind === 'u')) { UI.mode = 'amove'; uiMsg('Attack-move: left-click target (Shift = waypoint)'); }
  if (k === 'h') { const hq = G.ents.find(e => e.team === ME && e.t === 'hq') || G.ents.find(e => e.team === ME && e.t === 'cc'); if (hq) jumpTo(hq.x, hq.y); }
  if (k === 'q') { UI.tab = Object.keys(CATS)[(Object.keys(CATS).indexOf(UI.tab) + 1) % 5]; buildGrid(); }
  if (k === 'x') $('sellBtn').onclick(); if (k === 'r') $('repBtn').onclick();
  if (k === 'e') setSel(G.ents.filter(o => o.team === ME && o.kind === 'u' && UT[o.t].wpn));
  if (k === 'n') { toggleQuiet(); return; }
  if (k === 'f') { UI.set.fps = !UI.set.fps; $('setFps').checked = UI.set.fps; saveSet(); }
  if (k === '.') selectIdle('harv'); if (k === ',') selectIdle('army');
}
function myUnits() { return UI.sel.filter(s => s.team === ME && s.kind === 'u' && UT[s.t].wpn); }
function enemyFacing(cx, cy) {
  let best = null, bd = 1e9; for (const e of G.ents) if (foe(e.team, ME) && visibleTo0(e)) { const d = Math.hypot(e.x - cx, e.y - cy); if (d < bd) { bd = d; best = e; } }
  const t = best && bd < 30 ? best : (st => ({ x: st[0], y: st[1] }))(G.starts[(G.players.find(Q => foe(Q.team, ME)) || G.players[1]).start]); return Math.atan2(t.y - cy, t.x - cx);
}
function doFormation(atBase) {
  const us = myUnits(); if (!us.length) { uiMsg('Select combat units first'); sfx('error'); return; }
  let cx = us.reduce((a, u) => a + u.x, 0) / us.length, cy = us.reduce((a, u) => a + u.y, 0) / us.length;
  if (atBase) { const hq = G.ents.find(e => e.team === ME && e.t === 'hq') || us[0]; const es = G.starts[(G.players.find(Q => foe(Q.team, ME)) || G.players[1]).start], a = Math.atan2(es[1] - hq.y, es[0] - hq.x); cx = hq.x + Math.cos(a) * 7; cy = hq.y + Math.sin(a) * 7; }
  const fu = us.filter(u => UT[u.t].wpn && u.t !== 'harv'), n = fu.length; NET.issue({ c: 'form', u: ids(fu), x: cx, y: cy, a: enemyFacing(cx, cy) }); marker(cx, cy); sfx('ack'); uiMsg(`Defensive formation: ${n} units holding (armor front, infantry middle, artillery/AA rear)`); UI.ctxKey = null;
}
function toggleStance() { const us = myUnits(); if (!us.length) return; const st = us.every(u => u.stance === 'hold') ? 'aggr' : 'hold'; NET.issue({ c: 'stance', u: ids(us), s: st }); sfx('click'); uiMsg(st === 'hold' ? 'Stance: Hold position (engage in range, return)' : 'Stance: Aggressive (chase targets)'); UI.ctxKey = null; }
function doUpgrade() { const b = UI.sel.length === 1 && UI.sel[0].kind === 'b' && UI.sel[0].team === ME ? UI.sel[0] : null; if (!b) return; const inf = upgradeInfo(b);
  if (!inf) return; if (NET.online ? canUpgrade(b) && (NET.issue({ c: 'upg', b: b.id }), true) : NET.issue({ c: 'upg', b: b.id })) { sfx('click'); uiMsg(inf.kind === 'def' ? 'Researching ' + DEF_RESEARCH.n : 'Upgrading to level ' + inf.next); UI.ctxKey = null; } else { sfx('error'); uiMsg(b.upT != null ? 'Upgrade in progress' : (inf.gas || 0) > G.players[ME].gas ? `Need ${inf.gas} Plasma Gas` : 'Insufficient funds'); } }
function upgTip(b) {
  const inf = upgradeInfo(b); if (!inf) return 'Fully upgraded'; if (inf.kind === 'def') return `<b>${DEF_RESEARCH.n}</b> <span class="c">$${inf.cost}</span> <span class="gas">◆${inf.gas}</span> <span class="dim">· ${inf.time}s</span><br>All Guard Turrets & Flak Batteries: +${Math.round((DEF_RESEARCH.dmg - 1) * 100)}% damage, +${DEF_RESEARCH.rng} range, +${Math.round((DEF_RESEARCH.hp - 1) * 100)}% HP`;
  const w = defW(b), l = b.lvl || 1, nd = Math.round(W[BT[b.t].wpn].dmg * UPG_DMG[l] * (G.players[ME].defUp ? DEF_RESEARCH.dmg : 1)), nr = W[BT[b.t].wpn].rng + UPG_RNG[l] + (G.players[ME].defUp ? DEF_RESEARCH.rng : 0);
  return `<b>Upgrade to level ${l + 1}</b> <span class="c">$${inf.cost}</span>${inf.gas ? ` <span class="gas">◆${inf.gas}</span>` : ''} <span class="dim">· ${inf.time}s</span> <kbd>Z</kbd><br>Damage ${w.dmg} → <span class="g">${nd}</span><br>Range ${w.rng} → <span class="g">${nr}</span>`;
}
function idleList(kind) {
  return G.ents.filter(u => u.team === ME && u.kind === 'u' && (kind === 'harv' ? u.t === 'harv' && (u.hst === 'idle' || u.hst === 'manual') && !u.path.length && (u.idleT || 0) > 2
    : u.t !== 'harv' && UT[u.t].wpn && u.order === 'idle' && !u.tgt && !u.path.length && (u.idleT || 0) > 6));
}
function selectIdle(kind) { const l = idleList(kind); if (!l.length) return; setSel(kind === 'harv' ? [l[0]] : l); jumpTo(l[0].x, l[0].y); }
function uiFrame(dt) {
  annFrame(dt);
  const P = G.players[ME], m = UI.mouse, el = R3.renderer.domElement, W_ = el.clientWidth, H_ = el.clientHeight;
  // smooth camera scroll (edge + arrows), speed setting
  const sp = dt * R3.cam.d * 1.1 * UI.set.edge, ed = 14;
  let dx = 0, dy = 0;
  if (UI.keys.arrowleft || (m.x >= 0 && m.x < ed)) dx -= 1; if (UI.keys.arrowright || (m.x >= 0 && m.x > W_ - ed)) dx += 1;
  if (UI.keys.arrowup || (m.x >= 0 && m.y < ed)) dy -= 1; if (UI.keys.arrowdown || (m.x >= 0 && m.y > H_ - ed)) dy += 1;
  if (G.watch) { if (UI.keys.a) dx -= 1; if (UI.keys.d) dx += 1; if (UI.keys.w) dy -= 1; if (UI.keys.s) dy += 1; }
  if (!UI.mmDrag && !UI.pan) { R3.cam.tx += dx * sp; R3.cam.ty += dy * sp; }
  UI.sel = UI.sel.filter(s => s.hp > 0 && !s.dead && (s.team === ME || visibleTo0(s)));
  for (const u of G.ents) if (u.team === ME && u.kind === 'u') u.idleT = (u.path.length || u.tgt || (u.t === 'harv' && u.hst !== 'idle' && u.hst !== 'manual')) ? 0 : (u.idleT || 0) + dt;
  if (UI.placing && m.x >= 0) { const w = screenToWorld(m.x, m.y); if (w) { const d = BT[UI.placing], tx = Math.floor(w.x - d.w / 2 + 0.5), ty = Math.floor(w.y - d.h / 2 + 0.5); ghost(UI.placing, tx, ty, canPlace(UI.placing, ME, tx, ty)); } }
  else ghost(null);
  wallPreview(UI.mode === 'wall' ? (UI.wallA ? wallTiles() : (() => { const w = m.x >= 0 && screenToWorld(m.x, m.y); return w ? [[Math.floor(w.x), Math.floor(w.y)]] : null; })()) : null);
  if (UI.placing && P.ready[BT[UI.placing].cat] !== UI.placing) UI.placing = null;
  if (UI.msgT > 0) { UI.msgT -= dt; if (UI.msgT <= 0) $('msg').style.opacity = 0; }
  el.style.cursor = UI.pan ? 'grabbing' : UI.placing ? 'cell' : UI.mode === 'sell' ? 'not-allowed' : UI.mode === 'repair' ? 'help' : UI.mode === 'amove' ? 'crosshair' : (R3.hoverId && byId(R3.hoverId) && byId(R3.hoverId).team !== ME && UI.sel.some(s => s.kind === 'u' && s.team === ME)) ? 'crosshair' : 'default';
  if ((UI.hovT = (UI.hovT || 0) + dt) > 0.05) { UI.hovT = 0; const h = m.x >= 0 && !m.down ? pickAt(m.x, m.y) : null; R3.hoverId = h ? h.id : null; }
  UI.t = (UI.t || 0) + dt; if (UI.t > 0.1) { UI.t = 0; sidebar(); }
  if ((UI.mmT = (UI.mmT || 0) + dt) > 0.2) { UI.mmT = 0; minimap(); }
  UI.alerts.forEach(a => a.t -= dt); UI.alerts = UI.alerts.filter(a => a.t > 0); UI.pings.forEach(p => p.t -= dt); UI.pings = UI.pings.filter(p => p.t > 0);
  const f = $('fps'); f.style.display = UI.set.fps ? 'block' : 'none'; if (UI.set.fps) f.textContent = `${Math.round(R3.fps)} fps · ${R3.calls || 0} draws · ${((R3.tris || 0) / 1000).toFixed(0)}k tris · ${R3.q.label}${R3.auto ? ' (auto)' : ''} · ${G.ents.filter(e => e.kind === 'u').length} units`;
  overlay();
}
function sidebar() {
  const P = G.players[ME];
  $('cr').textContent = '$' + Math.floor(P.cr); $('gas').textContent = '◆ ' + Math.floor(P.gas);
  const pb = $('powbar'); const frac = P.gen ? Math.min(1, P.use / P.gen) : 1; pb.style.width = (frac * 100) + '%'; pb.style.background = P.pow < 0 ? '#ff4d3d' : frac > 0.85 ? '#ffc23d' : '#4dff7a';
  $('powtxt').textContent = `${P.use} / ${P.gen}` + (P.pow < 0 ? '  LOW POWER' : '');
  const upd = (b) => {
    const t = b.dataset.t, cat = catOf(t), q = P.queues[cat], d = BT[t] || UT[t];
    b.classList.toggle('locked', !avail(ME, t));
    const n = q.filter(i => i.t === t).length, first = q[0] && q[0].t === t ? q[0] : null;
    b.querySelector('.prog').style.height = first ? (100 - first.prog * 100) + '%' : n ? '100%' : '0%';
    b.querySelector('.cnt').textContent = n > 1 ? n : n === 1 && !first ? '1' : '';
    b.classList.toggle('ready', P.ready[cat] === t); b.classList.toggle('active', !!first); b.classList.toggle('poor', P.cr < d.cost * 0.1);
  };
  document.querySelectorAll('.item').forEach(upd);
  document.querySelectorAll('.tab').forEach(b => { const c = b.dataset.cat; b.querySelector('i').textContent = P.ready[c] ? '!' : P.queues[c].length ? P.queues[c].length : ''; b.classList.toggle('dis', !listFor(c).some(t => avail(ME, t))); });
  $('sellBtn').classList.toggle('on', UI.mode === 'sell'); $('repBtn').classList.toggle('on', UI.mode === 'repair');
  // alerts
  const ih = idleList('harv').length, ia = idleList('army').length;
  let ah = UI.alerts.map((a, i) => `<span class="al bad" data-a="${i}">⚠ ${a.txt}</span>`).join('');
  if (ih) ah += `<span class="al" data-idle="harv" title="Hotkey .">⛏ Idle harvesters: ${ih}</span>`;
  if (ia) ah += `<span class="al dim" data-idle="army" title="Hotkey ,">⚑ Idle army: ${ia}</span>`;
  const alEl = $('alerts'); if (alEl.dataset.h !== ah) { alEl.innerHTML = ah; alEl.dataset.h = ah; alEl.querySelectorAll('.al').forEach(s => s.onclick = () => { if (s.dataset.idle) selectIdle(s.dataset.idle); else { const a = UI.alerts[+s.dataset.a]; if (a) jumpTo(a.x, a.y); } }); }
  // context panel
  const s = UI.sel, ctx = $('ctx');
  const key = s.map(e => e.id).join(',') + '|' + (s.length === 1 ? s[0].t + s[0].team : '');
  if (key !== UI.ctxKey) {
    UI.ctxKey = key; let h = '';
    if (s.length === 1) { const e = s[0], d = defOf(e);
      h = `<div class="pt"><img src="${icon(e.t)}"><div><b>${d.n}</b>${foe(e.team, ME) ? ' <span class="r">(enemy)</span>' : e.team !== ME ? ' <span class="g">(ally)</span>' : ''}<div class="hpb"><div id="ctxhp"></div></div><div id="ctxinfo" class="dim"></div></div></div>`;
      if (e.kind === 'b' && e.team === ME && (UPG[e.t] || e.t === 'tech')) h += `<button id="upBtn" class="act"></button>`;
      if (e.kind === 'u' && e.team === ME && UT[e.t].wpn) h += `<div class="acts"><button id="fmBtn" class="act">⛨ Defensive Formation <kbd>G</kbd></button><button id="stBtn" class="act"></button></div>`;
      if (e.kind === 'b' && e.team === ME) { const opts = Object.keys(UT).filter(t => UT[t].from === e.t || (UT[t].alt || []).includes(e.t)); if (opts.length) h += `<div class="cgrid">${opts.map(t => `<div class="item sm">${itemHTML(t)}</div>`).join('')}</div><div class="dim small">Right-click ground to set rally point</div>`; }
    } else if (s.length > 1) { const c = {}; s.forEach(e => c[e.t] = (c[e.t] || 0) + 1); h = '<div class="chips">' + Object.entries(c).map(([t, n]) => `<span class="chip" data-t="${t}"><img src="${icon(t)}">${n}</span>`).join('') + '</div>';
      if (myUnits().length) h += `<div class="acts"><button id="fmBtn" class="act">⛨ Defensive Formation <kbd>G</kbd></button><button id="stBtn" class="act"></button></div>`; }
    ctx.innerHTML = h;
    const opts = s.length === 1 && s[0].kind === 'b' ? Object.keys(UT).filter(t => UT[t].from === s[0].t || (UT[t].alt || []).includes(s[0].t)) : [];
    ctx.querySelectorAll('.item').forEach((b, i) => wireItem(b, opts[i]));
    ctx.querySelectorAll('.chip').forEach(c => c.onclick = () => setSel(UI.sel.filter(e => e.t === c.dataset.t)));
    const fm = $('fmBtn'); if (fm) { fm.onclick = e => doFormation(e.shiftKey); fm.title = 'Arrange selected units in battle formation facing the nearest enemy and hold. Shift: at base entrance.'; }
    const st = $('stBtn'); if (st) st.onclick = toggleStance;
    const ub = $('upBtn'); if (ub) { ub.onclick = doUpgrade; ub.onmouseenter = () => { const b = UI.sel[0]; UI.tip.innerHTML = upgTip(b); UI.tip.style.display = 'block'; const r = ub.getBoundingClientRect(); UI.tip.style.top = Math.max(8, r.top - 90) + 'px'; UI.tip.style.right = (innerWidth - r.left + 8) + 'px'; }; ub.onmouseleave = () => { UI.tip.style.display = 'none'; }; }
  }
  const stb = $('stBtn'); if (stb) { const hold = myUnits().length && myUnits().every(u => u.stance === 'hold'); const t = hold ? '⚓ Stance: Hold <kbd>V</kbd>' : '⚔ Stance: Aggressive <kbd>V</kbd>'; if (stb.innerHTML !== t) stb.innerHTML = t; }
  const upb = $('upBtn'); if (upb && s[0]) { const b = s[0], inf = upgradeInfo(b); let t;
    if (b.upT != null) t = `⬆ Upgrading… ${Math.floor((G.time - b.upT) / b.upDur * 100)}%`; else if (!inf) t = b.t === 'tech' ? '✔ ' + DEF_RESEARCH.n + ' researched' : '★ Max level (3)';
    else t = inf.kind === 'def' ? `⬆ ${DEF_RESEARCH.n} $${inf.cost} <kbd>Z</kbd>` : `⬆ Upgrade to Lv${inf.next} $${inf.cost} <kbd>Z</kbd>`;
    if (upb.innerHTML !== t) upb.innerHTML = t; upb.disabled = !inf || b.upT != null; upb.classList.toggle('poor', !!inf && G.players[ME].cr < inf.cost); }
  if (s.length === 1) { const e = s[0], f = e.hp / e.mhp, hp = $('ctxhp'); if (hp) { hp.style.width = (f * 100) + '%'; hp.style.background = f > 0.6 ? '#4dff7a' : f > 0.3 ? '#ffd23d' : '#ff4d3d'; }
    const inf = $('ctxinfo'); if (inf) inf.innerHTML = `HP ${Math.ceil(e.hp)} / ${e.mhp}` + (e.t === 'harv' ? `<br>Ore ${Math.floor(e.load)} / ${HARV_CAP} · ${e.hst}` : '') + (e.kind === 'u' && UT[e.t].wpn ? `<br>${W[UT[e.t].wpn].type} · range ${W[UT[e.t].wpn].rng} · ${e.order}${e.wq && e.wq.length ? ' +' + e.wq.length + ' wp' : ''}` : '') + (e.kind === 'b' ? `<br>Power ${BT[e.t].pow > 0 ? '+' : ''}${BT[e.t].pow}${e.repair ? ' · repairing' : ''}` + (BT[e.t].wpn ? `<br>Lv${e.lvl || 1} · dmg ${defW(e).dmg} · range ${defW(e).rng}` : '') : '') + (e.kind === 'u' && e.stance === 'hold' ? ' · HOLD' : ''); }
}
function minimap() {
  const c = $('minimap'), x = c.getContext('2d'), s = c.width / MW;
  const b = UI.mmBase.getContext('2d'), img = b.createImageData(MW, MH);
  for (let i = 0; i < MW * MH; i++) {
    let r = 46, g = 82, bl = 36; const t = G.map[i];
    if (t === 1) { r = 112; g = 104; bl = 92; } else if (t === 2) { r = 28; g = 86; bl = 118; } else if (G.lava[i]) { r = 230; g = 80; bl = 20; } else if (G.ice[i]) { r = 170; g = 210; bl = 230; } else if (G.ore[i] > 30) { r = 210; g = 165; bl = 50; } else if (G.mapName === 'frost') { r = 190; g = 200; bl = 210; } else if (G.mapName === 'volcano') { r = 52; g = 44; bl = 40; }
    if (t === 0 && G.lvl[i] > 0.5) { r *= 1.18; g *= 1.18; bl *= 1.18; }
    const f = vis0(i) ? 1 : seen0(i) ? 0.5 : 0.08; img.data.set([r * f, g * f, bl * f, 255], i * 4);
  }
  b.putImageData(img, 0, 0); x.imageSmoothingEnabled = true; x.drawImage(UI.mmBase, 0, 0, c.width, c.height);
  for (const e of G.ents) { if (!visibleTo0(e)) continue; x.fillStyle = MMCOL[e.team] || '#ff5040'; if (e.kind === 'b') x.fillRect(e.tx * s, e.ty * s, e.w * s, e.h * s); else x.fillRect(e.x * s - 1.5, e.y * s - 1.5, 3, 3); }
  x.fillStyle = '#5fe8c4'; for (const [vx, vy] of G.vents || []) { x.beginPath(); x.arc((vx + 0.5) * s, (vy + 0.5) * s, 3, 0, 7); x.fill(); }
  for (const p of UI.pings) { x.strokeStyle = `rgba(255,80,60,${p.t / 3})`; x.lineWidth = 2; x.beginPath(); x.arc(p.x * s, p.y * s, (3 - p.t) * 10 % 12 + 4, 0, 7); x.stroke(); }
  if (R3.viewPts) { const v = R3.viewPts; x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 1; x.beginPath(); x.moveTo(v[0].x * s, v[0].y * s); x.lineTo(v[1].x * s, v[1].y * s); x.lineTo(v[3].x * s, v[3].y * s); x.lineTo(v[2].x * s, v[2].y * s); x.closePath(); x.stroke(); }
}
function overlay() {
  const c = $('ov'), x = c.getContext('2d'), el = R3.renderer.domElement;
  if (c.width !== el.clientWidth || c.height !== el.clientHeight) { c.width = el.clientWidth; c.height = el.clientHeight; }
  x.clearRect(0, 0, c.width, c.height);
  const mode = UI.set.hbars;
  for (const e of G.ents) {
    const show = mode === 'always' || e.sel || e.id === R3.hoverId || (mode === 'smart' && e.hp < e.mhp);
    if (!show || !visibleTo0(e) || !inView(e.x, e.y)) continue;
    const rs = e.kind === 'u' ? (R3.rs.get(e.id) || e) : e;
    const top = e.kind === 'b' ? 1.9 : (rs.z || 0) + (UT[e.t].armor === 'inf' ? 0.8 : 0.95);
    const p = worldToScreen(rs.x, e.kind === 'b' ? e.ty + 0.2 : rs.y, (e.kind === 'b' ? heightAt(e.x, e.y) : 0) + top); if (p.behind) continue;
    const z = 30 / R3.cam.d, w = (e.kind === 'b' ? e.w * 18 : Math.max(18, UT[e.t].r * 50)) * z, f = Math.max(0, e.hp / e.mhp), segs = Math.max(1, Math.round(e.mhp / 100));
    x.fillStyle = 'rgba(0,0,0,.75)'; x.fillRect(p.x - w / 2 - 1, p.y - 1, w + 2, 5);
    x.fillStyle = f > 0.6 ? '#4dff7a' : f > 0.3 ? '#ffd23d' : '#ff4d3d'; x.fillRect(p.x - w / 2, p.y, w * f, 3);
    if (segs > 1 && segs < 30) { x.fillStyle = 'rgba(0,0,0,.45)'; for (let i = 1; i < segs; i++) x.fillRect(p.x - w / 2 + w * i / segs, p.y, 1, 3); }
    if (foe(e.team, ME)) { x.fillStyle = '#ff5040'; x.fillRect(p.x - w / 2 - 4, p.y, 2, 3); }
    if (e.t === 'harv' && e.load > 0) { x.fillStyle = '#e8b030'; x.fillRect(p.x - w / 2, p.y + 4, w * e.load / HARV_CAP, 2); }
    if (e.sel && e.kind === 'b' && e.rally && e.team === ME) { const r = worldToScreen(e.rally.x, e.rally.y, heightAt(e.rally.x, e.rally.y)); x.strokeStyle = 'rgba(120,255,140,.7)'; x.setLineDash([5, 5]); x.beginPath(); x.moveTo(p.x, p.y + 20); x.lineTo(r.x, r.y); x.stroke(); x.setLineDash([]); x.fillStyle = '#7f8'; x.fillRect(r.x - 1, r.y - 14, 2, 14); x.fillRect(r.x + 1, r.y - 14, 9, 6); }
    if (e.sel && e.kind === 'u' && e.team === ME && (e.path.length || (e.wq && e.wq.length))) {
      x.strokeStyle = e.order === 'amove' ? 'rgba(255,120,90,.55)' : 'rgba(120,255,140,.45)'; x.setLineDash([3, 4]); x.beginPath(); let q = worldToScreen(rs.x, rs.y, 0.05); x.moveTo(q.x, q.y);
      for (const pt of e.path) { q = worldToScreen(pt.x, pt.y, heightAt(pt.x, pt.y)); x.lineTo(q.x, q.y); }
      for (const pt of (e.wq || [])) { q = worldToScreen(pt.x, pt.y, heightAt(pt.x, pt.y)); x.lineTo(q.x, q.y); }
      x.stroke(); x.setLineDash([]);
      for (const pt of (e.wq || [])) { q = worldToScreen(pt.x, pt.y, heightAt(pt.x, pt.y)); x.fillStyle = pt.am ? '#f86' : '#7f8'; x.beginPath(); x.arc(q.x, q.y, 3, 0, 7); x.fill(); }
    }
  }
  const m = UI.mouse;
  if (m.down) { x.strokeStyle = '#7dff9a'; x.fillStyle = 'rgba(125,255,154,.08)'; x.lineWidth = 1; x.fillRect(m.sx, m.sy, m.x - m.sx, m.y - m.sy); x.strokeRect(m.sx, m.sy, m.x - m.sx, m.y - m.sy); }
}

// ===== command helpers (lockstep-safe predictions; never mutate sim state) =====
function ids(a) { return a.map(e => e.id); }
function canEnqueue(team, t) { const P = G.players[team], cat = catOf(t), d = BT[t] || UT[t]; if (!avail(team, t)) return false; if (P.queues[cat].length >= queueCap(team, cat)) return false; if ((d.gas || 0) > P.gas) return false; if (UT[t] && t !== 'harv' && popOf(team) >= POP_CAP) return false; return cat !== 'bld' || !P.ready[cat]; }
function canUpgrade(b) { const P = G.players[b.team], inf = upgradeInfo(b); return !!inf && b.upT == null && P.cr >= inf.cost && P.gas >= (inf.gas || 0); }

function wallTiles() { const w = screenToWorld(UI.mouse.x, UI.mouse.y), a = UI.wallA; if (!a) return []; const b = w ? [Math.floor(w.x), Math.floor(w.y)] : a; return wallLine(a[0], a[1], b[0], b[1]); }

function toggleQuiet(on) {
  UI.set.quiet = on == null ? !UI.set.quiet : !!on; saveSet();
  if (UI.set.quiet) { R3.auto = false; applyQuality('quiet'); } else { R3.auto = UI.set.quality === 'auto'; applyQuality(UI.set.quality === 'auto' ? detectQuality() : UI.set.quality); }
  $('quietBtn').classList.toggle('on', UI.set.quiet); const qc = $('setQuiet'); if (qc) qc.checked = UI.set.quiet;
  uiMsg(UI.set.quiet ? `🍃 Quiet mode ON — ${UI.set.quietFps || 60} FPS cap, 1x resolution, lighter effects (N)` : 'Quiet mode OFF (N)'); sfx('click');
}
