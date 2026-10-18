// v6.0 browser: Hellgate lobby auto-setup + preview, in-game desert overview, outpost Grand Cannon firing (recoil + blast) screenshots
const { chromium } = require('playwright-core'), path = require('path');
const URL0 = process.argv[2] || 'file://' + path.resolve(__dirname, '../index.html'), SH = f => path.resolve(__dirname, '../shots/' + f);
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1400, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  await pg.goto(URL0 + '?q=' + (process.env.Q || 'med') + '&shot=1'); await pg.waitForTimeout(2000); await pg.click('#playBotsBtn'); await pg.waitForTimeout(500);
  await pg.evaluate(() => { const c = [...document.querySelectorAll('.fcard')].find(c => /France/.test(c.textContent)); if (c) c.click(); });
  await pg.selectOption('#mapSel', 'hellgate'); await pg.waitForTimeout(800);
  const L = await pg.evaluate(() => ({ rows: lobbyRead().map(r => r[0] + r[1]), txt: document.getElementById('mapPrevTxt').textContent }));
  ok(L.rows.join() === 'humanA,hardA,hardB,hardB,hardB,hardB,hardB,hardB', 'map pick auto-sets You + ally on Team A, 6 Hard AI on Team B: ' + L.rows.join()); ok(/128×128/.test(L.txt) && /outposts/.test(L.txt), 'preview: ' + L.txt);
  // human in another slot (v5.7.1): make slot 5 "You" -> still Team A seat
  await pg.evaluate(() => { const rows = lobbyRead(); rows[0] = ['hard', 'A', 'fra', 'auto']; rows[4] = ['human', 'A', 'fra', 'auto']; rows[1] = ['hard', 'B', 'rand', 'auto']; lobbySet(rows); });
  const lb = await pg.$('#lobbyBox') || await pg.$('#lobby'); await (await pg.$('#mapPrev')).screenshot({ path: SH('v6_0-hellgate-preview.png') });
  await pg.screenshot({ path: SH('v6_0-hellgate-lobby.png') });
  await pg.evaluate(() => document.getElementById('startBtn').click()); await pg.waitForTimeout(5000);
  const g = await pg.evaluate(() => ({ map: G.mapName, mw: MW, me: ME, start: G.players[ME].start, ally: G.players[ME].ally, fac: G.players[ME].fac, np: G.players.length, desert: !!G.desert }));
  ok(g.map === 'hellgate' && g.mw === 128 && g.np === 8 && g.desert, 'game: ' + JSON.stringify(g)); ok(g.ally === 0 && g.start <= 1, 'You (lobby slot 5) got a Team A valley seat');
  // overview of the Hellgate canyon + mouth outposts
  await pg.evaluate(() => { G.opts.fog = false; G.spectate = true; R3.cam.td = R3.cam.d = 46; jumpTo(47, 60, true); }); await pg.waitForTimeout(2500);
  await pg.screenshot({ path: SH('v6_0-hellgate-canyon.png') });
  await pg.evaluate(() => { R3.cam.td = R3.cam.d = 30; jumpTo(88, 62, true); }); await pg.waitForTimeout(2000); await pg.screenshot({ path: SH('v6_0-hellgate-village.png') });
  // capture Eagle's Nest outpost, build a Grand Cannon on it, enemy column in the canyon mouth
  const s = await pg.evaluate(() => { const o = G.derricks.find(d => d.op); o.owner = ME; const P = G.players[ME]; P.fac = 'fra'; addB('tech', ME, 8, 60, true).born = -10; for (let i = 0; i < 4; i++) addB('power', ME, 4, 44 + i * 3, true).born = -10;
    const tx = Math.floor(o.x) + 1, ty = Math.floor(o.y) - 2, can = canPlace('gcannon', ME, tx, ty); for (const k in MODEL_CACHE) if (/gcannon/.test(k)) delete MODEL_CACHE[k];
    const b = addB('gcannon', ME, tx, ty, true); b.born = -10; const foeT = G.players.find(p => p.ally !== P.ally).team; window.__hv = [];
    for (let i = 0; i < 6; i++) { const u = addU('heavy', foeT, 54 + (i % 3) * 1.2, 63 + (i / 3 | 0) * 1.4); u.stance = 'hold'; __hv.push(u); }
    window.__gc = b; R3.cam.td = R3.cam.d = 11; jumpTo(b.x - 1.0, b.y - 2.2, true); return { can, id: b.id }; });
  ok(s.can, 'Grand Cannon placeable on the captured outpost');
  let shot = null; for (let i = 0; i < 60; i++) { await pg.waitForTimeout(100); const r = await pg.evaluate(() => { const o = R3.objs.get(__gc.id); return o && o.rc; }); if (r > 0.6 && r < 0.95) { shot = r; break; } }
  ok(shot != null, 'Grand Cannon fired, recoil animating (rc ' + (shot || 0).toFixed(2) + ')');
  await pg.screenshot({ path: SH('v6_0-grand-cannon-fire.png') });
  await pg.waitForTimeout(2200); await pg.screenshot({ path: SH('v6_0-grand-cannon.png') });
  const hp = await pg.evaluate(() => __hv.reduce((a, u) => a + Math.max(0, u.hp), 0) / __hv.reduce((a, u) => a + u.mhp, 0)); ok(hp < 1, 'shells landed on the canyon column (hp ' + (hp * 100 | 0) + '%)');
  const fps = await pg.evaluate(async () => { G.spectate = true; R3.cam.td = R3.cam.d = 40; jumpTo(64, 64, true); let n = 0; const t0 = performance.now(); await new Promise(r => { const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); return n / 3; });
  console.log('INFO swiftshader fps (software GL, not representative):', fps.toFixed(1));
  ok(!errs.length, 'no page errors ' + errs.slice(0, 3).join(' | ')); console.log(fail ? 'HGSHOT FAIL' : 'HGSHOT OK'); await br.close(); process.exit(fail ? 1 : 0);
})();
