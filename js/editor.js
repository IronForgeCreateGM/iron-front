'use strict';
// ===== v7.7 Map Builder (private: hidden until this device is unlocked with ?key=...; only the SHA-256 of the key is in the code) =====
// Custom maps are stored in this browser (localStorage 'ironfront.maps') and travel inside game opts (opts.cmap), so replays + online peers get the map.
// Format + generator: see genUserMap in sim.js. Nothing here touches built-in maps.
const MB_HASH = '4cd57f6b22e93bd4bbda1ae152633ed35122b2986b8b5b335db7e9a9331d3648', MB_LS = 'ironfront.mb', CM_LS = 'ironfront.maps';
let CM_SEL = null; // the custom map picked in the lobby (null = a built-in map)
function mbUnlocked() { try { return localStorage.getItem(MB_LS) === MB_HASH; } catch (e) { return false; } }
async function mbCheckKey() {
  const q = new URLSearchParams(location.search), k = q.get('key'); if (k == null) return;
  try { if (k === 'lock') localStorage.removeItem(MB_LS);
    else if (crypto && crypto.subtle) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(k.trim())), h = [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); if (h === MB_HASH) localStorage.setItem(MB_LS, MB_HASH); }
  } catch (e) {}
  q.delete('key'); try { history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); } catch (e) {} // keep the key out of the address bar / history
}
// ---- saved maps ----
function cmAll() { if (!mbUnlocked()) return {}; try { return JSON.parse(localStorage.getItem(CM_LS) || '{}') || {}; } catch (e) { return {}; } }
function cmGet(id) { const m = (typeof CM_BUILTIN !== 'undefined' && CM_BUILTIN[id]) || cmAll()[id]; return m && cmValid(m) ? m : null; }
function cmPut(m) { const all = cmAll(); all[m.id] = m; try { localStorage.setItem(CM_LS, JSON.stringify(all)); return true; } catch (e) { alert('Could not save: browser storage is full. Export some maps and delete them.'); return false; } }
function cmDel(id) { const all = cmAll(); delete all[id]; try { localStorage.setItem(CM_LS, JSON.stringify(all)); } catch (e) {} }
function cmValid(m) { return m && typeof m === 'object' && CMAP_SIZES.includes(m.w) && m.h === m.w && typeof m.t === 'string' && Array.isArray(m.starts) && m.starts.length >= 1 && m.starts.length <= 8; }
function cmBaseRGB(th) { return { grass: [70, 110, 60], desert: [172, 138, 92], frost: [190, 205, 215], volcano: [70, 62, 58], space: [52, 48, 78], mech: [104, 110, 118] }[th] || [70, 110, 60]; }
function cmSelChanged() { const s = document.getElementById('mapSel'); CM_SEL = s && s.value.startsWith('cm:') ? cmGet(s.value.slice(3)) : null; }
function cmRefreshSel(pick) { // list saved maps in the skirmish map picker (unlocked devices only)
  const s = document.getElementById('mapSel'); if (!s) return; const cur = pick || s.value; let og = document.getElementById('cmGroup'); if (og) og.remove();
  const all = Object.values(cmAll()).filter(cmValid).sort((a, b) => (b.saved || 0) - (a.saved || 0));
  { let fg = document.getElementById('cmFeat'); if (fg) fg.remove(); const fe = typeof CM_BUILTIN !== 'undefined' ? Object.values(CM_BUILTIN).filter(m => cmValid(m) && !m.hide) : []; /* v7.8.3: hide=1 keeps data for replays but drops it from the lobby list */ if (fe.length) { fg = document.createElement('optgroup'); fg.id = 'cmFeat'; fg.label = '🗺 Featured maps'; for (const m of fe) { const o = document.createElement('option'); o.value = 'cm:' + m.id; o.textContent = `${m.name} (${m.starts.length}) · ${m.w}²`; fg.appendChild(o); } s.appendChild(fg); } }
  if (all.length) { og = document.createElement('optgroup'); og.id = 'cmGroup'; og.label = '🛠 My maps';
    for (const m of all) { const o = document.createElement('option'); o.value = 'cm:' + m.id; o.textContent = `${m.name} (${m.starts.length}) · ${m.w}²`; og.appendChild(o); } s.appendChild(og); }
  if ([...s.options].some(o => o.value === cur)) s.value = cur; else if (cur && cur.startsWith('cm:')) s.value = 'classic';
  cmSelChanged(); if (typeof unlockMarkMaps === 'function') unlockMarkMaps(); }
function mbApply() { const on = mbUnlocked(), b = document.getElementById('mapBuilderBtn'); if (b) b.style.display = on ? '' : 'none'; cmRefreshSel(); if (!on) CM_SEL = null; }
(async () => { await mbCheckKey(); mbApply(); const b = document.getElementById('mapBuilderBtn'); if (b) b.onclick = () => { if (mbUnlocked()) mbOpen(); }; if (typeof QS !== 'undefined' && QS.get('editor') && mbUnlocked()) mbOpen(); })(); // editor.js loads at the end of <body>, so the menu DOM exists

