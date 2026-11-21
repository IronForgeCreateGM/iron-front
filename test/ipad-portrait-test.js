// v7.9.22 iPad portrait match HUD: iPad-sized portrait windows (and narrow split view) play with a portrait HUD instead of the rotate overlay;
// HUD pieces stay inside the window and don't overlap (idle, unit selected, placing); minimap tap moves the camera; iPhone portrait keeps the overlay.
// NODE_PATH=<playwright-core> node test/ipad-portrait-test.js [url]
const { chromium } = require('playwright-core'), path = require('path');
const URL0 = process.argv[2] || 'file://' + path.resolve(__dirname, '../index.html');
const sizes = [['820x1180', 820, 1180, 1], ['768x1024', 768, 1024, 1], ['1024x1366', 1024, 1366, 1], ['split-410x1180', 410, 1180, 1], ['split-590x820', 590, 820, 1], ['split-678x1032', 678, 1032, 1], ['iphone-402x874', 402, 874, 0], ['iphone-440x956', 440, 956, 0]];
const IDS = ['mTop', 'side', 'mCmd', 'mTabs', 'mCards', 'mSel', 'mAlerts', 'mCtx', 'mPlace'];
(async () => { const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] }); let bad = 0;
  for (const [nm, w, h, port] of sizes) {
    const ctx = await br.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true }), pg = await ctx.newPage(), errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(URL0 + '?q=low&howto=0&mobile=1'); await pg.waitForTimeout(1200); await pg.click('#playBotsBtn'); await pg.waitForTimeout(400); await pg.click('#startBtn'); await pg.waitForTimeout(4500);
    const rot = await pg.evaluate(() => getComputedStyle(document.getElementById('mRotate')).display);
    const fails = []; if (port ? rot !== 'none' : rot === 'none') fails.push('rotate overlay ' + rot);
    if (port) {
      const lay = st => pg.evaluate(([st, IDS]) => { const R = {}, out = [];
        for (const id of IDS) { const e = document.getElementById(id); if (!e || !e.offsetParent || getComputedStyle(e).display === 'none') continue; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue; R[id] = r;
          if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) out.push(st + ':' + id + ' outside ' + [r.left, r.top, r.right, r.bottom].map(Math.round)); }
        const k = Object.keys(R); for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) { const a = R[k[i]], b = R[k[j]]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push(st + ':' + k[i] + 'x' + k[j]); }
        return out; }, [st, IDS]);
      fails.push(...await lay('idle'));
      const cards = await pg.evaluate(() => { const c = document.getElementById('mCards'), its = [...c.querySelectorAll('.item')], r = c.getBoundingClientRect(); return { n: its.length, vis: its.filter(i => { const q = i.getBoundingClientRect(); return q.top >= r.top - 1 && q.bottom <= r.bottom + 1 && q.right <= r.right + 1; }).length }; });
      if (cards.vis < Math.min(cards.n, w >= 700 ? 8 : 4)) fails.push('cards visible ' + JSON.stringify(cards));
      await pg.tap('#mCmd .mc[data-k="army"]'); await pg.waitForTimeout(600); fails.push(...await lay('army'));
      await pg.evaluate(() => { const hq = G.ents.find(e => e.team === ME && e.kind === 'b'); setSel([hq]); }); await pg.waitForTimeout(600); fails.push(...await lay('hq'));
      await pg.evaluate(() => setSel([])); await pg.waitForTimeout(300);
      await pg.evaluate(() => { G.players[ME].cr += 5000; }); await pg.tap('#mCards .item[data-t="power"]'); await pg.evaluate(() => { for (let i = 0; i < 30 * 15; i++) NET.tick(); }); await pg.waitForTimeout(400);
      if (!(await pg.evaluate(() => UI.placing))) { await pg.tap('#mCards .item[data-t="power"]'); await pg.waitForTimeout(500); }
      const pl = await pg.evaluate(() => UI.placing); if (pl !== 'power') fails.push('card tap did not start placement: ' + pl); else { await pg.waitForTimeout(600); if (!(await pg.isVisible('#mOk'))) fails.push('placing: ✓ not visible'); fails.push(...await lay('placing')); }
      await pg.tap('#mNo').catch(() => {}); await pg.waitForTimeout(300);
      const c0 = await pg.evaluate(() => ({ x: R3.cam.tx, y: R3.cam.ty })), mm = await pg.evaluate(() => { const r = document.getElementById('minimap').getBoundingClientRect(); return [r.left + r.width * 0.85, r.top + r.height * 0.85]; });
      await pg.touchscreen.tap(mm[0], mm[1]); await pg.waitForTimeout(500); const c1 = await pg.evaluate(() => ({ x: R3.cam.tx, y: R3.cam.ty }));
      if (Math.hypot(c1.x - c0.x, c1.y - c0.y) < 5) fails.push('minimap tap did not move camera ' + JSON.stringify([c0, c1]));
    }
    if (errs.length) fails.push('errors: ' + errs.join('|'));
    console.log(fails.length ? 'FAIL' : 'PASS', nm, fails.join('; ')); if (fails.length) bad++; await ctx.close(); }
  await br.close(); console.log(bad ? 'IPAD-PORTRAIT FAILED' : 'IPAD-PORTRAIT OK'); process.exit(bad ? 1 : 0); })();
