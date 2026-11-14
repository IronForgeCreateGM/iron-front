// v7.9.6 SC2-style blueprint construction look (render only). node test/v796-con-test.js [shotDir]
// Two teams (USA + Russia) build a War Factory and a Barracks; checks: every non-wall site shows a blueprint hologram of the whole
// finished building, the hologram colour is the same for every team, a weld seam shows at the build line, the hologram is gone when
// the building is done, walls keep the cheap path, phone (mobile) quality skips the wireframe layer, and no page errors. Saves shots.
const fs = require('fs'), path = require('path'), { chromium } = require('playwright-core');
const ROOT = path.join(__dirname, '..'), OUT = process.argv[2] || path.join(ROOT, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let fail = 0; const ok = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined ? ' ' + JSON.stringify(x) : '')); if (!c) fail++; };
  const open = async (q, vp) => {
    const pg = await br.newPage({ viewport: vp || { width: 1400, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.route('http://iron.test/**', r => { const u = new URL(r.request().url()); let p = decodeURIComponent(u.pathname.replace('/iron-front/', '/')); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: 'nf' }); r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); });
    await pg.goto('http://iron.test/iron-front/?q=' + q); await pg.waitForTimeout(2500); return { pg, errs };
  };
  const setup = pg => pg.evaluate(() => {
    startGame('normal', { seed: 3, map: 'classic', fog: false, slots: buildSlots([['human', 'A', 'usa'], ['easy', 'B', 'rus']]) }); G.opts.fog = false; if (typeof DIR !== 'undefined') DIR.auto = false; paused = true;
    for (let i = 0; i < 60; i++) { stepGame(); G.events.length = 0; }
    for (const P of G.players) { P.cr = 50000; const h = G.ents.find(e => e.t === 'hq' && e.team === P.team);
      const spot = (t, sk) => { let n = 0; for (let r = 4; r < 30; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) { const x = h.tx + dx, y = h.ty + dy; if (x > 11 && y > 11 && x < MW - 11 && y < MH - 11 && !buildWhy(P.team, t, x, y) && n++ >= sk) return [x, y]; } return null; };
      for (const t of ['power', 'barracks', 'refinery']) { const s = spot(t, 1); if (!s) continue; execCmd(P.team, { c: 'build', t, x: s[0], y: s[1] }); for (let i = 0; i < 30 * 40; i++) { stepGame(); G.events.length = 0; if (!G.ents.some(e => e.con && e.team === P.team)) break; } } }
    for (const P of G.players) { const h = G.ents.find(e => e.t === 'hq' && e.team === P.team);
      const spot = (t, sk) => { let n = 0; for (let r = 4; r < 30; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) { const x = h.tx + dx, y = h.ty + dy; if (x > 11 && y > 11 && x < MW - 11 && y < MH - 11 && !buildWhy(P.team, t, x, y) && n++ >= sk) return [x, y]; } return null; };
      const mid = t => { const cx = h.tx + Math.sign(MW / 2 - h.tx) * 11, cy = h.ty + Math.sign(MH / 2 - h.ty) * 11; let best = null, bd = 1e9; for (let x = cx - 7; x <= cx + 7; x++) for (let y = cy - 7; y <= cy + 7; y++) if (!buildWhy(P.team, t, x, y)) { const d = Math.hypot(x - cx, y - cy); if (d < bd) { bd = d; best = [x, y]; } } return best || spot(t, 2); };
      for (const t of ['factory', 'wall']) { const s = t === 'factory' ? mid(t) : spot(t, 2); if (s) { execCmd(P.team, { c: 'build', t, x: s[0], y: s[1] }); for (let i = 0; i < 3; i++) { stepGame(); G.events.length = 0; } } } }
    return G.ents.filter(e => e.con).map(e => ({ id: e.id, t: e.t, team: e.team }));
  });
  const look = (pg, id) => pg.evaluate(id => { const e = G.ents.find(x => x.id === id); if (!e) return; R3.cam.td = R3.cam.d = 12; jumpTo(e.x + 1, e.y - 2.5, true); for (let i = 0; i < 4; i++) r3Render(0.05); }, id);
  const state = pg => pg.evaluate(() => G.ents.filter(e => e.kind === 'b' && (e.con || (R3.objs.get(e.id) || {}).cs)).map(e => { const o = R3.objs.get(e.id), cs = o && o.cs;
    return { id: e.id, t: e.t, team: e.team, p: e.con ? +e.con.p.toFixed(2) : 1, site: !!cs, holo: !!(cs && cs.holo), hv: !!(cs && cs.holo && cs.holo.visible), col: cs && cs.hm ? cs.hm.color.getHex() : null, wire: !!(cs && cs.hw), seam: !!(cs && cs.seam && cs.seam.visible) }; }));
  // view every site once so each gets its render-side construction site, then step until our factory reaches tg
  const visitAll = pg => pg.evaluate(() => { const cur = [R3.cam.x, R3.cam.y]; for (const e of G.ents.filter(e => e.con)) { jumpTo(e.x, e.y, true); for (let i = 0; i < 3; i++) r3Render(0.05); } });
  const run = (pg, tg) => pg.evaluate(tg => { for (let i = 0; i < 6000; i++) { const f = G.ents.find(e => e.t === 'factory' && e.team === 0); if (!f || !f.con || f.con.p >= tg) break; stepGame(); G.events.length = 0; if (i % 10 === 0) r3Render(0.05); } for (let i = 0; i < 20; i++) r3Render(0.05); }, tg);

  let { pg, errs } = await open('high');
  const sites = await setup(pg); ok(sites.filter(s => s.t === 'factory').length === 2, 'both teams placed War Factory sites', sites.map(s => s.t + s.team));
  const fac = sites.find(s => s.t === 'factory' && s.team === 0);
  await run(pg, 0.08); await visitAll(pg);
  let st = await state(pg); const ns = st.filter(s => s.t !== 'wall' && s.site);
  ok(ns.length >= 2 && ns.every(s => s.holo), 'every non-wall site shows a blueprint hologram of the finished building', ns.map(s => s.t + s.team + ':' + s.holo));
  ok(new Set(ns.map(s => s.col)).size === 1 && ns.some(s => s.team === 1), 'hologram looks the same for every team', ns.map(s => s.team + ':' + (s.col || 0).toString(16)));
  ok(st.filter(s => s.t === 'wall').every(s => !s.holo), 'walls keep the cheap construction path (no hologram)');
  ok(ns.every(s => s.wire), 'desktop quality: hologram has the wireframe layer');
  await look(pg, fac.id); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(OUT, 'v7_9_6-con-08.png'), timeout: 180000 });
  await run(pg, 0.45); await look(pg, fac.id); await pg.waitForTimeout(400); st = await state(pg);
  const f45 = st.find(s => s.id === fac.id); ok(f45 && f45.hv && f45.seam, 'mid-build: hologram above the build line and a weld seam at it', f45);
  await pg.screenshot({ path: path.join(OUT, 'v7_9_6-con-45.png'), timeout: 180000 });
  await run(pg, 0.7); await look(pg, fac.id); await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(OUT, 'v7_9_6-con-70.png'), timeout: 180000 });
  await run(pg, 1.01); await pg.evaluate(() => { for (let i = 0; i < 60; i++) { stepGame(); G.events.length = 0; r3Render(0.05); } }); st = await state(pg);
  ok(!st.find(s => s.id === fac.id), 'finished factory: site and hologram removed', st.find(s => s.id === fac.id));
  ok(errs.length === 0, 'desktop: no page errors', errs.slice(0, 2)); await pg.close();

  ({ pg, errs } = await open('mobile', { width: 844, height: 390 }));
  const s2 = await setup(pg); const f2 = s2.find(s => s.t === 'factory' && s.team === 0); await run(pg, 0.4); await look(pg, f2.id); st = await state(pg);
  const m = st.filter(s => s.t !== 'wall' && s.site); ok(m.length && m.every(s => s.holo && !s.wire), 'phone quality: hologram without the wireframe layer (cheap)', m.length);
  await pg.screenshot({ path: path.join(OUT, 'v7_9_6-con-phone.png'), timeout: 180000 });
  ok(errs.length === 0, 'phone: no page errors', errs.slice(0, 2)); await pg.close();
  await br.close(); console.log(fail ? 'V796CON FAIL ' + fail : 'V796CON OK'); process.exit(fail ? 1 : 0);
})();