// ---- editor ----
const MB_TER = [['Ground', 0, '#5a8a48'], ['Rock / cliff', 1, '#6e6a64'], ['Water', 2, '#1c5a86'], ['Lava (walkable)', 3, '#e05a1e'], ['Lava pool (blocked)', 4, '#a8280c'], ['Ice', 5, '#a8d4ea'], ['Forest', 6, '#2f5a26']];
const MB_ORE = [['Sparse ore', 1, '#b8a050'], ['Normal ore', 2, '#e6be3c'], ['Rich ore (gold)', 3, '#ffd820'], ['Very rich ore', 4, '#fff07a'], ['Remove ore', 0, '#555']];
const MB_HT = [['Low ground', 0], ['High ground', 1], ['Higher ground', 2]];
const MB_OBJ = [['Spawn point', 'spawn', '#fff'], ['Gas vent', 'vent', '#4fe8dc'], ['Oil derrick', 'derrick', '#ffffff'], ['Outpost', 'outpost', '#ffd060'], ['Middle monument', 'monument', '#e8d8b0']];
const MBE = { on: false, m: null, tool: { k: 't', v: 1 }, brush: 3, fill: false, mirror: 'none', undo: [], redo: [], view: { s: 4, ox: 0, oy: 0 }, autoOre: true, dirty: false };
function mbBlank(w, theme, name) { const N = w * w; return { id: 'm' + Date.now().toString(36) + ((Math.random() * 1e4) | 0).toString(36), name: name || 'New map', w, theme: theme || 'grass', t: new Uint8Array(N), h: new Uint8Array(N), o: new Uint8Array(N), starts: [], vents: [], derricks: [], outposts: [], monument: null }; }
function mbToCmap(m) { return { v: 1, id: m.id, name: m.name, w: m.w, h: m.w, theme: m.theme, t: cmapRle(m.t), h2: cmapRle(m.h), o: cmapRle(m.o), starts: m.starts.map(p => p.slice()), vents: m.vents.map(p => p.slice()), derricks: m.derricks.map(p => p.slice()), outposts: m.outposts.map(p => p.slice()), monument: m.monument ? m.monument.slice() : null, saved: Date.now(), rev: (m.rev || 0) + 1 }; }
function mbFromCmap(c) { const N = c.w * c.w; return { id: c.id || mbBlank(c.w).id, name: c.name || 'Imported map', w: c.w, theme: c.theme || 'grass', t: cmapLayer(c.t, N), h: cmapLayer(c.h2, N), o: cmapLayer(c.o, N), starts: (c.starts || []).map(p => p.slice(0, 2)), vents: (c.vents || []).map(p => p.slice(0, 2)), derricks: (c.derricks || []).map(p => p.slice(0, 2)), outposts: (c.outposts || []).map(p => p.slice(0, 3)), monument: c.monument ? c.monument.slice(0, 2) : null, rev: c.rev || 0 }; }
function mbStarter(w, theme, np) { // symmetric starter: np spawns on a ring, base ore + gas each, a rich centre and expansions between bases
  const m = mbBlank(w, theme, 'My ' + np + '-player map'), c = w / 2, R = w * 0.38;
  for (let k = 0; k < np; k++) { const a = -Math.PI * 3 / 4 + k * 2 * Math.PI / np; mbAddSpawn(m, Math.round(c + Math.cos(a) * R), Math.round(c + Math.sin(a) * R), true);
    const b = a + Math.PI / np, ex = c + Math.cos(b) * w * 0.27, ey = c + Math.sin(b) * w * 0.27; mbDisc(m, ex, ey, 2.4, i => m.o[i] = 2); }
  mbDisc(m, c, c, 2.5, i => m.o[i] = 3); return m; }
function mbDisc(m, cx, cy, r, f) { for (let y = Math.max(0, Math.floor(cy - r - 1)); y <= Math.min(m.w - 1, Math.ceil(cy + r)); y++) for (let x = Math.max(0, Math.floor(cx - r - 1)); x <= Math.min(m.w - 1, Math.ceil(cx + r)); x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) f(y * m.w + x, x, y); }
function mbAddSpawn(m, x, y, auto) { if (m.starts.length >= 8) return false; x = Math.max(3, Math.min(m.w - 4, x)); y = Math.max(3, Math.min(m.w - 4, y)); m.starts.push([x, y]);
  mbDisc(m, x + 0.5, y + 0.5, 5, i => { if (m.t[i] !== 6) m.t[i] = 0; });
  if (auto) { let has = false; mbDisc(m, x + 0.5, y + 0.5, 13, i => { if (m.o[i]) has = true; });
    if (!has) { const c = m.w / 2, a = Math.atan2(c - y, c - x); mbDisc(m, x + 0.5 + Math.cos(a) * 8, y + 0.5 + Math.sin(a) * 8, 2.6, i => { m.o[i] = 2; if (m.t[i] !== 3 && m.t[i] !== 5) m.t[i] = 0; });
      const vx = Math.round(x + Math.cos(a + 1.1) * 7), vy = Math.round(y + Math.sin(a + 1.1) * 7); if (!m.vents.some(v => Math.hypot(v[0] - vx, v[1] - vy) < 4)) m.vents.push([vx, vy]); } }
  return true; }
function mbMirrors(x, y) { const w = MBE.m.w, p = [[x, y]], M = MBE.mirror; // tile coords -> list incl. symmetric copies
  if (M === 'h' || M === '4') p.push([w - 1 - x, y]); if (M === 'v' || M === '4') p.push([x, w - 1 - y]); if (M === '4') p.push([w - 1 - x, w - 1 - y]); if (M === 'r') p.push([w - 1 - x, w - 1 - y]);
  return p.filter((q, i) => p.findIndex(o => o[0] === q[0] && o[1] === q[1]) === i); }
