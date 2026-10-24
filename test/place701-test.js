// v7.0.1 touch placement regression (iPhone 14 landscape, simulated touches): card -> ghost, drag anywhere moves it smoothly
// (no first-touch jump, no jitter, no camera pan), lift = holds, pinch/2-finger pan keep it, tap moves it, ✓ places exactly
// what is shown, red ✓ never places, ✗ cancels, wall chains, build tabs return, desktop mouse placement unchanged.
//  NODE_PATH=/tmp/tb/node_modules node test/place701-test.js        (shots -> shots/v7_0_1-mobile-place-*.png)
const { chromium, devices } = require('playwright-core'), path = require('path');
const ROOT = 'file://' + path.resolve(__dirname, '../index.html');
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  const ctx = await br.newContext({ ...devices['iPhone 14 landscape'] }); const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => { console.log('PAGEERR ' + e.message); errs.push(e.message); });
  const T = (pts, type, ids) => pg.evaluate(([pts, type, ids]) => { const cv = document.getElementById('view'), ts = pts.map(([x, y], i) => new Touch({ identifier: ids ? ids[i] : i + 1, target: cv, clientX: x, clientY: y }));
    const all = type === 'touchend' ? [] : ts; cv.dispatchEvent(new TouchEvent(type, { touches: all, changedTouches: ts, bubbles: true, cancelable: true })); }, [pts, type, ids || null]);
  const frames = n => pg.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const pl = () => pg.evaluate(() => MOB.pl ? { tx: MOB.pl.tx, ty: MOB.pl.ty, vx: MOB.pl.vx, vy: MOB.pl.vy, ok: MOB.pl.ok, t: MOB.pl.t, cam: [R3.cam.tx, R3.cam.ty, R3.cam.td], placing: UI.placing, gv: !!(R3.ghost && R3.ghost.visible), bad: document.getElementById('mOk').classList.contains('bad') } : { placing: UI.placing, gv: !!(R3.ghost && R3.ghost.visible) });
  const ready = t => pg.evaluate(t => { const P = G.players[ME]; P.cr = 50000; P.ready[BT[t].cat] = t; }, t);
  const tileScr = (x, y) => pg.evaluate(([x, y]) => { const s = worldToScreen(x, y, heightAt(x, y)); return [s.x, s.y]; }, [x, y]);
  const shot = async n => { await frames(12); await pg.screenshot({ path: 'shots/v7_0_1-mobile-place-' + n + '.png' }); };

  await pg.goto(ROOT + '?slots=human:A:usa,easy:B&seed=7&peace=600'); await pg.waitForTimeout(3500);
  ok(await pg.evaluate(() => MOB.on && document.body.classList.contains('mplay')), 'iPhone landscape -> mobile play UI');
  await pg.evaluate(() => { const h = mobHome(); jumpTo(h.x + 3, h.y + 3, true); R3.cam.td = R3.cam.d = 26; }); await frames(10);
  // 1) card tap with a finished structure -> ghost appears on a green spot at once
  await ready('power'); await pg.tap('#mCards .item[data-t="power"]'); await frames(6);
  let s = await pl(); ok(s.placing === 'power' && s.t === 'power' && s.gv && await pg.isVisible('#mOk') && await pg.isVisible('#mNo'), 'card tap -> ghost + ✓/✗ shown ' + JSON.stringify(s));
  ok(s.ok && !s.bad, 'ghost starts on a valid (green) spot, ✓ green');
  ok(await pg.evaluate(() => { const h = document.getElementById('mPlHint'), r = h.getBoundingClientRect(); return h.offsetParent && /Drag anywhere/.test(h.textContent) && r.top > 0; }), 'placement hint sits above ✓/✗');
  ok(await pg.evaluate(() => { const L = MOB.pl, d = BT[L.t], s = worldToScreen(L.tx + d.w / 2, L.ty + d.h / 2, heightAt(L.tx + d.w / 2, L.ty + d.h / 2)), r = document.getElementById('mPlace').getBoundingClientRect(), h = document.getElementById('mPlHint').getBoundingClientRect(); const inR = q => s.x > q.left && s.x < q.right && s.y > q.top - 4 && s.y < q.bottom; return !inR(r) && !inR(h); }), 'starting ghost is not hidden under the ✓/✗ buttons or hint');
  await shot('ghost');
  // 2) first touch far from the ghost: no jump, no camera pan
  const g0 = s, start = [120, 150]; await T([start], 'touchstart'); await frames(2); s = await pl();
  ok(s.tx === g0.tx && s.ty === g0.ty, 'first touch (far from the ghost) does not move it');
  // tiny finger wobble (< tap slop) -> no jitter
  for (const d of [3, -4, 5, -2, 4]) await T([[start[0] + d, start[1] - d]], 'touchmove'); s = await pl();
  ok(s.tx === g0.tx && s.ty === g0.ty, 'finger wobble does not jitter the ghost');
  // 3) relative drag to the right: ghost follows step by step, monotonic, no jumps, camera still
  const track = []; for (let i = 1; i <= 24; i++) { await T([[start[0] + i * 7, start[1]]], 'touchmove'); const q = await pl(); track.push(q.tx); }
  s = await pl(); const steps = track.map((v, i) => v - (i ? track[i - 1] : g0.tx));
  ok(steps.every(d => d >= 0 && d <= 1) && s.tx > g0.tx + 2, 'drag moves the ghost smoothly, tile by tile ' + JSON.stringify(track));
  ok(Math.abs(s.ty - g0.ty) <= 0, 'horizontal drag keeps the row (no vertical jitter)');
  ok(Math.abs(s.cam[0] - g0.cam[0]) < 1e-6 && Math.abs(s.cam[1] - g0.cam[1]) < 1e-6, 'dragging the ghost does not pan the camera');
  // visual glide: drawn position eases toward the snapped tile and arrives
  ok(await pg.waitForFunction(() => Math.abs(MOB.pl.vx - MOB.pl.tx) < 0.02 && Math.abs(MOB.pl.vy - MOB.pl.ty) < 0.02, null, { timeout: 5000 }).then(() => true, () => false), 'drawn ghost glides onto its tile ' + JSON.stringify(await pl()));
  // back and forth over a tile edge: hysteresis -> no flicker
  const edge = []; for (let i = 0; i < 8; i++) { await T([[start[0] + 168 + (i % 2 ? 4 : -4), start[1]]], 'touchmove'); edge.push((await pl()).tx); }
  ok(new Set(edge).size <= 2 && edge.filter((v, i) => i && v !== edge[i - 1]).length <= 1, 'small back-and-forth on a tile edge does not flicker ' + JSON.stringify(edge));
  await T([[start[0] + 168, start[1]]], 'touchend'); const held = await pl(); await frames(25); s = await pl();
  ok(s.tx === held.tx && s.ty === held.ty && s.placing === 'power', 'ghost holds still after the finger lifts (nothing placed)');
  ok(await pg.evaluate(() => G.ents.filter(e => e.team === ME && e.t === 'power').length) === 0, 'no accidental placement from dragging');
  // 4) pinch zoom while placing: camera zooms, ghost stays on its tile; the leftover finger does not drag it
  const h0 = await pl(); await T([[300, 200], [500, 200]], 'touchstart', [11, 12]);
  for (let i = 1; i <= 6; i++) await T([[300 - i * 15, 200], [500 + i * 15, 200]], 'touchmove', [11, 12]);
  await T([[500 + 90, 200]], 'touchend', [12]); for (let i = 1; i <= 5; i++) await T([[210 + i * 20, 200]], 'touchmove', [11]); await T([[310, 200]], 'touchend', [11]);
  await frames(10); s = await pl(); ok(Math.abs(s.cam[2] - h0.cam[2]) > 2, 'pinch zooms the camera while placing (' + h0.cam[2].toFixed(1) + ' -> ' + s.cam[2].toFixed(1) + ')');
  ok(s.tx === h0.tx && s.ty === h0.ty, 'pinch + leftover finger leave the ghost on its tile');
  // two-finger pan: camera moves, ghost keeps its WORLD tile
  await T([[300, 200], [360, 200]], 'touchstart', [21, 22]); for (let i = 1; i <= 5; i++) await T([[300 - i * 12, 200 + i * 6], [360 - i * 12, 200 + i * 6]], 'touchmove', [21, 22]);
  await T([[240, 230], [300, 230]], 'touchend', [21, 22]); await frames(6); const p2 = await pl();
  ok(p2.tx === h0.tx && p2.ty === h0.ty && (Math.abs(p2.cam[0] - s.cam[0]) + Math.abs(p2.cam[1] - s.cam[1])) > 0.5, 'two-finger pan moves the view, ghost stays put');
  // dragging the ghost to the screen edge scrolls the view with it
  const e0 = await pl(); await T([[400, 150]], 'touchstart'); for (let i = 1; i <= 6; i++) await T([[400 + i * 56, 150]], 'touchmove'); await pg.waitForTimeout(1500); await T([[736, 150]], 'touchend'); const e1 = await pl();
  ok(e1.cam[0] > e0.cam[0] + 1 && e1.tx > e0.tx + 3 && Math.abs(e1.cam[1] - e0.cam[1]) < 0.01, 'dragging to the screen edge scrolls the view along with the ghost ' + JSON.stringify([e0.tx, e1.tx, e0.cam[0].toFixed(1), e1.cam[0].toFixed(1)]));
  await pg.evaluate(() => { const h = mobHome(); jumpTo(h.x + 3, h.y + 3, true); R3.cam.td = R3.cam.d = 26; }); await frames(10);
  // 5) invalid spot: drag onto the HQ -> red ✓, tapping it does not place
  const hq = await pg.evaluate(() => { const h = mobHome(); jumpTo(h.x + 2, h.y - 1, true); return [h.x, h.y]; }); await frames(6); const hs = await tileScr(hq[0], hq[1]);
  await T([[hs[0], hs[1]]], 'touchstart'); await T([[hs[0], hs[1]]], 'touchend'); await frames(4); s = await pl();
  ok(await pg.evaluate(() => /Blocked/.test(document.getElementById('mPlHint').textContent)), 'hint above ✓/✗ says the spot is blocked');
  ok(!s.ok && s.bad, 'tap on the HQ moves the ghost there; it turns red and ✓ is marked blocked');
  await shot('invalid');
  await pg.tap('#mOk'); await frames(4); s = await pl();
  ok(s.placing === 'power' && await pg.evaluate(() => G.ents.filter(e => e.team === ME && e.t === 'power').length) === 0, 'red ✓ does not place, placement stays open');
  // 6) tap a valid spot -> glide there -> ✓ places exactly the shown tile
  const sp = await pg.evaluate(() => mobSpot('power')); const ss = await tileScr(sp[0] + 1, sp[1] + 1);
  await T([ss], 'touchstart'); await T([ss], 'touchend'); const mid = await pl(); await pg.waitForFunction(() => MOB.pl.vx === MOB.pl.tx && MOB.pl.vy === MOB.pl.ty, null, { timeout: 5000 }).catch(() => {}); s = await pl();
  ok(s.ok && !s.bad, 'tap on open ground moves the ghost there (green) ' + JSON.stringify([s.tx, s.ty, sp]));
  ok(Math.abs(mid.vx - mid.tx) + Math.abs(mid.vy - mid.ty) > 0.01 || (mid.vx === mid.tx && mid.vy === mid.ty), 'ghost glides instead of teleporting');
  const at = [s.tx, s.ty]; await pg.tap('#mOk'); await frames(4);
  const placed = await pg.evaluate(() => G.ents.filter(e => e.team === ME && e.t === 'power').map(e => [e.tx, e.ty, e.x, e.y]));
  s = await pl(); ok(placed.length === 1 && s.placing === null && !s.gv, '✓ places the building and closes placement ' + JSON.stringify({ placed, at }));
  ok(await pg.evaluate(([x, y]) => G.ents.some(e => e.team === ME && e.t === 'power' && Math.abs(e.x - (x + BT.power.w / 2)) < 0.01 && Math.abs(e.y - (y + BT.power.h / 2)) < 0.01), at), 'building lands exactly where the ghost was shown');
  await shot('done');
  // v6.3.1 build tabs still there
  await frames(10); ok(await pg.evaluate(() => [...document.querySelectorAll('#mTabs .mtab')].filter(b => b.offsetParent).length) === 5 && await pg.isVisible('#mCards .item'), 'build tabs + cards back after placing');
  // 7) next structure reuses the last spot area; ✗ cancels cleanly
  await ready('barracks'); await pg.tap('#mCards .item[data-t="barracks"]'); await frames(6); s = await pl();
  ok(s.placing === 'barracks' && s.ok, 'next building starts on a green spot near the last one ' + JSON.stringify([s.tx, s.ty]));
  await pg.tap('#mNo'); await frames(4); s = await pl(); ok(s.placing === null && !s.gv && !(await pg.isVisible('#mPlace')), '✗ cancels placement, ghost gone');
  ok(await pg.evaluate(() => G.players[ME].ready.bld === 'barracks'), 'cancel keeps the finished structure ready (nothing lost)');
  // place it via card again + ✓ so walls are unlocked
  await pg.tap('#mCards .item[data-t="barracks"]'); await frames(6); await pg.tap('#mOk'); await frames(4);
  ok(await pg.evaluate(() => G.ents.some(e => e.team === ME && e.t === 'barracks')), 'card -> ✓ in one tap each places a Barracks');
  // 8) wall chain by touch drag
  await pg.evaluate(() => { const P = G.players[ME]; P.cr = 50000; MOB.tab = 'def'; mobCards(); }); await frames(4);
  const w0 = await pg.evaluate(() => G.ents.filter(e => e.t === 'wall' && e.team === ME).length);
  await pg.tap('#mCards .item[data-t="wall"]'); await frames(3);
  const wp = await pg.evaluate(() => { const h = mobHome(); for (let dy = 6; dy < 14; dy++) { let okRow = true; for (let x = -3; x <= 3; x++) if (!canPlace('wall', ME, Math.floor(h.x) + x, Math.floor(h.y) + dy)) okRow = false;
    if (okRow) { const a = worldToScreen(Math.floor(h.x) - 3 + 0.5, Math.floor(h.y) + dy + 0.5, 0), b = worldToScreen(Math.floor(h.x) + 3 + 0.5, Math.floor(h.y) + dy + 0.5, 0); return [a.x, a.y, b.x, b.y]; } } return null; });
  if (wp) { await T([[wp[0], wp[1]]], 'touchstart'); for (let i = 1; i <= 8; i++) await T([[wp[0] + (wp[2] - wp[0]) * i / 8, wp[1] + (wp[3] - wp[1]) * i / 8]], 'touchmove'); await frames(3); await shot('wall'); await T([[wp[2], wp[3]]], 'touchend'); }
  await pg.evaluate(() => { for (let i = 0; i < 3; i++) NET.tick(); }); const w1 = await pg.evaluate(() => G.ents.filter(e => e.t === 'wall' && e.team === ME).length);
  ok(wp && w1 >= w0 + 5, 'touch drag lays a wall chain (' + w0 + ' -> ' + w1 + ')');
  await pg.tap('#mNo'); await frames(3); ok(await pg.evaluate(() => !UI.mode && !UI.placing), '✗ leaves wall mode');
  // 9) defense auto-placement (turret finishes -> straight into placement) works with the new ghost
  await pg.evaluate(() => { MOB.tab = 'def'; mobCards(); const P = G.players[ME]; P.ready.def = 'turret'; UI.placing = 'turret'; }); await frames(6); s = await pl();
  ok(s.placing === 'turret' && s.t === 'turret' && s.gv, 'finished defense opens touch placement automatically');
  await pg.tap('#mOk'); await frames(4); ok(await pg.evaluate(() => G.ents.some(e => e.team === ME && e.t === 'turret')), 'defense placed with ✓');
  ok(!errs.length, 'no page errors (mobile)');
  await ctx.close();
  // 10) desktop mouse placement unchanged
  const dc = await br.newContext({ viewport: { width: 1280, height: 760 } }); const dp = await dc.newPage(); dp.on('pageerror', e => errs.push(e.message));
  await dp.goto(ROOT + '?slots=human:A:usa,easy:B&seed=7&peace=600'); await dp.waitForTimeout(3000);
  const dsp = await dp.evaluate(() => { const P = G.players[ME]; P.cr = 50000; P.ready.bld = 'power'; clickItem('power', false, false); const h = G.ents.find(e => e.team === ME && e.t === 'hq'); jumpTo(h.x + 3, h.y + 3, true); return MOB.on; });
  await dp.waitForTimeout(600);
  const tgt = await dp.evaluate(() => { const sp = mobSpot('power'), d = BT.power, s = worldToScreen(sp[0] + d.w / 2, sp[1] + d.h / 2, heightAt(sp[0] + d.w / 2, sp[1] + d.h / 2)), r = R3.renderer.domElement.getBoundingClientRect(); return [s.x + r.left, s.y + r.top]; });
  await dp.mouse.move(tgt[0], tgt[1], { steps: 4 }); await dp.waitForTimeout(200); await dp.mouse.down(); await dp.mouse.up(); await dp.waitForTimeout(300);
  ok(!dsp && await dp.evaluate(() => G.ents.some(e => e.team === ME && e.t === 'power') && !UI.placing), 'desktop: mouse click still places a building');
  ok(!errs.length, 'no page errors');
  await br.close(); console.log(fail ? 'FAILED ' + fail : 'PLACE701 OK'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
