// v7.9.19: "⚑ Report a player" from inside an online lobby keeps the lobby open in the App Store app (panel instead of leaving to support.html);
// the web version is unchanged (new tab). NODE_PATH=<playwright-core> node test/report-lobby-test.js  (starts its own http server)
const { chromium } = require('playwright-core'), path = require('path'), { spawn } = require('child_process');
const root = path.resolve(__dirname, '..'), PORT = 8760 + Math.floor(Math.random() * 30), B = `http://127.0.0.1:${PORT}/`;
(async () => {
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' }); await new Promise(r => setTimeout(r, 1200));
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const CAP = `window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: { Browser: { open: o => { (window.__bo = window.__bo || []).push(o.url); return Promise.resolve(); } } } };`;
  async function lobby(app, vp) {
    const ctx = await br.newContext({ viewport: vp || { width: 1280, height: 800 } }), pg = await ctx.newPage(), pops = [], errs = []; ctx.on('page', p => pops.push(p)); pg.on('pageerror', e => errs.push(e.message));
    if (app) await pg.addInitScript(CAP); await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, rt => rt.fulfill({ status: 200, contentType: 'text/html', body: '<p>external</p>' }));
    await pg.goto(B + 'index.html?q=low&howto=0&transport=local&home=online'); await pg.waitForTimeout(2000); await pg.click('#hostBtn'); await pg.waitForTimeout(1200);
    return { ctx, pg, pops, errs }; }
  { const { ctx, pg, pops, errs } = await lobby(true); const code = await pg.evaluate(() => ONL.code), url0 = pg.url();
    ok(!!code, 'app: hosting an online lobby, code ' + code);
    await pg.click('#chatReport'); await pg.waitForTimeout(500);
    const s = await pg.evaluate(() => { const b = document.getElementById('reportBox'); return { shown: !!b && getComputedStyle(b).display !== 'none', url: location.href, code: ONL.code, host: ONL.host, btns: b ? [...b.querySelectorAll('button')].map(x => Math.round(x.getBoundingClientRect().height)) : [] }; });
    ok(s.shown && s.url === url0 && s.code === code && s.host, 'app: Report opens a panel on top of the lobby, the page and the room stay as they were');
    ok(s.btns.length === 2 && s.btns.every(h => h >= 44), 'app: panel buttons are 44 px or taller ' + s.btns);
    await pg.click('#reportOpen'); await pg.waitForTimeout(400); const bo = await pg.evaluate(() => window.__bo || []);
    ok(bo.length === 1 && /^https:\/\/github\.com\/IronForgeCreateGM\/iron-front\/issues\/new\?title=Player%20report/.test(bo[0]) && bo[0].includes(encodeURIComponent('Room code: ' + code)), 'app: Open report form -> in-app browser sheet with the prefilled GitHub issue (room code included): ' + (bo[0] || '').slice(0, 90));
    ok(pg.url() === url0, 'app: still on the lobby page after opening the report form');
    await pg.click('#reportBack'); await pg.waitForTimeout(300); ok(await pg.evaluate(() => getComputedStyle(document.getElementById('reportBox')).display === 'none'), 'app: Back to lobby closes the panel');
    await pg.click('#chatReport'); await pg.waitForTimeout(300); ok(await pg.evaluate(() => getComputedStyle(document.getElementById('reportBox')).display !== 'none') && (await pg.$$('#reportBox')).length === 1, 'app: can be opened again (one panel only)');
    ok(!pops.length && !errs.length, 'app: no new windows, no page errors ' + errs.join('|')); await ctx.close(); }
  { const { ctx, pg, pops, errs } = await lobby(true, { width: 667, height: 375 }); await pg.click('#chatReport'); await pg.waitForTimeout(400);
    const r = await pg.evaluate(() => { const c = document.querySelector('#reportBox .rbCard').getBoundingClientRect(); return { top: Math.round(c.top), bottom: Math.round(c.bottom), h: innerHeight, btn: document.getElementById('reportBack').getBoundingClientRect().bottom }; });
    ok(r.top >= 0 && r.bottom <= r.h + 1, 'app, iPhone SE landscape: panel fits the screen ' + JSON.stringify(r)); await ctx.close(); }
  { const { ctx, pg, pops, errs } = await lobby(false); await pg.click('#chatReport'); await pg.waitForTimeout(1200);
    ok((await pg.$('#reportBox')) === null && pops.length === 1 && /support\.html#report/.test(pops[0].url()), 'web: unchanged, Report opens support.html#report in a new tab (' + pops.length + ' tab)'); await ctx.close(); }
  await br.close(); srv.kill(); console.log(fail ? 'REPORT-LOBBY FAILED' : 'REPORT-LOBBY OK'); process.exit(fail ? 1 : 0);
})();