function mbSnap() { const m = MBE.m; MBE.undo.push(JSON.stringify(mbToCmap(m))); if (MBE.undo.length > 60) MBE.undo.shift(); MBE.redo = []; MBE.dirty = true; }
function mbUndo(redo) { const A = redo ? MBE.redo : MBE.undo, B = redo ? MBE.undo : MBE.redo; if (!A.length) return; B.push(JSON.stringify(mbToCmap(MBE.m))); const c = JSON.parse(A.pop()), id = MBE.m.id; MBE.m = mbFromCmap(c); MBE.m.id = id; mbDrawAll(); mbStatus(); }
function mbApplyAt(x, y) { const m = MBE.m, T = MBE.tool, r = MBE.brush / 2;
  for (const [mx, my] of mbMirrors(x, y)) mbDisc(m, mx + 0.5, my + 0.5, Math.max(0.5, r), i => {
    if (T.k === 't') { m.t[i] = T.v; if (T.v === 1 || T.v === 2 || T.v === 4) m.o[i] = 0; }
    else if (T.k === 'h') m.h[i] = T.v;
    else if (T.k === 'o') { if (T.v === 0 || m.t[i] === 0 || m.t[i] === 3 || m.t[i] === 5 || m.t[i] === 6) { m.o[i] = T.v; if (T.v && m.t[i] === 6) m.t[i] = 0; } }
    else if (T.k === 'x') { m.t[i] = 0; m.h[i] = 0; m.o[i] = 0; } });
  if (T.k === 'x') { const near = p => mbMirrors(x, y).some(([mx, my]) => Math.hypot(p[0] - mx, p[1] - my) <= Math.max(1.5, r + 0.5));
    m.starts = m.starts.filter(p => !near(p)); m.vents = m.vents.filter(p => !near(p)); m.derricks = m.derricks.filter(p => !near(p)); m.outposts = m.outposts.filter(p => !near(p)); if (m.monument && near(m.monument)) m.monument = null; } }
function mbFill(x, y) { const m = MBE.m, T = MBE.tool, w = m.w, L = T.k === 'h' ? m.h : T.k === 'o' ? m.o : m.t;
  for (const [sx, sy] of mbMirrors(x, y)) { const s0 = sy * w + sx, v0 = L[s0], nv = T.k === 'x' ? 0 : T.v; if (v0 === nv && T.k !== 'x') continue; const seen = new Uint8Array(w * w), st = [s0]; seen[s0] = 1;
    while (st.length) { const i = st.pop(); if (T.k === 'x') { m.t[i] = 0; m.h[i] = 0; m.o[i] = 0; } else if (T.k === 'o') { if (m.t[i] === 1 || m.t[i] === 2 || m.t[i] === 4) continue; m.o[i] = nv; } else { L[i] = nv; if (T.k === 't' && (nv === 1 || nv === 2 || nv === 4)) m.o[i] = 0; }
      const cx = i % w, cy = (i / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= w) continue; const j = ny * w + nx; if (!seen[j] && L[j] === v0) { seen[j] = 1; st.push(j); } } } } }
function mbObject(x, y) { const m = MBE.m, k = MBE.tool.v, pts = mbMirrors(x, y);
  const listOf = { spawn: m.starts, vent: m.vents, derrick: m.derricks, outpost: m.outposts }[k];
  if (k === 'monument') { m.monument = m.monument && Math.hypot(m.monument[0] - x, m.monument[1] - y) < 3 ? null : [Math.max(3, Math.min(m.w - 3, x)), Math.max(3, Math.min(m.w - 3, y))]; return; }
  const hit = listOf.findIndex(p => Math.hypot(p[0] - x, p[1] - y) < 2.5);
  if (hit >= 0) { for (const [px, py] of pts) { const j = listOf.findIndex(p => Math.hypot(p[0] - px, p[1] - py) < 2.5); if (j >= 0) listOf.splice(j, 1); } return; } // click an existing object to remove it (and its mirror copies)
  for (const [px, py] of pts) { if (k === 'spawn') { if (!mbAddSpawn(m, px, py, MBE.autoOre)) { mbToast('A map can have at most 8 spawn points.'); break; } }
    else if (k === 'outpost') { m.outposts.push([px, py, 'Outpost ' + (m.outposts.length + 1)]); } else listOf.push([px, py]); } }
// ---- drawing ----
function mbTileRGB(m, i) { const t = m.t[i], h = m.h[i], o = m.o[i], b = cmBaseRGB(m.theme); let c;
  if (t === 1) c = m.theme === 'desert' ? [122, 94, 70] : m.theme === 'space' ? [60, 56, 74] : [92, 88, 82]; else if (t === 2) c = m.theme === 'space' ? [20, 30, 90] : [28, 86, 128]; else if (t === 3) c = [226, 92, 30]; else if (t === 4) c = [150, 34, 10]; else if (t === 5) c = [170, 212, 232];
  else if (t === 6) c = [b[0] * 0.55, b[1] * 0.75, b[2] * 0.55]; else c = b.slice();
  if (o && t !== 1 && t !== 2 && t !== 4) c = [[0, 0, 0], [184, 160, 80], [230, 190, 60], [255, 216, 32], [255, 240, 130]][o];
  if (t !== 2) { const k = 1 + h * 0.22; c = [c[0] * k + h * 10, c[1] * k + h * 10, c[2] * k + h * 8]; }
  return c; }
function mbDrawAll() { const m = MBE.m, w = m.w; if (!MBE.off || MBE.off.width !== w) { MBE.off = document.createElement('canvas'); MBE.off.width = MBE.off.height = w; }
  const x = MBE.off.getContext('2d'), img = x.createImageData(w, w), d = img.data;
  for (let i = 0; i < w * w; i++) { const c = mbTileRGB(m, i); d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; }
  // cliff edges between height levels: darken the lower tile
  for (let y = 0; y < w; y++) for (let xx = 0; xx < w; xx++) { const i = y * w + xx; for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const nx = xx + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= w) continue; if (m.h[ny * w + nx] > m.h[i]) { d[i * 4] *= 0.7; d[i * 4 + 1] *= 0.7; d[i * 4 + 2] *= 0.7; break; } } }
  x.putImageData(img, 0, 0); mbRender(); }
