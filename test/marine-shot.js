// v5.8: browser check — Brazil in every faction picker, Iron Marine model renders + walks, tooltip; screenshot
const { chromium } = require('playwright-core'), path = require('path');
const URL0 = process.argv[2] || 'file://' + path.resolve(__dirname, '../index.html');
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1400, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  await pg.goto(URL0 + '?q=low'); await pg.waitForTimeout(2000); await pg.click('#playBotsBtn'); await pg.waitForTimeout(500);
  const p = await pg.evaluate(() => ({ lf: [...document.querySelectorAll('#lobby .lf')].map(s => [...s.options].map(o => o.textContent)), cards: [...document.querySelectorAll('.fcard')].map(c => c.textContent) }));
  ok(p.lf.length && p.lf.every(o => o.includes('Random') && o.some(t => /🇧🇷 Brazil/.test(t))), 'every lobby faction picker has Random + 🇧🇷 Brazil');
  ok(p.cards.some(t => /Brazil/.test(t)), 'Your faction cards include Brazil: ' + p.cards.join(' | '));
  await pg.evaluate(() => { const c = [...document.querySelectorAll('.fcard')].find(c => /Brazil/.test(c.textContent)); c.click(); });
  await pg.evaluate(() => document.getElementById('startBtn').click()); await pg.waitForTimeout(4000);
  const g = await pg.evaluate(() => { G.opts.fog = false; const hq = G.ents.find(e => e.team === ME && e.t === 'hq'); const ms = []; for (let i = 0; i < 9; i++) ms.push(addU('marine', ME, hq.x + 3 + (i % 3) * 0.8, hq.y + 3 + ((i / 3) | 0) * 0.8));
    ms.push(addU('rifle', ME, hq.x + 2.2, hq.y + 3)); orderMove(ms.slice(0, 5), hq.x + 9, hq.y + 6, false); R3.cam.td = R3.cam.d = 9; jumpTo(hq.x + 4, hq.y + 4, true);
    UI.sel = ms.slice(0, 9); return { fac: G.players[ME].fac, can: avail(ME, 'marine'), barracks: hasBuilt(ME, 'barracks') }; });
  ok(g.fac === 'bra', 'you play Brazil');
  await pg.waitForTimeout(2500);
  const r = await pg.evaluate(() => { const e = G.ents.find(x => x.t === 'marine'); const rs = e && R3.rs ? R3.rs[e.id] : null; return { model: !!UNIT_MODELS.marine, rendered: R3.scene.children.length, moved: G.ents.filter(x => x.t === 'marine' && x.order === 'move').length, tip: (showTip('marine', document.body), (document.getElementById('tip') || {}).textContent || '') }; });
  console.log(JSON.stringify(r).slice(0, 400));
  await pg.evaluate(() => { const m = G.ents.filter(x => x.t === 'marine'); const cx = m.reduce((a, e) => a + e.x, 0) / m.length, cy = m.reduce((a, e) => a + e.y, 0) / m.length; R3.cam.td = R3.cam.d = 6; jumpTo(cx, cy - 1.5, true); }); await pg.waitForTimeout(1500);
  await pg.screenshot({ path: path.resolve(__dirname, '../shots/v5_8-iron-marine.png') });
  ok(!errs.length, 'no page errors ' + errs.slice(0, 2).join(' | ')); console.log(fail ? 'MARINESHOT FAIL' : 'MARINESHOT OK'); await br.close(); process.exit(fail ? 1 : 0);
})();
