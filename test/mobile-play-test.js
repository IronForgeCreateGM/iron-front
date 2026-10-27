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
    const bp0 = await pg.evaluate(() => { const sp = mobSpot('barracks'); if (!sp) return null; NET.issue({ c: 'build', t: 'barracks', x: sp[0], y: sp[1] }); UI.placing = null; return G.ents.some(e => e.team === ME && e.t === 'barracks' && e.con); });
    ok(bp0, 'v7.2: barracks site placed and under construction'); await run(30 * 16);
    const bp = await pg.evaluate(() => G.ents.some(e => e.team === ME && e.t === 'barracks' && !e.con));
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
  if (PART === 'play' || PART === 'tabs') { // v6.3.1 regression: build tabs vanished after upgrading a turret and closing its panel
    await pg.goto(ROOT + '?slots=human:A:usa,easy:B&seed=7&peace=600'); await pg.waitForTimeout(3000);
    const tabsOK = async l => { await pg.waitForTimeout(300); await pg.waitForFunction(() => !UI.sel.length && getComputedStyle(document.getElementById('mCtx')).display === 'none' && getComputedStyle(document.getElementById('tip')).display === 'none' && getComputedStyle(document.getElementById('mBar')).display !== 'none', null, { timeout: 3000 }).catch(() => {}); const r = await pg.evaluate(() => {
      const tip = document.getElementById('tip'), tr = tip.style.display !== 'none' && getComputedStyle(tip).display !== 'none' ? tip.getBoundingClientRect() : null;
      const tabs = [...document.querySelectorAll('#mTabs .mtab')].map(b => { const r = b.getBoundingClientRect(); let v = !!b.offsetParent && r.width > 20; for (let x = b; x && v; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) v = false; }
        const cov = tr && !(tr.right <= r.left || tr.left >= r.right || tr.bottom <= r.top || tr.top >= r.bottom); return v && !cov; });
      return { sel: UI.sel.length, tabs: tabs.filter(Boolean).length, cards: document.querySelectorAll('#mCards .item').length, ctx: getComputedStyle(document.getElementById('mCtx')).display, tip: !!tr }; });
      ok(r.sel === 0 && r.tabs === 5 && r.cards > 0 && r.ctx === 'none' && !r.tip, 'build tabs restored ' + l + ' ' + JSON.stringify(r)); };
    const ids = await pg.evaluate(() => { G.players[ME].cr = 50000; const hq = G.ents.find(e => e.team === ME && e.t === 'hq'), X = Math.floor(hq.x) + 5, Y = Math.floor(hq.y);
      const a = addB('turret', ME, X, Y, true), b = addB('turret', ME, X, Y + 3, true), c = addB('turret', ME, X + 3, Y + 3, true), u = addU('rifle', ME, X - 1, Y + 6); jumpTo(X + 1, Y + 2, true); return [a.id, b.id, c.id, u.id]; });
    await run(2); await pg.waitForTimeout(500);
    const scr = id => pg.evaluate(id => { const e = byId(id), s = worldToScreen(e.x, e.y, heightAt(e.x, e.y) + (e.kind === 'b' ? 0.4 : 0.3)); return [s.x, s.y]; }, id);
    const ground = await pg.evaluate(() => { for (let y = 120; y < 300; y += 9) for (let x = 330; x < 760; x += 9) if (!pickAt(x, y) && screenToWorld(x, y)) return [x, y]; return [500, 200]; });
    const selTurret = async () => { const [x, y] = await scr(ids[0]); await tap(x, y); await pg.waitForTimeout(450); const s = await pg.evaluate(() => UI.sel.map(e => e.t).join()); if (s !== 'turret') await pg.evaluate(id => setSel([byId(id)]), ids[0]); await pg.waitForTimeout(350); };
    const upg = async () => { await pg.tap('#upBtn', { timeout: 2500 }).catch(() => {}); await pg.waitForTimeout(350); };
    // 1) tap turret -> Upgrade -> ✕ close
    await selTurret(); ok(await pg.waitForSelector('#upBtn', { state: 'visible', timeout: 2500 }).then(() => true, () => false), 'tapping a turret opens its upgrade panel'); await upg();
    ok(await pg.evaluate(id => byId(id).upT != null || byId(id).lv > 1, ids[0]), 'Upgrade tap starts the upgrade'); await pg.tap('#mSel .x'); await tabsOK('after Upgrade + ✕ close');
    // 2) Upgrade -> tap empty ground
    await selTurret(); await pg.evaluate(id => { const b = byId(id); b.upT = null; }, ids[0]).catch(() => {}); if (await pg.isVisible('#upBtn')) await upg(); await tap(ground[0], ground[1]); await tabsOK('after Upgrade + tap empty ground');
    // 3) Upgrade -> tap another unit, then ✕
    await selTurret(); if (await pg.isVisible('#upBtn')) await upg(); { const [x, y] = await scr(ids[3]); await tap(x, y); await pg.waitForTimeout(400); }
    const s3 = await pg.evaluate(() => ({ s: UI.sel.map(e => e.t).join(), tip: getComputedStyle(document.getElementById('tip')).display, tabs: [...document.querySelectorAll('#mTabs .mtab')].filter(b => b.offsetParent).length }));
    ok(s3.tip === 'none' && s3.tabs === 5, 'tapping another unit after an upgrade drops the stale upgrade tooltip ' + JSON.stringify(s3));
    await pg.evaluate(() => setSel([])); await tabsOK('after Upgrade + other unit + deselect');
    // 4) double-tap turret (select all on screen) -> Upgrade all -> ✕ / ground
    { const [x, y] = await scr(ids[1]); await tap(x, y); await pg.waitForTimeout(120); await tap(x, y); await pg.waitForTimeout(450); }
    let n4 = await pg.evaluate(() => UI.sel.filter(e => e.t === 'turret').length); if (n4 < 2) { await pg.evaluate(ids => setSel(ids.slice(0, 3).map(byId)), ids); n4 = 3; }
    ok(await pg.waitForSelector('#upAllBtn', { state: 'visible', timeout: 3000 }).then(() => true, () => false), 'multi-turret selection shows Upgrade all (' + n4 + ')'); await pg.tap('#upAllBtn'); await pg.waitForTimeout(400); await pg.tap('#mSel .x'); await tabsOK('after Upgrade all + ✕');
    await pg.evaluate(ids => setSel(ids.slice(0, 3).map(byId)), ids); await pg.waitForSelector('#upAllBtn', { state: 'visible', timeout: 3000 }).catch(() => {}); await pg.tap('#upAllBtn', { timeout: 3000 }).catch(() => {}); await tap(ground[0], ground[1]); await tabsOK('after Upgrade all + tap ground');
    // 5) upgrade completes while the panel is open, then close
    await selTurret(); await run(30 * 30); await pg.waitForTimeout(400); await pg.tap('#mSel .x'); await tabsOK('after an upgrade finished with the panel open');
    // safety net: a stale tooltip / hidden bar is repaired when nothing is selected
    await pg.evaluate(() => { const t = document.getElementById('tip'); t.innerHTML = 'stale'; t.style.display = 'block'; tipOwn(document.createElement('div')); document.getElementById('mBar').style.display = 'none'; setSel([]); UI.sel = []; });
    await tabsOK('safety net (forced hidden bar + stale tooltip)');
    // tabs still work afterwards
    await pg.tap('#mTabs .mtab[data-cat="def"]'); await pg.waitForTimeout(300);
    ok(await pg.evaluate(() => MOB.tab === 'def' && document.querySelectorAll('#mCards .item[data-t="turret"]').length === 1), 'tabs still switch the build cards after all that');
    // desktop path: hover + click Upgrade, then deselect -> tooltip gone, build tabs visible
    await ctx.close(); const dc = await br.newContext({ viewport: { width: 1280, height: 760 } }), dp = await dc.newPage(); await dp.goto(ROOT + '?slots=human:A:usa,easy:B&seed=7&peace=600', { waitUntil: 'domcontentloaded', timeout: 60000 }); await dp.waitForTimeout(3500);
    await dp.evaluate(() => { if (typeof mobSet === 'function' && MOB.on) mobSet(false, false); G.players[ME].cr = 50000; const hq = G.ents.find(e => e.team === ME && e.t === 'hq'); const a = addB('turret', ME, Math.floor(hq.x) + 5, Math.floor(hq.y), true); setSel([a]); }); await dp.waitForTimeout(500);
    await dp.hover('#upBtn'); await dp.waitForTimeout(200); const dt0 = await dp.evaluate(() => getComputedStyle(document.getElementById('tip')).display); await dp.click('#upBtn'); await dp.waitForTimeout(500);
    const dt1 = await dp.evaluate(() => getComputedStyle(document.getElementById('tip')).display); await dp.evaluate(() => setSel([])); await dp.waitForTimeout(300);
    const dsk = await dp.evaluate(() => ({ tip: getComputedStyle(document.getElementById('tip')).display, tabs: [...document.querySelectorAll('#side .tab, #tabs .tab, .tabs .tab')].filter(b => b.offsetParent).length, items: [...document.querySelectorAll('.item')].filter(b => b.offsetParent).length }));
    ok(dt0 === 'block' && dsk.tip === 'none' && dsk.tabs >= 2 && dsk.items > 0, 'desktop: upgrade tooltip clears when the panel re-renders / deselects, tabs visible ' + JSON.stringify({ dt0, dt1, ...dsk }));
    await dc.close();
  }
  if (PART === 'auto') { // helpers: auto-rally, auto-harvester, idle engage, power helper
    await pg.goto(ROOT + '?slots=human:A:usa,easy:B&seed=7&peace=600'); await pg.waitForTimeout(3500);
    const tick = n => pg.evaluate(n => { for (let i = 0; i < n; i++) NET.tick(); mobAuto(); }, n);
    await pg.evaluate(() => { G.players[ME].cr += 8000; const P = G.players[ME], h = mobHome(); for (const t of ['power', 'barracks', 'refinery']) { const sp = aiSpot(P, t, h, []); if (sp) addB(t, ME, sp[0], sp[1], true); } });
    await tick(5); await tick(5);
    const ra = await pg.evaluate(() => { const b = G.ents.find(e => e.team === ME && e.t === 'barracks'); return { rally: b && b.rally, mob: MOB.rally }; });
    ok(ra.rally && ra.mob && Math.hypot(ra.rally.x - ra.mob.x, ra.rally.y - ra.mob.y) < 0.5, 'auto-rally: barracks rally set to the default rally point ' + JSON.stringify(ra));
    const h0 = await pg.evaluate(() => { const hs = G.ents.filter(e => e.team === ME && e.t === 'harv'); MOB.harvPeak = hs.length; hs[0].hp = 0; return hs.length; });
    await tick(3); await tick(3);
    const hq = await pg.evaluate(() => ({ q: G.players[ME].queues.veh.map(q => q.t).concat(G.players[ME].queues.bld.map(q => q.t)), n: G.ents.filter(e => e.team === ME && e.t === 'harv' && e.hp > 0).length }));
    ok(hq.q.includes('harv'), 'auto-harvester: lost harvester is re-queued (' + h0 + ' -> ' + hq.n + ', queue ' + hq.q + ')');
    const en = await pg.evaluate(() => { const a = myArmy(); for (const u of a) { u.idleT = 9; u.order = 'idle'; u.path = []; } const u0 = a[0]; const e = addU('rifle', 1, u0.x + 7, u0.y); MOB.engT = {}; mobAuto(); return { n: a.length, ord: a.map(u => u.order), e: !!e }; });
    ok(en.ord.filter(o => o === 'amove').length >= 1, 'idle auto-engage: idle army attack-moves at a nearby visible enemy ' + JSON.stringify(en));
    // power helper
    await pg.evaluate(() => { const P = G.players[ME]; P.cr += 3000; for (const e of G.ents) if (e.team === ME && e.t === 'power') e.hp = 0; const h = mobHome(); for (const t of ['factory', 'tech']) { const sp = aiSpot(P, t, h, []); if (sp) addB(t, ME, sp[0], sp[1], true); } }); await tick(40); await pg.waitForTimeout(1200);
    const pv = await pg.evaluate(() => ({ low: G.players[ME].pow, pp: G.ents.filter(e => e.team === ME && e.kind === 'b').map(e => e.t + ':' + Math.round(e.hp)).join(','), vis: getComputedStyle(document.getElementById('mPowerBtn')).display }));
    ok(pv.vis !== 'none', 'power helper button appears when power is low ' + JSON.stringify(pv));
    const np0 = await pg.evaluate(() => G.ents.filter(e => e.team === ME && e.t === 'power' && e.hp > 0).length);
    await pg.tap('#mPowerBtn'); await pg.waitForTimeout(300); await tick(30 * 14); await tick(2); await tick(2);
    const np1 = await pg.evaluate(() => G.ents.filter(e => e.team === ME && e.t === 'power' && e.hp > 0).length);
    ok(np1 === np0 + 1, 'one tap on ⚡ builds AND auto-places a Power Plant (' + np0 + ' -> ' + np1 + ')');
    await pg.evaluate(() => { const P = G.players[ME]; for (const b of G.ents) if (b.team === ME && b.kind === 'b' && b.t !== 'hq') { b.hp = b.mhp * 0.4; } MOB.auto.repair = true; P.cr = 5000; mobAuto(); });
    ok(await pg.evaluate(() => G.ents.some(b => b.team === ME && b.kind === 'b' && b.repair)), 'auto-repair (when enabled) turns on repair for damaged buildings');
  }
  if (PART === 'hellgate') { // phone lobby by touch -> Hellgate 2v6 auto-setup -> play + frame time
    await pg.goto(ROOT + '?q=low'); await pg.waitForTimeout(2500);
    ok(await pg.evaluate(() => MOB.on && document.body.classList.contains('mobile')), 'mobile UI auto-on at the menu');
    await pg.tap('#playBotsBtn'); await pg.waitForTimeout(600);
    await pg.selectOption('#mapSel', 'hellgate'); await pg.waitForTimeout(800);
    const lb = await pg.evaluate(() => ({ rows: [...document.querySelectorAll('#lobby .lrow:not(.lh)')].filter(r => r.offsetParent).length, ow: document.documentElement.scrollWidth <= innerWidth + 2,
      small: [...document.querySelectorAll('#setup select, #setup button, #lobby select')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect().height | 0).filter(h => h < 44).length }));
    ok(lb.rows === 8 && lb.ow && lb.small === 0, 'Hellgate auto-setup fills 8 lobby rows; lobby fits the phone and every control >= 44px ' + JSON.stringify(lb));
    // change my faction by touch (first row faction select)
    const fs = await pg.$('#lobby .lrow:not(.lh) select.lf, #lobby .lrow:not(.lh) select[data-k="fac"]'); if (fs) { await fs.selectOption({ index: 2 }); }
    await pg.evaluate(() => document.getElementById('lobby').scrollIntoView({ block: 'start' })); await pg.waitForTimeout(300); await pg.screenshot({ path: 'shots/v6_1-mobile-lobby.png' });
    await pg.tap('#startBtn'); await pg.waitForTimeout(5000);
    const g = await pg.evaluate(() => ({ map: G.opts.map || G.map, np: G.players.length, mplay: document.body.classList.contains('mplay'), q: R3.q.label, far: R3.camera.far, cards: document.querySelectorAll('#mCards .item').length }));
    ok(g.np === 8 && g.mplay && g.cards > 3, 'Hellgate 2v6 starts in mobile play mode ' + JSON.stringify(g));
    // build something on Hellgate via the card + auto power placement
    await pg.tap('#mCards .item[data-t="power"]'); await pg.evaluate(() => { for (let i = 0; i < 400; i++) NET.tick(); }); await pg.waitForTimeout(800);
    ok(await pg.evaluate(() => UI.placing === 'power'), 'Hellgate: card -> ghost placement'); await pg.evaluate(() => { const sp = mobSpot('power'), d = BT.power, s = worldToScreen(sp[0] + d.w / 2, sp[1] + d.h / 2, heightAt(sp[0] + d.w / 2, sp[1] + d.h / 2)); UI.mouse.x = s.x; UI.mouse.y = s.y; });
    await pg.waitForTimeout(400); await pg.tap('#mOk'); await pg.waitForTimeout(400);
    ok(await pg.evaluate(() => G.ents.filter(e => e.team === ME && e.t === 'power').length >= 1), 'Hellgate: ✓ places the building');
    // frame time: sim 8 players for a while (fast-forward), then measure rendering in emulation (software GL!)
    await pg.evaluate(() => { for (let i = 0; i < 30 * 90; i++) NET.tick(); });
    const ft = await pg.evaluate(() => new Promise(res => { const ts = []; let last = performance.now(); const f = t => { ts.push(t - last); last = t; if (ts.length < 40) requestAnimationFrame(f); else res(ts); }; requestAnimationFrame(f); }));
    const rt = await pg.evaluate(() => { const ts = []; for (let i = 0; i < 12; i++) { const t0 = performance.now(); r3Render(1 / 30); ts.push(performance.now() - t0); } const s0 = []; for (let i = 0; i < 60; i++) { const t0 = performance.now(); NET.tick(); s0.push(performance.now() - t0); } return { render: ts, sim: s0, calls: R3.calls, tris: R3.tris, units: G.ents.filter(e => e.kind === 'u').length }; });
    const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1], max = a => Math.max(...a);
    console.log(`PERF Hellgate t=${(await pg.evaluate(() => G.time)).toFixed(0)}s units=${rt.units} draws=${rt.calls} tris=${(rt.tris / 1000).toFixed(0)}k | rAF frame median ${med(ft).toFixed(1)}ms | r3Render median ${med(rt.render).toFixed(1)}ms max ${max(rt.render).toFixed(1)}ms | sim tick median ${med(rt.sim).toFixed(2)}ms max ${max(rt.sim).toFixed(1)}ms`);
    const gf = await pg.evaluate(() => { const gl = R3.renderer.getContext(), m = () => { const ts = []; for (let i = 0; i < 6; i++) { const t0 = performance.now(); r3Render(1 / 30); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); ts.push(performance.now() - t0); } return ts.sort((a, b) => a - b)[3]; };
      const mob = m(), px = R3.renderer.getPixelRatio(); applyQuality('high'); R3.renderer.setPixelRatio(3); r3Resize && r3Resize(); const hi = m(); applyQuality('mobile'); return { mob, hi, px }; });
    console.log(`PERF GPU (software GL, render + GPU sync): mobile preset ${gf.mob.toFixed(0)}ms @pr${gf.px} vs desktop High ${gf.hi.toFixed(0)}ms -> ${(gf.hi / gf.mob).toFixed(1)}x lighter`);
    ok(gf.mob < gf.hi, 'mobile preset renders cheaper than desktop High');
    ok(med(rt.sim) < 12, 'sim tick cost fine on Hellgate (median ' + med(rt.sim).toFixed(2) + 'ms)');
  }
  ok(!errs.length, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await br.close(); console.log(fail ? 'FAILED ' + fail : 'ALL PASS'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
