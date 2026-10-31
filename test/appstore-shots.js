// App Store screenshots at Apple's required pixel sizes (6.9" iPhone landscape 2868x1320, 13" iPad landscape 2752x2064).
// node test/appstore-shots.js [outDir=/workspace/appstore-shots]   Loads the local repo like GitHub Pages, mobile/touch mode, 0 page errors expected.
const fs = require('fs'), path = require('path'), { chromium } = require('playwright-core');
const ROOT = path.join(__dirname, '..'), OUT = process.argv[2] || '/workspace/appstore-shots'; fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const DEV = [['iphone69', { width: 956, height: 440 }, 3], ['ipad13', { width: 1376, height: 1032 }, 2]];
const SCENES = [['title', null], ['battle', { seed: 943231385, map: 'volcano8', peace: 180, slots: [['hard', 'A', 'usa'], ['hard', 'B', 'bra']], min: 9 }], ['base', { seed: 61, map: 'classic', slots: [['hard', 'A', 'chn'], ['hard', 'B', 'usa']], min: 6, own: 1 }]];
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let bad = 0;
  for (const [dn, vp, sc] of DEV) for (const [sn, g] of SCENES) {
    const ctx = await br.newContext({ viewport: vp, deviceScaleFactor: sc, hasTouch: true, isMobile: true }); const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push(e.message));
    await pg.route('http://iron.test/**', r => { const u = new URL(r.request().url()); let p = decodeURIComponent(u.pathname.replace('/iron-front/', '/')); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: 'nf' }); r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); });
    await pg.goto('http://iron.test/iron-front/?q=high'); await pg.waitForTimeout(2500);
    if (g) await pg.evaluate(g => { startGame('normal', { seed: g.seed, map: g.map, peace: g.peace, fog: false, slots: buildSlots(g.slots) }); paused = true;
      for (let i = 0; i < 30 * 60 * g.min; i++) stepGame(); G.events.length = 0; paused = false;
      const h = g.own ? G.ents.find(e => e.team === 0 && e.t === 'hq') : (G.ents.find(e => e.team === 1 && (e.t === 'hq' || e.t === 'cc')) || G.ents.find(e => e.team === 0 && e.t === 'hq'));
      if (typeof camFocus === 'function') camFocus(h.x, h.y); }, g);
    await pg.waitForTimeout(3000); const f = path.join(OUT, `${dn}-${sn}.png`); await pg.screenshot({ path: f });
    console.log(`${dn} ${sn} ${vp.width * sc}x${vp.height * sc} pageErrors=${errs.length}${errs.length ? ' ' + errs[0] : ''} -> ${f}`); bad += errs.length; await ctx.close(); }
  await br.close(); console.log(bad ? 'APPSTORE SHOTS: PAGE ERRORS' : 'APPSTORE SHOTS OK'); process.exit(bad ? 1 : 0); })();
