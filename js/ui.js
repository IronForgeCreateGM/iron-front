'use strict';
// ===== DOM UI: sidebar, context panel, alerts, minimap, overlay, input, hotkeys, settings =====
const HOTKEYS = ['t', 'y', 'u', 'i', 'o', 'j', 'k', 'l'];
const UI = { sel: [], tab: 'bld', placing: null, mode: null, mouse: { x: -1, y: -1, down: false, sx: 0, sy: 0 }, keys: {}, groups: {}, lastGroupKey: null, lastGroupT: 0, msgT: 0, lastClick: 0, pings: [], alerts: [], gridList: [],
  set: Object.assign({ edge: 1, hbars: 'smart', fps: false, vol: 0.45, quality: 'auto', bri: 0, con: 1.15, sat: 1.22 }, JSON.parse(localStorage.getItem('if_settings') || '{}')) };
const $ = id => document.getElementById(id);
function saveSet() { localStorage.setItem('if_settings', JSON.stringify(UI.set)); localStorage.setItem('if_quality', UI.set.quality); }
function uiMsg(s) { const m = $('msg'); if (!m) return; m.textContent = s; m.style.opacity = 1; UI.msgT = 3; }
function icon(t) { const P = typeof G !== 'undefined' && G.players && G.players[ME]; if (t === 'wall' && P && P.fac === 'chn' && R3.portraits && R3.portraits.wallChn) return R3.portraits.wallChn; return (R3.portraits && R3.portraits[t]) || ''; }
function nameOf(t) { const d = BT[t] || UT[t], P = typeof G !== 'undefined' && G.players && G.players[ME]; return t === 'wall' && P && P.fac === 'chn' ? 'Great Wall' : d.n; }
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
  const sideCats = ['bld', 'def'], botCats = ['inf', 'veh', 'air'];
  for (const k of sideCats) { const b = document.createElement('button'); b.className = 'tab'; b.dataset.cat = k; b.innerHTML = `${CATS[k]}<i></i>`; b.onclick = () => { UI.tab = k; UI.hotPanel = 'side'; sfx('click'); buildGrid(); }; tabs.appendChild(b); }
  const bt = $('btabs'); if (bt) { for (const k of botCats) { const b = document.createElement('button'); b.className = 'tab'; b.dataset.cat = k; b.innerHTML = `${CATS[k]}<i></i>`; b.onclick = () => { UI.btab = k; UI.hotPanel = 'bot'; sfx('click'); buildBotGrid(); }; bt.appendChild(b); } }
  UI.btab = UI.btab || 'inf'; UI.hotPanel = UI.hotPanel || 'side';
  buildGrid();
  $('sellBtn').onclick = () => { UI.mode = UI.mode === 'sell' ? null : 'sell'; UI.placing = null; sfx('click'); };
  $('repBtn').onclick = () => { UI.mode = UI.mode === 'repair' ? null : 'repair'; UI.placing = null; sfx('click'); };
  $('pauseBtn').onclick = () => togglePause();
  $('setBtn').onclick = () => openSettings(true);
  $('quietBtn').onclick = () => toggleQuiet(); $('quietBtn').classList.toggle('on', !!UI.set.quiet); document.body.classList.toggle('quiet', !!UI.set.quiet); if (UI.set.quiet) applyQuality('quiet');
  { const qf = $('setQuietFps'); qf.value = UI.set.quietFps || '60'; qf.onchange = () => { UI.set.quietFps = qf.value; saveSet(); }; const qc = $('setQuiet'); qc.checked = !!UI.set.quiet; qc.onchange = () => toggleQuiet(qc.checked); }
  $('muteBtn').onclick = () => { AU.muted = !AU.muted; $('muteBtn').textContent = AU.muted ? '🔇' : '🔊'; };
  const cv = $('view');
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('mousemove', e => { const r = (R3.renderer ? R3.renderer.domElement : cv).getBoundingClientRect(); const nx = e.clientX - r.left, ny = e.clientY - r.top;
    if (UI.pan) { const a = screenToWorld(UI.mouse.x, UI.mouse.y), b = screenToWorld(nx, ny); if (a && b) { R3.cam.tx -= b.x - a.x; R3.cam.ty -= b.y - a.y; R3.cam.x -= b.x - a.x; R3.cam.y -= b.y - a.y; } }
    UI.mouse.x = nx; UI.mouse.y = ny; });
  cv.addEventListener('mouseleave', () => { UI.mouse.x = -1; });
  cv.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  cv.addEventListener('wheel', e => { e.preventDefault(); R3.cam.td *= e.deltaY > 0 ? 1.12 : 0.89; if (G.spectate || G.watch) { if (typeof DIR !== 'undefined') DIR.userZoom = true; } }, { passive: false });
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', e => { UI.keys[e.key.toLowerCase()] = false; UI.keys.shift = e.shiftKey; UI.keys.control = e.ctrlKey || e.metaKey; });
  window.addEventListener('blur', () => { UI.keys = {}; }); document.addEventListener('visibilitychange', () => { UI.keys = {}; });
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
function listFor(cat) { const f = G.players[ME].fac, ok = t => { const d = BT[t] || UT[t]; return !d.hide && (!d.fac || d.fac === f) && d.noFac !== f; }; return [...Object.keys(BT).filter(t => t !== 'hq' && BT[t].cat === cat && ok(t)), ...Object.keys(UT).filter(t => FROMCAT[UT[t].from] === cat && ok(t))]; }
function itemHTML(t, hk) { const d = BT[t] || UT[t]; return `<img src="${icon(t)}"><div class="nm">${nameOf(t)}</div>${d.batch ? `<div class="bx">×${d.batch}</div>` : ""}<div class="cost">$${d.cost}${d.gas ? `<i class="gas"> ◆${d.gas}</i>` : ""}</div>${hk ? `<div class="hk">${hk.toUpperCase()}</div>` : ''}<div class="prog"></div><div class="cnt"></div><div class="rdy">READY</div><div class="lock">🔒</div>`; }
function wireItem(b, t, panel) {
  b.dataset.t = t;
  b.onmousedown = e => { e.preventDefault(); audioInit(); if (panel) UI.hotPanel = panel; clickItem(t, e.button === 2, e.shiftKey); };
  b.oncontextmenu = e => e.preventDefault();
  b.onmouseenter = () => showTip(t, b); b.onmouseleave = hideTip;
}
function buildGrid() {
  const g = $('grid'); if (!g) return; g.innerHTML = '';
  document.querySelectorAll('#tabs .tab').forEach(b => b.classList.toggle('on', b.dataset.cat === UI.tab));
  if (UI.tab !== 'bld' && UI.tab !== 'def') UI.tab = 'bld';
  UI.gridList = listFor(UI.tab);
  UI.gridList.forEach((t, i) => { const b = document.createElement('div'); b.className = 'item'; b.innerHTML = itemHTML(t, HOTKEYS[i]); wireItem(b, t, 'side'); g.appendChild(b); });
  buildBotGrid();
}
function buildBotGrid() {
  const g = $('bgrid'); if (!g) return; g.innerHTML = '';
  document.querySelectorAll('#btabs .tab').forEach(b => b.classList.toggle('on', b.dataset.cat === UI.btab));
  UI.botList = listFor(UI.btab || 'inf');
  UI.botList.forEach((t, i) => { const b = document.createElement('div'); b.className = 'item'; b.innerHTML = itemHTML(t, HOTKEYS[i]); wireItem(b, t, 'bot'); g.appendChild(b); });
}
function counters(wpn) {
  if (!wpn) return { good: [], bad: [] }; const m = DMG[W[wpn].type], names = { inf: 'Infantry', light: 'Light vehicles', heavy: 'Armor', bldg: 'Structures', air: 'Aircraft' };
  const ok = a => (a === 'air' ? W[wpn].air : W[wpn].ground);
  return { good: Object.keys(m).filter(a => m[a] >= 1 && ok(a)).map(a => names[a]), bad: Object.keys(m).filter(a => (m[a] <= 0.35 || !ok(a))).map(a => names[a]) };
}
// v6.3.1: tooltips remember the element that opened them. A tooltip whose owner left the DOM (panel re-render,
// deselect) or, on touch, that has been up for 2.5 s is hidden. Before this, tapping "Upgrade" on mobile opened the
// upgrade tooltip via a compat mouseenter that never got its mouseleave, and the tooltip sat over the build tabs forever.
function tipOwn(el) { UI.tipOwner = el || null; UI.tipT = performance.now(); }
function hideTip() { if (UI.tip) UI.tip.style.display = 'none'; UI.tipOwner = null; }
function tipGuard() { if (!UI.tip || UI.tip.style.display === 'none') return; const o = UI.tipOwner, touch = typeof MOB !== 'undefined' && MOB.on;
  if ((o && !o.isConnected) || (o && o.offsetParent === null) || (touch && performance.now() - (UI.tipT || 0) > 2500 && !(o && o.classList && o.classList.contains('mcard')))) hideTip(); }
