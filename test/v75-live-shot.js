// v7.5.0 (from v74-live-shot): load the game over a fake http origin under /iron-front/ (like GitHub Pages), start a skirmish,
// build a base with glb buildings + vehicles + aircraft, check models loaded, 0 page errors, screenshot.
// node test/v74-live-shot.js [out.png]   env BASE=https://... to load a real URL instead
const fs = require('fs'), path = require('path'), { chromium } = require('playwright-core');
const ROOT = path.join(__dirname, '..'), OUT = process.argv[2] || '/workspace/iron-front-v7.5.0-live.png';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.svg': 'image/svg+xml' };
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1400, height: 900 } }); const errs = [], warns = [], fails = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (/glb/i.test(m.text())) warns.push(m.text()); });
  pg.on('response', r => { if (r.status() >= 400) fails.push(r.status() + ' ' + r.url()); });
  let url = process.env.BASE;
  if (!url) { url = 'http://iron.test/iron-front/';
    await pg.route('http://iron.test/**', r => { const u = new URL(r.request().url()); let p = decodeURIComponent(u.pathname.replace('/iron-front/', '/')); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: 'nf' }); r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); }); }
  await pg.goto(url + '?q=high' + (process.env.QS || '')); await pg.waitForTimeout(2500);
  const ver = await pg.evaluate(() => (document.body.innerHTML.match(/v7\.[0-9.]+[0-9]/g) || []).filter((v, i, a) => a.indexOf(v) === i).join(','));
  await pg.evaluate(() => { startGame('normal', { seed: 5, map: 'classic', fog: false, slots: buildSlots([['human', 'A', 'usa'], ['easy', 'B', 'rus']]) }); G.opts.fog = false; });
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => { paused = true; const P = G.players.find(p => !p.ai), h = G.ents.find(e => e.t === 'hq' && e.team === P.team), E = G.players.find(Q => Q !== P);
    const bl = ['power', 'barracks', 'refinery', 'factory', 'tech', 'airfield', 'turret', 'aagun', 'tesla', 'silo']; let n = 0;
    for (const t of bl) { outer: for (let r = 4; r < 16; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) { const x = h.tx + dx, y = h.ty + dy; if (canPlace(t, P.team, x, y)) { addB(t, P.team, x, y, true, false); n++; break outer; } } }
    const gnd = ['heavy', 'tsar', 'arty', 'aa', 'scout', 'harv'], air = ['bomber', 'jet', 'intercept', 'stealth', 'drone', 'gunship', 'medevac'];
    gnd.forEach((t, i) => { const u = spawnUnit(P.team, t, h); u.x = h.x - 3 + i * 1.4; u.y = h.y + 3.2; });
    air.forEach((t, i) => { const u = spawnUnit(P.team, t, h); u.x = h.x - 4 + i * 1.5; u.y = h.y + 6.5; u.z = 2.6; });
    let sp = null; for (let k = 6; k < 30 && !sp; k++) for (const [dx, dy] of [[0, 1], [1, 1], [1, 0], [-1, 1], [0, -1], [1, -1], [-1, 0], [-1, -1]]) { const cx = h.x + dx * k, cy = h.y + dy * k; let ok = true;
      for (let yy = -4; yy <= 2 && ok; yy++) for (let xx = -4; xx <= 5 && ok; xx++) if (blk(cx + xx, cy + yy)) ok = false; if (ok) { sp = { x: cx, y: cy }; break; } }
    sp = sp || { x: h.x, y: h.y + 3 }; window.__sp = sp;
    ['rifle', 'rocketeer', 'engineer', 'sniper', 'kommando', 'marine'].forEach((t, k) => { const u = spawnUnit(P.team, t, h); u.x = sp.x - 2.2 + k * 0.62; u.y = sp.y; u.ang = u.tang = 0.35; });
    { const u = spawnUnit(P.team, 'titan', h); u.x = sp.x + 2.6; u.y = sp.y - 0.3; u.ang = u.tang = 0.5; }
    window.__h = h; window.__n = n; });
  const t0 = await pg.evaluate(() => { paused = false; window.__fr = 0; (function f() { window.__fr++; requestAnimationFrame(f); })(); return G.tick; }); await pg.waitForTimeout(8000);
  const run = await pg.evaluate(t0 => { const t1 = G.tick; const p0 = paused; for (let i = 0; i < 60; i++) stepGame(); paused = true; for (const u of G.ents) if (u.ang !== undefined && /^(rifle|rocketeer|engineer|sniper|kommando|marine|titan)$/.test(u.t)) { u.ang = u.tang = 0.4; } return { started, paused0: p0, loopTicks: t1 - t0, rafFramesIn8s: __fr, over: G.over }; }, t0);
  await pg.evaluate(() => { const ids = ['rifle', 'rocketeer', 'engineer', 'sniper', 'kommando', 'marine']; const P = G.players.find(p => !p.ai); let k = 0; for (const u of G.ents) if (u.team === P.team && ids.includes(u.t)) { u.x = __sp.x - 2.6 + k * 0.62; u.y = __sp.y + 0.4; u.ang = u.tang = 0.35; k++; } else if (u.team === P.team && u.t === 'titan') { u.x = __sp.x + 2.2; u.y = __sp.y - 0.4; u.ang = u.tang = 0.5; } R3.cam.td = R3.cam.d = +(window.__D || 8); jumpTo(__sp.x + 0.2, __sp.y - 2.4, true); }); await pg.waitForTimeout(3000);
  const info = await pg.evaluate(() => ({ on: GLB.on, st: Object.values(GLB.st).reduce((a, v) => (a[v] = (a[v] || 0) + 1, a), {}),
    ok: Object.keys(GLB.st).filter(k => GLB.st[k] === 'ok').sort().join(' '), placed: __n, spot: __sp, tick: G.tick }));
  info.run = run;
  await pg.screenshot({ path: OUT, timeout: 180000 });
  console.log('version on page:', ver); console.log('glb:', JSON.stringify(info)); console.log('glb warnings:', warns.length, warns.slice(0, 3).join(' | '));
  console.log('http failures:', fails.length, fails.slice(0, 5).join(' | ')); console.log('pageErrors:', errs.length, errs.slice(0, 3).join(' | ')); console.log('screenshot:', OUT);
  await br.close();
})();
