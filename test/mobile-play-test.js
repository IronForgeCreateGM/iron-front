// v6.1 mobile PLAY test: iPhone 14 landscape emulation (Chromium mobile emulation + touch).
//  NODE_PATH=/tmp/tb/node_modules node test/mobile-play-test.js [part]   part: play (default) | lobby | hellgate | perf
const { chromium, devices } = require('playwright-core'), path = require('path');
const ROOT = 'file://' + path.resolve(__dirname, '../index.html'), PART = process.argv[2] || 'play';
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const ctx = await br.newContext({ ...devices['iPhone 14 landscape'] }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => { if (errs.length < 3) console.log('PAGEERR ' + e.message); errs.push(e.message); }); pg.on('console', m => { if (m.type() === 'error' && errs.length < 5) { console.log('CONSOLE ' + m.text().slice(0, 300)); errs.push(m.text()); } });
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  // in-page touch helpers (CDP round-trips are slow under software GL)
  const T = (pts, type) => pg.evaluate(([pts, type]) => { const cv = document.getElementById('view'), ts = pts.map(([x, y], i) => new Touch({ identifier: i + 1, target: cv, clientX: x, clientY: y }));
    cv.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : ts, changedTouches: ts, bubbles: true, cancelable: true })); }, [pts, type]);
  const drag = async (a, b, n = 8) => { await T([a], 'touchstart'); for (let i = 1; i <= n; i++) await T([[a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]], 'touchmove'); await T([b], 'touchend'); };
  const tap = async (x, y) => { await T([[x, y]], 'touchstart'); await T([[x, y]], 'touchend'); };
  const run = n => pg.evaluate(n => { for (let i = 0; i < n; i++) NET.tick(); }, n);
  const W = await pg.evaluate(() => 0).catch(() => 0);
  if (PART === 'play') {
    await pg.goto(ROOT + '?slots=human:A:usa,easy:B&seed=7&peace=600'); await pg.waitForTimeout(3500);
    const s0 = await pg.evaluate(() => ({ mob: MOB.on, mplay: document.body.classList.contains('mplay'), cards: document.querySelectorAll('#mCards .item').length, pr: R3.renderer.getPixelRatio(), sh: R3.sun.castShadow, q: R3.q.label, w: innerWidth, h: innerHeight }));
    ok(s0.mob && s0.mplay, 'iPhone landscape auto-detects the mobile play UI ' + JSON.stringify(s0));
    ok(s0.cards >= 4, 'build bar shows structure cards: ' + s0.cards); ok(s0.pr <= 1.5 && !s0.sh && s0.q === 'Mobile', 'mobile quality preset');
    const tg = await pg.evaluate(() => [...document.querySelectorAll('#mHud button, #mCards .item')].filter(b => b.offsetParent && getComputedStyle(b).display !== 'none').map(b => { const r = b.getBoundingClientRect(); return [b.dataset.k || b.dataset.t || b.dataset.cat || b.id, r.width | 0, r.height | 0]; }));
    ok(tg.every(([, w, h]) => w >= 44 && h >= 44), 'all HUD tap targets >= 44px ' + JSON.stringify(tg.filter(([, w, h]) => w < 44 || h < 44)));
    // build a Power Plant via the card
    await pg.tap('#mCards .item[data-t="power"]'); await run(30 * 12);
    await pg.waitForTimeout(400);
    let st = await pg.evaluate(() => ({ ready: G.players[ME].ready.bld, placing: UI.placing }));
    if (st.ready === 'power' && !st.placing) { await pg.tap('#mCards .item[data-t="power"]'); await pg.waitForTimeout(500); st = await pg.evaluate(() => ({ ready: G.players[ME].ready.bld, placing: UI.placing })); }
    ok(st.placing === 'power' && await pg.isVisible('#mOk'), 'card tap -> ready -> ghost placement with ✓/✗ ' + JSON.stringify(st));
    // drag the ghost to a valid spot near the HQ
    const spot = await pg.evaluate(() => { const sp = mobSpot('power'), d = BT.power; const s = worldToScreen(sp[0] + d.w / 2, sp[1] + d.h / 2, 0); return [s.x, s.y, UI.mouse.x, UI.mouse.y]; });
    await drag([spot[2], spot[3]], [spot[0], spot[1]], 6); await pg.waitForTimeout(500);
    const gv = await pg.evaluate(() => { const w = screenToWorld(UI.mouse.x, UI.mouse.y), d = BT.power, tx = Math.floor(w.x - d.w / 2 + 0.5), ty = Math.floor(w.y - d.h / 2 + 0.5); return canPlace('power', ME, tx, ty); });
    ok(gv, 'drag moves the ghost onto a valid (green) spot');
    await pg.screenshot({ path: 'shots/v6_1-mobile-build.png' });
    const nb0 = await pg.evaluate(() => G.ents.filter(e => e.team === ME && e.t === 'power').length);
    await pg.tap('#mOk'); await pg.waitForTimeout(500);
    const nb1 = await pg.evaluate(() => G.ents.filter(e => e.team === ME && e.t === 'power').length);
    ok(nb1 === nb0 + 1, '✓ places the Power Plant (' + nb0 + ' -> ' + nb1 + ')');
    // barracks + queue infantry
    await pg.evaluate(() => { G.players[ME].cr += 5000; }); await pg.tap('#mCards .item[data-t="barracks"]'); await run(30 * 15); await pg.waitForTimeout(300);
    const bp = await pg.evaluate(() => { const sp = mobSpot('barracks'); if (!sp) return null; NET.issue({ c: 'place', cat: 'bld', x: sp[0], y: sp[1] }); UI.placing = null; return G.ents.some(e => e.team === ME && e.t === 'barracks'); });
    ok(bp, 'barracks built'); await pg.waitForTimeout(400);
    await pg.tap('.mtab[data-cat="inf"]'); await pg.waitForTimeout(300);
    const inf = await pg.evaluate(() => [...document.querySelectorAll('#mCards .item')].map(b => b.dataset.t)); ok(inf.length >= 2, 'infantry tab cards: ' + inf.join(','));
    for (let i = 0; i < 4; i++) await pg.tap(`#mCards .item[data-t="${inf[0]}"]`);
    await pg.waitForTimeout(400);
    const q = await pg.evaluate(t => ({ q: G.players[ME].queues.inf.length, cnt: document.querySelector(`#mCards .item[data-t="${t}"] .cnt`).textContent }), inf[0]); ok(q.q >= 4 && q.cnt, 'tap queues units with a count badge ' + JSON.stringify(q));
    await run(30 * 40);
    const u = await pg.evaluate(() => myArmy().length); ok(u >= 3, 'units produced: ' + u);
    // select army -> tap ground -> attack-move
    await pg.tap('#mCmd .mc[data-k="army"]'); const ns = await pg.evaluate(() => UI.sel.length); ok(ns >= 3, 'Army button selects all combat units: ' + ns);
    const tgtS = await pg.evaluate(() => { const a = myArmy(), cx = a.reduce((s, e) => s + e.x, 0) / a.length, cy = a.reduce((s, e) => s + e.y, 0) / a.length; const p = worldToScreen(cx + 6, cy + 3, 0); return [p.x, p.y]; });
    await tap(tgtS[0], tgtS[1]); await pg.waitForTimeout(500);
    const mv = await pg.evaluate(() => myArmy().map(u => [u.order, u.path.length > 0 || !!u.moveTo])); ok(mv.length && mv.every(([o]) => o === 'amove'), 'tap ground = attack-move for the selection ' + JSON.stringify(mv.slice(0, 3)));
    await pg.tap('#mCmd .mc[data-k="stop"]'); await run(2); const so = await pg.evaluate(() => myArmy().every(u => u.order === 'idle' && !u.path.length)); ok(so, 'Stop button (NET stop command) halts the selection');
    await pg.tap('#mCmd .mc[data-k="hold"]'); await run(2); ok(await pg.evaluate(() => myArmy().every(u => u.stance === 'hold')), 'Hold button sets hold stance');
    // tap a unit = select it; double tap = all of that type on screen
    const us = await pg.evaluate(() => { const u = myArmy()[0], rs = R3.rs.get(u.id) || u, p = worldToScreen(rs.x, rs.y, (rs.z || heightAt(u.x, u.y)) + 0.3); return [p.x, p.y, u.id]; });
    await pg.evaluate(() => setSel([])); await tap(us[0], us[1]); await pg.waitForTimeout(500);
    const s1 = await pg.evaluate(() => UI.sel.map(e => e.id)); ok(s1.length === 1, 'tap on a unit selects it ' + JSON.stringify(s1));
    await pg.evaluate(([x, y]) => { const cv = document.getElementById('view'), f = (ty) => { const t = new Touch({ identifier: 5, target: cv, clientX: x, clientY: y }); cv.dispatchEvent(new TouchEvent(ty, { touches: ty === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true })); }; setSel([]); f('touchstart'); f('touchend'); f('touchstart'); f('touchend'); }, us); await pg.waitForTimeout(300); const s2 = await pg.evaluate(() => UI.sel.length); ok(s2 >= 2, 'double-tap selects all of that type on screen: ' + s2);
    // box mode
    await pg.evaluate(() => setSel([])); await pg.tap('#mCmd .mc[data-k="box"]');
    const bx = await pg.evaluate(() => { const a = myArmy(); const ps = a.map(u => worldToScreen(u.x, u.y, 0)); return [Math.min(...ps.map(p => p.x)) - 30, Math.min(...ps.map(p => p.y)) - 30, Math.max(...ps.map(p => p.x)) + 30, Math.max(...ps.map(p => p.y)) + 30]; });
    await drag([bx[0], bx[1]], [bx[2], bx[3]], 5); await pg.waitForTimeout(500); const s3 = await pg.evaluate(() => UI.sel.filter(e => e.kind === 'u').length); ok(s3 >= 3, 'Box mode drag-selects units: ' + s3);
    // pan + inertia + pinch
    const cam = () => pg.evaluate(() => ({ x: R3.cam.tx, y: R3.cam.ty, d: R3.cam.td }));
    const c0 = await cam(); await drag([420, 200], [300, 150], 6); const c1 = await cam(); await pg.waitForTimeout(500); const c2 = await cam();
    ok(Math.hypot(c1.x - c0.x, c1.y - c0.y) > 1, `one-finger drag pans (${c0.x.toFixed(1)},${c0.y.toFixed(1)})->(${c1.x.toFixed(1)},${c1.y.toFixed(1)})`); ok(Math.hypot(c2.x - c1.x, c2.y - c1.y) > 0.05, 'pan inertia glides after release ' + Math.hypot(c2.x - c1.x, c2.y - c1.y).toFixed(2));
    await T([[350, 200], [450, 200]], 'touchstart'); for (let i = 1; i <= 6; i++) await T([[350 + i * 8, 200], [450 - i * 8, 200]], 'touchmove'); await T([[398, 200], [402, 200]], 'touchend');
    const c3 = await cam(); ok(c3.d > c2.d * 1.5, `pinch zooms ${c2.d.toFixed(0)} -> ${c3.d.toFixed(0)}`);
    // wall drag
    await pg.tap('.mtab[data-cat="def"]'); await pg.waitForTimeout(500);
    await pg.evaluate(() => { const h = mobHome(); R3.cam.td = R3.cam.d = 26; jumpTo(h.x, h.y + 6, true); }); await pg.waitForTimeout(300);
    await pg.tap('#mCards .item[data-t="wall"]'); const wm = await pg.evaluate(() => UI.mode); ok(wm === 'wall', 'wall card -> wall mode');
    const w0 = await pg.evaluate(() => G.ents.filter(e => e.t === 'wall' && e.team === ME).length);
    const wp = await pg.evaluate(() => { const h = mobHome(); for (let dy = 5; dy < 14; dy++) { let okRow = true; for (let x = -3; x <= 3; x++) if (!canPlace('wall', ME, Math.floor(h.x) + x, Math.floor(h.y) + dy)) okRow = false; if (okRow) { const a = worldToScreen(Math.floor(h.x) - 3 + 0.5, Math.floor(h.y) + dy + 0.5, 0), b = worldToScreen(Math.floor(h.x) + 3 + 0.5, Math.floor(h.y) + dy + 0.5, 0); return [a.x, a.y, b.x, b.y]; } } return null; });
    if (wp) await drag([wp[0], wp[1]], [wp[2], wp[3]], 6); await run(3);
    const w1 = await pg.evaluate(() => G.ents.filter(e => e.t === 'wall' && e.team === ME).length); ok(w1 >= w0 + 4, 'drag lays a wall chain (' + w0 + ' -> ' + w1 + ')');
    await pg.tap('#mNo'); ok(await pg.evaluate(() => !UI.mode), '✗ leaves wall mode');
    // HUD shot
    await pg.evaluate(() => { const a = myArmy(); setSel(a); jumpTo(a[0].x, a[0].y, true); R3.cam.td = R3.cam.d = 24; }); await pg.waitForTimeout(800);
    await pg.screenshot({ path: 'shots/v6_1-mobile-hud.png' });
    const sc = await pg.evaluate(() => [scrollX, scrollY]); ok(sc[0] === 0 && sc[1] === 0, 'no page scroll');
  }
  ok(!errs.length, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await br.close(); console.log(fail ? 'FAILED ' + fail : 'ALL PASS'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