function mbRender() { const cv = MBE.cv; if (!cv || !MBE.m || !MBE.off) return; const ctx = cv.getContext('2d'), V = MBE.view, m = MBE.m, W = cv.width, H = cv.height, s = V.s;
  ctx.fillStyle = '#0b0e12'; ctx.fillRect(0, 0, W, H); ctx.imageSmoothingEnabled = false; ctx.drawImage(MBE.off, V.ox, V.oy, m.w * s, m.w * s);
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.strokeRect(V.ox - 0.5, V.oy - 0.5, m.w * s + 1, m.w * s + 1);
  if (s >= 10) { ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); for (let k = 0; k <= m.w; k++) { ctx.moveTo(V.ox + k * s, V.oy); ctx.lineTo(V.ox + k * s, V.oy + m.w * s); ctx.moveTo(V.ox, V.oy + k * s); ctx.lineTo(V.ox + m.w * s, V.oy + k * s); } ctx.stroke(); }
  if (MBE.mirror !== 'none') { ctx.strokeStyle = 'rgba(120,200,255,.35)'; ctx.setLineDash([6, 6]); ctx.beginPath(); const c = m.w * s / 2; if (MBE.mirror === 'h' || MBE.mirror === '4') { ctx.moveTo(V.ox + c, V.oy); ctx.lineTo(V.ox + c, V.oy + m.w * s); } if (MBE.mirror === 'v' || MBE.mirror === '4') { ctx.moveTo(V.ox, V.oy + c); ctx.lineTo(V.ox + m.w * s, V.oy + c); } if (MBE.mirror === 'r') { ctx.arc(V.ox + c, V.oy + c, 6, 0, 7); } ctx.stroke(); ctx.setLineDash([]); }
  const P = (tx, ty) => [V.ox + (tx + 0.5) * s, V.oy + (ty + 0.5) * s], rr = Math.max(5, Math.min(16, s * 1.6));
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const [vx, vy] of m.vents) { const [px, py] = P(vx, vy); ctx.fillStyle = '#4fe8dc'; ctx.strokeStyle = '#043'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, rr * 0.55, 0, 7); ctx.fill(); ctx.stroke(); }
  for (const [dx, dy] of m.derricks) { const [px, py] = P(dx, dy), q = rr * 0.5; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.fillRect(px - q, py - q, q * 2, q * 2); ctx.strokeRect(px - q, py - q, q * 2, q * 2); }
  for (const [ox, oy, nm] of m.outposts) { const [px, py] = P(ox, oy), q = rr * 0.75; ctx.fillStyle = '#ffd060'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, py - q); ctx.lineTo(px + q, py); ctx.lineTo(px, py + q); ctx.lineTo(px - q, py); ctx.closePath(); ctx.fill(); ctx.stroke(); if (s >= 4) { ctx.font = '11px system-ui'; ctx.fillStyle = '#ffe9a8'; ctx.fillText(nm, px, py + q + 9); } }
  if (m.monument) { const [px, py] = P(m.monument[0] - 0.5, m.monument[1] - 0.5); ctx.fillStyle = '#e8d8b0'; ctx.strokeStyle = '#3a2e1a'; ctx.lineWidth = 2; ctx.fillRect(px - 2 * s, py - 2 * s, 4 * s, 4 * s); ctx.strokeRect(px - 2 * s, py - 2 * s, 4 * s, 4 * s); ctx.font = 'bold ' + Math.max(10, Math.min(18, s * 2)) + 'px system-ui'; ctx.fillStyle = '#3a2e1a'; ctx.fillText('★', px, py); }
  m.starts.forEach(([sx, sy], k) => { const [px, py] = P(sx, sy), R = Math.max(9, Math.min(22, s * 2.4)); ctx.fillStyle = TEAM_CSS[k] || '#3d9cff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(px, py, R, 0, 7); ctx.fill(); ctx.stroke(); ctx.font = 'bold ' + Math.round(R * 1.1) + 'px system-ui'; ctx.fillStyle = '#fff'; ctx.fillText(String(k + 1), px, py + 1); });
  if (MBE.hover && !MBE.pan) { const [hx, hy] = MBE.hover; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5;
    for (const [mx, my] of mbMirrors(hx, hy)) { const [px, py] = P(mx, my); ctx.beginPath(); if (MBE.tool.k === 'obj' || MBE.fill) ctx.rect(px - s / 2, py - s / 2, s, s); else ctx.arc(px, py, Math.max(s / 2, MBE.brush / 2 * s), 0, 7); ctx.stroke(); } } }
// ---- validation ----
function mbCheck() { const m = MBE.m, w = m.w, out = []; if (m.starts.length < 2) out.push(['err', 'Place at least 2 spawn points (max 8).']);
  const walk = i => m.t[i] !== 1 && m.t[i] !== 2 && m.t[i] !== 4;
  if (m.starts.length) { const seen = new Uint8Array(w * w), st = [], mark = (x, y) => { const i = y * w + x; if (!seen[i]) { seen[i] = 1; st.push(i); } }; const [x0, y0] = m.starts[0];
    mbDisc(m, x0 + 0.5, y0 + 0.5, 5, i => mark(i % w, (i / w) | 0));
    while (st.length) { const i = st.pop(), x = i % w, y = (i / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= w) continue; const j = ny * w + nx; if (!seen[j] && (walk(j) || m.starts.some(([sx, sy]) => Math.hypot(nx + 0.5 - sx - 0.5, ny + 0.5 - sy - 0.5) <= 5))) { seen[j] = 1; st.push(j); } } }
    m.starts.forEach(([sx, sy], k) => { if (k && !seen[sy * w + sx]) out.push(['err', `Spawn ${k + 1} cannot drive to spawn 1 (walled in by rock/water/lava pools).`]); });
    m.starts.forEach(([sx, sy], k) => { let ore = 0; mbDisc(m, sx + 0.5, sy + 0.5, 14, i => { if (m.o[i]) ore++; }); if (ore < 8) out.push(['warn', `Spawn ${k + 1} has little or no ore nearby (bots need a base ore field).`]); let gas = m.vents.some(v => Math.hypot(v[0] - sx, v[1] - sy) < 14); if (!gas) out.push(['warn', `Spawn ${k + 1} has no gas vent within 14 tiles.`]); }); }
  // v7.7.2 cramped-base warning: buildable tiles (not rock/water/lava pool/ore, inside the map) within 12 tiles of each spawn; a full bot base needs ~200
  m.starts.forEach(([sx, sy], k) => { let free = 0; mbDisc(m, sx + 0.5, sy + 0.5, 12, i => { const t = m.t[i]; if (t !== 1 && t !== 2 && t !== 4 && !m.o[i]) free++; }); if (free < MB_CRAMP) out.push(['warn', `Spawn ${k + 1} base is cramped (${free} buildable tiles within 12; about ${MB_CRAMP}+ fit a full base). Move it off the edge or clear rock/water/ore.`]);
    m.starts.forEach(([ox, oy], j) => { if (j > k && Math.hypot(ox - sx, oy - sy) < 20) out.push(['warn', `Spawns ${k + 1} and ${j + 1} are only ${Math.round(Math.hypot(ox - sx, oy - sy))} tiles apart (bases will overlap; 20+ is better).`]); }); });
  return out; }
