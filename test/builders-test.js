// v7.7.4 SC2-style builder bots at construction sites (render only). node test/builders-test.js [shotPath]
// Loads the repo like GitHub Pages (models on), finds a bot base mid-build, checks the builder bots show up, weld, idle and drive off; 0 page errors.
const fs = require('fs'), path = require('path'), { chromium } = require('playwright-core');
const ROOT = path.join(__dirname, '..'), SHOT = process.argv[2] || '/workspace/n1103/builders.png';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.svg': 'image/svg+xml' };
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let fail = 0; const ok = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x ? ' ' + JSON.stringify(x) : '')); if (!c) fail++; };
  for (const q of ['high', 'low']) {
    const pg = await br.newPage({ viewport: { width: 960, height: 600 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.route('http://iron.test/**', r => { const u = new URL(r.request().url()); let p = decodeURIComponent(u.pathname.replace('/iron-front/', '/')); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: 'nf' }); r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); });
    await pg.goto('http://iron.test/iron-front/?q=' + q); await pg.waitForTimeout(2500);
    await pg.evaluate(() => { startGame('hard', { seed: 61, map: 'classic', fog: false, slots: buildSlots([['hard', 'A', 'usa'], ['hard', 'B', 'rus']]) }); G.opts.fog = false; if (typeof DIR !== 'undefined') DIR.auto = false; });
    // fast-forward until a big (non-wall) site is 35-65% built
    const id = await pg.evaluate(() => { paused = true; for (let i = 0; i < 30 * 60 * 8; i++) { stepGame(); G.events.length = 0;
        const s = G.ents.find(e => e.kind === 'b' && e.con && e.con.p > 0.35 && e.con.p < 0.65 && !/wall|gate|gtower/.test(e.t) && e.w * e.h >= 4); if (s) return s.id; } return null; });
    ok(id != null, q + ': found a bot building mid-construction');
    if (id == null) { await pg.close(); continue; }
    await pg.evaluate(id => { const s = G.ents.find(e => e.id === id); DIR.auto = false; DIR.cur = null; R3.cam.td = R3.cam.d = 11; jumpTo(s.x, s.y, true); }, id);
    await pg.evaluate(() => { for (let i = 0; i < 8; i++) r3Render(0.1); });
    const st = await pg.evaluate(id => { const o = R3.objs.get(id), s = G.ents.find(e => e.id === id); if (!o || !o.cs || !o.cs.bots) return null;
      const b = o.cs.bots, far = b.some(x => Math.hypot(x.g.position.x, x.g.position.z) > Math.max(s.w, s.h) * 0.75 + 1.2);
      return { n: b.length, vis: b.filter(x => x.g.visible).length, far, t: s.t, p: +s.con.p.toFixed(2), lite: csLite() }; }, id);
    ok(st && st.vis >= 1 && st.n === st.vis, q + ': builder bots on site', st);
    ok(st && !st.far, q + ': bots stay on the walk loop round the site', st);
    ok(st && (q === 'low' ? st.n === 1 : st.n >= 1), q + ': bot count fits the quality (low/phone = 1)', st);
    // welding: over ~3 s at least one bot has its torch lit
    // (frames are driven by hand: software GL in headless Chrome is too slow for real-time checks)
    const weld = await pg.evaluate(id => { let w = 0, mv = 0; const p0 = {}; for (let i = 0; i < 40; i++) { r3Render(0.1); const o = R3.objs.get(id); if (!o || !o.cs) continue;
        if (o.cs.bots.some(b => b.tip.visible)) w++; o.cs.bots.forEach((b, k) => { const P = b.g.position, q = p0[k]; if (q && Math.hypot(P.x - q[0], P.z - q[1]) > 0.01) mv++; p0[k] = [P.x, P.z]; }); } return { w, mv }; }, id);
    ok(weld.w > 0 && weld.w < 40, q + ': bots weld some of the time (torch lit)', weld);
    ok(weld.mv > 0, q + ': bots drive between welding spots', weld);
    if (q === 'high') await pg.screenshot({ path: SHOT, timeout: 180000 });
    // finish: run the sim until the site is done, the bots drive off and the site is removed
    await pg.evaluate(id => { for (let i = 0; i < 30 * 120; i++) { stepGame(); G.events.length = 0; const s = G.ents.find(e => e.id === id); if (!s || !s.con) break; } for (let i = 0; i < 12; i++) r3Render(0.1); }, id);
    const gone = await pg.evaluate(id => { const o = R3.objs.get(id), s = G.ents.find(e => e.id === id); return { done: !!s && !s.con, cs: !!(o && o.cs) }; }, id);
    ok(gone.done && !gone.cs, q + ': site finished, bots and scaffold cleared', gone);
    ok(errs.length === 0, q + ': no page errors', errs.slice(0, 2));
    await pg.close();
  }
  await br.close(); console.log(fail ? 'BUILDERS FAIL ' + fail : 'BUILDERS OK'); process.exit(fail ? 1 : 0);
})();
