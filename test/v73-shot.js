// v7.3 browser shots: a Barracks (plus a turret and walls) going up through the construction stages; checks no page errors.
// node test/v73-shot.js [url] [w h tag]
const { chromium } = require('playwright-core'), path = require('path'), fs = require('fs');
const URL0 = process.argv[2] || 'file://' + path.resolve(__dirname, '../index.html'), VW = +(process.argv[3] || 1400), VH = +(process.argv[4] || 900), TAG = process.argv[5] || '';
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: VW, height: VH }, isMobile: VW < 1000, hasTouch: VW < 1000 }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  await pg.goto(URL0 + (URL0.includes('?') ? '&' : '?') + 'q=med'); await pg.waitForTimeout(2000);
  await pg.evaluate(() => { startGame('normal', { seed: 3, map: 'classic', fog: false, slots: buildSlots([['human', 'A', 'bra'], ['easy', 'B', 'rus']]) }); G.opts.fog = false; });
  await pg.waitForTimeout(1500);
  const r = await pg.evaluate(() => { const P = G.players.find(P => !P.ai), h = G.ents.find(e => e.t === 'hq' && e.team === P.team); P.cr = 20000; paused = true;
    for (let i = 0; i < 60; i++) stepGame();
    const spot = (t, sk) => { let n = 0; for (let r = 5; r < 30; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) { const x = h.tx + dx, y = h.ty + dy; if (x > 11 && y > 11 && x < MW - 11 && y < MH - 11 && !buildWhy(P.team, t, x, y) && n++ >= sk) return [x, y]; } return null; };
    let s0 = spot('power', 0); execCmd(P.team, { c: 'build', t: 'power', x: s0[0], y: s0[1] }); for (let i = 0; i < 30 * 9; i++) { stepGame(); G.events.length = 0; }
    s0 = (() => { const cx = h.tx + Math.sign(MW / 2 - h.tx) * 10, cy = h.ty + Math.sign(MH / 2 - h.ty) * 10; let best = null, bd = 1e9; for (let x = cx - 6; x <= cx + 6; x++) for (let y = cy - 6; y <= cy + 6; y++) if (!buildWhy(P.team, 'barracks', x, y)) { const d = Math.hypot(x - cx, y - cy); if (d < bd) { bd = d; best = [x, y]; } } return best || spot('barracks', 0); })(); execCmd(P.team, { c: 'build', t: 'barracks', x: s0[0], y: s0[1] });
    const tur = Object.keys(BT).find(k => BT[k].cat === 'def' && BT[k].wpn && (!BT[k].fac || BT[k].fac === P.fac) && spot(k, 2)); if (tur) { const s = spot(tur, 2); execCmd(P.team, { c: 'build', t: tur, x: s[0], y: s[1] }); }
    const b = G.ents.find(e => e.t === 'barracks' && e.team === P.team); R3.cam.td = R3.cam.d = 13; jumpTo(b.x + 1.5, b.y - 3.5, true); window.__b = b; return { tur, at: [b.tx, b.ty] }; });
  console.log(JSON.stringify(r));
  const outs = []; const shot = async name => { const f = path.resolve(__dirname, '../shots/v7_3-build-' + name + TAG + '.png'); await pg.screenshot({ path: f }); outs.push(f); };
  for (const [tg, name] of [[0.1, '10'], [0.4, '40'], [0.75, '75']]) {
    // run the sim at real-time pace so particles and the crane animate between steps
    for (let k = 0; k < 400; k++) { const p = await pg.evaluate(tg => { for (let i = 0; i < 3 && __b.con && __b.con.p < tg; i++) { stepGame(); G.events.length = 0; } return __b.con ? __b.con.p : 1; }, tg); if (p >= tg) break; await pg.waitForTimeout(16); }
    await pg.waitForTimeout(name === '75' ? 900 : 600); await shot(name); }
  for (let k = 0; k < 800; k++) { const done = await pg.evaluate(() => { for (let i = 0; i < 3 && __b.con; i++) stepGame(); return !__b.con; }); if (done) break; await pg.waitForTimeout(16); }
  await pg.waitForTimeout(400); await shot('done'); await pg.waitForTimeout(1500); await shot('finished');
  const st = await pg.evaluate(() => ({ con: !!__b.con, site: !!(R3.objs.get(__b.id) || {}).cs, fps: R3.fps }));
  ok(!st.con && !st.site, 'barracks finished and its construction site was removed');
  ok(!errs.length, 'no page errors ' + errs.slice(0, 2).join(' | ')); console.log(outs.join('\n')); await br.close(); process.exit(fail ? 1 : 0);
})();
