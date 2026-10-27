// v7.2 browser shot: Brazil places a Barracks + a turret; they construct on the ground (scaffolding + progress bar)
const { chromium } = require('playwright-core'), path = require('path');
const URL0 = process.argv[2] || 'file://' + path.resolve(__dirname, '../index.html');
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1400, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  await pg.goto(URL0 + '?q=low'); await pg.waitForTimeout(2000);
  await pg.evaluate(() => { startGame('normal', { seed: 3, map: 'classic', fog: false, slots: buildSlots([['human', 'A', 'bra'], ['normal', 'B', 'rus']]) }); G.opts.fog = false; });
  await pg.waitForTimeout(1500);
  const r = await pg.evaluate(() => { const me = G.players.find(P => !P.ai), P = me, h = G.ents.find(e => e.t === 'hq' && e.team === P.team); P.cr = 9000;
    for (let i = 0; i < 60; i++) stepGame();
    const spot = (t, sk) => { let n = 0; for (let r = 5; r < 30; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) { const x = h.tx + dx, y = h.ty + dy; if (x > 11 && y > 11 && x < MW - 11 && y < MH - 11 && !buildWhy(P.team, t, x, y) && n++ >= sk) return [x, y]; } return null; };
    const placed = []; let s0 = spot('power', 0); execCmd(P.team, { c: 'build', t: 'power', x: s0[0], y: s0[1] }); placed.push('power');
    for (let i = 0; i < 30 * 7; i++) { stepGame(); G.events.length = 0; }
    s0 = spot('barracks', 0); if (s0) { execCmd(P.team, { c: 'build', t: 'barracks', x: s0[0], y: s0[1] }); placed.push('barracks'); }
    const tur = Object.keys(BT).find(k => BT[k].cat === 'def' && BT[k].wpn && (!BT[k].fac || BT[k].fac === P.fac) && !buildWhy(P.team, k, ...(spot(k, 3) || [0, 0])));
    if (tur) { const s = spot(tur, 3); execCmd(P.team, { c: 'build', t: tur, x: s[0], y: s[1] }); placed.push(tur); }
    const bb = G.ents.find(e => e.t === 'barracks' && e.team === P.team); for (let i = 0; i < 900 && bb && bb.con && bb.con.p < 0.45; i++) { stepGame(); G.events.length = 0; }
    const sites = G.ents.filter(e => e.kind === 'b' && e.team === P.team && e.con).map(e => ({ t: e.t, p: +e.con.p.toFixed(2), x: e.x, y: e.y }));
    paused = true; const b = sites.find(s => s.t === 'barracks') || sites[0]; if (b) { R3.cam.td = R3.cam.d = 18; jumpTo(b.x, b.y, true); } return { placed, sites, mine: G.ents.filter(e => e.kind === 'b' && e.team === P.team).map(e => e.t + (e.con ? ':' + e.con.p.toFixed(2) : '')), team: P.team, t: G.time }; });
  console.log(JSON.stringify(r)); await pg.waitForTimeout(2500);
  const out = path.resolve(__dirname, '../shots/v7_2-under-construction.png'); await pg.screenshot({ path: out });
  ok(r.sites.length >= 1, 'buildings under construction on the ground: ' + r.sites.map(s => s.t + ' ' + Math.round(s.p * 100) + '%').join(', '));
  ok(!errs.length, 'no page errors ' + errs.slice(0, 2).join(' | ')); console.log(out); await br.close(); process.exit(fail ? 1 : 0);
})();