const MB_CRAMP = 200;
function mbStatus() { const el = document.getElementById('mbStat'); if (!el || !MBE.m) return; const m = MBE.m, ch = mbCheck(); let ore = 0; for (let i = 0; i < m.o.length; i++) if (m.o[i]) ore++;
  el.innerHTML = `<b>${m.w}×${m.w}</b> · ${m.starts.length}/8 spawns · ${ore} ore tiles · ${m.vents.length} gas · ${m.derricks.length} derricks · ${m.outposts.length} outposts${m.monument ? ' · monument' : ''}${MBE.dirty ? ' · <span style="color:#fc6">unsaved</span>' : ''}<br>` +
    (ch.length ? ch.slice(0, 5).map(([k, t]) => `<span class="${k}">${k === 'err' ? '⛔' : '⚠'} ${t}</span>`).join('<br>') + (ch.length > 5 ? `<br>…and ${ch.length - 5} more` : '') : '<span class="ok">✔ Ready to play</span>'); }
function mbToast(t) { const el = document.getElementById('mbToast'); if (!el) return; el.textContent = t; el.style.opacity = 1; clearTimeout(MBE.tt); MBE.tt = setTimeout(() => el.style.opacity = 0, 2600); }
// ---- UI ----
function mbCSS() { if (document.getElementById('mbCss')) return; const st = document.createElement('style'); st.id = 'mbCss'; st.textContent = `
#mbEd{position:fixed;inset:0;z-index:9000;background:#0b0e12;color:#dde6ee;font:13px system-ui,sans-serif;display:flex;flex-direction:column;user-select:none}
#mbEd .bar{display:flex;gap:6px;align-items:center;padding:6px 8px;background:#151b22;border-bottom:1px solid #2a3540;flex-wrap:wrap}
#mbEd button,#mbEd select,#mbEd input[type=text]{background:#1d2731;color:#dde6ee;border:1px solid #34485a;border-radius:5px;padding:4px 8px;font:13px system-ui}
#mbEd button:hover{background:#26425e}#mbEd button.on{background:#2a6fc0;border-color:#8cc4ff;color:#fff}#mbEd button.pri{background:#2a8a4a;border-color:#5c5}
#mbEd .main{flex:1;display:flex;min-height:0}#mbEd .side{width:212px;overflow-y:auto;background:#121820;border-right:1px solid #2a3540;padding:6px}
#mbEd .side h4{margin:8px 0 4px;font-size:11px;letter-spacing:1px;color:#8aa;text-transform:uppercase}#mbEd .side button{display:flex;align-items:center;gap:6px;width:100%;margin:2px 0;text-align:left}
#mbEd .sw{width:14px;height:14px;border-radius:3px;border:1px solid #000;display:inline-block;flex:none}
#mbEd .cvw{flex:1;position:relative;min-width:0}#mbEd canvas{position:absolute;inset:0;width:100%;height:100%;cursor:crosshair;touch-action:none}
#mbStat{padding:6px 10px;background:#151b22;border-top:1px solid #2a3540;min-height:34px;line-height:1.5}#mbStat .err{color:#ff8a7a}#mbStat .warn{color:#f6d36a}#mbStat .ok{color:#7de08a}
#mbToast{position:absolute;left:50%;top:12px;transform:translateX(-50%);background:#000c;padding:6px 14px;border-radius:6px;opacity:0;transition:opacity .3s;pointer-events:none}
#mbHelp{position:absolute;right:8px;bottom:8px;background:#000a;padding:6px 10px;border-radius:6px;font-size:11.5px;color:#9ab;pointer-events:none;line-height:1.45}
#mbDlg{position:fixed;inset:0;z-index:9100;background:#0009;display:flex;align-items:center;justify-content:center}#mbDlg .box{background:#161d25;border:1px solid #3a4c5e;border-radius:8px;padding:16px 18px;min-width:340px;max-width:560px;max-height:80vh;overflow:auto}
#mbDlg .row{display:flex;gap:8px;align-items:center;margin:8px 0}#mbDlg .ml{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #2a3540}
`; document.head.appendChild(st); }
function mbOpen() { mbCSS(); if (!MBE.m) { const last = Object.values(cmAll()).sort((a, b) => (b.saved || 0) - (a.saved || 0))[0]; MBE.m = last ? mbFromCmap(last) : mbStarter(128, 'grass', 4); MBE.dirty = !last; }
  let ed = document.getElementById('mbEd'); if (ed) ed.remove(); ed = document.createElement('div'); ed.id = 'mbEd'; MBE.on = true;
  const btn = (k, v, lab, sw) => `<button data-k="${k}" data-v="${v}">${sw ? `<span class="sw" style="background:${sw}"></span>` : ''}${lab}</button>`;
  ed.innerHTML = `<div class="bar"><b style="letter-spacing:2px">🛠 MAP BUILDER</b>
    <input type="text" id="mbName" maxlength="32" style="width:170px" title="Map name">
    <label>Theme <select id="mbTheme">${CMAP_THEMES.map(t => `<option value="${t}">${{ grass: 'Grassland', desert: 'Desert', frost: 'Frost', volcano: 'Volcano', space: 'Space', mech: 'Futuristic / mech' }[t]}</option>`).join('')}</select></label>
    <label>Mirror <select id="mbMirror"><option value="none">Off</option><option value="h">Left ↔ right</option><option value="v">Top ↕ bottom</option><option value="4">4-way</option><option value="r">Rotate 180°</option></select></label>
    <label title="[ and ] keys">Brush <input type="range" id="mbBrush" min="1" max="21" step="1" style="width:90px"> <span id="mbBrushV"></span></label>
    <button id="mbFillB" title="F: flood-fill the connected area under the cursor with the current tool">🪣 Fill</button>
    <button id="mbUndo" title="Cmd/Ctrl+Z">↶ Undo</button><button id="mbRedo" title="Shift+Cmd/Ctrl+Z">↷ Redo</button>
    <span style="flex:1"></span>
    <button id="mbNew">New…</button><button id="mbOpenB">My maps…</button><button id="mbSave" class="pri">💾 Save</button><button id="mbExport" title="Download as .json">⬇ Export</button><button id="mbImport">⬆ Import</button>
    <button id="mbPlay" class="pri">▶ Play this map</button><button id="mbClose">✕ Close</button><input type="file" id="mbFile" accept=".json,application/json" style="display:none"></div>
    <div class="main"><div class="side">
      <h4>Terrain</h4>${MB_TER.map(([n, v, c]) => btn('t', v, n, c)).join('')}
      <h4>Height (high ground)</h4>${MB_HT.map(([n, v]) => btn('h', v, n, ['#4a6a40', '#7a9a68', '#a8c494'][v])).join('')}
      <h4>Resources</h4>${MB_ORE.map(([n, v, c]) => btn('o', v, n, c)).join('')}
      <h4>Objects (click to place / remove)</h4>${MB_OBJ.map(([n, v, c]) => btn('obj', v, n, c)).join('')}
      <label style="display:block;margin:4px 2px;font-size:12px"><input type="checkbox" id="mbAuto"> new spawns get base ore + gas</label>
      <h4>Eraser</h4>${btn('x', 0, 'Erase to plain ground', '#222')}
    </div><div class="cvw"><canvas id="mbCv"></canvas><div id="mbToast"></div><div id="mbHelp">Left-drag: paint · Right-drag / Space+drag: pan · Wheel / pinch: zoom · [ ] brush · F fill · E eraser · Cmd+Z undo · Cmd+S save</div></div></div>
    <div id="mbStat"></div>`;
  document.body.appendChild(ed); MBE.cv = ed.querySelector('#mbCv');
  const $ = id => ed.querySelector('#' + id), sync = () => { $('mbName').value = MBE.m.name; $('mbTheme').value = MBE.m.theme; $('mbMirror').value = MBE.mirror; $('mbBrush').value = MBE.brush; $('mbBrushV').textContent = MBE.brush; $('mbAuto').checked = MBE.autoOre; $('mbFillB').classList.toggle('on', MBE.fill);
    ed.querySelectorAll('.side button').forEach(b => b.classList.toggle('on', b.dataset.k === MBE.tool.k && String(b.dataset.v) === String(MBE.tool.v))); };
  MBE.sync = sync;
  ed.querySelectorAll('.side button').forEach(b => b.onclick = () => { MBE.tool = { k: b.dataset.k, v: b.dataset.k === 'obj' ? b.dataset.v : +b.dataset.v }; if (MBE.tool.k === 'obj') MBE.fill = false; sync(); });
  $('mbName').oninput = e => { MBE.m.name = e.target.value || 'Untitled'; MBE.dirty = true; mbStatus(); };
  $('mbTheme').onchange = e => { mbSnap(); MBE.m.theme = e.target.value; mbDrawAll(); mbStatus(); };
  $('mbMirror').onchange = e => { MBE.mirror = e.target.value; mbRender(); };
  $('mbBrush').oninput = e => { MBE.brush = +e.target.value; sync(); };
  $('mbAuto').onchange = e => { MBE.autoOre = e.target.checked; };
  $('mbFillB').onclick = () => { MBE.fill = !MBE.fill; if (MBE.tool.k === 'obj') MBE.tool = { k: 't', v: 0 }; sync(); };
  $('mbUndo').onclick = () => mbUndo(false); $('mbRedo').onclick = () => mbUndo(true);
  $('mbNew').onclick = mbNewDlg; $('mbOpenB').onclick = mbListDlg; $('mbSave').onclick = () => mbSave(true);
  $('mbExport').onclick = () => { const c = mbToCmap(MBE.m), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(c)], { type: 'application/json' })); a.download = (c.name || 'map').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + '.ironfront-map.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  $('mbImport').onclick = () => $('mbFile').click();
  $('mbFile').onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { try { const c = JSON.parse(rd.result); if (!cmValid(c)) throw new Error('not an Iron Front map'); mbSnap(); MBE.m = mbFromCmap(c); if (cmAll()[MBE.m.id]) MBE.m.id = mbBlank(c.w).id; mbFit(); sync(); mbDrawAll(); mbSave(false); mbToast('Imported “' + MBE.m.name + '” and saved it to My maps'); } catch (er) { alert('Could not import: ' + er.message); } }; rd.readAsText(f); e.target.value = ''; };
  $('mbPlay').onclick = mbPlay; $('mbClose').onclick = mbClose;
  mbBindCanvas(); sync(); mbResize(); mbFit(); mbDrawAll(); mbStatus();
  window.addEventListener('resize', mbResize); window.addEventListener('keydown', mbKey, true); }
