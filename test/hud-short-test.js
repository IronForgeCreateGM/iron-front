// v7.9.21: desktop/Mac in-match HUD in short windows: the side bar's build grid keeps room (it was one clipped row at 600-720 px high),
// the controls hint stays above the bottom bar tabs, the minimap stays inside the side bar. NODE_PATH=<playwright-core> node test/hud-short-test.js [url]
const { chromium } = require('playwright-core'), path = require('path');
const URL0 = process.argv[2] || 'file://' + path.resolve(__dirname, '../index.html');
const sizes = [['1440x900', 1440, 900, 150], ['1280x720', 1280, 720, 150], ['1100x700', 1100, 700, 150], ['900x600', 900, 600, 100]];
(async () => { const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] }); let bad = 0;
  for (const [nm, w, h, minGrid] of sizes) {
    const ctx = await br.newContext({ viewport: { width: w, height: h } }), pg = await ctx.newPage(), errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(URL0 + '?q=low&howto=0&mobile=0'); await pg.waitForTimeout(1200); await pg.click('#playBotsBtn'); await pg.waitForTimeout(400); await pg.click('#startBtn'); await pg.waitForTimeout(5000);
    const m = await pg.evaluate(() => { const r = id => { const e = document.getElementById(id); return e ? e.getBoundingClientRect() : null; }, g = r('grid'), mm = r('minimap'), s = r('side'), hint = r('hint'), bt = r('btabs'), cx = r('ctx');
      return { grid: Math.round(g.height), mmW: Math.round(mm.width), mmInSide: mm.left >= s.left && mm.right <= s.right + 1, hintBottom: Math.round(hint.bottom), tabsTop: Math.round(bt.top), sideBottom: Math.round(s.bottom), ctxBottom: Math.round(cx.bottom), vh: innerHeight }; });
    const ok = m.grid >= minGrid && m.mmInSide && m.hintBottom <= m.tabsTop + 1 && m.ctxBottom <= m.vh && !errs.length;
    console.log(ok ? 'PASS' : 'FAIL', nm, JSON.stringify(m), errs.join('|')); if (!ok) bad++; await ctx.close(); }
  await br.close(); console.log(bad ? 'HUD-SHORT FAILED' : 'HUD-SHORT OK'); process.exit(bad ? 1 : 0); })();
