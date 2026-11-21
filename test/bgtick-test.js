// v7.9.20: timers that keep running in a hidden tab (js/bgtick.js): the online lockstep keep-alive (main.js) and the relay heartbeat/keep-alive use IF_TICK.
// Chrome throttles a hidden tab's setInterval to 1/s (1/min after 5 min hidden); a Worker-driven timer is not throttled.
// NODE_PATH=<playwright-core> node test/bgtick-test.js  (starts its own http server)
const { chromium } = require('playwright-core'), path = require('path'), { spawn } = require('child_process');
const root = path.resolve(__dirname, '..'), PORT = 8790 + Math.floor(Math.random() * 9), B = `http://127.0.0.1:${PORT}/`;
(async () => {
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' }); await new Promise(r => setTimeout(r, 1200));
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-backgrounding-occluded-windows=false'] });
  const ctx = await br.newContext({ viewport: { width: 900, height: 600 } }), pg = await ctx.newPage(), errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(B + 'index.html?q=low&howto=0'); await pg.waitForTimeout(1500);
  const a = await pg.evaluate(async () => { const n = { f: 0, s: 0 }; const h = IF_TICK.every(() => n.f++, 100), h2 = IF_TICK.every(() => n.s++, 1000); await new Promise(r => setTimeout(r, 2300)); const m = IF_TICK.mode(), c = IF_TICK.count(); h.stop(); h2.stop(); const c2 = IF_TICK.count(); const f0 = n.f; await new Promise(r => setTimeout(r, 400)); return { n, m, c, c2, stopped: n.f === f0 }; });
  ok(a.m === 'worker', 'IF_TICK runs on a Worker: ' + a.m);
  ok(a.n.f >= 18 && a.n.f <= 25 && a.n.s >= 1 && a.n.s <= 3, 'fires on schedule: 100 ms x' + a.n.f + ' and 1 s x' + a.n.s + ' in 2.3 s');
  ok(a.c >= 2 && a.c2 === a.c - 2 && a.stopped, 'stop() removes the timer (' + a.c + ' -> ' + a.c2 + ')');
  const b = await pg.evaluate(() => { const t = []; return { mainLoop: typeof IF_TICK.every === 'function' }; });
  // hidden tab: put the game page behind a second one and compare a plain setInterval with IF_TICK
  const p2 = await ctx.newPage(); await p2.goto('about:blank'); await p2.bringToFront(); await pg.waitForTimeout(300);
  const vis = await pg.evaluate(() => document.visibilityState);
  const h = await pg.evaluate(async () => { const n = { plain: 0, tick: 0 }; const i = setInterval(() => n.plain++, 100), t = IF_TICK.every(() => n.tick++, 100); await new Promise(r => setTimeout(r, 4000)); clearInterval(i); t.stop(); return n; });
  console.log('info: page visibility while another tab is in front = ' + vis + '; counts in 4 s ' + JSON.stringify(h));
  if (vis === 'hidden') ok(h.tick >= 30 && h.tick > h.plain * 2, 'hidden tab: IF_TICK keeps ticking (' + h.tick + ') where setInterval is throttled (' + h.plain + ')');
  else ok(h.tick >= 30, 'tab not reported hidden by this headless Chrome; IF_TICK still ticks (' + h.tick + ')');
  await p2.close();
  // ?bgtick=0 -> setInterval fallback still ticks
  const pf = await ctx.newPage(); await pf.goto(B + 'index.html?q=low&howto=0&bgtick=0'); await pf.waitForTimeout(1200);
  const f = await pf.evaluate(async () => { let k = 0; const t = IF_TICK.every(() => k++, 100); await new Promise(r => setTimeout(r, 1500)); t.stop(); return { mode: IF_TICK.mode(), k }; });
  ok(f.mode === 'interval' && f.k >= 10, 'fallback without a Worker: setInterval pump (' + JSON.stringify(f) + ')');
  ok(!errs.length, 'no page errors ' + errs.join('|'));
  await br.close(); srv.kill(); console.log(fail ? 'BGTICK FAILED' : 'BGTICK OK'); process.exit(fail ? 1 : 0);
})();
