// v7.1.1 browser shot: all-Chief-SI 2v2 on Volcano Crown -> the biggest battle (25+ fighting units per side within 12 tiles)
const { chromium } = require('playwright-core'), path = require('path');
const URL0 = process.argv[2] || 'file://' + path.resolve(__dirname, '../index.html'), SEED = +(process.argv[3] || 7), NEED = +(process.argv[4] || 25);
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1400, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  await pg.goto(URL0 + '?q=low'); await pg.waitForTimeout(2000);
  await pg.evaluate(seed => { startGame('si', { seed, map: 'volcano', fog: false, slots: buildSlots([['si', 'A', 'usa'], ['si', 'A', 'ger'], ['si', 'B', 'rus'], ['si', 'B', 'chn']]) }); G.opts.fog = false; DIR.auto = false; }, SEED);
  const ff = async t => { for (;;) { const g = await pg.evaluate(t => { const end = performance.now() + 4000; while (G.time < t && !G.over && performance.now() < end) { stepGame(); G.events.length = 0; } return G.time; }, t); if (g >= t) return; } };
  let best = null; const snap = async b => { await pg.evaluate(([x, y]) => { paused = true; DIR.auto = false; DIR.cur = null; R3.cam.td = R3.cam.d = 26; jumpTo(x, y, true); }, [b.x, b.y]); await pg.waitForTimeout(1500);
    await pg.screenshot({ path: path.resolve(__dirname, '../shots/v7_1_1-big-battle.png') }); await pg.evaluate(([x, y]) => { R3.cam.td = R3.cam.d = 16; jumpTo(x, y, true); }, [b.x, b.y]); await pg.waitForTimeout(1200);
    await pg.screenshot({ path: path.resolve(__dirname, '../shots/v7_1_1-big-battle-close.png') }); await pg.evaluate(() => { paused = false; }); };
  for (let t = 360; t <= 1100; t += 6) { await ff(t);
    const b = await pg.evaluate(() => { const cu = G.ents.filter(e => e.kind === 'u' && e.hp > 0 && UT[e.t].wpn && e.t !== 'harv'); let best = null;
      for (let i = 0; i < cu.length; i += 3) { const u = cu[i], n = [0, 0]; for (const o of cu) if (Math.hypot(o.x - u.x, o.y - u.y) < 12) n[G.players[o.team].ally === G.players[0].ally ? 0 : 1]++;
        const m = Math.min(n[0], n[1]); if (!best || m > best.m) best = { x: u.x, y: u.y, m, a: n[0], b: n[1], t: Math.round(G.time) }; }
      return best; });
    if (b && (!best || b.m > best.m)) { best = b; if (b.m >= 18) await snap(b); } if (best && best.m >= NEED) break; }
  ok(best && best.m >= NEED, 'big battle: ' + JSON.stringify(best));
  ok(!errs.length, 'no page errors ' + errs.slice(0, 2).join(' | ')); console.log(fail ? 'V711 SHOT FAIL' : 'V711 SHOT OK'); await br.close(); process.exit(fail ? 1 : 0);
})();
