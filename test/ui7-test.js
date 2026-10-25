// v7.0 UI layout test: title screen, lobby mode tabs, Endless HUD, Raijin transform button, mobile ⚡ (Japan only),
// iPhone touch targets + safe-area CSS, no stuck tooltip. NODE_PATH=/tmp/tb/node_modules node test/ui7-test.js
const { chromium } = require('playwright-core'), path = require('path'), fs = require('fs');
const URL0 = 'file://' + path.resolve(__dirname, '../index.html');
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  const vis = (pg, s) => pg.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05; }, s);
  const box = (pg, s) => pg.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, s);
  // --- desktop: title -> home -> lobby tabs
  { const pg = await br.newPage({ viewport: { width: 1280, height: 800 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(URL0 + '?q=low'); await pg.waitForTimeout(1200);
    ok(!(await vis(pg, '#titleScreen')), 'title skipped for automated/deep-link runs (tests unaffected)');
    await pg.goto(URL0 + '?title=1&q=low'); await pg.waitForTimeout(1500);
    ok(await vis(pg, '#titleScreen'), 'title screen shown on launch');
    const tb = await box(pg, '#titleScreen'); ok(tb && tb.w === 1280 && tb.h === 800, 'title covers the viewport');
    ok(await pg.evaluate(() => document.querySelectorAll('#tsFlags span').length) === await pg.evaluate(() => Object.keys(FACTIONS).length), 'title shows every faction flag');
    const lb = await box(pg, '.tsLogo'), gb = await box(pg, '#tsGo'); ok(lb && gb && gb.y > lb.y + lb.h && gb.h >= 44, 'logo above a ≥44px deploy button');
    await pg.keyboard.press('Enter'); await pg.waitForTimeout(800);
    ok(!(await vis(pg, '#titleScreen')), 'any key dismisses title');
    ok(await vis(pg, '#playBotsBtn') && await vis(pg, '#playEndlessBtn'), 'home: Play vs Bots + Endless buttons');
    ok(/v7\.\d/.test(await pg.textContent("#menu .sub")), "menu subtitle says v7.x");
    await pg.click('#playEndlessBtn'); await pg.waitForTimeout(600);
    ok(await pg.evaluate(() => document.querySelector('#modeTabs [data-m=endless]').classList.contains('on')), 'Endless button opens lobby on the Endless tab');
    ok(await vis(pg, '#endInfo'), 'Endless info panel visible');
    await pg.click('#modeTabs [data-m=skirmish]'); await pg.waitForTimeout(400);
    ok(!(await vis(pg, '#endInfo')) && await pg.evaluate(() => document.querySelector('#modeTabs [data-m=skirmish]').classList.contains('on')), 'Skirmish tab switches back');
    const t1 = await box(pg, '#modeTabs [data-m=skirmish]'), t2 = await box(pg, '#modeTabs [data-m=endless]'); ok(t1 && t2 && Math.abs(t1.y - t2.y) < 2 && t2.x > t1.x + t1.w - 1, 'mode tabs side by side, no overlap');
    // tooltip hygiene
    await pg.evaluate(() => { UI.tip = UI.tip || document.getElementById('tip'); UI.tip.style.display = 'block'; UI.tipOwner = document.body; window.dispatchEvent(new Event('blur')); });
    ok(await pg.evaluate(() => UI.tip.style.display === 'none'), 'tooltip hidden on window blur');
    ok(!errs.length, 'desktop: no page errors ' + errs.slice(0, 2).join(' | ')); await pg.close(); }
  // --- desktop in-game: Endless HUD + Japan transform button
  { const pg = await br.newPage({ viewport: { width: 1280, height: 800 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(URL0 + '?q=low&home=endless'); await pg.waitForTimeout(1200);
    await pg.evaluate(() => { const c = [...document.querySelectorAll('.fcard')].find(c => c.textContent.includes('Japan')); c && c.click(); document.getElementById('startBtn').click(); }); await pg.waitForTimeout(3000);
    ok(await pg.evaluate(() => G.mode === 'endless' || !!G.end), 'Endless game started');
    ok(await vis(pg, '#waveHud'), 'wave HUD visible in Endless');
    const wb = await box(pg, '#waveHud'), sb = await box(pg, '#side'); ok(wb && sb && wb.x + wb.w <= sb.x, 'wave HUD does not overlap the side panel');
    ok(/skip/i.test(await pg.textContent('#waveHud')), 'build break shows a Skip control');
    await pg.evaluate(() => { const u = addU('raijin', ME, G.players[ME].sx || 10, G.players[ME].sy || 10); setSel([u]); }); await pg.waitForTimeout(800);
    ok(await vis(pg, '#xfBtn') && /JET/.test(await pg.textContent('#xfBtn')), 'Raijin selected -> ⚡ transform button in panel');
    await pg.evaluate(() => toggleQuiet(true)); await pg.waitForTimeout(300);
    ok(await pg.evaluate(() => R3.qName === 'quiet' && document.body.classList.contains('quiet')), 'Quiet mode still applies (quality quiet + body.quiet)');
    const fr = await pg.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
    ok(fr > 1, 'render loop keeps ticking in Quiet mode (' + fr.toFixed(1) + ' fps in software GL)');
    await pg.evaluate(() => toggleQuiet(false));
    ok(!errs.length, 'endless: no page errors ' + errs.slice(0, 2).join(' | ')); await pg.close(); }
  // --- iPhone 844x390 mobile mode: touch targets, ⚡ only for Japan
  for (const fac of ['Japan', 'France']) {
    const pg = await br.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(URL0 + (fac === 'Japan' ? '?title=1&q=low' : '?q=low')); await pg.waitForTimeout(1000); await pg.evaluate(() => mobSet(true)); await pg.waitForTimeout(300);
    if (fac === 'Japan') { await pg.tap('#tsGo'); await pg.waitForTimeout(900);
      ok(!(await vis(pg, '#titleScreen')) && await vis(pg, '#playBotsBtn') && await pg.evaluate(() => typeof started === 'undefined' || !started), 'iPhone: tapping the title opens the menu (no ghost click starting a game)'); }
    if (fac === 'Japan') { const small = await pg.evaluate(() => [...document.querySelectorAll('#homeBtns button')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 40).map(b => b.id || b.textContent.slice(0, 12)));
      ok(!small.length, 'iPhone home: all buttons ≥40px tall ' + small.join(',')); }
    await pg.evaluate(() => document.getElementById('playBotsBtn').click()); await pg.waitForTimeout(500);
    await pg.evaluate(f => { const c = [...document.querySelectorAll('.fcard')].find(c => c.textContent.includes(f)); c && c.click(); document.getElementById('startBtn').click(); }, fac); await pg.waitForTimeout(3500);
    const xs = await pg.evaluate(() => { const b = document.querySelector('#mCmd [data-k=xform]'); return b ? getComputedStyle(b).display !== 'none' : false; });
    ok(fac === 'Japan' ? xs : !xs, `mobile ⚡ transform button ${fac === 'Japan' ? 'shown' : 'hidden'} for ${fac}`);
    if (fac === 'Japan') { const small = await pg.evaluate(() => [...document.querySelectorAll('#mCmd button,#mTabs button,#mobMenuBtn')].filter(b => b.offsetParent && getComputedStyle(b).display !== 'none').map(b => b.getBoundingClientRect()).filter(r => Math.min(r.width, r.height) < 40).length);
      ok(small === 0, 'iPhone in-game: command/tab buttons ≥40px (' + small + ' too small)');
      const off = await pg.evaluate(() => [...document.querySelectorAll('#mHud button')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).filter(r => r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1).length);
      ok(off === 0, 'iPhone in-game: no HUD button off-screen (' + off + ')'); }
    ok(!errs.length, `iPhone ${fac}: no page errors ` + errs.slice(0, 2).join(' | ')); await pg.close(); }
  // --- iPhone Endless: wave HUD must not cover the money bar, minimap or command buttons
  { const pg = await br.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(URL0 + '?q=low&home=endless'); await pg.waitForTimeout(1000); await pg.evaluate(() => mobSet(true));
    await pg.evaluate(() => document.getElementById('startBtn').click()); await pg.waitForTimeout(3500);
    const hit = await pg.evaluate(() => { const w = document.getElementById('waveHud').getBoundingClientRect(), ov = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      return ['#mTop', '#mCmd', '#minimap', '#mobMenuBtn', '#mTabs'].filter(s => { const e = document.querySelector(s); if (!e || !e.offsetParent && getComputedStyle(e).position !== 'fixed') return false; const r = e.getBoundingClientRect(); return r.width && ov(w, r); }); });
    ok(await vis(pg, '#waveHud') && !hit.length, 'iPhone Endless: wave HUD clear of other HUD (' + hit.join(',') + ')');
    await pg.screenshot({ path: path.resolve(__dirname, '../shots/v7_0-iphone-endless.png') });
    ok(!errs.length, 'iPhone Endless: no page errors ' + errs.slice(0, 2).join(' | ')); await pg.close(); }
  // --- static: safe areas, PWA, Capacitor
  const css = fs.readFileSync(path.resolve(__dirname, '../style.css'), 'utf8'), html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  ok(/viewport-fit=cover/.test(html) && (css.match(/safe-area-inset/g) || []).length > 15, 'safe-area insets used throughout');
  const man = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../manifest.json'), 'utf8')); ok(['180x180', '192x192', '512x512'].every(s => man.icons.some(i => i.sizes === s)) && man.icons.every(i => fs.existsSync(path.resolve(__dirname, '..', i.src))), 'PWA manifest icons 180/192/512 exist');
  const cap = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../capacitor.config.json'), 'utf8')); ok(cap.webDir === 'www' && fs.existsSync(path.resolve(__dirname, '../scripts/build-www.js')) && fs.existsSync(path.resolve(__dirname, '../APP-STORE.md')), 'Capacitor config + build-www + APP-STORE.md');
  await br.close(); console.log(fail ? 'UI7 FAIL ' + fail : 'UI7 OK'); process.exit(fail ? 1 : 0);
})();