function showTip(t, el) { tipOwn(el);
  const d = BT[t] || UT[t], u = UT[t], wpn = u ? u.wpn : BT[t].wpn, c = counters(wpn), i = UI.gridList.indexOf(t);
  let h = `<b>${nameOf(t)}</b> <span class="c">$${d.cost}</span>${d.gas ? ` <span class="gas">◆${d.gas}</span>` : ''} <span class="dim">· ${d.time}s</span>${i >= 0 && HOTKEYS[i] ? ` <kbd>${HOTKEYS[i].toUpperCase()}</kbd>` : ''}<br>`;
  if (t === 'wall' && G.players[ME].fac === 'chn') h += `<span class="g">🇨🇳 Great Wall:</span> +${Math.round((CHN_WALL.hp - 1) * 100)}% HP, and every ${CHN_WALL.every}th piece rises as a Guard Tower — each guard tower fights like a garrisoned squad: rifleman, sniper, rocketeer and Iron Marine (range up to ${W.snipe.rng + GT_SQUAD.rng} tiles, ground + air, no power). With a Research Lab, select a guard tower to convert it into a 🏹 Ballista Tower ($${BALLISTA.cost} ◆${BALLISTA.gas}): one giant tank-killing arrow, no splash.<br>`;
  if (d.desc) h += d.desc + '<br>'; else h += `<span class="dim">${BT[t] ? (d.cat === 'def' ? 'Static defense.' : 'Base structure.') : (u && u.air ? 'Aircraft.' : u && u.armor === 'inf' ? 'Infantry unit.' : 'Vehicle.') }</span><br>`;
  h += `HP ${d.hp}` + (u ? ` · ${u.armor} armor · speed ${u.sp}` : ` · power ${d.pow > 0 ? '+' : ''}${d.pow}`) + '<br>';
  if (wpn) h += `Weapon: ${W[wpn].type}, ${W[wpn].dmg} dmg, range ${W[wpn].rng}${W[wpn].splash ? ', splash' : ''}<br>`;
  if (c.good.length) h += `<span class="g">Strong vs: ${c.good.join(', ')}</span><br>`; if (c.bad.length) h += `<span class="r">Weak / can't hit: ${c.bad.join(', ')}</span><br>`;
  if (u && u.engineer) h += 'Captures enemy structures, repairs your own.<br>';
  if (UPG[t]) h += `<span class="dim">Upgradable to level 3 (+dmg, +range) when selected.</span><br>`;
  if (d.fac) h += `<span class="g">${FACTIONS[d.fac].flag} ${FACTIONS[d.fac].n} special.</span> ${FACTIONS[d.fac].desc}<br>`;
  if (t === 'extractor') h += `Must be placed on a Plasma Gas vent (glowing teal). Produces ${GAS_RATE} gas/s.<br>`;
  if (u && u.heal) h += 'Heals nearby infantry.<br>'; if (u && u.mech) h += 'Walker: fires rockets at ground and air.<br>'; if (u && u.jet) h += 'Bomb/missile runs, returns to Airfield to rearm.<br>';
  if (t === 'harv') h += `Carries ${HARV_CAP} ore (~$${Math.round(HARV_CAP * ORE_VALUE)} a load, 💎 diamond fields +$${DIA_BONUS}). Max ${FIELD_CAP} per ore field. Built at War Factory or Command Yard.<br>`;
  const req = (d.req || []).filter(r => r !== '__never'); if (req.length) h += `<span class="dim">Requires: ${req.map(r => BT[r].n).join(', ')}</span><br>`;
  h += `<span class="dim">${BT[t] ? 'Click to build, then place' : 'Shift+click: queue 5'} · Right-click: cancel</span>`;
  UI.tip.innerHTML = h; UI.tip.style.display = 'block'; const r = el.getBoundingClientRect(); UI.tip.style.top = Math.max(8, Math.min(innerHeight - 200, r.top)) + 'px'; UI.tip.style.right = (innerWidth - r.left + 8) + 'px';
}
function clickItem(t, right, shift) {
  const P = G.players[ME], cat = catOf(t);
  if (right) { const n = NET.online ? (P.queues[cat].some(q => q.t === t) || P.ready[cat] === t || (BT[t] && G.ents.some(e => e.con && e.team === ME && e.t === t && e.hp > 0)) ? 1 : 0) : 0; const r = NET.issue({ c: 'cancel', t, n: shift ? 5 : 1 }); if (NET.online ? n : r) { sfx('click'); if (UI.placing === t) UI.placing = null; } return; }
  if (t === 'wall') { if (!avail(ME, t)) { sfx('error'); uiMsg('Walls require a Barracks'); return; } UI.mode = 'wall'; UI.placing = null; UI.wallA = null; sfx('click'); uiMsg('Wall: click-drag to lay a chain ($' + BT.wall.cost + '/segment, straight or diagonal). Shift keeps the tool. Right-click/Esc to stop.'); return; }
  if (!avail(ME, t)) { sfx('error'); const d = BT[t] || UT[t]; uiMsg('Requires: ' + [...(d.req || []), ...(UT[t] ? [UT[t].from] : [])].filter(r => r !== '__never' && !hasBuilt(ME, r)).map(r => BT[r].n).join(', ')); return; }
  if (BT[t]) { const why = buildWhy(ME, t); if (why) { sfx('error'); uiMsg(buildMsg(t, why)); return; } UI.placing = t; UI.mode = null; sfx('click'); uiMsg(`Place the ${BT[t].n}: $${BT[t].cost}${BT[t].gas ? ' ◆' + BT[t].gas : ''} is paid when you place it, then it builds on the spot. Shift keeps the tool · Right-click/Esc to stop.`); return; } // v7.2 place-then-build
  const cnt = shift && UT[t] ? 5 : 1; let n; if (NET.online) { n = canEnqueue(ME, t) ? 1 : 0; if (n) NET.issue({ c: 'enq', t, n: cnt }); } else n = NET.issue({ c: 'enq', t, n: cnt });
  if (n) sfx('click'); else { sfx('error'); const gq = (BT[t] || UT[t]).gas || 0; uiMsg(gq > P.gas ? `Need ${gq} Plasma Gas (build a Gas Extractor on a vent)` : BT[t] ? (BT[t].cat === 'def' ? 'Defense queue full (5)' : 'Already building a structure') : 'Queue full (' + queueCap(ME, cat) + ' — build more production to raise it)'); }
}
function buildMsg(t, why) { const d = BT[t], P = G.players[ME]; return why === 'cr' ? `Not enough credits: ${d.n} costs $${d.cost} (you have $${Math.floor(P.cr)})` : why === 'gas' ? `Need ${d.gas} Plasma Gas (build a Gas Extractor on a vent)` : why === 'busy' ? `${CON_CAP[d.cat]} ${d.cat === 'def' ? 'defenses' : 'structures'} already waiting to be built — let one finish first` : why === 'spot' ? "Can't build there" : why === 'req' ? 'Requirements missing' : "Can't build that"; }
function pickAt(sx, sy) {
  const w = screenToWorld(sx, sy); if (!w) return null;
  let best = null, bd = 1e9;
  for (const e of G.ents) {
    if (!visibleTo0(e)) continue;
    // v5.7.1: the thing under the cursor must be near the clicked ground point (objects behind the camera project to garbage boxes)
    if (dhypot(e.x - w.x, e.y - w.y) > (e.kind === 'b' ? Math.max(e.w, e.h) * 0.75 + 2.5 : UT[e.t] && (UT[e.t].air || UT[e.t].jet) ? 4.5 : 2.5)) continue;
    if (e.kind === 'b') { // v5.5: screen-space box of the projected building (base + top), exact under the cursor
      const h0 = typeof heightAt === 'function' ? heightAt(e.x, e.y) : 0, ht = e.t === 'tesla' ? 2.4 : e.t === 'wall' || e.t === 'gate' ? 0.9 : BT[e.t].cat === 'def' ? 1.3 : 1.6;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [cx, cy] of [[e.tx, e.ty], [e.tx + e.w, e.ty], [e.tx, e.ty + e.h], [e.tx + e.w, e.ty + e.h]]) for (const z of [h0, h0 + ht]) { const q = worldToScreen(cx, cy, z); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
      if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) { const c = worldToScreen(e.x, e.y, h0 + ht * 0.5), d = Math.hypot(c.x - sx, c.y - sy) * 0.5 + 6; if (d < bd) { best = e; bd = d; } } continue; }
    const rs = R3.rs.get(e.id) || e, p = worldToScreen(rs.x, rs.y, (R3.rs.get(e.id) ? rs.z : heightAt(e.x, e.y) + (e.z || 0)) + 0.3), d = Math.hypot(p.x - sx, p.y - sy), rr = (12 + UT[e.t].r * 900 / R3.cam.d) * (MOBL() ? 1.6 : 1); // v6.1: fat-finger radius on touch
    if (d < rr && d < bd) { bd = d; best = e; }
  }
  return best;
}
const TABFOR = { barracks: 'inf', factory: 'veh', airfield: 'air', hq: 'bld' };
function setSel(list) {
  hideTip();
  G.ents.forEach(e => e.sel = false); UI.sel = list; list.forEach(e => e.sel = true);
  if (list.length === 1 && list[0].kind === 'b' && list[0].team === ME && TABFOR[list[0].t]) { const tf = TABFOR[list[0].t]; if (tf === 'bld' || tf === 'def') { if (UI.tab !== tf) { UI.tab = tf; UI.hotPanel = 'side'; buildGrid(); } } else if (UI.btab !== tf) { UI.btab = tf; UI.hotPanel = 'bot'; buildBotGrid(); } }
  UI.ctxKey = null;
}
function onDown(e) {
  audioInit();
  const m = UI.mouse; const r = (R3.renderer ? R3.renderer.domElement : $('view')).getBoundingClientRect(); m.x = e.clientX - r.left; m.y = e.clientY - r.top;
  if (e.button === 1) { e.preventDefault(); UI.pan = true; return; }
  const w = screenToWorld(m.x, m.y);
  if (e.altKey && w && !G.spectate) { e.preventDefault(); const en = G.ents.some(o => foe(o.team, ME) && visibleTo0(o) && Math.hypot(o.x - w.x, o.y - w.y) < 6); NET.issue({ c: 'ping', x: w.x, y: w.y, k: en ? 'attack' : 'defend' }); UI.pings.push({ x: w.x, y: w.y, t: 3 }); marker(w.x, w.y, en); uiMsg(en ? 'Ping: attack here!' : 'Ping: help here!'); sfx('alert'); return; }
  if (e.button === 2) {
    if (UI.placing || UI.mode) { UI.placing = null; UI.mode = null; return; }
    if (!w) return;
    const tgt = pickAt(m.x, m.y), units = UI.sel.filter(s => s.kind === 'u' && s.team === ME);
    if (units.length) {
      const dk = !tgt && G.derricks && units.some(u => UT[u.t].engineer) ? G.derricks.find(d => Math.hypot(d.x - w.x, d.y - w.y) < 1.4 && d.owner !== ME) : null;
      if (dk) { NET.issue({ c: 'derrick', u: ids(units.filter(u => UT[u.t].engineer)), k: dk.id }); uiMsg('Engineer: capturing oil derrick'); }
      else if (tgt && tgt.cargo && tgt.team === ME && units.some(u => canBoard(u, tgt))) { NET.issue({ c: 'board', u: ids(units.filter(u => canBoard(u, tgt))), tr: tgt.id }); uiMsg('Boarding ' + tgt.cargo.length + ' aboard · ' + (UT[tgt.t].cap - cargoUsed(tgt)) + ' slots free'); }
      else if (tgt && foe(tgt.team, ME)) { NET.issue({ c: 'attack', u: ids(units), t: tgt.id }); marker(tgt.x, tgt.y, true); }
      else if (tgt && tgt.kind === 'b' && units.some(u => UT[u.t].engineer)) { NET.issue({ c: 'attack', u: ids(units.filter(u => UT[u.t].engineer)), t: tgt.id }); }
      else if (tgt && tgt.t === 'refinery' && units.some(u => u.t === 'harv')) { units.filter(u => u.t === 'harv').forEach(h => { h.hst = 'ret'; h.path = []; }); }
      else { NET.issue({ c: 'move', u: ids(units), x: w.x, y: w.y, am: UI.keys.control || false, q: e.shiftKey }); marker(w.x, w.y); }
      sfx('ack');
    } else { const bs = UI.sel.filter(s => s.kind === 'b' && s.team === ME && (PRODB.includes(s.t) || s.t === 'hq')); if (bs.length) NET.issue({ c: 'rally', b: ids(bs), x: w.x, y: w.y }); if (bs.length) { marker(w.x, w.y); sfx('ack'); uiMsg('Rally point set'); } }
    return;
  }
  if (e.button !== 0) return;
  if (UI.placing) {
    const d = BT[UI.placing], tx = Math.floor(w.x - d.w / 2 + 0.5), ty = Math.floor(w.y - d.h / 2 + 0.5);
    const why = buildWhy(ME, UI.placing, tx, ty); // v7.2: full price paid on placement; the site builds on the ground
    if (!why && (NET.online ? (NET.issue({ c: 'build', t: UI.placing, x: tx, y: ty }), true) : NET.issue({ c: 'build', t: UI.placing, x: tx, y: ty }))) { sfx('ack'); if (!e.shiftKey) UI.placing = null; } else { sfx('error'); uiMsg(buildMsg(UI.placing, why || 'spot')); }
    return;
  }
  if (UI.mode === 'nuke') { const b = UI.sel.find(s => s.t === 'silo' && s.team === ME); if (w && b) { if (dhypot(w.x - b.x, w.y - b.y) > MIS[b.mis || 'small'].rng) { sfx('error'); uiMsg('Target out of range (' + MIS[b.mis || 'small'].rng + ')'); return; } NET.issue({ c: 'mlaunch', b: b.id, x: w.x, y: w.y }); marker(w.x, w.y, true); sfx('ack'); } UI.mode = null; return; }
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
const PRODB = ['barracks', 'factory', 'airfield'];
function sameTypeOnScreen(t) { const l = G.ents.filter(o => o.team === ME && o.t === t.t && o.hp > 0 && (o.kind !== 'b' || o.sell < 0) && inView(o.x, o.y)); return l.sort((a, b) => dhypot(a.x - t.x, a.y - t.y) - dhypot(b.x - t.x, b.y - t.y)); }
function upgradeAll() { // v6.2: blanket-upgrade every selected defense of one type, nearest first, as many as affordable (sim stops when money runs out)
  const bs = UI.sel.filter(b => b.kind === 'b' && b.team === ME && UPG[b.t] && upgradeInfo(b) && b.upT == null); if (!bs.length) { sfx('error'); uiMsg('Nothing to upgrade'); return; }
  const P = G.players[ME]; let cr = P.cr, gas = P.gas, n = 0; for (const b of bs) { const i = upgradeInfo(b); if (cr >= i.cost && gas >= (i.gas || 0)) { cr -= i.cost; gas -= i.gas || 0; n++; } }
  if (!n) { sfx('error'); uiMsg('Not enough credits to upgrade any'); return; }
  NET.issue({ c: 'upgall', b: ids(bs) }); sfx('click'); uiMsg(`⬆ Upgrading ${n} of ${bs.length} ${BT[bs[0].t].n}${bs.length > 1 ? 's' : ''} (nearest first)`); UI.ctxKey = null; }
function onUp(e) {
  if (e.button === 1) { UI.pan = false; return; }
  if (e.button === 0 && UI.mode === 'wall' && UI.wallA) { const tl = wallTiles(); UI.wallA = null; const ok = tl.filter(([x, y]) => canPlace('wall', ME, x, y)); if (ok.length && G.players[ME].cr < BT.wall.cost) { sfx('error'); uiMsg(`Not enough credits: walls cost $${BT.wall.cost} per piece`); } else if (ok.length) { NET.issue({ c: 'walls', t: ok }); sfx('ack'); } else { sfx('error'); uiMsg("Can't build walls there"); } if (!e.shiftKey) UI.mode = null; return; }
  const m = UI.mouse; if (!m.down || e.button !== 0) return; m.down = false;
  const x0 = Math.min(m.sx, m.x), x1 = Math.max(m.sx, m.x), y0 = Math.min(m.sy, m.y), y1 = Math.max(m.sy, m.y);
  let list;
  if (x1 - x0 < 6 && y1 - y0 < 6) {
    const t = pickAt(m.x, m.y); list = t ? [t] : [];
    const now = performance.now();
    if (t && t.team === ME && now - UI.lastClick < 350 && UI.lastPick === t.t) list = sameTypeOnScreen(t); // v6.2: buildings too
    UI.lastClick = now; UI.lastPick = t && t.t;
  } else {
    list = G.ents.filter(o => o.team === ME && o.kind === 'u' && (() => { const rs = R3.rs.get(o.id) || o, p = worldToScreen(rs.x, rs.y, (rs.z || 0) + 0.2); return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1; })());
    if (list.some(u => u.t !== 'harv')) list = list.filter(u => u.t !== 'harv');
  }
  if (m.shift) list = [...new Set([...UI.sel, ...list])];
  setSel(list); if (list.length && list[0].team === ME) sfx('ack');
}
function onKey(e) {
  const ae = document.activeElement, tag = ae && ae.tagName;
  if (tag === 'TEXTAREA' || (tag === 'INPUT' && /^(text|search|number|password|email|)$/i.test(ae.type || ''))) return; // typing (chat, name, code): keys are text
  if (started && ae && ae !== document.body && (tag === 'SELECT' || tag === 'INPUT' || tag === 'BUTTON')) ae.blur(); // v5.7.2: a focused dropdown/checkbox must not swallow camera keys
  const k0 = e.key.toLowerCase(); if (started && (/^arrow/.test(k0) || ('wasd'.includes(k0) && k0.length === 1))) e.preventDefault();
  if (k0 === 'meta') { UI.keys = {}; } // macOS: no keyup for letters released while Cmd is held
  const k = e.key.toLowerCase(); UI.keys[k] = true; UI.keys.control = e.ctrlKey || e.metaKey; UI.keys.shift = e.shiftKey;
  if (!started) return;
  if (k === 'escape') { if ($('settings').style.display === 'flex') openSettings(false); else if (UI.placing || UI.mode) { UI.placing = null; UI.mode = null; } else togglePause(); return; }
  if (k === 'p') { togglePause(); return; }
  if (G.watch && k === 'c') { DIR.auto = !DIR.auto; DIR.tagT = -9; return; }
  if (G.watch && 'wasd'.includes(k) && k.length === 1) return;
  if (paused) return;
  if (k === 't' && !e.ctrlKey && !e.metaKey && UI.sel.some(u => u.team === ME && u.kind === 'u' && UT[u.t].xform)) { doXform(); return; } // v7.0: T transforms Raijin (beats the T build hotkey while one is selected)
  if (/^[1-9]$/.test(k)) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) { UI.groups[k] = UI.sel.filter(s => s.team === ME).map(s => s.id); uiMsg('Group ' + k + ' set'); return; }
    const list = (UI.groups[k] || []).map(byId).filter(Boolean); setSel(list);
    const now = performance.now(); if (UI.lastGroupKey === k && now - UI.lastGroupT < 400 && list.length) jumpTo(list[0].x, list[0].y);
    UI.lastGroupKey = k; UI.lastGroupT = now; return;
  }
  if ('wasd'.includes(k) && k.length === 1 && !e.ctrlKey && !e.metaKey) return; // WASD = camera only (before grid hotkeys)
  const hi = HOTKEYS.indexOf(k); if (hi >= 0 && !e.ctrlKey && !e.metaKey) { const list = UI.hotPanel === 'bot' ? (UI.botList || []) : UI.gridList; if (list[hi]) { clickItem(list[hi], false, e.shiftKey); return; } }
  if (k === 'b' && !UI.sel.some(s => s.cargo && s.team === ME) && toggleSiege()) return;
  if (k === 'b') { const trs = UI.sel.filter(s => s.cargo && s.team === ME); if (trs.length) { if (e.shiftKey) unloadAll(); else { UI.mode = 'unload'; uiMsg('Unload: click where to drop (Shift+B drops right here). Carrying ' + trs.reduce((a, t) => a + t.cargo.length, 0)); } return; } }
  if (k === 'c' && !G.watch) { const su = UI.sel.filter(s => s.team === ME && s.kind === 'u'); if (su.length) NET.issue({ c: 'stop', u: ids(su) }); }
  if ('wasd'.includes(k) && k.length === 1) return; // v5.5: WASD is camera pan only
  if (k === 'g') { doFormation(e.shiftKey); return; }
  if (k === 'v') { toggleStance(); return; }
  if (k === 'z') { if (UI.sel.length > 1) upgradeAll(); else doUpgrade(); return; }
  if (k === 'n' && UI.sel.some(s => s.t === 'silo' && s.team === ME)) { siloArm(); return; }
  if (k === 'f' && UI.sel.some(s => s.kind === 'u')) { UI.mode = 'amove'; uiMsg('Attack-move (F): left-click target — units fight what they meet (Shift = waypoint)'); return; }
  if (k === 'h') { const hq = G.ents.find(e => e.team === ME && e.t === 'hq') || G.ents.find(e => e.team === ME && e.t === 'cc'); if (hq) jumpTo(hq.x, hq.y); }
  if (k === 'q') { const side = ['bld', 'def']; UI.tab = side[(side.indexOf(UI.tab) + 1) % side.length]; UI.hotPanel = 'side'; buildGrid(); }
  if (k === 'tab') { e.preventDefault(); const bot = ['inf', 'veh', 'air']; UI.btab = bot[(bot.indexOf(UI.btab || 'inf') + 1) % bot.length]; UI.hotPanel = 'bot'; buildBotGrid(); }
  if (k === 'x') $('sellBtn').onclick(); if (k === 'r') $('repBtn').onclick();
  if (k === 'e') setSel(G.ents.filter(o => o.team === ME && o.kind === 'u' && UT[o.t].wpn));
  if (k === 'm') { toggleQuiet(); return; }
  if (k === '`') { UI.set.fps = !UI.set.fps; $('setFps').checked = UI.set.fps; saveSet(); }
  if (k === '.') selectIdle('harv'); if (k === ',') selectIdle('army');
}
function doXform() { // v7.0 Japan Raijin mech <-> jet (T / ⚡ button / mobile command). Mixed selection: any mechs take off, else the jets land
  const a = UI.sel.filter(u => u.team === ME && u.kind === 'u' && UT[u.t].xform && u.hp > 0 && u.xfT == null && G.time >= (u.xfCd || 0)); if (!a.length) return !!UI.sel.some(u => u.team === ME && UT[u.t] && UT[u.t].xform);
  const mechs = a.filter(u => !UT[u.t].air), list = mechs.length ? mechs : a;
  NET.issue({ c: 'xform', u: ids(list) }); sfx('ack'); uiMsg(mechs.length ? `⚡ ${list.length} Raijin taking off — JET mode: fast, flies over walls` : `⚡ ${list.length} Raijin landing — MECH mode: lightning cannon`); UI.ctxKey = null; return true; }
