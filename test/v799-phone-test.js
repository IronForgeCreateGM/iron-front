// v7.9.9 phone polish on the 224x224 maps: iPhone 14 landscape emulation (touch), each big map:
//  terrain triangles (built / drawn per frame), load time, pinch/drag/minimap-tap camera, no page errors.
//  NODE_PATH=... node test/v799-phone-test.js [repoDir] [shotDir]
const { chromium, devices } = require('playwright-core'), path = require('path'), fs = require('fs');
const ARG = process.argv[2] || path.join(__dirname, '..'), DIR = /^https?:/.test(ARG) ? ARG : path.resolve(ARG), SHOT = process.argv[3] || '';
const ROOT = /^https?:/.test(DIR) ? DIR.replace(/\/?$/, '/') + 'index.html' : 'file://' + path.join(DIR, 'index.html'), MAPS = (process.env.MAPS || 'shatteredmoon,deltakings,labyrinth,riftcanyon').split(',');
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  for (const map of MAPS) {
    const ctx = await br.newContext({ ...devices['iPhone 14 landscape'] }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    const T = (pts, type) => pg.evaluate(([pts, type]) => { const cv = document.getElementById('view'), ts = pts.map(([x, y], i) => new Touch({ identifier: i + 1, target: cv, clientX: x, clientY: y }));
      cv.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : ts, changedTouches: ts, bubbles: true, cancelable: true })); }, [pts, type]);
    const t0 = Date.now();
    await pg.goto(ROOT + '?map=' + map + '&slots=human:A:usa,hard:B,hard:C,hard:D,hard:E,hard:F,hard:G,hard:H&seed=5&peace=600');
    await pg.waitForFunction(() => typeof R3 !== 'undefined' && R3.terrain && typeof G !== 'undefined' && G.players, null, { timeout: 120000 }); const load = Date.now() - t0; await pg.waitForTimeout(1500);
    const info = await pg.evaluate(() => { let built = 0, meshes = 0; (R3.terrain.isMesh ? [R3.terrain] : R3.terrain.children).forEach(m => { meshes++; const g = m.geometry; built += (g.index ? g.index.count : g.attributes.position.count) / 3; });
      const drawn = d => { R3.cam.td = R3.cam.d = d; jumpTo(R3.cam.tx, R3.cam.ty, true); R3.renderer.info.reset(); r3Render(0.016); return R3.renderer.info.render.triangles; };
      const tx = R3.cam.tx, ty = R3.cam.ty, a = drawn(26), b = drawn(64); R3.cam.td = R3.cam.d = 26; jumpTo(tx, ty, true);
      return { mob: MOB.on, q: R3.q.label, MW, built: Math.round(built), meshes, drawn26: a, drawn64: b, far: R3.camera.far }; });
    console.log('info ' + map + ' load ' + load + 'ms ' + JSON.stringify(info));
    ok(info.mob && info.q === 'Mobile' && info.MW === 224, map + ': phone UI + Mobile preset on a 224 map');
    // pinch out then in
    const cam = () => pg.evaluate(() => ({ x: R3.cam.tx, y: R3.cam.ty, d: R3.cam.td }));
    const c0 = await cam(); await T([[380, 200], [460, 200]], 'touchstart'); for (let i = 1; i <= 8; i++) await T([[380 + i * 4, 200], [460 - i * 4, 200]], 'touchmove'); await T([], 'touchend');
    const c1 = await cam(); ok(c1.d > c0.d * 1.3, map + ': pinch zooms out ' + c0.d.toFixed(0) + ' -> ' + c1.d.toFixed(0));
    await T([[420, 220]], 'touchstart'); for (let i = 1; i <= 8; i++) await T([[420 - i * 15, 220 - i * 6]], 'touchmove'); await T([], 'touchend');
    const c2 = await cam(); ok(Math.hypot(c2.x - c1.x, c2.y - c1.y) > 2, map + ': one-finger drag pans');
    for (const [fx, fy] of [[0.2, 0.8], [0.8, 0.2], [0.5, 0.5]]) {
      const r = await pg.evaluate(([fx, fy]) => { const b = document.getElementById('minimap').getBoundingClientRect(); return [b.left + b.width * fx, b.top + b.height * fy, b.width, b.height]; }, [fx, fy]);
      await pg.touchscreen.tap(r[0], r[1]); await pg.waitForTimeout(250); const c = await cam();
      ok(Math.abs(c.x - 224 * fx) < 10 && Math.abs(c.y - 224 * fy) < 14, `${map}: minimap tap (${fx},${fy}) -> camera ${c.x.toFixed(0)},${c.y.toFixed(0)} (minimap ${r[2] | 0}x${r[3] | 0})`);
    }
    const mm = await pg.evaluate(() => { const b = document.getElementById('minimap').getBoundingClientRect(); return { w: b.width, h: b.height, inView: b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1 && b.left >= -1 && b.top >= -1 }; });
    ok(mm.inView && mm.w >= 90, map + ': minimap on screen and >= 90px ' + JSON.stringify(mm));
    const fps = await pg.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2500) requestAnimationFrame(f); else r(n / 2.5); }; requestAnimationFrame(f); }));
    console.log('info ' + map + ' emulated fps (software GL) ' + fps.toFixed(1));
    if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await pg.evaluate(() => { R3.cam.td = R3.cam.d = 30; }); await pg.waitForTimeout(800); await pg.screenshot({ path: path.join(SHOT, map + '.png') }); }
    ok(!errs.length, map + ': no page errors ' + errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  console.log(fail ? 'V799PHONE FAIL' : 'V799PHONE OK'); await br.close(); process.exit(fail ? 1 : 0);
})();
