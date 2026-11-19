// v7.9.14 phone smoothness (render only): iPhone 14 landscape emulation (touch) on a normal 96x96 map, mid-game.
//  - terrain is split into culled pieces on phones (fewer triangles drawn), full 4 verts/tile kept on normal maps
//  - no full-size bloom/FXAA render targets on the Mobile preset
//  - dynamic resolution drops the pixel ratio when the phone can't hold its cap (software GL here is always slow)
//  - a tap (touchend) unlocks WebAudio; no page errors. Prints emulated fps / frame times.
//  NODE_PATH=... node test/v7914-mobile-perf-test.js [http://localhost:8765 | repoDir]
const { chromium, devices } = require('playwright-core'), path = require('path');
const ARG = process.argv[2] || path.join(__dirname, '..'), ROOT = /^https?:/.test(ARG) ? ARG.replace(/\/?$/, '/') + 'index.html' : 'file://' + path.join(path.resolve(ARG), 'index.html');
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  const ctx = await br.newContext({ ...devices['iPhone 14 landscape'] }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(ROOT + '?slots=human:A:usa,hard:B,hard:C,hard:D&seed=5&ff=120');
  await pg.waitForFunction(() => typeof R3 !== 'undefined' && R3.terrain && typeof G !== 'undefined' && G.time > 1, null, { timeout: 180000 }); await pg.waitForTimeout(1000);
  const a = await pg.evaluate(() => ({ mob: MOB.on, q: R3.q.label, MW, chunks: R3.terrain.isMesh ? 1 : R3.terrain.children.length, res: R3.terrainRes, pr: R3.renderer.getPixelRatio(),
    ldr: [POST.ldr.width, POST.ldr.height], b1: [POST.b1.width, POST.b1.height], main: [POST.main.width, POST.main.height], dyn: !!MOB.dyn }));
  console.log('info ' + JSON.stringify(a));
  ok(a.mob && a.q === 'Mobile' && a.MW === 96, 'phone UI + Mobile preset on a 96 map');
  ok(a.chunks > 4 && a.res === 4, 'terrain split into culled pieces at full detail (' + a.chunks + ' pieces, ' + a.res + ' verts/tile)');
  ok(a.ldr[0] === 1 && a.b1[0] === 1 && a.main[0] > 300, 'no full-size bloom/FXAA targets on Mobile ' + JSON.stringify(a));
  const tri = await pg.evaluate(() => { R3.renderer.info.reset(); r3Render(0.016); return R3.renderer.info.render.triangles; });
  console.log('info triangles drawn per frame ' + tri);
  // dynamic resolution: software GL can't hold 30 fps, so the pixel ratio has to step down within ~10 s
  await pg.waitForFunction(() => R3.renderer.getPixelRatio() < 1.01, null, { timeout: 30000 }).catch(() => {});
  const d = await pg.evaluate(() => ({ pr: R3.renderer.getPixelRatio(), n: MOB.dyn && MOB.dyn.n, fps: R3.fps, w: R3.renderer.domElement.width, cw: R3.renderer.domElement.clientWidth }));
  ok(d.pr <= 1.01 && d.n >= 1 && d.cw > 600, 'dynamic resolution stepped down to 1.0 on a slow GPU, canvas still fills the screen ' + JSON.stringify(d));
  const f = await pg.evaluate(() => new Promise(r => { const s = []; let l = performance.now(); const k = t => { s.push(t - l); l = t; if (s.length < 40) requestAnimationFrame(k); else r(s); }; requestAnimationFrame(k); }));
  console.log('info emulated rAF interval ms (software GL) mean ' + (f.reduce((x, y) => x + y, 0) / f.length).toFixed(1));
  // pausing the match must not move the resolution
  const p = await pg.evaluate(() => { togglePause(); const n = MOB.dyn.n; return new Promise(r => setTimeout(() => { const m = MOB.dyn.n; togglePause(); r([n, m]); }, 4500)); });
  ok(p[0] === p[1], 'no resolution changes while paused ' + p);
  // audio unlock on a tap (touchend)
  await pg.touchscreen.tap(400, 200); await pg.waitForTimeout(300);
  const au = await pg.evaluate(() => typeof AU !== 'undefined' && AU.ctx ? AU.ctx.state : 'none');
  ok(au !== 'none', 'a tap creates/resumes the audio context (' + au + ')');
  ok(!errs.length, 'no page errors ' + errs.slice(0, 2).join(' | '));
  await ctx.close();
  // ?dynres=0 keeps the full pixel ratio
  const c2 = await br.newContext({ ...devices['iPhone 14 landscape'] }); const p2 = await c2.newPage();
  await p2.goto(ROOT + '?slots=human:A:usa,hard:B&seed=5&dynres=0'); await p2.waitForFunction(() => typeof R3 !== 'undefined' && R3.terrain && G.time > 1, null, { timeout: 180000 }); await p2.waitForTimeout(8000);
  const pr2 = await p2.evaluate(() => R3.renderer.getPixelRatio()); ok(pr2 > 1.4, '?dynres=0 keeps pixel ratio ' + pr2); await c2.close();
  console.log(fail ? 'V7914MOB FAIL' : 'V7914MOB OK'); await br.close(); process.exit(fail ? 1 : 0);
})();
