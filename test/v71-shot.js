// v7.1 browser shots: all-Chief-SI 2v2 on Volcano Crown -> France fortress, China Great Wall, a massed SI attack
const { chromium } = require('playwright-core'), path = require('path');
const URL0 = process.argv[2] || 'file://' + path.resolve(__dirname, '../index.html'), SEED = +(process.argv[3] || 7);
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1400, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  await pg.goto(URL0 + '?q=low'); await pg.waitForTimeout(2000);
  await pg.evaluate(seed => { startGame('si', { seed, map: 'volcano', fog: false, slots: buildSlots([['si', 'A', 'fra'], ['si', 'A', 'chn'], ['si', 'B', 'rus'], ['si', 'B', 'usa']]) }); G.opts.fog = false; DIR.auto = false; }, SEED);
  const ff = async t => { for (;;) { const g = await pg.evaluate(t => { const end = performance.now() + 4000; while (G.time < t && !G.over && performance.now() < end) { stepGame(); G.events.length = 0; } return G.time; }, t); if (g >= t) return; } };
  const shoot = async (name, fn, d) => { const p = await pg.evaluate(fn); if (!p) return null; await pg.evaluate(([x, y, d]) => { DIR.auto = false; DIR.cur = null; R3.cam.td = R3.cam.d = d; jumpTo(x, y, true); }, [p.x, p.y, d]); await pg.waitForTimeout(2500); await pg.screenshot({ path: path.resolve(__dirname, '../shots/' + name) }); return p; };
  await ff(660);
  const fr = await shoot('v7_1-france-fortress.png', () => { const P = G.players.find(p => p.fac === 'fra'); const d = G.ents.filter(e => e.team === P.team && e.kind === 'b' && (e.t === 'gatling' || e.t === 'gcannon')); if (!d.length) return null; const g = d.find(e => e.t === 'gcannon') || d[0]; return { x: g.x, y: g.y, gat: d.filter(e => e.t === 'gatling').length, gc: d.filter(e => e.t === 'gcannon').length }; }, 17);
  ok(fr && fr.gat >= 3, 'France fortress: ' + JSON.stringify(fr));
  const cw = await shoot('v7_1-china-wall.png', () => { const P = G.players.find(p => p.fac === 'chn'); const w = G.ents.filter(e => e.team === P.team && (e.t === 'wall' || e.t === 'gtower' || e.t === 'gate')); const gt = G.ents.filter(e => e.team === P.team && e.t === 'gtower'); if (!w.length) return null; const c = gt[0] || w[0]; return { x: c.x, y: c.y, wall: w.length, gtower: gt.length, bal: gt.filter(e => e.bal).length }; }, 17);
  ok(cw && cw.wall >= 6, 'China wall: ' + JSON.stringify(cw));
  let ma = null; for (let t = 690; t <= 1200 && !ma; t += 15) { await ff(t); ma = await pg.evaluate(() => { let best = null; for (const P of G.players) { const S = P.aiS; if (!S || !S.grp) continue; const g = S.grp.filter(u => u.hp > 0); if (g.length < 18) continue; let x = 0, y = 0; g.forEach(u => { x += u.x; y += u.y; }); x /= g.length; y /= g.length; const near = G.ents.some(e => e.kind === 'b' && e.hp > 0 && G.players[e.team].ally !== P.ally && Math.hypot(e.x - x, e.y - y) < 14); if (near && (!best || g.length > best.n)) best = { x, y, n: g.length, fac: P.fac, t: G.time | 0 }; } return best; }); }
  if (ma) { await pg.evaluate(([x, y]) => { DIR.auto = false; DIR.cur = null; R3.cam.td = R3.cam.d = 22; jumpTo(x, y, true); }, [ma.x, ma.y]); await pg.waitForTimeout(2500); await pg.screenshot({ path: path.resolve(__dirname, '../shots/v7_1-massed-attack.png') }); }
  ok(!!ma, 'massed attack: ' + JSON.stringify(ma));
  ok(!errs.length, 'no page errors ' + errs.slice(0, 2).join(' | ')); console.log(fail ? 'V71 SHOT FAIL' : 'V71 SHOT OK'); await br.close(); process.exit(fail ? 1 : 0);
})();