function toggleSiege() { // v6.2 Howler Siege Mode (B / button / mobile command)
  const a = UI.sel.filter(u => u.team === ME && u.kind === 'u' && UT[u.t].siege && u.hp > 0); if (!a.length) return false; const on = !a.every(u => u.sg === 1 || u.sg === 2);
  NET.issue({ c: 'siege', u: ids(a), on: on ? 1 : 0 }); sfx('ack'); uiMsg(on ? `🎯 ${a.length} Howler${a.length > 1 ? 's' : ''} deploying (${SIEGE.dep}s): range ${SIEGE.rng}, wider splash` : `Howlers packing up (${SIEGE.pack}s)`); UI.ctxKey = null; return true; }
function doResearch(k) { const b = UI.sel[0]; if (!b || b.t !== 'tech' || b.team !== ME) return; const i = researchInfo(ME, k), P = G.players[ME];
  const why = !i ? 'Already at level 3' : b.upT != null ? 'This lab is busy (one track at a time per lab)' : i.busy ? 'Already being researched' : i.lock ? 'Level 3 needs a 2nd Research Lab, an Air Command or a Warhead Launcher' : P.cr < i.cost ? 'Insufficient funds' : P.gas < i.gas ? `Need ${i.gas} Plasma Gas` : '';
  if (why) { sfx('error'); uiMsg(why); return; } NET.issue({ c: 'research', b: b.id, k }); sfx('click'); uiMsg(`🔬 Researching ${RES.nm[k]} level ${i.next} (${i.time}s)`); }