function mbClose() { if (MBE.dirty && !confirm('Close the Map Builder? Unsaved changes are lost (press Save first to keep them).')) return; MBE.on = false; const ed = document.getElementById('mbEd'); if (ed) ed.remove(); window.removeEventListener('resize', mbResize); window.removeEventListener('keydown', mbKey, true); cmRefreshSel(); }
function mbSave(toast) { const c = mbToCmap(MBE.m); if (!cmPut(c)) return null; MBE.m.rev = c.rev; MBE.dirty = false; for (const k in MP_CACHE) if (k.startsWith('cm:' + c.id)) delete MP_CACHE[k]; cmRefreshSel(); mbStatus(); if (toast) mbToast('Saved “' + c.name + '” — it is now in the skirmish map list'); return c; }
function mbPlay() { const errs = mbCheck().filter(c => c[0] === 'err'); if (errs.length) { alert('Fix this first:\n• ' + errs.map(e => e[1]).join('\n• ')); return; } const c = mbSave(false); if (!c) return;
  MBE.dirty = false; mbClose(); homeShow('bots'); setMode('skirmish'); const ms = document.getElementById('mapSel'); cmRefreshSel('cm:' + c.id); ms.value = 'cm:' + c.id; cmSelChanged();
  const n = c.starts.length, rows = [0, 1, 2, 3, 4, 5, 6, 7].map(i => i >= n ? ['off', 'A'] : [i === 0 ? 'human' : 'si', n === 2 ? (i ? 'B' : 'A') : TEAM_LET[i]]); lobbySet(rows); if (typeof lobbyChanged === 'function') lobbyChanged(); mapPreview();
  const t = document.getElementById('setupTitle'); if (t) t.textContent = `“${c.name}”: You vs ${n - 1} Hard bot${n > 2 ? 's, free-for-all (change Team per slot for teams)' : ''} — press Start`; }
