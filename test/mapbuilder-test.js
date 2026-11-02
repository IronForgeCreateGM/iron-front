// v7.7 Map Builder end-to-end: private unlock (hash-gated ?key=), editor painting/undo/save, lobby per-slot teams, playing a 224 8-player custom map.
// The unlock key is NOT in the repo: MB_KEY env or /workspace/.mapbuilder-key.  NODE_PATH=/workspace/pwlib/node_modules node test/mapbuilder-test.js [shotDir]
const { chromium } = require('playwright-core'), path = require('path'), fs = require('fs');
const URL0 = 'file://' + path.resolve(__dirname, '../index.html'), SHOTS = process.argv[2] || '';
const KEY = process.env.MB_KEY || (fs.existsSync('/workspace/.mapbuilder-key') ? fs.readFileSync('/workspace/.mapbuilder-key', 'utf8').trim() : '');
(async () => {
  if (!KEY) { console.log('SKIP: no unlock key available'); process.exit(0); }
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1440, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  const vis = () => pg.evaluate(() => { const b = document.getElementById('mapBuilderBtn'); return !!b && b.style.display !== 'none'; });
  await pg.goto(URL0 + '?q=low&editor=1'); await pg.waitForTimeout(1500);
  ok(!(await vis()) && !(await pg.$('#mbEd')), 'locked by default: no Map Builder button, ?editor=1 does nothing');
  await pg.goto(URL0 + '?q=low&key=wrong-key'); await pg.waitForTimeout(1200); ok(!(await vis()), 'a wrong key does not unlock');
  await pg.goto(URL0 + '?q=low&key=' + encodeURIComponent(KEY)); await pg.waitForTimeout(1500);
  ok(await vis(), 'the right key unlocks the button'); ok(!(await pg.evaluate(() => location.search.includes('key='))), 'key is stripped from the address bar');
  await pg.goto(URL0 + '?q=low'); await pg.waitForTimeout(1200); ok(await vis(), 'unlock persists on this device');
  await pg.click('#mapBuilderBtn'); await pg.waitForTimeout(400); ok(!!(await pg.$('#mbEd')), 'editor opens');
  await pg.click('#mbNew'); await pg.selectOption('#nS', '224'); await pg.selectOption('#nT', 'space'); await pg.selectOption('#nP', '8'); await pg.click('#nOk'); await pg.waitForTimeout(300);
  let st = await pg.evaluate(() => ({ w: MBE.m.w, n: MBE.m.starts.length, v: MBE.m.vents.length, th: MBE.m.theme })); ok(st.w === 224 && st.n === 8 && st.v === 8 && st.th === 'space', '224 space starter with 8 spawns + 8 vents ' + JSON.stringify(st));
  { const cr = await pg.evaluate(() => { const keep = MBE.m, r = {}; r.starter = mbCheck().filter(c => /cramped|apart/.test(c[1])).map(c => c[1]);
      const m = mbBlank(64, 'grass', 'cramp'); MBE.m = m; m.starts.push([20, 20], [44, 44]); r.open = mbCheck().filter(c => /cramped|apart/.test(c[1])).length;
      mbDisc(m, 20.5, 20.5, 12, i => { const x = i % 64, y = (i / 64) | 0; if (Math.hypot(x - 20, y - 20) > 6) m.t[i] = 1; }); m.starts.push([50, 46]);
      const c = mbCheck(); r.cramped = c.some(x => /Spawn 1 base is cramped/.test(x[1])); r.apart = c.some(x => /Spawns 2 and 3 are only/.test(x[1])); MBE.m = keep; return r; });
    ok(cr.open === 0 && cr.cramped && cr.apart, 'v7.7.2 cramped-base + spawns-too-close warnings ' + JSON.stringify(cr)); }
  await pg.fill('#mbName', 'Eight Ring'); await pg.selectOption('#mbMirror', '4');
  const box = await (await pg.$('#mbCv')).boundingBox(), T = (tx, ty) => pg.evaluate(([tx, ty]) => { const V = MBE.view, r = MBE.cv.getBoundingClientRect(); return [r.left + (V.ox + (tx + 0.5) * V.s) / MBE.dpr, r.top + (V.oy + (ty + 0.5) * V.s) / MBE.dpr]; }, [tx, ty]);
  const drag = async (pts) => { let p = await T(...pts[0]); await pg.mouse.move(...p); await pg.mouse.down(); for (const q of pts.slice(1)) { p = await T(...q); await pg.mouse.move(...p, { steps: 8 }); } await pg.mouse.up(); };
  const tool = (k, v) => pg.click(`#mbEd .side button[data-k="${k}"][data-v="${v}"]`);
  await tool('t', 1); await pg.evaluate(() => { MBE.brush = 4; MBE.sync(); }); await drag([[60, 95], [75, 80], [95, 62]]);
  await tool('t', 2); await drag([[100, 30], [112, 40], [124, 30]]);
  await tool('h', 1); await pg.evaluate(() => { MBE.brush = 9; MBE.sync(); }); await drag([[40, 40], [48, 48]]);
  await tool('t', 4); await pg.evaluate(() => { MBE.brush = 3; MBE.sync(); }); await drag([[85, 112], [95, 112]]);
  await tool('o', 4); await pg.evaluate(() => { MBE.brush = 4; MBE.sync(); }); await drag([[70, 70], [72, 72]]);
  await tool('t', 6); await pg.evaluate(() => { MBE.brush = 7; MBE.sync(); }); await drag([[30, 100], [40, 110]]);
  await tool('obj', 'monument'); let p = await T(112, 112); await pg.mouse.click(...p);
  await pg.selectOption('#mbMirror', 'none'); await tool('obj', 'derrick'); for (const q of [[112, 70], [112, 154], [70, 112], [154, 112]]) { p = await T(...q); await pg.mouse.click(...p); }
  await tool('obj', 'outpost'); p = await T(112, 90); await pg.mouse.click(...p);
  st = await pg.evaluate(() => { let r = 0, w = 0, o4 = 0; for (let i = 0; i < MBE.m.t.length; i++) { if (MBE.m.t[i] === 1) r++; if (MBE.m.t[i] === 2) w++; if (MBE.m.o[i] === 4) o4++; } return { r, w, o4, mon: !!MBE.m.monument, d: MBE.m.derricks.length, op: MBE.m.outposts.length, u: MBE.undo.length }; });
  ok(st.r > 100 && st.w > 50 && st.o4 > 20 && st.mon && st.d === 4 && st.op === 1, 'painted rock/water/rich ore (4-way mirror), monument, derricks, outpost ' + JSON.stringify(st));
  await tool('t', 0); await pg.keyboard.press('f'); p = await T(5, 5); await pg.mouse.click(...p); // fill ground (no-op on ground) then undo the last real change
  const before = await pg.evaluate(() => MBE.m.outposts.length); await pg.keyboard.press('Control+z'); await pg.keyboard.press('Control+z'); const after = await pg.evaluate(() => MBE.m.outposts.length); ok(before === 1 && after === 0, 'Cmd/Ctrl+Z undoes (outpost removed)');
  await pg.keyboard.press('Control+Shift+z'); ok(await pg.evaluate(() => MBE.m.outposts.length) === 1, 'redo brings it back'); await pg.keyboard.press('f');
  await pg.keyboard.press('Control+s'); await pg.waitForTimeout(200);
  const saved = await pg.evaluate(() => Object.values(cmAll()).map(m => [m.name, m.w, m.starts.length, JSON.stringify(m).length]));
  ok(saved.some(m => m[0] === 'Eight Ring' && m[1] === 224 && m[2] === 8), 'saved to localStorage ' + JSON.stringify(saved));
  const chk = await pg.evaluate(() => mbCheck()); ok(!chk.some(c => c[0] === 'err'), 'map validates (no errors) ' + JSON.stringify(chk).slice(0, 200));
  if (SHOTS) await pg.screenshot({ path: SHOTS + '/1-editor-224-space.png' });
  // export -> import round trip
  const exp = await pg.evaluate(() => JSON.stringify(mbToCmap(MBE.m)));
  fs.writeFileSync('/tmp/mb-export.json', exp); await pg.setInputFiles('#mbFile', '/tmp/mb-export.json'); await pg.waitForTimeout(400);
  ok(await pg.evaluate(() => Object.values(cmAll()).filter(m => m.name === 'Eight Ring').length === 2), 'import adds a copy to My maps');
  // play it: lobby, per-slot teams 2v2v2v2
  await pg.click('#mbPlay'); await pg.waitForTimeout(800);
  const sel = await pg.evaluate(() => [document.getElementById('mapSel').value, !!CM_SEL, [...document.querySelectorAll('#lobby .lrow:not(.lh) .la')].map(s => s.value).join('')]);
  ok(sel[0].startsWith('cm:') && sel[1], 'lobby has the custom map selected ' + sel.join(' '));
  const las = await pg.$$('#lobby .lrow:not(.lh) .la'); const plan = 'AABBCCDD'; for (let i = 0; i < 8; i++) await las[i].selectOption(plan[i]); await pg.waitForTimeout(400);
  if (SHOTS) await pg.screenshot({ path: SHOTS + '/2-lobby-2v2v2v2-custom.png' });
  await pg.click('#startBtn'); await pg.waitForTimeout(6000);
  let g = await pg.evaluate(() => ({ custom: !!G.custom, MW, n: G.players.length, allies: G.players.map(p => p.ally).join(''), theme: G.theme, hqs: G.ents.filter(e => e.t === 'hq').length, me: ME }));
  ok(g.custom && g.MW === 224 && g.n === 8 && g.allies === '00112233' && g.theme === 'space' && g.hqs === 8, 'custom game running with 4 teams of 2 ' + JSON.stringify(g));
  const fps = await pg.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(f); else r(n / ((performance.now() - t0) / 1000)); })(); }));
  console.log('INFO fps (headless swiftshader, software GL) ' + fps.toFixed(1));
  g = await pg.evaluate(() => { const t0 = performance.now(), g0 = G.time; for (let i = 0; i < 1200; i++) simAdvance(0.1, 6); return { t: G.time | 0, simMs: +((performance.now() - t0) / Math.max(1, (G.time - g0) * 15)).toFixed(2), ents: G.ents.length, over: G.over, mined: G.players.map(p => p.stats.mined | 0).join(',') }; }); // 2 min of game time, sim only
  ok(g.t >= 100 && !g.over && g.ents > 150, 'in-browser sim runs 2 game-minutes on the 224 map, bots building ' + JSON.stringify(g));
  if (SHOTS) { await pg.evaluate(() => { const P = G.players.find(p => p.ally === 1) || G.players[1]; const s = G.starts[P.start]; if (typeof camGoto === 'function') camGoto(s[0], s[1]); }).catch(() => {}); await pg.waitForTimeout(800); await pg.screenshot({ path: SHOTS + '/3-custom-map-in-play.png' }); }
  // relock
  await pg.goto(URL0 + '?q=low&key=lock'); await pg.waitForTimeout(1200); ok(!(await vis()) && !(await pg.evaluate(() => [...document.querySelectorAll('#mapSel option')].some(o => o.value.startsWith('cm:') && !o.value.startsWith('cm:feat-')))), '?key=lock hides the builder and the custom maps again (v7.7.1 featured maps stay for everyone)');
  ok(!errs.length, 'no page errors ' + errs.slice(0, 3).join(' | ')); console.log(fail ? 'MAPBUILDER FAIL' : 'MAPBUILDER OK'); await br.close(); process.exit(fail ? 1 : 0);
})();