function researchPanel(b) { const P = G.players[ME];
  document.querySelectorAll('.rsb').forEach(bt => { const c = bt.dataset.k, l = rsLvl(ME, c), i = researchInfo(ME, c), cur = b.upT != null && b.upKind === 'rs' && b.upCat === c;
    const ch = '<span class="chev">' + '▲'.repeat(l - 1) + '</span>';
    const t = `${RES.ic[c]} ${RES.nm[c]} L${l} ${ch} ` + (!i ? '<span class="g">★ max</span>' : cur ? `<span class="g">researching ${Math.floor((G.time - b.upT) / b.upDur * 100)}%</span>` : i.busy ? '<span class="dim">in another lab…</span>' : i.lock ? '<span class="dim">🔒 L3: 2nd lab / Air Command / Warhead Launcher</span>' : `→ L${i.next} <span class="c">$${i.cost}</span>${i.gas ? ` <span class="gas">◆${i.gas}</span>` : ''} <span class="dim">${i.time}s</span>`);
    if (bt.innerHTML !== t) bt.innerHTML = t; bt.disabled = !i || i.busy || i.lock || b.upT != null; bt.classList.toggle('poor', !!i && (P.cr < i.cost || P.gas < i.gas)); });
  const st = $('rsSt'); if (st) { const t = b.upT != null && b.upKind === 'rs' ? `Lab busy: ${RES.nm[b.upCat]} ${Math.ceil(b.upDur - (G.time - b.upT))}s left` : 'Lab idle: pick a track'; if (st.textContent !== t) st.textContent = t; } }
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
function unloadAll() { const trs = UI.sel.filter(s => s.cargo && s.team === ME); if (!trs.length) return false; let n = 0; trs.forEach(tr => { n += tr.cargo.length; NET.issue({ c: 'unload', tr: tr.id, x: tr.x, y: tr.y }); }); sfx('ack'); uiMsg(n ? `⏬ Unloading ${n} passenger${n > 1 ? 's' : ''}` : 'Transport is empty'); return true; } // v6.3
function toggleStance() { const us = myUnits(); if (!us.length) return; const st = us.every(u => u.stance === 'hold') ? 'aggr' : 'hold'; NET.issue({ c: 'stance', u: ids(us), s: st }); sfx('click'); uiMsg(st === 'hold' ? 'Stance: Hold position (engage in range, return)' : 'Stance: Aggressive (chase targets)'); UI.ctxKey = null; }
function doUpgrade() { const b = UI.sel.length === 1 && UI.sel[0].kind === 'b' && UI.sel[0].team === ME ? UI.sel[0] : null; if (!b) return; const inf = upgradeInfo(b);
  if (!inf) return; if (NET.online ? canUpgrade(b) && (NET.issue({ c: 'upg', b: b.id }), true) : NET.issue({ c: 'upg', b: b.id })) { sfx('click'); uiMsg(inf.kind === 'bal' ? '🏹 Converting to ' + BALLISTA.n + ' (' + inf.time + 's)' : inf.kind === 'pads' ? 'Building ' + AIRPADS.n : inf.kind === 'sm3' ? 'Installing ' + SM3.n : inf.kind === 'def' ? 'Researching ' + DEF_RESEARCH.n : 'Upgrading to level ' + inf.next); UI.ctxKey = null; } else { sfx('error'); uiMsg(b.upT != null ? 'Upgrade in progress' : (inf.gas || 0) > G.players[ME].gas ? `Need ${inf.gas} Plasma Gas` : 'Insufficient funds'); } }
