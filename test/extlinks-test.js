// v7.9.13 App Store: every target="_blank"/other-site link must work inside the app's WKWebView (which ignores _blank).
// Checks: in the app (Capacitor stub) every _blank link in index.html goes through IF_LINKS (Capacitor Browser for other sites,
// same window for privacy/support); without the Browser plugin other-site links fall back to the same window; links inside
// privacy/support also route; privacy.html and support.html have a visible "← Back to game" link that returns to a working game;
// the web version is unchanged (_blank still opens a new tab); no window.open() anywhere else in js/. Starts its own http server.
// NODE_PATH=/workspace/pwlib/node_modules node test/extlinks-test.js
const { chromium } = require('playwright-core'), path = require('path'), fs = require('fs'), { spawn } = require('child_process');
const root = path.resolve(__dirname, '..'), PORT = 8700 + Math.floor(Math.random() * 60), B = `http://127.0.0.1:${PORT}/`;
(async () => {
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  // static: no other window.open, every page with links loads the helper
  for (const f of fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js') && f !== 'extlinks.js')) ok(!/\bwindow\.open\s*\(/.test(fs.readFileSync(path.join(root, 'js', f), 'utf8')), `js/${f}: no window.open() (would do nothing in the app)`);
  for (const f of ['index.html', 'privacy.html', 'support.html']) ok(/<script src="js\/extlinks\.js[^"]*"><\/script>/.test(fs.readFileSync(path.join(root, f), 'utf8')), f + ' loads js/extlinks.js');
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1200));
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const CAP = browser => `window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: {} }; window.__bo = [];` + (browser ? `window.Capacitor.Plugins.Browser = { open: o => { window.__bo.push(o.url); try { sessionStorage.setItem('bo', JSON.stringify(window.__bo)); } catch (e) {} return Promise.resolve(); } };` : '');
  async function mk(init) {
    const ctx = await br.newContext({ viewport: { width: 1280, height: 800 } }); const pg = await ctx.newPage(); const errs = [], pops = [];
    pg.on('pageerror', e => errs.push(e.message)); ctx.on('page', p => pops.push(p));
    if (init) await pg.addInitScript(init);
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, rt => rt.fulfill({ status: 200, contentType: 'text/html', body: '<p>external</p>' }));
    return { ctx, pg, errs, pops };
  }
  const INV = 'https://ironforgecreategm.github.io/iron-front/?room=TEST1';
  const prep = pg => pg.evaluate(inv => { try { onlShowCode('TEST1', inv); } catch (e) {} }, INV);
  const blanks = pg => pg.evaluate(() => [...document.querySelectorAll('a[target="_blank" i]')].map((a, i) => ({ i, id: a.id, href: a.href })));
  // 1) app + Capacitor Browser plugin
  { const { ctx, pg, errs, pops } = await mk(CAP(true));
    await pg.goto(B + 'index.html?q=low'); await pg.waitForTimeout(2500); await prep(pg);
    const L = await blanks(pg); ok(L.length >= 4, 'index.html has the _blank links (privacy, support, report, invite): ' + L.length);
    for (const l of L) {
      if (pg.url().split('?')[0] !== B + 'index.html') { await pg.goto(B + 'index.html?q=low'); await pg.waitForTimeout(1500); await prep(pg); }
      const ext = !l.href.startsWith(B);
      await pg.evaluate(i => { window.__bo = []; document.querySelectorAll('a[target="_blank" i]')[i].click(); }, l.i); await pg.waitForTimeout(900);
      const u = pg.url();
      if (ext) { const bo = await pg.evaluate(() => window.__bo); ok(bo.length === 1 && bo[0] === l.href && u.startsWith(B + 'index.html'), `app+Browser: ${l.id || l.href} -> Capacitor Browser.open (${bo[0] || 'none'}), game page kept`); }
      else ok(u === l.href, `app+Browser: ${l.id || l.href} -> same window (${u})`);
    }
    ok(!pops.length, 'app: no new tabs/windows opened (' + pops.length + ')');
    for (const p of ['privacy.html', 'support.html']) {
      await pg.goto(B + p); await pg.waitForTimeout(500);
      const bk = await pg.evaluate(() => { const a = document.getElementById('backToGame'), r = a && a.getBoundingClientRect(), cs = a && getComputedStyle(a); return a ? { t: a.textContent, href: a.getAttribute('href'), y: r.top, h: r.height, vis: cs.display !== 'none' && cs.visibility !== 'hidden' } : null; });
      ok(bk && /Back to game/.test(bk.t) && bk.href === 'index.html' && bk.vis && bk.y >= 0 && bk.y < 120 && bk.h >= 20, `${p}: visible "← Back to game" at the top ${JSON.stringify(bk)}`);
      const ex = await pg.evaluate(() => { window.__bo = []; const a = [...document.querySelectorAll('a[href^="https://"]')][0]; a.click(); return a.href; }); await pg.waitForTimeout(500);
      const bo = await pg.evaluate(() => window.__bo); ok(bo[0] === ex && pg.url() === B + p, `${p}: other-site link opens in Capacitor Browser, page kept`);
      await pg.click('#backToGame'); await pg.waitForTimeout(2000);
      const back = await pg.evaluate(() => [location.pathname, typeof startGame === 'function', !!document.getElementById('titleScreen') || !!document.querySelector('.tsFoot')]);
      ok(back[0].endsWith('/index.html') && back[1], `${p}: Back to game returns to a working game ${JSON.stringify(back)}`);
    }
    ok(!errs.length, 'app+Browser: no page errors ' + errs.slice(0, 2).join(' | ')); await ctx.close(); }
  // 2) app without the Browser plugin: same-window fallback
  { const { ctx, pg, errs, pops } = await mk(CAP(false));
    await pg.goto(B + 'index.html?q=low'); await pg.waitForTimeout(2500); await prep(pg);
    await pg.evaluate(() => document.getElementById('onInviteA').click()); await pg.waitForTimeout(900);
    ok(pg.url() === INV && !pops.length, 'app, no Browser plugin: invite link opens in the same window (Capacitor hands other sites to Safari) ' + pg.url());
    await pg.goto(B + 'index.html?q=low'); await pg.waitForTimeout(1500);
    await pg.evaluate(() => document.getElementById('chatReport').click()); await pg.waitForTimeout(900);
    ok(pg.url() === B + 'support.html#report' && !pops.length, 'app, no Browser plugin: Report a player opens support.html#report in the same window ' + pg.url());
    await pg.click('#backToGame'); await pg.waitForTimeout(1500); ok(pg.url() === B + 'index.html', 'app, no Browser plugin: Back to game works ' + pg.url());
    ok(!errs.length, 'app, no Browser: no page errors ' + errs.slice(0, 2).join(' | ')); await ctx.close(); }
  // 3) web version unchanged
  { const { ctx, pg, errs, pops } = await mk(null);
    await pg.goto(B + 'index.html?q=low'); await pg.waitForTimeout(2500);
    const n = await pg.evaluate(() => { const a = [...document.querySelectorAll('a[target="_blank"]')].find(a => /privacy\.html$/.test(a.href)); a.click(); return IF_LINKS.opened.length; }); await pg.waitForTimeout(1200);
    ok(pops.length === 1 && n === 0 && pg.url().startsWith(B + 'index.html'), 'web: _blank privacy link still opens a new tab, helper not used (' + pops.length + ')');
    ok(!errs.length, 'web: no page errors ' + errs.slice(0, 2).join(' | ')); await ctx.close(); }
  await br.close(); srv.kill(); console.log(fail ? 'EXTLINKS FAIL' : 'EXTLINKS OK'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('EXTLINKS FAIL ' + e.stack); process.exit(1); });