function mbResize() { if (!MBE.cv) return; const r = MBE.cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); MBE.dpr = dpr; MBE.cv.width = Math.max(10, r.width * dpr); MBE.cv.height = Math.max(10, r.height * dpr); mbRender(); }
function mbFit() { if (!MBE.cv) return; const W = MBE.cv.width, H = MBE.cv.height, s = Math.max(1, Math.min(W, H) * 0.94 / MBE.m.w); MBE.view = { s, ox: (W - MBE.m.w * s) / 2, oy: (H - MBE.m.w * s) / 2 }; }
function mbTileAt(e) { const r = MBE.cv.getBoundingClientRect(), px = (e.clientX - r.left) * MBE.dpr, py = (e.clientY - r.top) * MBE.dpr, V = MBE.view; return [Math.floor((px - V.ox) / V.s), Math.floor((py - V.oy) / V.s), px, py]; }
function mbBindCanvas() { const cv = MBE.cv, ptrs = new Map(); let last = null, pinch = null;
  const inside = (x, y) => x >= 0 && y >= 0 && x < MBE.m.w && y < MBE.m.w;
  const stroke = (x, y) => { if (last) { const n = Math.max(Math.abs(x - last[0]), Math.abs(y - last[1])); for (let k = 1; k <= n; k++) { const ix = Math.round(last[0] + (x - last[0]) * k / n), iy = Math.round(last[1] + (y - last[1]) * k / n); if (inside(ix, iy)) mbApplyAt(ix, iy); } } else if (inside(x, y)) mbApplyAt(x, y); last = [x, y]; };
  cv.oncontextmenu = e => e.preventDefault();
  cv.onpointerdown = e => { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: MBE.view.s }; MBE.paint = false; MBE.pan = null; return; }
    const [x, y, px, py] = mbTileAt(e);
    if (e.button === 2 || e.button === 1 || MBE.space) { MBE.pan = [px, py, MBE.view.ox, MBE.view.oy]; return; }
    if (e.button !== 0) return; if (!inside(x, y)) { MBE.pan = [px, py, MBE.view.ox, MBE.view.oy]; return; }
    mbSnap(); if (MBE.tool.k === 'obj') { mbObject(x, y); mbDrawAll(); mbStatus(); return; } if (MBE.fill) { mbFill(x, y); mbDrawAll(); mbStatus(); return; }
    MBE.paint = true; last = null; stroke(x, y); mbDrawAll(); };
  cv.onpointermove = e => { if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), r = cv.getBoundingClientRect(); mbZoom(((a[0] + b[0]) / 2 - r.left) * MBE.dpr, ((a[1] + b[1]) / 2 - r.top) * MBE.dpr, pinch.s * d / pinch.d / MBE.view.s); return; }
    const [x, y, px, py] = mbTileAt(e); MBE.hover = inside(x, y) ? [x, y] : null;
    if (MBE.pan) { MBE.view.ox = MBE.pan[2] + px - MBE.pan[0]; MBE.view.oy = MBE.pan[3] + py - MBE.pan[1]; mbRender(); return; }
    if (MBE.paint) { stroke(x, y); mbDrawAll(); return; } mbRender(); const st = document.getElementById('mbHelp'); if (st && MBE.hover) st.dataset.xy = x + ',' + y; };
  const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (MBE.paint) mbStatus(); MBE.paint = false; MBE.pan = null; last = null; };
  cv.onpointerup = up; cv.onpointercancel = up; cv.onpointerleave = () => { MBE.hover = null; mbRender(); };
  cv.onwheel = e => { e.preventDefault(); const r = cv.getBoundingClientRect(); mbZoom((e.clientX - r.left) * MBE.dpr, (e.clientY - r.top) * MBE.dpr, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))); }; }
