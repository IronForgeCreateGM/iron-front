// v7.6.4: Iran Shahed drone visibility shot. Iran base, two batches of drones (own + enemy team) hovering next to tanks, normal RTS zoom.
// node test/v764-drone-shot.js out.png   env D=camera distance (default 30 = normal zoom), QS=extra query (e.g. &quiet=1)
const fs = require('fs'), path = require('path'), { chromium } = require('playwright-core');
const ROOT = process.env.ROOT || path.join(__dirname, '..'), OUT = process.argv[2] || '/workspace/iron-front-drone.png';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/json' };
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1400, height: 900 } }); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.route('http://iron.test/**', r => { const u = new URL(r.request().url()); let p = decodeURIComponent(u.pathname.replace('/iron-front/', '/')); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: 'nf' }); r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); });
  await pg.goto('http://iron.test/iron-front/?q=high' + (process.env.QS || '')); await pg.waitForTimeout(2500);
  await pg.evaluate(() => { startGame('normal', { seed: 5, map: 'classic', fog: false, slots: buildSlots([['human', 'A', 'irn'], ['easy', 'B', 'rus']]) }); G.opts.fog = false; });
  await pg.waitForTimeout(1500);
  if (process.env.QUIET) await pg.evaluate(() => toggleQuiet(true));
  await pg.evaluate(() => { const P = G.players.find(p => !p.ai), E = G.players.find(Q => Q !== P), h = G.ents.find(e => e.t === 'hq' && e.team === P.team);
    for (const t of ['power', 'factory', 'refinery']) { outer: for (let r = 4; r < 14; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) { const x = h.tx + dx, y = h.ty + dy; if (canPlace(t, P.team, x, y)) { addB(t, P.team, x, y, true, false); break outer; } } }
    const cx = h.x + 1, cy = h.y + 5.5; window.__c = { x: cx, y: cy };
    ['heavy', 'heavy', 'scout'].forEach((t, i) => { const u = spawnUnit(P.team, t, h); u.x = cx - 2 + i * 1.6; u.y = cy + 1.6; });
    spawnUnit(P.team, 'drone', h); spawnUnit(E.team, 'drone', h);
    G.ents.filter(e => e.t === 'drone').forEach((u, i) => { u.x = cx - 3.2 + (i % 3) * 1.4 + (i >= 3 ? 4.6 : 0); u.y = cy - 1 + (i % 2) * 0.8; u.z = 2.0; u.ang = 0.3; u.path = []; });
    paused = true; R3.cam.td = R3.cam.d = +(window.__D || 30); jumpTo(cx, cy - 7, true); }, null);
  if (process.env.D) await pg.evaluate(d => { R3.cam.td = R3.cam.d = d; jumpTo(__c.x, __c.y - d * 0.23, true); }, +process.env.D);
  await pg.waitForTimeout(6000);
  const info = await pg.evaluate(() => ({ glbDrone: GLB.st['u_drone'] || GLB.st['u_drone_lod1'] || 'none', drones: G.ents.filter(e => e.t === 'drone').length, d: R3.cam.d, lite: glbLod(), droneTris: (() => { const u = [...R3.uiMesh.entries()].find(([k]) => k.startsWith('drone|')); return u ? u[1].model.body.attributes.position.count / 3 : 0; })() }));
  await pg.screenshot({ path: OUT, timeout: 180000 });
  console.log(JSON.stringify(info), 'pageErrors:', errs.length, errs.slice(0, 3).join(' | '), 'shot:', OUT);
  await br.close();
})();
