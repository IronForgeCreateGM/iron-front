// v5.9 browser: France build menu shows Gatling Bastion (not Tesla); Gatling renders, spins up and fires at ground + air; marine tooltip shows $400
const { chromium } = require('playwright-core'), path = require('path');
const URL0 = process.argv[2] || 'file://' + path.resolve(__dirname, '../index.html');
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1400, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  await pg.goto(URL0 + '?q=low'); await pg.waitForTimeout(2000); await pg.click('#playBotsBtn'); await pg.waitForTimeout(500);
  await pg.evaluate(() => { const c = [...document.querySelectorAll('.fcard')].find(c => /France/.test(c.textContent)); c.click(); });
  await pg.evaluate(() => document.getElementById('startBtn').click()); await pg.waitForTimeout(4000);
  const m = await pg.evaluate(() => ({ fac: G.players[ME].fac, def: listFor('def'), defB: listFor('def').length }));
  ok(m.fac === 'fra' && m.def.includes('gatling') && !m.def.includes('tesla'), 'France Defenses tab: ' + m.def.join(','));
  const s = await pg.evaluate(() => { G.opts.fog = false; const hq = G.ents.find(e => e.team === ME && e.t === 'hq'), foe = G.players.find(p => p.team !== ME).team;
    const x = Math.floor(hq.x) + 5, y = Math.floor(hq.y) + 2; const g = addB('gatling', ME, x, y, true); g.born = -10; for (let i = 0; i < 3; i++) addB('power', ME, x - 4 - i * 2, y + 4, true).born = -10;
    window.__rs = []; for (let i = 0; i < 6; i++) { const u = addU('rifle', foe, x + 6 + (i % 3) * 0.7, y + 1 + (i / 3 | 0) * 0.7); u.stance = 'hold'; __rs.push(u); } const gs = addU('gunship', foe, x + 3, y + 5); gs.stance = 'hold';
    R3.cam.td = R3.cam.d = 5.5; jumpTo(x + 0.5, y - 0.8, true); window.__g = g; window.__gs = gs; return { gid: g.id }; });
  await pg.waitForTimeout(1600);
  const r = await pg.evaluate(() => { const o = R3.objs.get(__g.id); return { gv: o && o.gv, part: !!(o && o.parts.gat), fired: G.time - (__g.lastFire || -99) < 2, tgt: __g.tgt && __g.tgt.t }; });
  ok(r.part && r.gv > 5, 'gatling barrel cluster spinning (' + (r.gv || 0).toFixed(1) + ' rad/s)'); ok(r.fired, 'gatling firing at ' + r.tgt);
  await pg.screenshot({ path: path.resolve(__dirname, '../shots/v5_9-gatling.png') });
  const t0 = await pg.evaluate(() => G.time); for (let i = 0; i < 60 && (await pg.evaluate(() => G.time)) < t0 + 10; i++) await pg.waitForTimeout(1000);
  const k = await pg.evaluate(() => ({ air: __gs.hp <= 0, gsHp: __gs.hp | 0, ground: __rs.filter(e => e.hp > 0).length, dt: G.time }));
  ok(k.air, 'gunship shot down (hp ' + k.gsHp + ')'); ok(k.ground < 6, 'riflemen hit (' + k.ground + ' left of 6)');
  const tip = await pg.evaluate(() => { showTip('marine', document.body); return document.getElementById('tip').textContent; }); ok(/\$400/.test(tip) && /Auto-engages/.test(tip), 'marine tooltip: ' + tip.slice(0, 120));
  const tip2 = await pg.evaluate(() => { showTip('gatling', document.body); return document.getElementById('tip').textContent; }); ok(/Gatling/.test(tip2) && /\$1800/.test(tip2), 'gatling tooltip: ' + tip2.slice(0, 120));
  ok(!errs.length, 'no page errors ' + errs.slice(0, 2).join(' | ')); console.log(fail ? 'GATLING FAIL' : 'GATLING OK'); await br.close(); process.exit(fail ? 1 : 0);
})();
