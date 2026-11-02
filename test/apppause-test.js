// v7.7.3: inside the App Store app (Capacitor shell) an offline game pauses and mutes when the app goes to the background; a plain desktop browser keeps the old behaviour. NODE_PATH=/workspace/pwlib/node_modules node test/apppause-test.js [url]
const { chromium } = require('playwright-core'), path = require('path');
const URL0 = process.argv[2] || 'file://' + path.resolve(__dirname, '../index.html');
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  const hide = (pg, h) => pg.evaluate(h => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => h ? 'hidden' : 'visible' }); document.dispatchEvent(new Event('visibilitychange')); }, h);
  for (const app of [true, false]) {
    const ctx = await br.newContext({ viewport: { width: 1400, height: 900 } }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    if (app) await pg.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' }; });
    await pg.goto(URL0 + '?q=low&mobile=0'); await pg.waitForTimeout(2500);
    await pg.evaluate(() => { startGame('normal', { seed: 7, map: 'classic', fog: false, slots: buildSlots([['human', 'A', 'bra'], ['easy', 'B', 'rus']], null, 'classic') }); audioInit(); });
    await pg.waitForTimeout(2500);
    const before = await pg.evaluate(() => [paused, MOB.on, G.time]);
    await hide(pg, true); await pg.waitForTimeout(400);
    const hid = await pg.evaluate(() => [paused, AU.ctx ? AU.ctx.state : 'none']);
    await hide(pg, false); await pg.waitForTimeout(600);
    const back = await pg.evaluate(() => [paused, AU.ctx ? AU.ctx.state : 'none', mobIsApp()]);
    const tag = app ? 'app' : 'desktop browser';
    ok(!before[0] && !before[1] && before[2] > 0, tag + ': game running in desktop UI ' + JSON.stringify(before));
    if (app) { ok(hid[0] === true, 'app: backgrounding pauses the offline game ' + JSON.stringify(hid)); ok(hid[1] !== 'running', 'app: sound is muted while in the background'); ok(back[0] === true && back[2] === true, 'app: still paused on return (player resumes) ' + JSON.stringify(back)); }
    else { ok(hid[0] === false && back[0] === false && back[2] === false, 'desktop browser: unchanged, no auto-pause ' + JSON.stringify([hid, back])); }
    ok(!errs.length, tag + ': no page errors ' + errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  await br.close(); console.log(fail ? 'APPPAUSE FAIL' : 'APPPAUSE OK'); process.exit(fail ? 1 : 0);
})();
