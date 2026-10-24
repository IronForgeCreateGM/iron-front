// v6.3 screenshots: Seraph Medevac build card + heal beam, Volcano Crown lava -> shots/v6_3-*.png
const { chromium } = require('playwright-core'), path = require('path');
const URL0 = 'file://' + path.resolve(__dirname, '../index.html'), OUT = n => path.resolve(__dirname, '../shots/v6_3-' + n + '.png');
const only = process.argv[2] || 'all';
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  const start = async (map) => { const pg = await br.newPage({ viewport: { width: 1400, height: 900 } }); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message));
    await pg.goto(URL0 + '?q=low'); await pg.waitForTimeout(2000); await pg.click('#playBotsBtn'); await pg.waitForTimeout(500);
    if (map) await pg.selectOption('#mapSel', map);
    await pg.evaluate(() => { const c = [...document.querySelectorAll('.fcard')].find(c => /Brazil/.test(c.textContent)); if (c) c.click(); });
    await pg.evaluate(() => document.getElementById('startBtn').click()); await pg.waitForTimeout(4500);
    await pg.mouse.move(400, 300); await pg.evaluate(() => { UI.mouse.x = -1; G.opts.fog = false; G.players.forEach(Q => { if (Q.team !== ME) Q.aiS && (Q.aiS.next = 1e9); }); }); return pg; };
  if (only === 'all' || only === 'healer') {
    const pg = await start();
    await pg.evaluate(() => { const P = G.players[ME]; P.cr = 60000; const hq = G.ents.find(e => e.team === ME && e.t === 'hq'); window.__hq = hq;
      const spot = (t, dx, dy) => addB(t, ME, Math.round(hq.x + dx), Math.round(hq.y + dy), true); for (let i = 0; i < 4; i++) spot('power', 6 + (i % 2) * 2, 4 + ((i / 2) | 0) * 2); spot('factory', -4, 8); spot('tech', 3, 12); spot('airfield', 12, 1); });
    await pg.evaluate(() => { UI.btab = 'air'; buildBotGrid(); sidebar(); }); await pg.waitForTimeout(1000);
    await pg.screenshot({ path: OUT('cards-air') });
    const card = await pg.evaluate(() => { const el = [...document.querySelectorAll('.item')].find(e => /Seraph/.test(e.textContent) || (e.title || '').includes('Seraph') || (e.innerHTML || '').includes('medevac')); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    ok(!!card, 'Seraph Medevac build card present ' + JSON.stringify(card));
    if (card) await pg.screenshot({ path: OUT('healer-card'), clip: { x: Math.max(0, card.x - 6), y: Math.max(0, card.y - 6), width: card.w + 12, height: card.h + 12 } });
    // heal beam: medevac hovering over a wounded squad mid-field
    const st = await pg.evaluate(() => { const flat = (x, y) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const i = (y + dy) * MW + x + dx; if (G.map[i] !== 0 || G.lvl[i] > 0 || (G.forest && G.forest[i]) || G.ore[i] > 0) return false; } return true; };
      let cx = Math.round(MW * 0.42), cy = Math.round(MH * 0.36); outer: for (let r = 0; r < 30; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (flat(cx + dx, cy + dy)) { cx += dx; cy += dy; break outer; }
      const sq = []; for (let i = 0; i < 5; i++) { const u = addU(i === 2 ? 'heavy' : i === 4 ? 'scout' : 'rifle', ME, cx - 1 + (i % 3) * 0.9, cy + (i / 3 | 0) * 0.9); u.hp = u.mhp * (0.25 + i * 0.08); u.stance = 'hold'; sq.push(u); }
      const m = addU('medevac', ME, cx, cy + 0.4); m.hp = m.mhp; window.__m = m; for (let i = 0; i < 30 * 3; i++) stepGame();
      R3.cam.td = R3.cam.d = 9; jumpTo(cx, cy, true); const V = new THREE.Vector3();
      for (let it = 0; it < 6; it++) { updCamera(0); V.set(cx, heightAt(cx, cy) + 0.8, cy).project(R3.camera); R3.cam.tx = R3.cam.x += V.x * 3; R3.cam.ty = R3.cam.y -= (V.y + 0.05) * 2.5; } setSel([m]); UI.set.hbars = 'always'; return { beams: (m.beams || []).length, hp: sq.map(u => Math.round(u.hp / u.mhp * 100)) }; });
    ok(st.beams >= 2, 'medevac beaming ' + st.beams + ' targets, hp% ' + st.hp.join(','));
    await pg.waitForTimeout(3500); await pg.screenshot({ path: OUT('healer-beam') });
    ok(!pg.errs.length, 'no page errors ' + pg.errs.slice(0, 3).join(' | ')); await pg.close();
  }
  if (only === 'all' || only === 'lava') {
    const pg = await start('volcano');
    const lv = await pg.evaluate(() => { const L = R3.lavaCore || []; let best = null, bd = 1e9; for (const i of L) { const x = i % MW + 0.5, y = (i / MW | 0) + 0.5, d = Math.hypot(x - MW * 0.5, y - MH * 0.62); if (d < bd) { bd = d; best = [x, y]; } }
      if (!best) return { n: 0 }; R3.cam.td = R3.cam.d = 15; jumpTo(best[0], best[1] + 3, true); setSel([]); return { n: L.length, at: best, map: G.mapName, q: R3.uLavaQ && R3.uLavaQ.value }; });
    ok(lv.n > 50, 'lava mesh + core tiles ' + JSON.stringify(lv));
    await pg.waitForTimeout(6000); await pg.screenshot({ path: OUT('lava') });
    await pg.evaluate(() => toggleQuiet(true)); await pg.waitForTimeout(4000);
    const q = await pg.evaluate(() => R3.uLavaQ.value); ok(q === 0, 'quiet mode switches lava to the light shader (uLavaQ=0)'); await pg.screenshot({ path: OUT('lava-quiet') });
    await pg.evaluate(() => toggleQuiet(false));
    ok(!pg.errs.length, 'no page errors ' + pg.errs.slice(0, 3).join(' | ')); await pg.close();
  }
  await br.close(); console.log(fail ? 'V63SHOT FAIL' : 'V63SHOT OK'); process.exit(fail ? 1 : 0);
})();
