// v7.6.2 map graphics: before/after shots of every map at normal RTS zoom (d=26) over a fake http origin (glb on),
// plus a phone (touch, Quiet/mobile preset) shot. Checks 0 page errors per map and reports terrain-asset load state.
// node test/v762-shot.js <outDir> [maps=classic,frost,...]   env PHONE=0 to skip the phone shot, SHOTQ=high
const fs = require('fs'), path = require('path'), { chromium } = require('playwright-core');
const ROOT = process.env.ROOTDIR || path.join(__dirname, '..'), OUT = process.argv[2] || '/workspace/shots762/x';
const MAPS = (process.argv[3] || 'classic,frost,volcano,volcano8,hellgate,endless').split(',');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
fs.mkdirSync(OUT, { recursive: true });
async function page(br, phone) {
  const ctx = await br.newContext(phone ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1400, height: 900 } });
  const pg = await ctx.newPage(); pg.errs = []; pg.fails = []; pg.warns = [];
  pg.on('pageerror', e => pg.errs.push(e.message)); pg.on('console', m => { if (/glb|terr|tex|props/i.test(m.text())) pg.warns.push(m.text()); });
  pg.on('response', r => { if (r.status() >= 400) pg.fails.push(r.status() + ' ' + r.url()); });
  await pg.route('http://iron.test/**', r => { const u = new URL(r.request().url()); let p = decodeURIComponent(u.pathname.replace('/iron-front/', '/')); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: 'nf' }); r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); });
  return pg;
}
async function shoot(br, map, phone) {
  const pg = await page(br, phone);
  if (phone) { await pg.goto('http://iron.test/iron-front/'); await pg.evaluate(() => { localStorage.setItem('ifMobile', '1'); }); }
  await pg.goto('http://iron.test/iron-front/' + (phone ? '' : '?q=' + (process.env.SHOTQ || 'high'))); await pg.waitForTimeout(2000);
  const n = map === 'volcano8' || map === 'hellgate' ? 8 : map === 'volcano' || map === 'frost' ? 6 : map === 'endless' ? 1 : 2;
  await pg.evaluate(([map, n]) => { const L = [['human', 'A', 'bra']]; for (let i = 1; i < n; i++) L.push(['easy', map === 'hellgate' ? (i < 2 ? 'A' : 'B') : i % 2 ? 'B' : 'A', ['rus', 'usa', 'ger', 'chn', 'fra', 'jpn', 'irn'][i % 7]]);
    startGame('normal', { seed: 7, map, fog: false, mode: map === 'endless' ? 'endless' : undefined, slots: buildSlots(L, null, map) }); G.opts.fog = false; }, [map, n]);
  await pg.waitForTimeout(2500);
  if (process.env.QUIET) { await pg.evaluate(() => toggleQuiet(true)); await pg.waitForTimeout(3000); } // mid-game switch: light ground + LOD1 props
  const spots = await pg.evaluate(() => { paused = true; const P = G.players[ME], h = G.ents.find(e => e.team === ME && (e.t === 'hq' || e.t === 'cc')) || { x: G.starts[P.start][0], y: G.starts[P.start][1] };
    const near = (mask, ox, oy) => { let b = null, bd = 1e9; for (let i = 0; i < MW * MH; i++) if (mask(i)) { const x = i % MW + 0.5, y = (i / MW | 0) + 0.5, d = Math.hypot(x - ox, y - oy); if (d < bd) { bd = d; b = { x, y }; } } return b; };
    const cx = MW / 2, cy = MH / 2, S = [{ n: 'base', x: h.x + 3, y: h.y + 2 }];
    const f = G.lava && G.lava.some(v => v) ? near(i => G.lava[i], h.x, h.y) : G.ice && G.ice.some(v => v) ? near(i => G.ice[i], cx, cy) : G.bridge && G.bridge.some(v => v) ? near(i => G.bridge[i], cx, cy) : near(i => G.map[i] === 2, h.x, h.y);
    if (f) S.push({ n: 'feature', x: f.x, y: f.y }); const o = near(i => G.oreMax[i] > 0 && Math.hypot(i % MW - h.x, (i / MW | 0) - h.y) > 9, h.x, h.y); if (o) S.push({ n: 'ore', x: o.x, y: o.y });
    S.push({ n: 'mid', x: cx, y: cy });
    // a few units of two teams so readability on the new ground can be judged
    const E = G.players.find(Q => Q.ally !== P.ally) || G.players[1] || P; window.__u = [];
    for (const s of S) { ['heavy', 'rifle', 'rifle', 'scout'].forEach((t, k) => { try { const u = spawnUnit(k % 2 ? P.team : E.team, t, h); u.x = s.x - 1.5 + k; u.y = s.y + 1.5; u.ang = u.tang = 0.6; } catch (e) {} }); }
    return S; });
  const res = [];
  for (const s of phone ? spots.slice(0, 1) : spots) {
    await pg.evaluate(s => { R3.cam.td = R3.cam.d = 26; jumpTo(s.x, s.y, true); paused = false; }, s); await pg.waitForTimeout(2500); await pg.evaluate(() => { paused = true; });
    const f = path.join(OUT, map + '-' + s.n + (phone ? '-phone' : '') + (process.env.QUIET ? '-quiet' : '') + '.png'); await pg.screenshot({ path: f, timeout: 180000 }); res.push(f);
  }
  const info = await pg.evaluate(() => ({ q: R3.qName, ter: typeof TEX !== 'undefined' ? TEX.st : 'n/a', props: typeof PROPS !== 'undefined' ? Object.entries(PROPS.cache).map(([k, v]) => k + ':' + v.st).join(',') : 'n/a', calls: R3.renderer.info.render.calls, tris: R3.renderer.info.render.triangles, top: (() => { const L = []; R3.scene.traverse(o => { if (!o.isMesh || !o.visible || !o.geometry) return; const g = o.geometry, t = (g.index ? g.index.count : g.attributes.position.count) / 3, n = o.isInstancedMesh ? o.count : 1; L.push([Math.round(t * n), Math.round(t), n, (o.material && o.material.type) || '']); }); return L.sort((a, b) => b[0] - a[0]).slice(0, 8).map(x => x.join('/')).join(' '); })() }));
  console.log(map + (phone ? ' [phone]' : '') + (process.env.QUIET ? ' [quiet]' : ''), 'pageErrors:', pg.errs.length, pg.errs.slice(0, 2).join(' | '), 'http fails:', pg.fails.length, pg.fails.slice(0, 3).join(' | '), JSON.stringify(info), pg.warns.slice(0, 3).join(' | '));
  await pg.context().close(); return pg.errs.length;
}
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--ignore-gpu-blocklist'] });
  let bad = 0; for (const m of MAPS) bad += await shoot(br, m, false);
  if (process.env.PHONE !== '0') { bad += await shoot(br, 'classic', true); bad += await shoot(br, 'volcano', true); }
  console.log('TOTAL pageErrors', bad); await br.close();
})();
