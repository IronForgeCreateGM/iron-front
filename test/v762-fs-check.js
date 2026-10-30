// v7.6.2 full screen + home-screen web app check (under /iron-front/): manifest + icons resolve, Full screen buttons in the
// menu and the pause menu, iPhone Safari one-time tip, 0 page errors. Saves mobile landscape shots.
// node test/v762-fs-check.js <outDir>
const fs = require('fs'), path = require('path'), { chromium } = require('playwright-core');
const ROOT = path.join(__dirname, '..'), OUT = process.argv[2] || '/workspace/shots762/fs'; fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp' };
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
async function page(br, opt) { const ctx = await br.newContext(opt); const pg = await ctx.newPage(); pg.errs = []; pg.fails = [];
  pg.on('pageerror', e => pg.errs.push(e.message)); pg.on('response', r => { if (r.status() >= 400) pg.fails.push(r.status() + ' ' + r.url()); });
  await pg.route('http://iron.test/**', r => { const u = new URL(r.request().url()); if (!u.pathname.startsWith('/iron-front/')) return r.fulfill({ status: 404, body: 'outside /iron-front/' });
    let p = decodeURIComponent(u.pathname.replace('/iron-front/', '/')); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: 'nf' }); r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); });
  return pg; }
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--ignore-gpu-blocklist'] });
  let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
  // desktop
  let pg = await page(br, { viewport: { width: 1400, height: 900 } }); await pg.goto('http://iron.test/iron-front/'); await pg.waitForTimeout(1500);
  const man = await pg.evaluate(async () => { const l = document.querySelector('link[rel=manifest]'); const r = await fetch(l.href); const j = await r.json(); const ic = [];
    for (const i of j.icons) { const rr = await fetch(new URL(i.src, l.href)); ic.push(i.sizes + ':' + rr.status); }
    const at = document.querySelector('link[rel=apple-touch-icon]'); const ar = await fetch(at.href);
    const meta = n => (document.querySelector('meta[name="' + n + '"]') || {}).content;
    return { href: l.href, display: j.display, ov: j.display_override, orient: j.orientation, name: j.name, short: j.short_name, start: new URL(j.start_url || '.', l.href).href, scope: j.scope, ic, apple: at.getAttribute('sizes') + ':' + ar.status,
      cap: meta('apple-mobile-web-app-capable'), mcap: meta('mobile-web-app-capable'), bar: meta('apple-mobile-web-app-status-bar-style'), vp: meta('viewport'), theme: meta('theme-color') }; });
  console.log(JSON.stringify(man));
  ok(man.display === 'fullscreen' && (man.ov || []).includes('standalone') && /landscape/.test(man.orient) && man.name === 'Iron Front' && man.short === 'Iron Front', 'manifest fields');
  ok(man.ic.every(s => /:200$/.test(s)) && man.ic.some(s => /^192/.test(s)) && man.ic.some(s => /^512/.test(s)) && man.apple === '180x180:200', 'icons 192/512 + apple-touch 180 resolve under /iron-front/');
  ok(man.start.startsWith('http://iron.test/iron-front/'), 'start_url inside /iron-front/');
  ok(man.cap === 'yes' && man.mcap === 'yes' && man.bar === 'black-translucent' && /viewport-fit=cover/.test(man.vp), 'iOS / mobile web-app metas');
  ok(await pg.evaluate(() => [...document.querySelectorAll('#menu .fsBtn, .homeSmall .fsBtn')].some(b => b.offsetParent)), 'Full screen button visible on the menu');
  await pg.evaluate(() => { startGame('normal', { seed: 7, map: 'classic', fog: true, slots: buildSlots([['human', 'A', 'bra'], ['easy', 'B', 'rus']], null, 'classic') }); }); await pg.waitForTimeout(1500);
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(500);
  ok(await pg.evaluate(() => { const b = document.querySelector('#pause .fsBtn'); return !!(b && b.offsetParent); }), 'Full screen button in the in-game pause menu');
  await pg.evaluate(() => document.querySelector('#pause .fsBtn').click()); await pg.waitForTimeout(600);
  console.log('desktop after click: fullscreen=' + await pg.evaluate(() => !!document.fullscreenElement) + ' label=' + await pg.evaluate(() => document.querySelector('#pause .fsBtn').textContent));
  ok(pg.errs.length === 0, 'desktop 0 page errors ' + pg.errs.join(' | ')); await pg.context().close();
  // iPhone Safari landscape
  pg = await page(br, { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: IPHONE });
  await pg.goto('http://iron.test/iron-front/'); await pg.waitForTimeout(2500);
  const tip = await pg.evaluate(() => { const t = document.getElementById('fsTip'); return t && t.style.display !== 'none' ? t.textContent : null; });
  ok(tip && tip.includes('For full screen on iPhone: tap Share, then Add to Home Screen, and open Iron Front from the icon.'), 'iPhone one-time tip shown: ' + tip);
  await pg.screenshot({ path: path.join(OUT, 'iphone-menu-tip.png') });
  await pg.reload(); await pg.waitForTimeout(2500); ok(await pg.evaluate(() => { const t = document.getElementById('fsTip'); return !t || t.style.display === 'none'; }), 'tip only once (not on reload)');
  await pg.evaluate(() => { localStorage.setItem('ifMobile', '1'); }); await pg.reload(); await pg.waitForTimeout(2000);
  await pg.evaluate(() => { startGame('normal', { seed: 7, map: 'classic', fog: true, slots: buildSlots([['human', 'A', 'bra'], ['easy', 'B', 'rus']], null, 'classic') }); }); await pg.waitForTimeout(3500);
  await pg.screenshot({ path: path.join(OUT, 'iphone-landscape-game.png') });
  const hb = await pg.$('#mMenu'); console.log('hamburger:', !!hb);
  if (hb) { await hb.tap(); await pg.waitForTimeout(600); }
  else await pg.evaluate(() => { if (typeof togglePause === 'function') togglePause(); else document.getElementById('pause').style.display = ''; });
  ok(await pg.evaluate(() => { const b = document.querySelector('#pause .fsBtn'); return !!(b && b.offsetParent); }), 'Full screen button in the phone hamburger (pause) menu');
  await pg.screenshot({ path: path.join(OUT, 'iphone-landscape-pause.png') });
  await pg.evaluate(() => document.querySelector('#pause .fsBtn').click()); await pg.waitForTimeout(500);
  ok(await pg.evaluate(() => { const t = document.getElementById('fsTip'); return !!(t && t.style.display !== 'none'); }), 'tapping Full screen on iPhone shows the Add to Home Screen tip');
  ok(pg.errs.length === 0, 'iPhone 0 page errors ' + pg.errs.join(' | '));
  console.log('http fails:', pg.fails.join(' | ') || 'none'); console.log(bad ? 'FS CHECK FAILED ' + bad : 'FS CHECK ALL PASS'); await br.close();
})();
