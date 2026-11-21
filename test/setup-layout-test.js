// v7.9.17/18: "Game vs bots" seat table must fit every device size (iPhone landscape used to squeeze it to 0-14 px).
// NODE_PATH=<playwright-core> node test/setup-layout-test.js [url]
const { chromium } = require('playwright-core'), path = require('path');
const URL0 = process.argv[2] || 'file://' + path.resolve(__dirname, '../index.html');
const sizes = [['iPhone 17 Pro landscape', 874, 402, 1], ['iPhone SE landscape', 667, 375, 1], ['iPhone portrait', 402, 874, 1], ['iPad portrait', 1032, 1376, 1], ['iPad landscape', 1376, 1032, 1], ['iPad split 1/2', 678, 1032, 1], ['iPad slide-over 1/3', 507, 1032, 1], ['Mac window', 1440, 900, 0], ['Mac 1280x720', 1280, 720, 0], ['Mac small window', 900, 600, 0]];
(async () => { const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let bad = 0;
  for (const [nm, w, h, touch] of sizes) {
    const ctx = await br.newContext(touch ? { viewport: { width: w, height: h }, hasTouch: true, isMobile: true } : { viewport: { width: w, height: h } }), pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(URL0 + '?howto=0&q=low&mobile=' + touch); await pg.waitForTimeout(1200); await pg.click('#playBotsBtn'); await pg.waitForTimeout(500);
    const m = await pg.evaluate(() => { const rw = s => [...document.querySelectorAll(s)].map(e => Math.round(e.getBoundingClientRect().width)); const lb = document.getElementById('lobby').getBoundingClientRect(); return { sel: rw('#lobby .lrow:nth-child(2) select'), hdr: rw('#lobby .lrow.lh span'), right: Math.round(lb.right), panelRight: Math.round(document.querySelector('#menu .panel').getBoundingClientRect().right), mapRight: Math.round(document.getElementById('mapSel').getBoundingClientRect().right), mapSel: Math.round(document.getElementById('mapSel').getBoundingClientRect().width), hs: document.documentElement.scrollWidth - innerWidth }; });
    const ok = m.sel.length === 4 && m.sel.every(x => x >= 56) && m.hdr.every(x => x >= 16) && m.right <= w + 1 && m.right <= m.panelRight + 1 && m.mapRight <= m.panelRight + 1 && m.hs <= 1 && m.mapSel >= 90 && !errs.length;
    console.log(ok ? 'PASS' : 'FAIL', nm, JSON.stringify(m), errs.join('|')); if (!ok) bad++; await ctx.close(); }
  await br.close(); console.log(bad ? 'SETUP-LAYOUT FAILED' : 'SETUP-LAYOUT OK'); process.exit(bad ? 1 : 0); })();