function upgTip(b) {
  const inf = upgradeInfo(b);
  if (b.t === 'gtower') { const bw = W.bolt, rl = rsLvl(b.team, 'def'), bd = Math.round(bw.dmg * RES_M[rl]), rg = bw.rng + GT_SQUAD.rng; // v7.0.2 Ballista Tower
    const body = `One giant armour-piercing arrow every ${bw.cd}s: <span class="g">${Math.round(bd * DMG.bolt.heavy)}</span> vs heavy armour, ${Math.round(bd * DMG.bolt.light)} vs light, ${Math.round(bd * DMG.bolt.inf)} vs infantry, ${Math.round(bd * DMG.bolt.bldg)} vs buildings. Single target, <b>no splash</b>. Range ${rg} · ground only.<br>Sniper + rocketeer crew the ballista; the rifleman and Iron Marine stay (Marine = light anti-air).<br>Tower HP ${BT.gtower.hp} → <span class="g">${BALLISTA.hp}</span> · uses ${-BALLISTA.pow} power`;
    if (b.bal) return `<b>🏹 ${BALLISTA.n}</b><br>${body}`;
    return `<b>🏹 Convert to ${BALLISTA.n}</b> <span class="c">$${BALLISTA.cost}</span> <span class="gas">◆${BALLISTA.gas}</span> <span class="dim">· ${BALLISTA.time}s${inf ? '' : ' · needs a Research Lab'}</span>${inf ? ' <kbd>Z</kbd>' : ''}<br>${body}`; } if ((b.t === 'hq' || b.t === 'cc') && !b.sm3) return `<b>🛡 ${SM3.n}</b> <span class="c">$${SM3.cost}</span> <span class="gas">◆${SM3.gas}</span> <span class="dim">· ${SM3.time}s · needs a Research Lab</span><br>${Math.round(SM3.p * 100)}% chance to shoot down EVERY incoming warhead, missile, rocket and artillery shell within ${SM3.r} tiles of this building.`; if (inf && inf.kind === 'pads') return `<b>✈ ${AIRPADS.n}</b> <span class="c">$${inf.cost}</span> <span class="dim">· ${inf.time}s</span><br>Adds 4 more dock slots (4 → 8). Docked aircraft rearm and are repaired 8%/s.`; if (!inf) return 'Fully upgraded'; if (inf.kind === 'def') return `<b>${DEF_RESEARCH.n}</b> <span class="c">$${inf.cost}</span> <span class="gas">◆${inf.gas}</span> <span class="dim">· ${inf.time}s</span><br>All Guard Turrets & Flak Batteries: +${Math.round((DEF_RESEARCH.dmg - 1) * 100)}% damage, +${DEF_RESEARCH.rng} range, +${Math.round((DEF_RESEARCH.hp - 1) * 100)}% HP`;
  const w = defW(b), l = b.lvl || 1, nd = Math.round(W[BT[b.t].wpn].dmg * UPG_DMG[l] * (G.players[ME].defUp ? DEF_RESEARCH.dmg : 1)), nr = W[BT[b.t].wpn].rng + UPG_RNG[l] + (G.players[ME].defUp ? DEF_RESEARCH.rng : 0);
  return `<b>Upgrade to level ${l + 1}</b> <span class="c">$${inf.cost}</span>${inf.gas ? ` <span class="gas">◆${inf.gas}</span>` : ''} <span class="dim">· ${inf.time}s</span> <kbd>Z</kbd><br>Damage ${w.dmg} → <span class="g">${nd}</span><br>Range ${w.rng} → <span class="g">${nr}</span>`;
}
function idleList(kind) {
  return G.ents.filter(u => u.team === ME && u.kind === 'u' && (kind === 'harv' ? u.t === 'harv' && (u.hst === 'idle' || u.hst === 'manual') && !u.path.length && (u.idleT || 0) > 2
    : u.t !== 'harv' && UT[u.t].wpn && u.order === 'idle' && !u.tgt && !u.path.length && (u.idleT || 0) > 6));
}
function selectIdle(kind) { const l = idleList(kind); if (!l.length) return; setSel(kind === 'harv' ? [l[0]] : l); jumpTo(l[0].x, l[0].y); }
function uiFrame(dt) {
  annFrame(dt); tipGuard(); endlessHud();
  const P = G.players[ME], m = UI.mouse, el = R3.renderer.domElement, W_ = el.clientWidth, H_ = el.clientHeight;
  // smooth camera scroll (edge + arrows), speed setting
  // v5.4 WASD camera pan (works in play + spectate; A still arms attack-move on keydown)
  { const sp = dt * R3.cam.d * 1.15 * (UI.set.edge || 1); let dx = 0, dy = 0;
    if (UI.keys.w || UI.keys.arrowup) dy -= 1; if (UI.keys.s || UI.keys.arrowdown) dy += 1;
    if (UI.keys.a || UI.keys.arrowleft) dx -= 1; if (UI.keys.d || UI.keys.arrowright) dx += 1;
    if (dx || dy) { const n = Math.hypot(dx, dy) || 1; R3.cam.tx += dx / n * sp; R3.cam.ty += dy / n * sp; if (typeof DIR !== 'undefined') DIR.auto = false; } }
  const sp = dt * R3.cam.d * 1.1 * UI.set.edge, ed = typeof MOB !== 'undefined' && MOB.on ? -1e9 : 14; // no edge-pan with touch
  let dx = 0, dy = 0;
  if (UI.keys.arrowleft || (m.x >= 0 && m.x < ed)) dx -= 1; if (UI.keys.arrowright || (m.x >= 0 && m.x > W_ - ed)) dx += 1;
  if (UI.keys.arrowup || (m.x >= 0 && m.y < ed)) dy -= 1; if (UI.keys.arrowdown || (m.x >= 0 && m.y > H_ - ed)) dy += 1;
  if (G.watch) { if (UI.keys.a) dx -= 1; if (UI.keys.d) dx += 1; if (UI.keys.w) dy -= 1; if (UI.keys.s) dy += 1; }
  if (!UI.mmDrag && !UI.pan) { R3.cam.tx += dx * sp; R3.cam.ty += dy * sp; }
  UI.sel = UI.sel.filter(s => s.hp > 0 && !s.dead && (s.team === ME || visibleTo0(s)));
  for (const u of G.ents) if (u.team === ME && u.kind === 'u') u.idleT = (u.path.length || u.tgt || (u.t === 'harv' && u.hst !== 'idle' && u.hst !== 'manual')) ? 0 : (u.idleT || 0) + dt;
  if (UI.placing && typeof MOB !== 'undefined' && MOB.on && MOB.pl && MOB.pl.t === UI.placing && !G.spectate) { const L = MOB.pl, d = BT[L.t]; ghost(L.t, L.tx, L.ty, L.ok); if (R3.ghost) { const gx = L.vx + d.w / 2, gy = L.vy + d.h / 2; R3.ghost.position.set(gx, heightAt(L.tx + d.w / 2, L.ty + d.h / 2) + 0.02, gy); } } // v7.0.1 touch: world-space ghost, smooth glide
  else if (UI.placing && m.x >= 0) { const w = screenToWorld(m.x, m.y); if (w) { const d = BT[UI.placing], tx = Math.floor(w.x - d.w / 2 + 0.5), ty = Math.floor(w.y - d.h / 2 + 0.5); ghost(UI.placing, tx, ty, canPlace(UI.placing, ME, tx, ty)); } }
  else ghost(null);
  wallPreview(UI.mode === 'wall' ? (UI.wallA ? wallTiles() : (() => { const w = m.x >= 0 && screenToWorld(m.x, m.y); return w ? [[Math.floor(w.x), Math.floor(w.y)]] : null; })()) : null);
  if (UI.placing && !avail(ME, UI.placing)) UI.placing = null;
  if (UI.msgT > 0) { UI.msgT -= dt; if (UI.msgT <= 0) $('msg').style.opacity = 0; }
  el.style.cursor = UI.pan ? 'grabbing' : UI.placing ? 'cell' : UI.mode === 'sell' ? 'not-allowed' : UI.mode === 'repair' ? 'help' : UI.mode === 'amove' || UI.mode === 'nuke' ? 'crosshair' : (R3.hoverId && byId(R3.hoverId) && byId(R3.hoverId).team !== ME && UI.sel.some(s => s.kind === 'u' && s.team === ME)) ? 'crosshair' : 'default';
  if ((UI.hovT = (UI.hovT || 0) + dt) > 0.05) { UI.hovT = 0; const h = m.x >= 0 && !m.down ? pickAt(m.x, m.y) : null; R3.hoverId = h ? h.id : null; }
  UI.t = (UI.t || 0) + dt; if (UI.t > (MOBL() ? 0.25 : 0.1)) { UI.t = 0; sidebar(); }
  if ((UI.mmT = (UI.mmT || 0) + dt) > (MOBL() ? 0.5 : 0.2)) { UI.mmT = 0; minimap(); }
  UI.alerts.forEach(a => a.t -= dt); UI.alerts = UI.alerts.filter(a => a.t > 0); UI.pings.forEach(p => p.t -= dt); UI.pings = UI.pings.filter(p => p.t > 0);
  const f = $('fps'); f.style.display = UI.set.fps ? 'block' : 'none'; if (UI.set.fps) f.textContent = `${Math.round(R3.fps)} fps · ${R3.calls || 0} draws · ${((R3.tris || 0) / 1000).toFixed(0)}k tris · ${R3.q.label}${R3.auto ? ' (auto)' : ''} · ${G.ents.filter(e => e.kind === 'u').length} units`;
  overlay();
  if (typeof mobFrame === 'function' && typeof MOB !== 'undefined') mobFrame(dt);
}
function MOBL() { return typeof MOB !== 'undefined' && MOB.on; }
function sidebar() {
  const P = G.players[ME];
  $('cr').textContent = '$' + Math.floor(P.cr); $('gas').textContent = '◆ ' + Math.floor(P.gas);
  const pb = $('powbar'); const frac = P.gen ? Math.min(1, P.use / P.gen) : 1; pb.style.width = (frac * 100) + '%'; pb.style.background = P.pow < 0 ? '#ff4d3d' : frac > 0.85 ? '#ffc23d' : '#4dff7a';
  $('powtxt').textContent = `${P.use} / ${P.gen}` + (P.pow < 0 ? '  LOW POWER' : '');
  const sites = {}; for (const e of G.ents) if (e.con && e.team === ME && e.hp > 0) { const k = e.t === 'gtower' ? 'wall' : e.t, o = sites[k] || (sites[k] = { n: 0, p: 0 }); o.n++; if (!e.con.w) o.p = Math.max(o.p, e.con.p); }
  const upd = (b) => {
    const t = b.dataset.t, cat = catOf(t), q = P.queues[cat], d = BT[t] || UT[t];
    b.classList.toggle('locked', !avail(ME, t));
    if (BT[t]) { const st = sites[t] || null; b.querySelector('.prog').style.height = st ? (100 - st.p * 100) + '%' : '0%'; b.querySelector('.cnt').textContent = st && st.n > 1 ? st.n : ''; b.classList.toggle('ready', false); b.classList.toggle('active', !!st); b.classList.toggle('poor', P.cr < d.cost); return; } // v7.2: card shows the site being built
    const n = q.filter(i => i.t === t).length, first = q[0] && q[0].t === t ? q[0] : null;
    b.querySelector('.prog').style.height = first ? (100 - first.prog * 100) + '%' : n ? '100%' : '0%';
    b.querySelector('.cnt').textContent = n > 1 ? n : n === 1 && !first ? '1' : '';
    b.classList.toggle('ready', P.ready[cat] === t); b.classList.toggle('active', !!first); b.classList.toggle('poor', P.cr < d.cost * 0.1);
  };
  document.querySelectorAll('.item').forEach(upd);
  document.querySelectorAll('.tab').forEach(b => { const c = b.dataset.cat, ns = c === 'bld' || c === 'def' ? Object.keys(sites).filter(t => BT[t].cat === c).reduce((a, t) => a + sites[t].n, 0) : 0; b.querySelector('i').textContent = ns ? ns : P.queues[c].length ? P.queues[c].length : ''; b.classList.toggle('dis', !listFor(c).some(t => avail(ME, t))); });
  $('sellBtn').classList.toggle('on', UI.mode === 'sell'); $('repBtn').classList.toggle('on', UI.mode === 'repair');
  // alerts
  const ih = idleList('harv').length, ia = idleList('army').length;
  let ah = UI.alerts.map((a, i) => `<span class="al bad" data-a="${i}">⚠ ${a.txt}</span>`).join('');
  if (ih) ah += `<span class="al" data-idle="harv" title="Hotkey .">⛏ Idle harvesters: ${ih}</span>`;
  if (ia) ah += `<span class="al dim" data-idle="army" title="Hotkey ,">⚑ Idle army: ${ia}</span>`;
  const alEl = $('alerts'); if (alEl.dataset.h !== ah) { alEl.innerHTML = ah; alEl.dataset.h = ah; alEl.querySelectorAll('.al').forEach(s => s.onclick = () => { if (s.dataset.idle) selectIdle(s.dataset.idle); else { const a = UI.alerts[+s.dataset.a]; if (a) jumpTo(a.x, a.y); } }); }
  // context panel
  const s = UI.sel, ctx = $('ctx');
  const key = s.map(e => e.id).join(',') + '|' + (s.length === 1 ? s[0].t + s[0].team + (s[0].bal ? 'B' : '') + (s[0].con ? 'C' : '') : '');
  if (key !== UI.ctxKey) {
    UI.ctxKey = key; let h = '';
    if (s.length === 1) { const e = s[0], d = defOf(e);
      h = `<div class="pt"><img src="${icon(e.t)}"><div><b>${e.bal ? '🏹 ' + BALLISTA.n : d.n}</b>${foe(e.team, ME) ? ' <span class="r">(enemy)</span>' : e.team !== ME ? ' <span class="g">(ally)</span>' : ''}<div class="hpb"><div id="ctxhp"></div></div><div id="ctxinfo" class="dim"></div></div></div>`;
      if (e.con) { if (e.team === ME) h += `<div class="acts"><button id="bcBtn" class="act" title="Stop building and get the full price back">✖ Cancel construction · refund $${e.paid != null ? e.paid : BT[e.t].cost}${e.paidG ? ' ◆' + e.paidG : ''}</button></div>`; h += `<div id="conSt" class="dim small"></div>`; }
      else if (e.kind === 'b' && e.team === ME && (UPG[e.t] || e.t === 'hq' || e.t === 'cc' || e.t === 'airfield' || e.t === 'gtower')) h += `<button id="upBtn" class="act"></button>`; // v7.0.2 gtower -> Ballista Tower
      if (!e.con && e.kind === 'b' && e.team === ME && e.t === 'tech') h += `<div class="rsp"><div class="rsh">🔬 Research tracks <span class="dim small">L2 +15% · L3 +30% damage & HP (existing units too)</span></div>${RES.cats.map(c => `<button class="act rsb" data-k="${c}"></button>`).join('')}<div id="rsSt" class="dim small"></div></div>`;
      if (!e.con && e.kind === 'b' && e.team === ME && e.t === 'silo') h += `<div class="acts">${Object.keys(MIS).map(k => `<button class="act mis" data-k="${k}" title="Range ${MIS[k].rng} · ${MIS[k].sub > 1 ? MIS[k].sub + '× ' : ''}${MIS[k].dmg} dmg · build ${MIS[k].time}s · cooldown ${MIS[k].cd}s${MIS[k].icpt ? ' · can be intercepted by Lv3 Flak' : ''}">🚀 ${MIS[k].n} <span class="c">$${MIS[k].cost}</span> <span class="gas">◆${MIS[k].gas}</span></button>`).join('')}<button id="nukeBtn" class="act">🎯 Launch <kbd>N</kbd></button></div><div id="siloSt" class="dim small"></div>`;
      if (e.kind === 'u' && e.team === ME && UT[e.t].wpn) h += `<div class="acts"><button id="fmBtn" class="act">⛨ Defensive Formation <kbd>G</kbd></button><button id="stBtn" class="act"></button></div>`;
      if (e.kind === 'u' && e.team === ME && UT[e.t].xform) h += `<div class="acts"><button id="xfBtn" class="act xf" title="Raijin: switch between JET (fast, flies over walls and cliffs, rockets) and MECH (heavy armor, chain-lightning cannon). ${XFORM.t}s transform, ${XFORM.cd}s cooldown."></button></div>`;
      if (e.kind === 'u' && e.team === ME && UT[e.t].siege) h += `<div class="acts"><button id="sgBtn" class="act" title="${SIEGE.dep}s to deploy: stationary, range ${SIEGE.rng} (mobile ${W.arty.rng}), wider splash. ${SIEGE.pack}s to pack; a move order packs automatically."></button></div>`;
      if (s.some(u => u.kind === 'u' && u.team === ME && u.cargo)) h += `<div class="acts"><button id="ulBtn" class="act" title="Drop every passenger right where the craft is">⏬ Unload all <kbd>Shift+B</kbd></button><button id="ulAtBtn" class="act" title="Fly to a spot and unload there">📍 Unload at… <kbd>B</kbd></button></div>`;
      if (!e.con && e.kind === 'b' && e.team === ME) { const opts = Object.keys(UT).filter(t => UT[t].from === e.t || (UT[t].alt || []).includes(e.t)); if (opts.length) h += `<div class="cgrid">${opts.map(t => `<div class="item sm">${itemHTML(t)}</div>`).join('')}</div><div class="dim small">Right-click ground to set rally point</div>`; }
    } else if (s.length > 1) { const c = {}; s.forEach(e => c[e.t] = (c[e.t] || 0) + 1); h = '<div class="chips">' + Object.entries(c).map(([t, n]) => `<span class="chip" data-t="${t}"><img src="${icon(t)}">${n}</span>`).join('') + '</div>';
      if (s.some(u => u.kind === 'u' && u.team === ME && UT[u.t].siege)) h += `<div class="acts"><button id="sgBtn" class="act"></button></div>`;
      if (s.some(u => u.kind === 'u' && u.team === ME && UT[u.t].xform)) h += `<div class="acts"><button id="xfBtn" class="act xf"></button></div>`;
      if (myUnits().length) h += `<div class="acts"><button id="fmBtn" class="act">⛨ Defensive Formation <kbd>G</kbd></button><button id="stBtn" class="act"></button></div>`;
      if (s.some(u => u.kind === 'u' && u.team === ME && u.cargo)) h += `<div class="acts"><button id="ulBtn" class="act" title="Drop every passenger right where the craft is">⏬ Unload all <kbd>Shift+B</kbd></button><button id="ulAtBtn" class="act" title="Fly to a spot and unload there">📍 Unload at… <kbd>B</kbd></button></div>`;
      const mb = s.filter(e => e.kind === 'b' && e.team === ME);
      if (mb.length === s.length && mb.every(b => UPG[b.t])) h += `<div class="acts"><button id="upAllBtn" class="act">⬆ Upgrade all (${mb.filter(b => upgradeInfo(b) && b.upT == null).length} upgradable) <kbd>Z</kbd></button></div><div class="dim small">Nearest first, as many as you can afford.</div>`;
      if (mb.length === s.length && mb.every(b => PRODB.includes(b.t))) h += `<div class="dim small">Right-click the ground: one shared rally point for all ${mb.length}.</div>`; }
    ctx.innerHTML = h;
    const bcb = $('bcBtn'); if (bcb) bcb.onclick = () => { const b = UI.sel[0]; if (!b || !b.con) return; const ok = NET.online ? (NET.issue({ c: 'bcancel', b: b.id }), true) : NET.issue({ c: 'bcancel', b: b.id }); if (ok) { sfx('click'); uiMsg('Construction cancelled — full refund'); } };
    const opts = s.length === 1 && s[0].kind === 'b' && !s[0].con ? Object.keys(UT).filter(t => UT[t].from === s[0].t || (UT[t].alt || []).includes(s[0].t)) : [];
    ctx.querySelectorAll('.item').forEach((b, i) => wireItem(b, opts[i]));
    ctx.querySelectorAll('.chip').forEach(c => c.onclick = () => setSel(UI.sel.filter(e => e.t === c.dataset.t)));
    const fm = $('fmBtn'); if (fm) { fm.onclick = e => doFormation(e.shiftKey); fm.title = 'Arrange selected units in battle formation facing the nearest enemy and hold. Shift: at base entrance.'; }
    const ul = $('ulBtn'); if (ul) ul.onclick = unloadAll; const ula = $('ulAtBtn'); if (ula) ula.onclick = () => { UI.mode = 'unload'; uiMsg('Unload: click where to drop the passengers'); };
    const st = $('stBtn'); if (st) st.onclick = toggleStance; const sgb = $('sgBtn'); if (sgb) sgb.onclick = toggleSiege; const xfb = $('xfBtn'); if (xfb) xfb.onclick = doXform;
    ctx.querySelectorAll('.rsb').forEach(bt => bt.onclick = () => doResearch(bt.dataset.k));
    ctx.querySelectorAll('.mis').forEach(bt => bt.onclick = () => { const b = UI.sel[0]; if (!b || b.t !== 'silo') return; const m = MIS[bt.dataset.k], P = G.players[ME]; if (b.mq || b.mis) { sfx('error'); uiMsg('Launcher busy: one missile at a time'); return; } if (P.cr < m.cost || P.gas < m.gas) { sfx('error'); uiMsg('Need $' + m.cost + ' and ◆' + m.gas); return; } NET.issue({ c: 'mbuild', b: b.id, k: bt.dataset.k }); sfx('click'); uiMsg('Building ' + m.n); });
    const nb = $('nukeBtn'); if (nb) nb.onclick = siloArm; const ua = $('upAllBtn'); if (ua) ua.onclick = upgradeAll;
    const ub = $('upBtn'); if (ub) { ub.onclick = doUpgrade; ub.onmouseenter = () => { const b = UI.sel[0]; if (!b) return; UI.tip.innerHTML = upgTip(b); UI.tip.style.display = 'block'; UI.tip.style.left = 'auto'; tipOwn(ub); const r = ub.getBoundingClientRect(); UI.tip.style.top = Math.max(8, r.top - 90) + 'px'; UI.tip.style.right = (innerWidth - r.left + 8) + 'px'; }; ub.onmouseleave = hideTip; }
  }
  const sst = $('siloSt'); if (sst && UI.sel[0] && UI.sel[0].t === 'silo') { const b = UI.sel[0], cd = Math.max(0, (b.cdT || 0) - G.time); const t = b.mq ? `Building ${MIS[b.mq.k].n}: ${Math.floor(b.mq.p / MIS[b.mq.k].time * 100)}%` : b.mis ? (cd > 0 ? `${MIS[b.mis].n} ready · cooling down ${Math.ceil(cd)}s` : `<span class="g">${MIS[b.mis].n} READY</span> · range ${MIS[b.mis].rng}`) : cd > 0 ? `Cooling down ${Math.ceil(cd)}s` : 'Empty: build a missile'; if (sst.innerHTML !== t) sst.innerHTML = t; }
  const stb = $('stBtn'); if (stb) { const hold = myUnits().length && myUnits().every(u => u.stance === 'hold'); const t = hold ? '⚓ Stance: Hold <kbd>V</kbd>' : '⚔ Stance: Aggressive <kbd>V</kbd>'; if (stb.innerHTML !== t) stb.innerHTML = t; }
  const xfb = $('xfBtn'); if (xfb) { const a = s.filter(u => u.kind === 'u' && u.team === ME && UT[u.t].xform), busy = a.length && a.every(u => u.xfT != null || G.time < (u.xfCd || 0)), jet = a.length && a.every(u => UT[u.t].air);
    const t = busy ? (a.some(u => u.xfT != null) ? '⚡ Transforming…' : '⚡ Recharging…') : jet ? '⚡ Land → MECH <kbd>T</kbd>' : '⚡ Take off → JET <kbd>T</kbd>'; if (xfb.innerHTML !== t) xfb.innerHTML = t; xfb.classList.toggle('on', !!jet); xfb.disabled = !!busy; }
  const sgb = $('sgBtn'); if (sgb) { const a = s.filter(u => u.kind === 'u' && UT[u.t].siege), on = a.length && a.every(u => u.sg === 2), mv = a.some(u => u.sg === 1 || u.sg === 3); const t = mv ? '⏳ Deploying / packing…' : on ? '🎯 Siege Mode ON (range 10) · pack up <kbd>B</kbd>' : '🎯 Siege Mode <kbd>B</kbd>'; if (sgb.innerHTML !== t) sgb.innerHTML = t; sgb.classList.toggle('on', !!on); }
  { const cs = $('conSt'), b = s[0]; if (cs && b) { const t = !b.con ? '<span class="g">Construction complete</span>' : `🏗 Under construction ${Math.floor(b.con.p * 100)}%` + (b.con.w ? (G.ents.some(e => e.team === b.team && (e.t === 'hq' || e.t === 'cc') && !e.con && e.hp > 0) ? ' · waiting for the site ahead' : ' · needs a Command Yard') : ` · ~${Math.ceil((1 - b.con.p) * BT[b.t].time)}s`) + '<br>No power, production or weapons until finished'; if (cs.innerHTML !== t) cs.innerHTML = t; } }
  if (s.length === 1 && s[0].t === 'tech' && s[0].team === ME && !s[0].con) researchPanel(s[0]);
  const upb = $('upBtn'); if (upb && s[0]) { const b = s[0], inf = upgradeInfo(b); let t;
    if (b.upT != null) t = `⬆ Upgrading… ${Math.floor((G.time - b.upT) / b.upDur * 100)}%`; else if (!inf) t = b.t === 'gtower' ? (b.bal ? '🏹 Ballista Tower' : '🏹 Ballista needs a Research Lab') : b.t === 'hq' || b.t === 'cc' ? (b.sm3 ? '🛡 SM-3 interceptors online' : '🛡 SM-3 needs a Research Lab') : b.t === 'tech' ? '✔ ' + DEF_RESEARCH.n + ' researched' : b.t === 'airfield' ? `✈ ${airSlots(b)} dock slots` : '★ Max level (3)';
    else t = inf.kind === 'bal' ? `🏹 Ballista Tower $${inf.cost} ◆${inf.gas} <kbd>Z</kbd>` : inf.kind === 'pads' ? `✈ ${AIRPADS.n} (4→8 slots) $${inf.cost} <kbd>Z</kbd>` : inf.kind === 'sm3' ? `🛡 ${SM3.n} $${inf.cost} ◆${inf.gas} <kbd>Z</kbd>` : inf.kind === 'def' ? `⬆ ${DEF_RESEARCH.n} $${inf.cost} <kbd>Z</kbd>` : `⬆ Upgrade to Lv${inf.next} $${inf.cost} <kbd>Z</kbd>`;
    if (upb.innerHTML !== t) upb.innerHTML = t; upb.disabled = !inf || b.upT != null; upb.classList.toggle('poor', !!inf && G.players[ME].cr < inf.cost); }
  if (s.length === 1) { const e = s[0], f = e.hp / e.mhp, hp = $('ctxhp'); if (hp) { hp.style.width = (f * 100) + '%'; hp.style.background = f > 0.6 ? '#4dff7a' : f > 0.3 ? '#ffd23d' : '#ff4d3d'; }
    const inf = $('ctxinfo'); if (inf) inf.innerHTML = `HP ${Math.ceil(e.hp)} / ${e.mhp}` + (e.t === 'harv' ? `<br>Ore ${Math.floor(e.load)} / ${HARV_CAP} · ${e.hst}` : '') + (e.kind === 'u' && UT[e.t].wpn ? `<br>${W[UT[e.t].wpn].type} · range ${W[UT[e.t].wpn].rng} · ${e.order}${e.wq && e.wq.length ? ' +' + e.wq.length + ' wp' : ''}` : '') + (e.kind === 'b' ? `<br>Power ${BT[e.t].pow > 0 ? '+' : ''}${e.bal ? BALLISTA.pow : BT[e.t].pow}${e.repair ? ' · repairing' : ''}` + (BT[e.t].squad ? `<br>Garrison: ${(e.bal ? BALLISTA.w : GT_SQUAD.w).map(k => [k, sqW(e, k)]).map(([k, w]) => ({ rifle: 'Rifle', snipe: 'Sniper', rocket: 'Rocket', marine: 'Marine', bolt: '🏹 Ballista' })[k] + ' ' + w.dmg + '/' + w.rng).join(' · ')}` : BT[e.t].wpn ? `<br>Lv${e.lvl || 1} · dmg ${defW(e).dmg} · range ${defW(e).rng}` : '') : '') + (e.kind === 'u' && e.stance === 'hold' ? ' · HOLD' : '') + (e.cargo ? `<br>Cargo ${cargoUsed(e)} / ${UT[e.t].cap} slots` : '') + (UT[e.t] && UT[e.t].medevac ? ` · <span class="g">✚ healing ${(e.beams || []).length}</span>` : ''); }
}
function minimap() {
  const c = $('minimap'), x = c.getContext('2d'), s = c.width / MW;
  const b = UI.mmBase.getContext('2d'), img = b.createImageData(MW, MH);
  for (let i = 0; i < MW * MH; i++) {
    let r = 46, g = 82, bl = 36; const t = G.map[i];
    if (t === 1) { r = 112; g = 104; bl = 92; } else if (t === 2) { r = 28; g = 86; bl = 118; } else if (G.lava[i]) { r = 230; g = 80; bl = 20; } else if (G.ice[i]) { r = 170; g = 210; bl = 230; } else if (G.ore[i] > 30) { if (G.dia && G.dia[i]) { r = 120; g = 230; bl = 255; } else { r = 210; g = 165; bl = 50; } } else if (G.mapName === 'frost') { r = 190; g = 200; bl = 210; } else if (G.mapName === 'volcano') { r = 52; g = 44; bl = 40; } else if (G.desert) { r = G.wadi && G.wadi[i] ? 200 : 168; g = G.wadi && G.wadi[i] ? 176 : 136; bl = G.wadi && G.wadi[i] ? 128 : 92; }
    if (t === 1 && G.mud && G.mud[i]) { r = 150; g = 108; bl = 70; } else if (t === 1 && G.desert) { r = 122; g = 94; bl = 70; }
    if (t === 0 && G.lvl[i] > 0.5) { r *= 1.18; g *= 1.18; bl *= 1.18; }
    const f = vis0(i) ? 1 : seen0(i) ? 0.5 : 0.08; img.data.set([r * f, g * f, bl * f, 255], i * 4);
  }
  b.putImageData(img, 0, 0); x.imageSmoothingEnabled = true; x.drawImage(UI.mmBase, 0, 0, c.width, c.height);
  for (const e of G.ents) { if (!visibleTo0(e)) continue; x.fillStyle = MMCOL[e.team] || '#ff5040'; if (e.kind === 'b') x.fillRect(e.tx * s, e.ty * s, e.w * s, e.h * s); else x.fillRect(e.x * s - 1.5, e.y * s - 1.5, 3, 3); }
  for (const d of G.derricks || []) { if (d.op) { x.fillStyle = d.owner >= 0 ? MMCOL[d.owner] : '#ffd060'; x.beginPath(); x.moveTo(d.x * s, d.y * s - 5); x.lineTo(d.x * s + 5, d.y * s); x.lineTo(d.x * s, d.y * s + 5); x.lineTo(d.x * s - 5, d.y * s); x.closePath(); x.fill(); x.strokeStyle = '#000'; x.stroke(); continue; } x.fillStyle = d.owner >= 0 ? MMCOL[d.owner] : '#ddd'; x.fillRect(d.x * s - 2.5, d.y * s - 2.5, 5, 5); x.strokeStyle = '#000'; x.strokeRect(d.x * s - 2.5, d.y * s - 2.5, 5, 5); }
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
    const show = mode === 'always' || e.sel || e.id === R3.hoverId || (mode === 'smart' && e.hp < e.mhp) || (e.con && e.team === ME), rl = e.kind === 'u' || BT[e.t].wpn ? rsLvl(e.team, resCat(e)) : 1;
    if ((!show && rl < 2) || !visibleTo0(e) || !inView(e.x, e.y)) continue;
    const rs = e.kind === 'u' ? (R3.rs.get(e.id) || e) : e;
    const top = e.kind === 'b' ? 1.9 : (rs.z || 0) + (UT[e.t].armor === 'inf' ? 0.8 : 0.95);
    const p = worldToScreen(rs.x, e.kind === 'b' ? e.ty + 0.2 : rs.y, (e.kind === 'b' ? heightAt(e.x, e.y) : 0) + top); if (p.behind) continue;
    const z = 30 / R3.cam.d, w = (e.kind === 'b' ? e.w * 18 : Math.max(18, UT[e.t].r * 50)) * z, f = Math.max(0, e.hp / e.mhp), segs = Math.max(1, Math.round(e.mhp / 100));
    if (rl > 1) { x.strokeStyle = rl > 2 ? '#ffd23d' : '#9fd8ff'; x.lineWidth = 1.6; for (let c = 0; c < rl - 1; c++) { const cx = p.x - w / 2 - 7, cy = p.y + 3 - c * 4; x.beginPath(); x.moveTo(cx - 3, cy); x.lineTo(cx, cy - 3); x.lineTo(cx + 3, cy); x.stroke(); } } // v6.2 research chevrons
    if (!show) continue;
    x.fillStyle = 'rgba(0,0,0,.75)'; x.fillRect(p.x - w / 2 - 1, p.y - 1, w + 2, 5);
    x.fillStyle = f > 0.6 ? '#4dff7a' : f > 0.3 ? '#ffd23d' : '#ff4d3d'; x.fillRect(p.x - w / 2, p.y, w * f, 3);
    if (segs > 1 && segs < 30) { x.fillStyle = 'rgba(0,0,0,.45)'; for (let i = 1; i < segs; i++) x.fillRect(p.x - w / 2 + w * i / segs, p.y, 1, 3); }
    if (foe(e.team, ME)) { x.fillStyle = '#ff5040'; x.fillRect(p.x - w / 2 - 4, p.y, 2, 3); }
    if (e.con) { const cw = Math.max(w, 22), cy = p.y - 9; x.fillStyle = 'rgba(0,0,0,.8)'; x.fillRect(p.x - cw / 2 - 1, cy - 1, cw + 2, 6); x.fillStyle = e.con.w ? '#9a8450' : '#ffb52e'; x.fillRect(p.x - cw / 2, cy, cw * e.con.p, 4); // v7.2 construction progress bar
      x.fillStyle = 'rgba(0,0,0,.45)'; for (let i = 1; i < 10; i++) x.fillRect(p.x - cw / 2 + cw * i / 10, cy, 1, 4);
      if (e.w > 1) { x.font = 'bold 11px system-ui,sans-serif'; x.textAlign = 'center'; x.fillStyle = '#ffd88a'; x.strokeStyle = 'rgba(0,0,0,.85)'; x.lineWidth = 3; const tx = '🏗 ' + Math.floor(e.con.p * 100) + '%' + (e.con.w ? ' · waiting' : ''); x.strokeText(tx, p.x, cy - 4); x.fillText(tx, p.x, cy - 4); x.textAlign = 'left'; } }
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
  if (typeof glbUnitRefresh === 'function' && typeof R3 !== 'undefined' && R3.scene) glbUnitRefresh('drone'); // v7.6.4 procedural drone has a lite variant for Quiet
  $('quietBtn').classList.toggle('on', UI.set.quiet); document.body.classList.toggle('quiet', !!UI.set.quiet); const qc = $('setQuiet'); if (qc) qc.checked = UI.set.quiet;
  uiMsg(UI.set.quiet ? `🍃 Quiet mode ON — ${UI.set.quietFps || 60} FPS cap, 1x resolution, lighter effects (M)` : 'Quiet mode OFF (M)'); sfx('click');
}

