// v7.9.27: GPU context loss recovery. Loses the WebGL context mid-skirmish (WEBGL_lose_context) in the App Store app at Mac size and
// iPhone size on a 224 map, plus the web build: offline match pauses, panel covers the black screen, Try again/Restart after the wait,
// picture comes back on restore (screenshot not black), pause menu waits for Resume, no page errors. Online is not paused (code path check).
// NODE_PATH=<playwright-core> node test/gpuloss-test.js [url]
const { chromium } = require('playwright-core'), path = require('path');
const URL0 = process.argv[2] || 'file://' + path.resolve(__dirname, '../index.html');
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  const cases = [
    { tag: 'app Mac-size classic', app: true, vp: { width: 1280, height: 800 }, q: '?mobile=0&howto=0', map: 'classic', wait: 0 },
    { tag: 'app iPhone-size deltakings (224)', app: true, vp: { width: 874, height: 402 }, q: '?mobile=1&howto=0', map: 'deltakings', wait: 0, touch: true },
    { tag: 'web desktop, stuck then Try again', app: false, vp: { width: 1200, height: 800 }, q: '?mobile=0&howto=0', map: 'classic', wait: 1200 },
  ];
  for (const c of cases) {
    const ctx = await br.newContext({ viewport: c.vp, hasTouch: !!c.touch }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    if (c.app) await pg.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' }; });
    await pg.goto(URL0 + c.q); await pg.waitForTimeout(2500);
    await pg.evaluate(m => { startGame('normal', { seed: 7, map: m, fog: false, slots: buildSlots([['human', 'A', 'usa'], ['easy', 'B', 'rus']], null, m) }); }, c.map);
    await pg.waitForTimeout(3000);
    const shotLen = async () => (await pg.screenshot()).length;
    const s0 = await shotLen();
    const pre = await pg.evaluate(w => { if (w) IF_GPU.waitMs = w; return [paused, typeof IF_GPU, !!IF_GPU.ext, IF_GPU.cv === R3.renderer.domElement]; }, c.wait);
    ok(!pre[0] && pre[1] === 'object' && pre[2] && pre[3], c.tag + ': running, IF_GPU attached to the game canvas ' + JSON.stringify(pre));
    await pg.evaluate(() => IF_GPU.ext.loseContext()); await pg.waitForTimeout(700);
    const lost = await pg.evaluate(() => { const p = document.getElementById('gpuLost'), r = p && p.getBoundingClientRect(); return { paused, lost: IF_GPU.lost, mob: MOB.lost, auto: IF_GPU.autoPaused, panel: p && getComputedStyle(p).display, full: r && r.width >= innerWidth - 1 && r.height >= innerHeight - 1, btns: getComputedStyle(document.getElementById('gpuLostBtns')).display, t: G.time }; });
    ok(lost.lost && lost.mob && lost.paused && lost.auto, c.tag + ': context lost -> offline match paused ' + JSON.stringify(lost));
    ok(lost.panel === 'flex' && lost.full && lost.btns === 'none', c.tag + ': full-screen "Graphics paused" panel, no buttons yet');
    await pg.keyboard.press('Escape'); await pg.keyboard.press('p'); const kp = await pg.evaluate(() => paused); ok(kp, c.tag + ': Esc / P cannot resume behind the panel');
    if (c.wait) await pg.screenshot({ path: '/tmp/gpuloss-panel.png' });
    await pg.waitForTimeout(600); const t2 = await pg.evaluate(() => G.time); ok(t2 === lost.t, c.tag + ': sim does not run while blind (' + lost.t + ' -> ' + t2 + ')');
    if (c.wait) {
      await pg.waitForTimeout(c.wait); const st = await pg.evaluate(() => { const b = document.getElementById('gpuRetry').getBoundingClientRect(); return [getComputedStyle(document.getElementById('gpuLostBtns')).display, b.height, document.getElementById('gpuLostTxt').textContent]; });
      ok(st[0] === 'flex' && st[1] >= 44, c.tag + ': after the wait, Try again / Restart shown (44 pt) ' + JSON.stringify(st));
      await pg.click('#gpuRetry'); await pg.waitForTimeout(2500);
    } else { await pg.evaluate(() => IF_GPU.ext.restoreContext()); await pg.waitForTimeout(2500); }
    const back = await pg.evaluate(() => ({ lost: IF_GPU.lost, mob: MOB.lost, ctxLost: R3.renderer.getContext().isContextLost(), panel: getComputedStyle(document.getElementById('gpuLost')).display, paused, pauseMenu: document.getElementById('pause').style.display, tri: R3.renderer.info.render.triangles }));
    ok(!back.lost && !back.mob && !back.ctxLost && back.panel === 'none', c.tag + ': restored, panel gone ' + JSON.stringify(back));
    ok(back.paused && back.pauseMenu === 'flex', c.tag + ': pause menu waits for the player to Resume');
    await pg.evaluate(() => togglePause()); await pg.waitForTimeout(1200);
    const s1 = await shotLen(); const run = await pg.evaluate(() => [paused, G.time, R3.renderer.info.render.triangles]);
    ok(!run[0] && run[1] > t2 && run[2] > 1000, c.tag + ': resumed, drawing again ' + JSON.stringify(run));
    ok(s1 > s0 * 0.6, c.tag + ': picture is back, not black (png ' + s0 + ' -> ' + s1 + ' bytes)');
    ok(!errs.length, c.tag + ': no page errors ' + errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  // online: lockstep must not pause; the panel still covers the black screen (code check, no relay needed)
  const ctx = await br.newContext({ viewport: { width: 1200, height: 800 } }); const pg = await ctx.newPage();
  await pg.goto(URL0 + '?mobile=0&howto=0'); await pg.waitForTimeout(2500);
  await pg.evaluate(() => { startGame('normal', { seed: 7, map: 'classic', fog: false, slots: buildSlots([['human', 'A', 'usa'], ['easy', 'B', 'rus']], null, 'classic') }); });
  await pg.waitForTimeout(1500);
  const on = await pg.evaluate(() => { const was = NET.online; NET.online = true; gpuOnLost({ preventDefault() {} }); const r = [paused, IF_GPU.autoPaused, getComputedStyle(document.getElementById('gpuLost')).display, document.getElementById('gpuLostTxt').textContent]; gpuOnRestored(); NET.online = was; return r; });
  ok(on[0] === false && on[1] === false && on[2] === 'flex' && /online match keeps running/.test(on[3]), 'online: not paused, panel says the match keeps running ' + JSON.stringify(on));
  await ctx.close();
  await br.close(); console.log(fail ? 'GPULOSS FAIL' : 'GPULOSS OK'); process.exit(fail ? 1 : 0);
})();