function mbZoom(px, py, f) { const V = MBE.view, ns = Math.max(0.8, Math.min(48, V.s * f)), k = ns / V.s; V.ox = px - (px - V.ox) * k; V.oy = py - (py - V.oy) * k; V.s = ns; mbRender(); }
function mbKey(e) { if (!MBE.on || document.getElementById('mbDlg')) return; const tg = e.target && e.target.tagName; if (tg === 'INPUT' && e.target.type === 'text') { if (e.key === 'Escape' || e.key === 'Enter') e.target.blur(); if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); mbSave(true); } e.stopImmediatePropagation(); return; }
  const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase(); let used = true;
  if (mod && k === 'z') mbUndo(e.shiftKey); else if (mod && k === 'y') mbUndo(true); else if (mod && k === 's') mbSave(true);
  else if (k === '[') MBE.brush = Math.max(1, MBE.brush - 1); else if (k === ']') MBE.brush = Math.min(21, MBE.brush + 1);
  else if (k === 'f' && !mod) { MBE.fill = !MBE.fill; if (MBE.tool.k === 'obj') MBE.tool = { k: 't', v: 0 }; } else if (k === 'e' && !mod) MBE.tool = { k: 'x', v: 0 }; else if (k === 'b' && !mod) MBE.fill = false;
  else if (k === ' ') { MBE.space = true; window.addEventListener('keyup', function u(ev) { if (ev.key === ' ') { MBE.space = false; window.removeEventListener('keyup', u); } }); }
  else if (k === 'escape') mbClose(); else if (k === '0' && !mod) { mbFit(); mbRender(); } else used = !mod && k.length === 1; // swallow other letter keys so game hotkeys never fire under the editor
  if (used) { e.preventDefault(); e.stopImmediatePropagation(); if (MBE.sync) MBE.sync(); mbRender(); } }
function mbDlg(html, wire) { let d = document.getElementById('mbDlg'); if (d) d.remove(); d = document.createElement('div'); d.id = 'mbDlg'; d.innerHTML = '<div class="box">' + html + '</div>'; document.body.appendChild(d); d.onclick = e => { if (e.target === d) d.remove(); }; wire(d); return d; }
function mbNewDlg() { mbDlg(`<h3 style="margin:0 0 6px">New map</h3>
  <div class="row">Size <select id="nS">${CMAP_SIZES.map(s => `<option value="${s}" ${s === 128 ? 'selected' : ''}>${s}×${s}${{ 64: ' (small)', 96: ' (classic size)', 128: ' (Hellgate size)', 160: '', 192: ' (large)', 224: ' (huge, ~3× Hellgate)' }[s]}</option>`).join('')}</select></div>
  <div class="row">Theme <select id="nT">${CMAP_THEMES.map(t => `<option value="${t}">${t}</option>`).join('')}</select></div>
  <div class="row">Start from <select id="nK"><option value="starter">Starter layout (spawns + base ore + gas)</option><option value="blank">Blank ground</option></select> <select id="nP">${[2, 3, 4, 5, 6, 7, 8].map(n => `<option value="${n}" ${n === 4 ? 'selected' : ''}>${n} players</option>`).join('')}</select></div>
  <div class="row" style="justify-content:flex-end"><button id="nC">Cancel</button><button id="nOk" class="pri">Create</button></div>`, d => {
    d.querySelector('#nC').onclick = () => d.remove();
    d.querySelector('#nOk').onclick = () => { if (MBE.dirty && !confirm('Discard unsaved changes to the current map?')) return; const w = +d.querySelector('#nS').value, th = d.querySelector('#nT').value, np = +d.querySelector('#nP').value;
      MBE.m = d.querySelector('#nK').value === 'blank' ? mbBlank(w, th) : mbStarter(w, th, np); MBE.undo = []; MBE.redo = []; MBE.dirty = true; d.remove(); mbFit(); MBE.sync(); mbDrawAll(); mbStatus(); }; }); }
function mbListDlg() { const all = Object.values(cmAll()).filter(cmValid).sort((a, b) => (b.saved || 0) - (a.saved || 0)), esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  mbDlg(`<h3 style="margin:0 0 6px">My maps (${all.length})</h3>${all.length ? all.map(m => `<div class="ml"><span><b>${esc(m.name)}</b> <span style="color:#8aa">${m.w}² · ${m.starts.length} spawns · ${m.theme} · ${new Date(m.saved || 0).toLocaleDateString()}</span></span><span><button data-o="${m.id}">Open</button> <button data-c="${m.id}">Copy</button> <button data-d="${m.id}">Delete</button></span></div>`).join('') : '<p>No saved maps yet.</p>'}
  <div class="row" style="justify-content:flex-end"><button id="lC">Close</button></div>`, d => {
    d.querySelector('#lC').onclick = () => d.remove();
    d.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { if (MBE.dirty && !confirm('Discard unsaved changes to the current map?')) return; MBE.m = mbFromCmap(cmGet(b.dataset.o)); MBE.undo = []; MBE.redo = []; MBE.dirty = false; d.remove(); mbFit(); MBE.sync(); mbDrawAll(); mbStatus(); });
    d.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { const c = Object.assign({}, cmGet(b.dataset.c)); c.id = mbBlank(64).id; c.name = c.name + ' (copy)'; c.saved = Date.now(); cmPut(c); d.remove(); mbListDlg(); });
    d.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const m = cmGet(b.dataset.d); if (m && confirm('Delete “' + m.name + '”? (Export it first if you want a backup.)')) { cmDel(b.dataset.d); cmRefreshSel(); d.remove(); mbListDlg(); } }); }); }
