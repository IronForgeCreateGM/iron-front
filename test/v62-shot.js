// v6.2 screenshots: build cards, Air Command, diamond ore, SM-3 intercept, Research Lab panel, Howler siege, marine walking -> shots/v6_2-*.png
const { chromium } = require('playwright-core'), path = require('path');
const URL0 = process.argv[2] || 'file://' + path.resolve(__dirname, '../index.html'), OUT = n => path.resolve(__dirname, '../shots/v6_2-' + n + '.png');
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1400, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  await pg.goto(URL0 + '?q=low'); await pg.waitForTimeout(2000); await pg.click('#playBotsBtn'); await pg.waitForTimeout(500);
  await pg.evaluate(() => { const c = [...document.querySelectorAll('.fcard')].find(c => /Brazil/.test(c.textContent)); if (c) c.click(); });
  await pg.evaluate(() => document.getElementById('startBtn').click()); await pg.waitForTimeout(4500);
  const W8 = ms => pg.waitForTimeout(ms);
  // base setup: everything built, rich, no fog
  const info = await pg.evaluate(() => { G.opts.fog = false; const P = G.players[ME]; P.cr = 60000; P.gas = 5000; const hq = G.ents.find(e => e.team === ME && e.t === 'hq'); window.__hq = hq;
    G.players.forEach(Q => { if (Q.team !== ME) Q.aiS && (Q.aiS.next = 1e9); });
    const spot = (t, dx, dy) => { const tx = Math.round(hq.x + dx), ty = Math.round(hq.y + dy); const b = addB(t, ME, tx, ty, true); return b; };
    for (let i = 0; i < 6; i++) spot('power', 6 + (i % 3) * 2, 4 + ((i / 3) | 0) * 2); window.__b = { tech: spot('tech', 3, 12), fac: spot('factory', -4, 8), air: spot('airfield', 12, 1) };
    return { fac: P.fac, hq: [hq.x, hq.y] }; });
  console.log(JSON.stringify(info));
  // 1) build cards (vehicles + air tabs)
  await pg.evaluate(() => { UI.btab = 'veh'; buildBotGrid(); sidebar(); }); await W8(800); await pg.screenshot({ path: OUT('cards') });
  await pg.evaluate(() => { UI.btab = 'inf'; buildBotGrid(); }); await W8(500); await pg.screenshot({ path: OUT('cards-infantry') });
  // 2) Air Command with docked jets + a gunship
  await pg.evaluate(() => { const a = __b.air; const js = []; for (let i = 0; i < 4; i++) { const j = addU(i < 3 ? 'jet' : 'bomber', ME, a.x - 3 + i, a.y + 4); j.ammo = 0; js.push(j); } addU('gunship', ME, a.x + 1, a.y - 0.4);
    R3.cam.td = R3.cam.d = 8; jumpTo(a.x, a.y, true); setSel([a]); for (let i = 0; i < 30 * 8; i++) stepGame(); }); await W8(2500);
  const air = await pg.evaluate(() => G.ents.filter(e => e.team === ME && UT[e.t] && UT[e.t].jet && e.js === 'landed').length); ok(air >= 3, 'jets docked at the Air Command: ' + air);
  await pg.screenshot({ path: OUT('air-command') });
  // 3) diamond ore
  const dia = await pg.evaluate(() => { ensureFields(); const f = G.fields.find(f => f.dia); if (!f) return null; R3.cam.td = R3.cam.d = 11; jumpTo(f.x, f.y, true); setSel([]); return [f.x, f.y]; });
  ok(!!dia, 'diamond field found ' + JSON.stringify(dia)); await W8(1500); await pg.screenshot({ path: OUT('diamond-ore') });
  // 4) SM-3 intercept: a Command Center with the SM-3 battery under a continuous rocket barrage
  await pg.evaluate(() => { const hq = __hq, cc = addB('cc', ME, Math.round(hq.x + 14), Math.round(hq.y + 20), true); cc.sm3 = true; cc.hp = cc.mhp = 1e6; window.__cc = cc; R3.cam.td = R3.cam.d = 12; jumpTo(cc.x, cc.y, true); setSel([cc]);
    window.__bar = setInterval(() => { for (let i = 0; i < 1; i++) { const a = Math.random() * 6.283, r = 6 + Math.random() * 2.5, x = cc.x + Math.cos(a) * r, y = cc.y + Math.sin(a) * r; G.projs.push({ id: G.nid++, x, y, z: 1.5, sx: x, sy: y, w: W.rocket, team: 1, tgt: null, src: null, est: 0, home: false, tx: cc.x, ty: cc.y, tz: 0.5, delay: 0, kind: 'rocket' }); } }, 120); });
  let shots = 0; await W8(2500); for (let k = 0; k < 3; k++) { await pg.screenshot({ path: OUT('sm3-intercept' + (k ? '-' + k : '')) }); shots++; await W8(300); }
  await pg.evaluate(() => { clearInterval(__bar); G.projs.length = 0; G.ents = G.ents.filter(e => e !== __cc); G.bver++; });
  ok(shots, 'SM-3 intercept shot');
  // 5) Research Lab panel + chevrons
  await pg.evaluate(() => { const P = G.players[ME]; P.rs = { inf: 2, tank: 3 }; researchB(__b.tech, 'arty'); const t = __b.tech; for (let i = 0; i < 4; i++) addU(i % 2 ? 'heavy' : 'rifle', ME, t.x + 2 + i * 0.8, t.y + 2.5).hp *= 0.7;
    R3.cam.td = R3.cam.d = 9; jumpTo(t.x + 1.5, t.y + 1.5, true); setSel([t]); UI.set.hbars = 'always'; }); await W8(3500);
  const rp = await pg.evaluate(() => document.querySelectorAll('.rsb').length); ok(rp === 5, 'Research panel shows 5 tracks (' + rp + ')'); await pg.screenshot({ path: OUT('research-lab') });
  await pg.evaluate(() => { UI.set.hbars = 'smart'; });
  // 6) Howler siege firing at an enemy outpost
  await pg.evaluate(() => { const hq = __hq, x = hq.x + 26, y = hq.y + 3; const hs = []; for (let i = 0; i < 3; i++) hs.push(addU('arty', ME, x + i * 1.2, y)); hs.forEach(h => siegeToggle(h, 1)); for (let i = 0; i < 100; i++) { stepGame(); }
    for (let i = 0; i < 4; i++) { const e = addU(i % 2 ? 'rifle' : 'heavy', 1, x + 1 + i, y + 8.5); e.stance = 'hold'; e.hp = e.mhp = 50000; }
    window.__en = G.ents.filter(e => e.team === 1 && e.kind === 'u' && e.hp > 1000); window.__hs = hs; R3.cam.td = R3.cam.d = 13; jumpTo(x + 1.5, y + 3.2, true); setSel(hs); }); await W8(6500);
  const sg = await pg.evaluate(() => __hs.filter(h => h.sg === 2).length); ok(sg === 3, 'Howlers sieged: ' + sg); await pg.screenshot({ path: OUT('howler-siege') }); const hd = await pg.evaluate(() => __en.reduce((a, e) => a + (50000 - e.hp), 0)); ok(hd > 0, 'sieged Howlers hit targets 8.5 tiles away (dmg ' + hd + ')');
  // 7) marine walking (close-up)
  await pg.evaluate(() => { G.ents = G.ents.filter(e => !__en.includes(e)); UI.alerts = []; G.bver++; const hq = __hq, ms = []; for (let i = 0; i < 6; i++) ms.push(addU('marine', ME, hq.x + 4 + (i % 3) * 0.8, hq.y + 20 + ((i / 3) | 0) * 0.8)); orderMove(ms, hq.x + 16, hq.y + 21, false); window.__ms = ms; setSel(ms); }); await W8(1200);
  await pg.evaluate(() => { const m = __ms; const cx = m.reduce((a, e) => a + e.x, 0) / m.length, cy = m.reduce((a, e) => a + e.y, 0) / m.length; R3.cam.td = R3.cam.d = 5.5; jumpTo(cx + 0.8, cy, true); }); await W8(500);
  await pg.screenshot({ path: OUT('marine-walking') });
  ok(!errs.length, 'no page errors ' + errs.slice(0, 3).join(' | ')); console.log(fail ? 'V62SHOT FAIL' : 'V62SHOT OK'); await br.close(); process.exit(fail ? 1 : 0);
})();
