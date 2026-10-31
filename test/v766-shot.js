// v7.6.6: load the game like GitHub Pages, run a 2-Hard (si2, m7 on) bot game 9 min in the browser, 0 page errors, screenshot.
// node test/v766-shot.js [out.png]   env BASE=https://... loads a real URL instead (live check)
const fs = require('fs'), path = require('path'), { chromium } = require('playwright-core');
const ROOT = path.join(__dirname, '..'), OUT = process.argv[2] || '/workspace/iron-front-v7.6.6.png';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.svg': 'image/svg+xml' };
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1400, height: 900 } }); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  let url = process.env.BASE;
  if (!url) { url = 'http://iron.test/iron-front/';
    await pg.route('http://iron.test/**', r => { const u = new URL(r.request().url()); let p = decodeURIComponent(u.pathname.replace('/iron-front/', '/')); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: 'nf' }); r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); }); }
  await pg.goto(url + '?q=high'); await pg.waitForTimeout(2500);
  const ver = await pg.evaluate(() => [NET_VERSION, (document.body.innerHTML.match(/v7\.[0-9.]+[0-9]/g) || [])[0]].join(' '));
  await pg.evaluate(() => { startGame('normal', { seed: 943231385, map: 'volcano8', peace: 180, fog: false, slots: buildSlots([['hard', 'A', 'usa'], ['hard', 'B', 'bra']]) }); paused = true; });
  const info = await pg.evaluate(() => { for (let i = 0; i < 30 * 60 * 9; i++) stepGame(); G.events.length = 0; paused = false;
    const P = G.players[0], h = G.ents.find(e => e.team === 1 && (e.t === 'hq' || e.t === 'cc')) || G.ents.find(e => e.team === 0 && e.t === 'hq');
    if (typeof camFocus === 'function') camFocus(h.x, h.y); else if (window.CAM) { CAM.x = h.x; CAM.y = h.y; }
    return { m7: G.m7, t: G.time | 0, diff: G.players.map(p => p.diff).join(','), u: G.ents.filter(e => e.kind === 'u').length }; });
  await pg.waitForTimeout(3000); await pg.screenshot({ path: OUT });
  console.log(`ver ${ver} ${JSON.stringify(info)} pageErrors=${errs.length}${errs.length ? ' ' + errs[0] : ''} -> ${OUT}`); await br.close(); })();
