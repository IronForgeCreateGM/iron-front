// v7.9.24 App Store app: no web-only bits that break or confuse inside the app's WKWebView (guideline 2.1/4.0 polish).
// Checks, with a Capacitor native stub vs the plain web page:
//  - invite / Copy link from the app use the public https game URL (the app page is capacitor://localhost/, useless to a friend);
//    the web version keeps its own origin;
//  - no "Add to Home Screen" tip and no full-screen button in the app (it is already full screen); web iPhone Safari keeps the tip;
//  - Save replay in the app goes to the share sheet (navigator.share with a .json file) or, without Web Share, says it is kept on
//    the device (a WKWebView ignores <a download>); the web version still downloads the file;
//  - online error box says "Restart" in the app ("Reload page" on the web); Settings says sound is made "on your device".
// Starts its own http server. NODE_PATH=<playwright-core node_modules> node test/appweb-test.js
const { chromium } = require('playwright-core'), path = require('path'), fs = require('fs'), { spawn } = require('child_process');
const root = path.resolve(__dirname, '..'), PORT = 8640 + Math.floor(Math.random() * 50), B = `http://127.0.0.1:${PORT}/`;
const WEB = 'https://ironforgecreategm.github.io/iron-front/';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
(async () => {
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  const on = fs.readFileSync(path.join(root, 'js/online.js'), 'utf8');
  ok(!/location\.origin\s*\+\s*location\.pathname\s*\+\s*'\?room='/.test(on), 'js/online.js: no invite link built from location (would be capacitor://localhost in the app)');
  ok(!/synthesised in the browser/.test(fs.readFileSync(path.join(root, 'index.html'), 'utf8')), 'index.html: Settings no longer says "in the browser"');
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1200));
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const CAP = `window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: {} };`;
  const SHARE = `window.__sh = []; navigator.canShare = o => !!(o && o.files && o.files.length); navigator.share = o => { window.__sh.push({ n: o.files[0].name, t: o.files[0].type, sz: o.files[0].size }); return Promise.resolve(); };`;
  const NOSHARE = `try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }); } catch (e) {}`;
  async function mk(init, opt) {
    const ctx = await br.newContext(Object.assign({ viewport: { width: 1280, height: 800 }, acceptDownloads: true }, opt || {}));
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    if (init) await pg.addInitScript(init);
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, rt => rt.fulfill({ status: 200, contentType: 'text/html', body: '<p>external</p>' }));
    await pg.goto(B + 'index.html?q=low&howto=0'); await pg.waitForTimeout(2600);
    return { ctx, pg, errs };
  }
  const fsState = pg => pg.evaluate(() => ({ tip: !!(document.getElementById('fsTip') && document.getElementById('fsTip').style.display === 'block'), btns: [...document.querySelectorAll('.fsBtn')].map(b => getComputedStyle(b).display) }));
  // 1) app on iPhone
  { const { ctx, pg, errs } = await mk(CAP + SHARE, { viewport: { width: 874, height: 402 }, userAgent: IPHONE, hasTouch: true, isMobile: true });
    ok(await pg.evaluate(w => onlGameUrl() === w, WEB), 'app: invite base is the public game ' + await pg.evaluate(() => onlGameUrl()));
    const cl = await pg.evaluate(async () => { let got = ''; const o = navigator.clipboard; Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { got = t; return Promise.resolve(); } }, configurable: true });
      ONL.invite = ''; ONL.code = 'ABCDE'; document.getElementById('copyLinkBtn').click(); await new Promise(r => setTimeout(r, 50)); return got; });
    ok(cl === WEB + '?room=ABCDE', 'app: Copy link copies ' + cl);
    const st = await fsState(pg); ok(!st.tip && st.btns.length && st.btns.every(d => d === 'none'), 'app iPhone: no Add-to-Home-Screen tip, full-screen buttons hidden ' + JSON.stringify(st));
    await pg.evaluate(() => FS.toggle()); await pg.waitForTimeout(200); ok(!(await fsState(pg)).tip, 'app: FS.toggle() never shows the home-screen tip');
    const r = await pg.evaluate(() => dlReplay('{"game":"ironfront"}', 'ironfront-replay-x.json')); await pg.waitForTimeout(200);
    const sh = await pg.evaluate(() => window.__sh);
    ok(r === 'share' && sh.length === 1 && sh[0].n === 'ironfront-replay-x.json' && sh[0].t === 'application/json' && sh[0].sz > 5, 'app: replay goes to the share sheet ' + JSON.stringify(sh));
    await pg.evaluate(() => onlError('test')); const rb = await pg.evaluate(() => document.getElementById('onReload') && document.getElementById('onReload').textContent);
    ok(/Restart/.test(rb || ''), 'app: online error button says ' + rb);
    const cred = await pg.evaluate(() => document.querySelector('#settings .credits, .credits') && document.querySelector('.credits').textContent);
    ok(/on your device/.test(cred || ''), 'Settings credits: sound made on your device');
    ok(!errs.length, 'app iPhone: 0 page errors ' + errs.join(' | ')); await ctx.close(); }
  // 2) app without Web Share (older WebKit): kept on device, no download attempted
  { const { ctx, pg, errs } = await mk(CAP + NOSHARE); let dl = 0; pg.on('download', () => dl++);
    const r = await pg.evaluate(() => dlReplay('{"game":"ironfront"}', 'r.json')); await pg.waitForTimeout(600);
    ok(r === 'kept' && dl === 0, `app without Web Share: replay kept on device (${r}, downloads ${dl})`);
    const st = await fsState(pg); ok(st.btns.every(d => d === 'none'), 'app iPad/Mac: full-screen buttons hidden ' + JSON.stringify(st.btns));
    ok(!errs.length, 'app (no share): 0 page errors ' + errs.join(' | ')); await ctx.close(); }
  // 3) web desktop: unchanged
  { const { ctx, pg, errs } = await mk(SHARE);
    ok(await pg.evaluate(b => onlGameUrl() === b + 'index.html', B), 'web: invite base stays the page itself ' + await pg.evaluate(() => onlGameUrl()));
    const dlP = pg.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    const r = await pg.evaluate(() => dlReplay('{"game":"ironfront"}', 'w.json')); const d = await dlP; const sh = await pg.evaluate(() => window.__sh);
    ok(r === 'download' && d && d.suggestedFilename() === 'w.json' && !sh.length, 'web: replay still downloads as a file (' + (d && d.suggestedFilename()) + ')');
    const st = await fsState(pg); ok(st.btns.some(d => d !== 'none'), 'web desktop: full-screen button shown ' + JSON.stringify(st.btns));
    await pg.evaluate(() => onlError('test')); ok(/Reload page/.test(await pg.evaluate(() => document.getElementById('onReload').textContent)), 'web: online error button says Reload page');
    ok(!errs.length, 'web: 0 page errors ' + errs.join(' | ')); await ctx.close(); }
  // 4) web iPhone Safari: home-screen tip still shown once
  { const { ctx, pg, errs } = await mk(null, { viewport: { width: 874, height: 402 }, userAgent: IPHONE, hasTouch: true, isMobile: true });
    ok((await fsState(pg)).tip, 'web iPhone Safari: Add-to-Home-Screen tip still shown');
    ok(!errs.length, 'web iPhone: 0 page errors ' + errs.join(' | ')); await ctx.close(); }
  await br.close(); srv.kill();
  console.log(fail ? `FAILED ${fail}` : 'ALL PASS'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