function siloArm() { const b = UI.sel.find(s => s.t === 'silo' && s.team === ME); if (!b) return; if (!b.mis) { sfx('error'); uiMsg('No missile loaded'); return; } if (G.time < (b.cdT || 0)) { sfx('error'); uiMsg('Launcher cooling down'); return; } UI.mode = 'nuke'; UI.placing = null; sfx('click'); uiMsg('Select missile target (range ' + MIS[b.mis].rng + ')'); }

// v7.0 polish: never leave a tooltip hanging when the app loses focus, rotates, or a screen opens
addEventListener('blur', () => hideTip()); addEventListener('resize', () => hideTip()); addEventListener('orientationchange', () => hideTip());
document.addEventListener('visibilitychange', () => { if (document.hidden) hideTip(); });
// v7.0 title screen: shown on a fresh launch (skipped for deep links like ?room= and for automated runs unless ?title=1)
function titleInit() {
  const ts = document.getElementById('titleScreen'); if (!ts) return;
  const q = new URLSearchParams(location.search), auto = typeof navigator !== 'undefined' && navigator.webdriver;
  if (q.get('title') !== '1' && ([...q.keys()].length || auto)) return;
  const fl = document.getElementById('tsFlags'); if (fl && typeof FACTIONS !== 'undefined') fl.innerHTML = Object.values(FACTIONS).map((f, i) => `<span title="${f.n}" style="animation-delay:${0.25 + i * 0.07}s">${f.flag}</span>`).join('');
  ts.style.display = 'flex'; hideTip();
  const go = e => { if (e) { e.preventDefault && e.preventDefault(); e.stopPropagation && e.stopPropagation(); }
    removeEventListener('keydown', go, true); ts.onpointerup = null; try { typeof audioInit === 'function' && audioInit(); } catch (er) {}
    ts.classList.add('out'); const until = performance.now() + 600; const eat = ev => { if (performance.now() < until) { ev.preventDefault(); ev.stopPropagation(); } else removeEventListener('click', eat, true); };
    addEventListener('click', eat, true); ts.onclick = ev => ev.stopPropagation(); // swallow the ghost click from the dismissing tap
    setTimeout(() => { ts.style.display = 'none'; }, 460); };
  ts.onpointerup = go; addEventListener('keydown', go, true);
}
addEventListener('load', titleInit);
