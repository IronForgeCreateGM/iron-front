// v7.9.26 App Store app feel (js/appfeel.js): inside the app (Capacitor native stub) the web view's own page gestures are off:
// right-click menu (Reload/Back/Inspect), image drag, text-selection start, page pinch and double-click zoom — except in text boxes.
// The game's own right-click orders still work (checked with a real right-click on the minimap in a skirmish). Web page unchanged.
// Starts its own http server. NODE_PATH=<playwright-core node_modules> node test/appfeel-test.js
const { chromium } = require('playwright-core'), path = require('path'), { spawn } = require('child_process');
const root = path.resolve(__dirname, '..'), PORT = 8600 + Math.floor(Math.random() * 30), B = `http://127.0.0.1:${PORT}/`;
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
(async () => {
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1200));
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const CAP = `window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: {} };`;
  async function mk(init, opt, q) {
    const ctx = await br.newContext(Object.assign({ viewport: { width: 1280, height: 800 } }, opt || {}));
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    if (init) await pg.addInitScript(init);
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, rt => rt.fulfill({ status: 200, contentType: 'text/html', body: '<p>external</p>' }));
    await pg.goto(B + 'index.html?q=low&howto=0' + (q || '')); await pg.waitForTimeout(2600);
    return { ctx, pg, errs };
  }
  // fire synthetic events, return which ones had their default prevented
  const probe = pg => pg.evaluate(() => {
    const fire = (el, ev) => { el.dispatchEvent(ev); return ev.defaultPrevented; };
    const btn = document.getElementById('playBotsBtn') || document.querySelector('#menu button'), name = document.getElementById('pname');
    const img = document.createElement('img'); img.src = 'icons/icon-192.png'; document.getElementById('menu').appendChild(img);
    const r = {
      cmBtn: fire(btn, new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })),
      cmBody: fire(document.body, new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })),
      cmName: name ? fire(name, new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })) : null,
      dragImg: fire(img, new DragEvent('dragstart', { bubbles: true, cancelable: true })),
      selBtn: fire(btn, new Event('selectstart', { bubbles: true, cancelable: true })),
      selName: name ? fire(name, new Event('selectstart', { bubbles: true, cancelable: true })) : null,
      gesture: fire(document, new Event('gesturestart', { bubbles: true, cancelable: true })),
      dbl: fire(btn, new MouseEvent('dblclick', { bubbles: true, cancelable: true })),
      imgDrag: getComputedStyle(img).webkitUserDrag, inapp: document.documentElement.classList.contains('inapp'),
      on: !!(window.IF_APPFEEL && IF_APPFEEL.on), mob: typeof MOB !== 'undefined' && MOB.on };
    img.remove(); return r; });
  // 1) app, Mac-sized window (touch UI off)
  { const { ctx, pg, errs } = await mk(CAP); const r = await probe(pg);
    ok(r.on && r.inapp && !r.mob, 'app Mac: app feel on, touch UI off ' + JSON.stringify({ on: r.on, inapp: r.inapp, mob: r.mob }));
    ok(r.cmBtn && r.cmBody, 'app Mac: right-click on menus/page opens no web view menu (Reload/Inspect)');
    ok(r.cmName === false && r.selName === false, 'app Mac: player-name box keeps its copy/paste menu and text selection');
    ok(r.dragImg && r.imgDrag === 'none', 'app Mac: images cannot be dragged out (' + r.imgDrag + ')');
    ok(r.selBtn, 'app Mac: no text selection start on buttons/menus');
    ok(r.gesture && r.dbl, 'app Mac: trackpad pinch / double-click page zoom blocked with the touch UI off');
    // real right-click with the mouse on the menu: default prevented, page still there
    const seen = await pg.evaluate(() => { window.__cm = []; document.addEventListener('contextmenu', e => window.__cm.push(e.defaultPrevented)); return true; });
    const bb = await pg.locator('#playBotsBtn').boundingBox(); if (bb) await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2, { button: 'right' });
    await pg.waitForTimeout(200);
    const cm = await pg.evaluate(() => window.__cm); ok(seen && cm.length >= 1 && cm.every(Boolean), 'app Mac: real right-click on a menu button prevented ' + JSON.stringify(cm));
    // skirmish: the game's own right-click order on the minimap still goes out
    await pg.evaluate(() => { document.getElementById('playBotsBtn').click(); }); await pg.waitForTimeout(500);
    await pg.evaluate(() => document.getElementById('startBtn').click()); await pg.waitForTimeout(3500);
    const st = await pg.evaluate(() => { window.__iss = []; const o = NET.issue; NET.issue = function (c) { window.__iss.push(c && c.c); return o.apply(this, arguments); };
      const u = G.ents.filter(e => e.team === ME && e.kind === 'u' && e.hp > 0); UI.sel = u.slice(0, 3); return { n: UI.sel.length, started: !!G && !document.getElementById('menu').offsetParent }; });
    const mm = await pg.locator('#minimap, #mm, canvas#mmc').first().boundingBox().catch(() => null);
    if (mm) await pg.mouse.click(mm.x + mm.width * 0.5, mm.y + mm.height * 0.5, { button: 'right' });
    await pg.waitForTimeout(300);
    const iss = await pg.evaluate(() => window.__iss), cm2 = await pg.evaluate(() => window.__cm);
    ok(st.started && st.n > 0 && mm && iss.includes('move'), 'app Mac skirmish: right-click on the minimap still orders a move ' + JSON.stringify({ st, mm: !!mm, iss }));
    ok(cm2.every(Boolean), 'app Mac skirmish: and opens no web view menu');
    ok(!errs.length, 'app Mac: 0 page errors ' + errs.join(' | ')); await ctx.close(); }
  // 2) app on iPhone (touch UI on): long-press callouts / drag / pinch blocked, name box still selectable
  { const { ctx, pg, errs } = await mk(CAP, { viewport: { width: 874, height: 402 }, userAgent: IPHONE, hasTouch: true, isMobile: true }); const r = await probe(pg);
    ok(r.on && r.cmBtn && r.dragImg && r.gesture && r.cmName === false && r.selName === false, 'app iPhone: menus/drag/pinch blocked, name box selectable ' + JSON.stringify(r));
    ok(!errs.length, 'app iPhone: 0 page errors ' + errs.join(' | ')); await ctx.close(); }
  // 3) app with ?appfeel=0 (QA switch): off
  { const { ctx, pg } = await mk(CAP, null, '&appfeel=0'); const r = await probe(pg);
    ok(!r.on && !r.inapp && !r.cmBtn, 'app ?appfeel=0: off'); await ctx.close(); }
  // 4) web desktop: browser menus unchanged
  { const { ctx, pg, errs } = await mk(''); const r = await probe(pg);
    ok(!r.on && !r.inapp && !r.cmBtn && !r.cmBody && !r.dragImg && !r.selBtn && !r.gesture && !r.dbl, 'web desktop: unchanged (normal browser menus) ' + JSON.stringify(r));
    ok(!errs.length, 'web: 0 page errors ' + errs.join(' | ')); await ctx.close(); }
  await br.close(); srv.kill();
  console.log(fail ? `APPFEEL FAIL (${fail})` : 'APPFEEL OK'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
