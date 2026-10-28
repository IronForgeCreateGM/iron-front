// v5.7.2: Fog-of-war checkbox works (every map, any slot) + WASD/arrow camera pan in play and spectate, after touching lobby controls.
const { chromium } = require('playwright-core'), path = require('path');
const URL0 = process.argv[2] || 'file://' + path.resolve(__dirname, '../index.html');
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  async function game({ map, fog, youRow = 0, spectate = false }) {
    const pg = await br.newPage({ viewport: { width: 1280, height: 800 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(URL0 + '?q=low'); await pg.waitForTimeout(1500); await pg.click('#playBotsBtn'); await pg.waitForTimeout(300);
    await pg.selectOption('#mapSel', map); const n = map === 'volcano8' ? 8 : map === 'volcano' ? 6 : 4;
    const rows = await pg.$$('#lobby .lrow:not(.lh)');
    for (let i = 0; i < 8; i++) { const lt = await rows[i].$('.lt'), la = await rows[i].$('.la'); await lt.selectOption(i >= n ? 'off' : i === youRow && !spectate ? 'human' : 'si'); if (i < n) await la.selectOption(i % 2 ? 'B' : 'A'); }
    if (spectate) await (await rows[0].$('.lt')).selectOption('si');
    const fc = await pg.isChecked('#fogChk'); if (fc !== fog) await pg.click('#fogChk');
    await pg.focus('#mapSel'); // leave focus in a dropdown, like a real click would
    await pg.click('#startBtn'); await pg.waitForTimeout(3500);
    return { pg, errs };
  }
  const visState = pg => pg.evaluate(() => { let v = 0, s = 0; for (let i = 0; i < G.vis.length; i++) { v += G.vis[i]; s += G.seen[i]; } const foeB = G.ents.filter(e => foe(e.team, ME) && e.kind === 'b');
    const objVis = foeB.filter(e => { const o = R3.objs && R3.objs.get(e.id); return o && o.group ? o.group.visible : !!o; }).length;
    const mm = document.getElementById('minimap').getContext('2d').getImageData(0, 0, 256, 256).data; let dark = 0; for (let i = 0; i < mm.length; i += 4) if (mm[i] + mm[i + 1] + mm[i + 2] < 30) dark++;
    return { fog: G.opts.fog, ME, vis: v / G.vis.length, seen: s / G.seen.length, foeVis: foeB.filter(e => visibleTo0(e)).length, foeB: foeB.length, darkMM: dark / (mm.length / 4) }; });
  for (const map of ['classic', 'frost', 'volcano', 'volcano8']) {
    const { pg, errs } = await game({ map, fog: false, youRow: map === 'volcano8' ? 7 : 1 }); const s = await visState(pg);
    ok(s.fog === false && s.vis === 1 && s.seen === 1 && s.foeVis === s.foeB && s.darkMM < 0.02, `${map}: fog OFF -> whole map + all ${s.foeB} enemy buildings visible (you=slot ${s.ME + 1}, dark minimap ${(s.darkMM * 100).toFixed(1)}%)`);
    if (map === 'volcano8') { // keyboard pan while playing
      const cam = () => pg.evaluate(() => [R3.cam.tx, R3.cam.ty]); const hold = async (keys, ms = 700) => { for (const k of keys) await pg.keyboard.down(k); await pg.waitForTimeout(ms); for (const k of keys) await pg.keyboard.up(k); };
      const res = []; for (const [keys, dx, dy] of [[['d'], 1, 0], [['a'], -1, 0], [['s'], 0, 1], [['w'], 0, -1], [['ArrowRight'], 1, 0], [['ArrowUp'], 0, -1], [['w', 'd'], 1, -1]]) { const a = await cam(); await hold(keys); const b = await cam(); res.push([keys.join('+'), Math.sign(Math.round((b[0] - a[0]) * 10)) === dx && Math.sign(Math.round((b[1] - a[1]) * 10)) === dy]); }
      ok(res.every(r => r[1]), 'playing: WASD/arrows/W+D pan correctly after DEPLOY with a dropdown focused ' + JSON.stringify(res));
      ok(await pg.evaluate(() => document.activeElement === document.body), 'no form element keeps focus in game');
    }
    ok(!errs.length, map + ': no page errors ' + errs.slice(0, 1)); await pg.close();
  }
  { const { pg } = await game({ map: 'classic', fog: true }); const s = await visState(pg); ok(s.fog === true && s.vis < 0.6 && s.foeVis < s.foeB, `fog ON still hides the map (visible ${(s.vis * 100).toFixed(0)}%, enemy buildings seen ${s.foeVis}/${s.foeB})`); await pg.close(); }
  { const { pg } = await game({ map: 'volcano', fog: false, spectate: true }); const sp = await pg.evaluate(() => !!G.watch);
    const a = await pg.evaluate(() => [R3.cam.tx, R3.cam.ty]); await pg.keyboard.down('a'); await pg.keyboard.down('s'); await pg.waitForTimeout(800); await pg.keyboard.up('a'); await pg.keyboard.up('s'); const b = await pg.evaluate(() => [R3.cam.tx, R3.cam.ty]);
    ok(sp && b[0] < a[0] - 0.5 && b[1] > a[1] + 0.5, `spectating: A+S pans (${a.map(v => v.toFixed(1))} -> ${b.map(v => v.toFixed(1))})`); await pg.close(); }
  console.log(fail ? 'FOGKEYS FAIL' : 'FOGKEYS OK'); await br.close(); process.exit(fail ? 1 : 0);
})();
