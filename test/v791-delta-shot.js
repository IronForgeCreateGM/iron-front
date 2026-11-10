// v7.9.1 Delta of Kings: in-game shots (overview, base, ford, islet bridge, King's Isle, phone) over a fake http origin.
// node test/v791-delta-shot.js <outDir>   env PHONE=0 skips the phone shot. Reports page errors, asset loads, draw calls/triangles.
const fs = require('fs'), path = require('path'), { chromium } = require('playwright-core');
const ROOT = process.env.ROOTDIR || path.join(__dirname, '..'), OUT = process.argv[2] || '/workspace/shots791';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
fs.mkdirSync(OUT, { recursive: true });
async function run(br, phone) {
  const ctx = await br.newContext(phone ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1400, height: 900 } });
  const pg = await ctx.newPage(), errs = [], fails = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('response', r => { if (r.status() >= 400) fails.push(r.status() + ' ' + r.url()); });
  await pg.route('http://iron.test/**', r => { const u = new URL(r.request().url()); let p = decodeURIComponent(u.pathname.replace('/iron-front/', '/')); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: 'nf' }); r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); });
  if (phone) { await pg.goto('http://iron.test/iron-front/'); await pg.evaluate(() => localStorage.setItem('ifMobile', '1')); }
  await pg.goto('http://iron.test/iron-front/' + (phone ? '' : '?q=' + (process.env.SHOTQ || 'high'))); await pg.waitForTimeout(2000);
  await pg.evaluate(() => { const L = [['human', 'A', 'usa']]; for (let i = 1; i < 8; i++) L.push(['easy', 'ABCDEFGH'[i], ['rus', 'usa', 'ger', 'chn', 'fra', 'jpn', 'irn'][i % 7]]);
    startGame('normal', { seed: 7, map: 'deltakings', fog: false, slots: buildSlots(L, null, 'deltakings') }); G.opts.fog = false; });
  await pg.waitForTimeout(4000);
  const spots = await pg.evaluate(() => { const P = G.players[ME], [sx, sy] = G.starts[P.start], M = MW / 2;
    const ford = []; for (let i = 0; i < MW * MH; i++) if (G.ford[i] && (i % MW) < M && ((i / MW) | 0) < M) ford.push([(i % MW) + 0.5, ((i / MW) | 0) + 0.5]);
    const fx = ford.reduce((s, p) => s + p[0], 0) / ford.length, fy = ford.reduce((s, p) => s + p[1], 0) / ford.length;
    window.__dbg = { me: ME, start: P.start, sx, sy, ford: [fx | 0, fy | 0], hq: G.ents.filter(e => e.t === 'hq').map(e => [e.team, e.x | 0, e.y | 0]).slice(0, 3) };
    return [{ n: 'overview', x: M, y: M, d: 60, D: 330 }, { n: 'base', x: sx + 4, y: sy + 8, d: 40 }, { n: 'ford', x: fx, y: fy + 2, d: 26 }, { n: 'islet', x: M - 65.5, y: M - 65.5 + 3, d: 28 }, { n: 'kings', x: M, y: M + 4, d: 44 }]; });
  const res = [];
  for (const s of phone ? spots.slice(1, 2) : spots) {
    await pg.evaluate(s => { window.__D = s.D || 0; if (!window.__wrapped) { window.__wrapped = 1; const o = updCamera, dn = dayNight; // full-map overview: test-only camera beyond the player zoom limit
      updCamera = function (dt) { o(dt); const D = window.__D; if (!D) return; const c = R3.cam, p = 1.22; R3.camera.near = 5; R3.camera.far = D * 3 + 200; R3.camera.updateProjectionMatrix();
        R3.camera.position.set(c.x, D * Math.sin(p), c.y + D * Math.cos(p)); R3.camera.lookAt(c.x, 0, c.y); R3.camera.updateMatrixWorld(); R3.scene.fog.density = 0.0009; };
      dayNight = function (dt) { dn(dt); if (window.__D) R3.scene.fog.density = 0.0009; }; }
    G.spectate = !!s.spec; R3.cam.td = R3.cam.d = s.d; jumpTo(s.x, s.y, true); paused = false; R3.time = Math.floor(R3.time / 8) * 8 + 8.35; }, s);
    await pg.waitForTimeout(2600); await pg.evaluate(() => { paused = true; });
    const f = path.join(OUT, 'delta-' + s.n + (phone ? '-phone' : '') + '.png'); await pg.screenshot({ path: f, timeout: 180000 }); res.push(f);
  }
  const info = await pg.evaluate(() => ({ dbg: window.__dbg, q: R3.qName, tex: TEX.st, props: Object.entries(PROPS.cache).map(([k, v]) => k + ':' + v.st).join(','), water: !!R3.water, calls: R3.calls, tris: R3.tris, fps: R3.fps | 0, terrTris: R3.terrain.geometry.index.count / 3 }));
  console.log(phone ? '[phone]' : '[desktop]', 'pageErrors', errs.length, errs.slice(0, 3).join(' | '), 'httpFails', fails.length, fails.slice(0, 3).join(' | '), JSON.stringify(info), res.join(' '));
  await ctx.close(); return errs.length;
}
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--ignore-gpu-blocklist'] });
  let bad = await run(br, false); if (process.env.PHONE !== '0') bad += await run(br, true);
  console.log('TOTAL pageErrors', bad); await br.close(); process.exit(bad ? 1 : 0);
})();
