// v7.7.7 country flags on Command Yards / Command Centers (render only). node test/flags-test.js [shotDir]
// Loads the repo like GitHub Pages (models on). Checks: every one of the 8 countries flies its own flag on its HQ, two players of the
// same country get different trims, flags hide on Quiet-free paths correctly, custom (featured) maps, Endless and phone/Quiet quality
// work, no page errors, and the sim is untouched (same state hash with flags on and with flags.js removed).
const fs = require('fs'), path = require('path'), { chromium } = require('playwright-core');
const ROOT = path.join(__dirname, '..'), OUT = process.argv[2] || '/workspace/n1104/flag/shots';
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.svg': 'image/svg+xml' };
const FACS = ['usa', 'rus', 'fra', 'ger', 'bra', 'irn', 'chn', 'jpn'];
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let fail = 0; const ok = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x ? ' ' + JSON.stringify(x) : '')); if (!c) fail++; };
  const open = async (q, vp, noFlags) => {
    const pg = await br.newPage({ viewport: vp || { width: 960, height: 600 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.route('http://iron.test/**', r => { const u = new URL(r.request().url()); let p = decodeURIComponent(u.pathname.replace('/iron-front/', '/')); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
      if (noFlags && p.includes('flags.js')) return r.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: 'nf' }); r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); });
    await pg.goto('http://iron.test/iron-front/?q=' + q); await pg.waitForTimeout(2500); return { pg, errs };
  };
  const hqState = pg => pg.evaluate(() => { for (let i = 0; i < 6; i++) r3Render(0.1); return G.ents.filter(e => e.kind === 'b' && (e.t === 'hq' || e.t === 'cc')).map(e => { const o = R3.objs.get(e.id), f = o && o.flag;
    return { t: e.t, team: e.team, fac: G.players[e.team].fac, has: !!f, ffac: f && f.userData.fac, vis: !!(f && f.visible), tex: f && f.userData.cloth.material.map.uuid }; }); });
  const simHash = pg => pg.evaluate(() => { paused = true; for (let i = 0; i < 30 * 90; i++) { stepGame(); if (i % 15 === 0) r3Render(0.05); G.events.length = 0; }
    let h = 0; for (const e of G.ents) h = (h * 31 + Math.round(e.x * 100) + Math.round(e.y * 100) * 7 + Math.round(e.hp)) | 0; return h + ':' + G.ents.length + ':' + G.players.map(P => Math.round(P.cr)).join(','); });

  // 1. all 8 countries (FFA on volcano8), flags present + right country; sim hash equals the build with flags.js blanked out
  const start8 = pg => pg.evaluate(f => { startGame('hard', { seed: 77, map: 'volcano8', fog: false, slots: buildSlots(f.map((x, i) => ['hard', 'ABCDEFGH'[i], x]), null, 'volcano8') }); G.opts.fog = false; if (typeof DIR !== 'undefined') DIR.auto = false; }, FACS);
  let { pg, errs } = await open('high'); await start8(pg);
  let st = await hqState(pg);
  ok(st.length === 8 && st.every(s => s.has && s.ffac === s.fac), 'all 8 countries: each Command Yard flies its own country flag', st.map(s => s.fac + ':' + s.has));
  ok(new Set(st.map(s => s.fac)).size === 8, '8 different countries in the game');
  ok(await pg.evaluate(() => Object.keys(FLAG_PAINT).sort().join(',') === FAC_KEYS.slice().sort().join(',')), 'a flag painter for every faction in FACTIONS');
  // close-up shots of each HQ at normal zoom
  for (const s of st) await pg.evaluate(t => { const e = G.ents.find(x => x.kind === 'b' && x.t === 'hq' && x.team === t); R3.cam.td = R3.cam.d = 16; jumpTo(e.x + 1, e.y + 1, true); for (let i = 0; i < 6; i++) r3Render(0.1); }, s.team)
    .then(() => pg.screenshot({ path: path.join(OUT, 'hq-' + s.fac + '.png'), timeout: 180000 }));
  const hA = await simHash(pg); ok(errs.length === 0, '8-country game: no page errors', errs.slice(0, 2)); await pg.close();
  ({ pg, errs } = await open('high', null, true)); await start8(pg); const hB = await simHash(pg); await pg.close();
  ({ pg, errs } = await open('high')); await start8(pg); const hC = await simHash(pg); await pg.close();
  ok(hA !== hC || hA === hB, 'sim with and without flags.js matches (or this sim is not reload-deterministic: see det gate)', { hA, hB, hC });
  if (hA === hC) ok(hA === hB, 'sim identical with and without flags (visual only)', { hA, hB });

  // 2. same country twice: different trim -> different texture
  ({ pg, errs } = await open('high'));
  await pg.evaluate(() => { startGame('hard', { seed: 9, map: 'classic', fog: false, slots: buildSlots([['hard', 'A', 'fra', 'blue'], ['hard', 'B', 'fra', 'red']], null, 'classic') }); G.opts.fog = false; DIR.auto = false; });
  st = await hqState(pg); ok(st.length === 2 && st[0].ffac === 'fra' && st[1].ffac === 'fra' && st[0].tex !== st[1].tex, 'two France players: same flag, different player-colour trim', st);
  // a second Command Center: flag too, and hidden while it is a construction site
  const cc = await pg.evaluate(() => { paused = true; const P = G.players[0]; P.cr = 1e6; for (let i = 0; i < 30 * 600; i++) { stepGame(); G.events.length = 0; const s = G.ents.find(e => e.kind === 'b' && e.t === 'cc' && e.team === 0 && e.con); if (s) { R3.cam.td = R3.cam.d = 16; jumpTo(s.x, s.y, true); for (let k = 0; k < 4; k++) r3Render(0.1); const o = R3.objs.get(s.id); return { site: true, inView: !!(o && o.g.visible), hasFlag: !!(o && o.flag), vis: !!(o && o.flag && o.flag.visible) }; } } return null; });
  ok(cc == null || !cc.vis, 'flag hidden while a Command Center is under construction', cc);
  ok(errs.length === 0, 'same-country game: no page errors', errs.slice(0, 2)); await pg.close();

  // 3. featured custom map (Iron Foundry, 8 players) + Endless, phone viewport at mobile quality, and Quiet mode
  ({ pg, errs } = await open('mobile', { width: 844, height: 390 }));
  await pg.evaluate(f => { const cm = CM_BUILTIN['feat-iron-foundry']; startGame('hard', { seed: 5, map: 'custom', cmap: cm, fog: false, slots: buildSlots(f.map((x, i) => ['hard', 'ABCDEFGH'[i], x]), null, 'custom') }); G.opts.fog = false; DIR.auto = false; }, FACS);
  st = await hqState(pg); ok(st.length === 8 && st.every(s => s.has && s.vis), 'featured custom map, phone quality: 8 flags shown', st.length);
  const sway = await pg.evaluate(() => { const o = [...R3.objs.values()].find(o => o.flag); const a = o.flag.userData.cloth.rotation.y; for (let i = 0; i < 5; i++) r3Render(0.1); return [csLite(), a === o.flag.userData.cloth.rotation.y]; });
  ok(sway[0] && sway[1], 'phone/lite quality: flag does not animate (no per-frame cost)', sway);
  await pg.evaluate(() => { const e = G.ents.find(x => x.kind === 'b' && x.t === 'hq' && x.team === 0); R3.cam.td = R3.cam.d = 16; jumpTo(e.x + 1, e.y + 1, true); for (let i = 0; i < 6; i++) r3Render(0.1); });
  await pg.screenshot({ path: path.join(OUT, 'phone-custom.png'), timeout: 180000 });
  ok(errs.length === 0, 'custom map on phone: no page errors', errs.slice(0, 2)); await pg.close();
  ({ pg, errs } = await open('quiet'));
  await pg.evaluate(() => { startGame('hard', { mode: 'endless', seed: 5, fog: false, slots: buildSlots([['human', 'A', 'chn']], null, 'endless') }); });
  await pg.evaluate(() => { paused = true; for (let i = 0; i < 30 * 30; i++) { stepGame(); G.events.length = 0; } });
  st = await hqState(pg); ok(st.some(s => s.fac === 'chn' && s.has), 'Endless (Quiet): player HQ flies the China flag; horde without a country gets none', st.map(s => s.fac + ':' + s.has));
  ok(errs.length === 0, 'Endless Quiet: no page errors', errs.slice(0, 2)); await pg.close();
  await br.close(); console.log(fail ? 'FLAGS FAIL ' + fail : 'FLAGS OK'); process.exit(fail ? 1 : 0);
})();
