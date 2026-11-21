// v7.9.16: first-run "How to play" cards (js/howto.js). NODE_PATH=<playwright-core> node test/howto-test.js [url]
// Checks: shows once on a real first launch (under the title screen), skippable, remembered in localStorage, ?howto=0/1,
// hidden for automation/deep links, touch vs mouse wording, fits iPhone landscape/portrait + iPad + Mac with 44px buttons,
// keys don't leak into game hotkeys, re-open from the menu and pause screens, no network use, 0 page errors.
const { chromium } = require('playwright-core'), path = require('path');
const URL0 = process.argv[2] || 'file://' + path.resolve(__dirname, '../index.html');
const J = u => URL0 + (URL0.includes('?') ? '&' : '?') + u;
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  const errs = [], net = [];
  const mk = async (opt, human) => { const ctx = await br.newContext(opt); const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
    pg.on('request', r => { const u = r.url(); if (/^https?:/.test(u) && !/localhost|127\.0\.0\.1/.test(u)) net.push(u); });
    if (human) await pg.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); });
    return { ctx, pg }; };
  const st = pg => pg.evaluate(() => { const o = document.getElementById('howto'); const v = !!o && getComputedStyle(o).display !== 'none';
    return { vis: v, step: o ? +o.dataset.step : 0, h: v ? document.getElementById('howtoH').textContent : '', p: v ? document.getElementById('howtoP').textContent : '', seen: localStorage.getItem('ifHowtoSeen') }; });

  // 1) real first launch on a Mac-size window (webdriver hidden): title screen on top, cards under it, then on top after the tap
  { const { ctx, pg } = await mk({ viewport: { width: 1440, height: 900 } }, true);
    await pg.goto(URL0); await pg.waitForTimeout(2500);
    const z = await pg.evaluate(() => [getComputedStyle(document.getElementById('titleScreen')).display, +getComputedStyle(document.getElementById('titleScreen')).zIndex, +getComputedStyle(document.getElementById('howto')).zIndex]);
    let s = await st(pg); ok(z[0] === 'flex' && s.vis && z[1] > z[2], 'first launch: title screen shown with How to play waiting underneath ' + JSON.stringify(z));
    await pg.mouse.click(720, 450); await pg.waitForTimeout(900);
    s = await st(pg); ok(s.vis && s.step === 1 && /Build your base/.test(s.h), 'after TAP TO DEPLOY: card 1 "' + s.h + '"');
    ok(/Click a building/.test(s.p), 'mouse wording on a desktop window');
    const q0 = await pg.evaluate(() => !!UI.set.quiet); await pg.keyboard.press('m'); await pg.keyboard.press('ArrowRight');
    s = await st(pg); ok(s.step === 2 && (await pg.evaluate(() => !!UI.set.quiet)) === q0, 'arrow key moves to card 2, game hotkey M does not leak');
    await pg.click('#howtoNext'); await pg.click('#howtoNext'); s = await st(pg); ok(s.step === 4 && /Right-click/.test(s.p), 'card 4 mouse controls: ' + s.p.slice(0, 50));
    await pg.click('#howtoBack'); s = await st(pg); ok(s.step === 3, 'Back goes to card 3');
    await pg.click('#howtoNext'); await pg.click('#howtoNext'); s = await st(pg);
    const last = await pg.evaluate(() => [document.getElementById('howtoNext').textContent, getComputedStyle(document.getElementById('howtoSkip')).visibility]);
    ok(s.step === 5 && /Win/.test(s.h) && /let/.test(last[0]) && last[1] === 'hidden', 'card 5 "' + s.h + '" with "' + last[0] + '"');
    ok(s.seen !== '1', 'not marked seen before finishing');
    await pg.click('#howtoNext'); await pg.waitForTimeout(200); s = await st(pg); ok(!s.vis && s.seen === '1', 'finish closes and remembers (ifHowtoSeen=1)');
    await pg.reload(); await pg.waitForTimeout(2500); await pg.mouse.click(720, 450); await pg.waitForTimeout(900);
    s = await st(pg); ok(!s.vis, 'second launch: not shown again');
    await pg.click('#homeBtns .howtoBtn'); await pg.waitForTimeout(200); s = await st(pg); ok(s.vis && s.step === 1, 're-open from ❓ How to play on the menu');
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(150); s = await st(pg); ok(!s.vis, 'Esc skips');
    const menuOk = await pg.evaluate(() => getComputedStyle(document.getElementById('menu')).display !== 'none'); ok(menuOk, 'menu still there after closing');
    await pg.click('#playBotsBtn'); await pg.waitForTimeout(400); ok(await pg.evaluate(() => getComputedStyle(document.getElementById('setup')).display !== 'none'), 'Play vs Bots works after the cards');
    await pg.evaluate(() => { startGame('normal', { seed: 5, map: 'classic', fog: false, slots: buildSlots([['human', 'A', 'usa'], ['easy', 'B', 'rus']], null, 'classic') }); });
    await pg.waitForTimeout(1500); await pg.evaluate(() => { document.getElementById('pause').style.display = 'flex'; });
    await pg.click('#pause .howtoBtn'); await pg.waitForTimeout(200); s = await st(pg); ok(s.vis, 're-open from the pause screen');
    await pg.click('#howtoSkip'); s = await st(pg); ok(!s.vis, 'Skip closes'); await ctx.close(); }

  // 2) Skip on first launch also remembers; ?howto=0 never shows; automation / deep links don't auto-show
  { const { ctx, pg } = await mk({ viewport: { width: 1280, height: 800 } }, true);
    await pg.goto(URL0); await pg.waitForTimeout(2000); await pg.mouse.click(640, 400); await pg.waitForTimeout(800);
    await pg.click('#howtoSkip'); let s = await st(pg); ok(!s.vis && s.seen === '1', 'Skip on first launch remembers');
    await pg.evaluate(() => localStorage.removeItem('ifHowtoSeen')); await pg.goto(J('howto=0')); await pg.waitForTimeout(1500);
    s = await st(pg); ok(!s.vis, '?howto=0 never auto-shows'); await pg.goto(J('room=ABC')); await pg.waitForTimeout(1500); s = await st(pg); ok(!s.vis, 'deep link (?room=) does not auto-show'); await ctx.close(); }
  { const { ctx, pg } = await mk({ viewport: { width: 1280, height: 800 } }, false);
    await pg.goto(URL0); await pg.waitForTimeout(1500); const s = await st(pg); ok(!s.vis, 'automated runs (webdriver) do not auto-show'); await ctx.close(); }

  // 3) touch devices: iPhone landscape + portrait, iPad: touch wording, card inside the screen, 44px buttons, taps work
  for (const [nm, vp] of [['iPhone 16 landscape', { width: 874, height: 402 }], ['iPhone SE landscape', { width: 667, height: 375 }], ['iPhone portrait', { width: 402, height: 874 }], ['iPad 13 portrait', { width: 1032, height: 1376 }], ['iPad landscape', { width: 1376, height: 1032 }]]) {
    const { ctx, pg } = await mk({ viewport: vp, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await pg.goto(J('howto=1&mobile=1&q=low')); await pg.waitForTimeout(2000);
    let s = await st(pg); ok(s.vis && /Tap a card/.test(s.p), nm + ': shown with touch wording');
    const box = await pg.evaluate(() => { const r = document.querySelector('#howto .htCard').getBoundingClientRect(); const bs = [...document.querySelectorAll('#howto button')].filter(b => getComputedStyle(b).visibility !== 'hidden').map(b => b.getBoundingClientRect().height); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: innerWidth, h: innerHeight, minB: Math.min(...bs) }; });
    ok(box.l >= 0 && box.t >= 0 && box.r <= box.w && box.b <= box.h, nm + ': card fits on screen ' + JSON.stringify(box));
    ok(box.minB >= 44, nm + ': buttons are at least 44pt tall (' + box.minB + ')');
    for (let i = 0; i < 3; i++) await pg.tap('#howtoNext');
    s = await st(pg); ok(s.step === 4 && /Tap a unit/.test(s.p), nm + ': card 4 touch controls');
    await pg.tap('#howtoNext'); await pg.tap('#howtoNext'); await pg.waitForTimeout(150); s = await st(pg); ok(!s.vis && s.seen === '1', nm + ': finish by tapping'); await ctx.close();
  }
  ok(net.length === 0, 'no outside network requests (works offline) ' + net.slice(0, 3).join(' '));
  ok(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
  console.log(fail ? 'HOWTO FAIL ' + fail : 'HOWTO ALL PASS'); await br.close(); process.exit(fail ? 1 : 0);
})();
