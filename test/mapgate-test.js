// v7.8.9: Full Unlock MAP gate (native only). Web default = everything open; ?unlock=0 forces the gate; ?unlock=1 opens all.
// Free maps: classic + frost. Locked when gated: volcano, volcano8, razorwheel, hellgate, endless, featured cm: maps.
// NODE_PATH=/workspace/pwlib/node_modules node test/mapgate-test.js [url]
const { chromium } = require('playwright-core'), path = require('path');
const BASE = process.argv[2] || ('file://' + path.resolve(__dirname, '../index.html'));
const LOCKED = ['volcano', 'volcano8', 'razorwheel', 'hellgate', 'endless'], FREE = ['classic', 'frost'];
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  async function page(q, init) {
    const ctx = await br.newContext({ viewport: { width: 1280, height: 800 } });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    if (init) await pg.addInitScript(init);
    await pg.goto(BASE + q); await pg.waitForTimeout(2200);
    await pg.evaluate(() => { if (typeof homeShow === 'function') homeShow('bots'); });
    await pg.waitForTimeout(300);
    return { ctx, pg, errs };
  }
  const pick = (pg, v) => pg.evaluate(v => { const ms = document.getElementById('mapSel'); ms.value = v; ms.dispatchEvent(new Event('change')); const o = document.getElementById('unlockOffer'); const r = { val: ms.value, offer: !!(o && o.style.display === 'flex'), body: (document.getElementById('unlockOfferBody') || {}).textContent || '' }; if (o) o.style.display = 'none'; return r; }, v);
  const state = pg => pg.evaluate(() => {
    const ms = document.getElementById('mapSel');
    return {
      gate: unlockGateActive(), owned: unlockOwned(),
      lockedOpts: [...ms.options].filter(o => o.textContent.startsWith('🔒')).map(o => o.value),
      lockedPresets: [...document.querySelectorAll('#presets button')].filter(b => b.textContent.startsWith('🔒')).map(b => b.dataset.p),
      endTab: (document.querySelector('#modeTabs button[data-m="endless"]') || {}).textContent,
      featured: [...ms.options].filter(o => o.value.startsWith('cm:')).map(o => o.value),
      facs: Object.keys(FACTIONS).filter(f => unlockFacOk(f, true)).length,
    };
  });
  // --- 1. WEB default: everything open ---
  {
    const { ctx, pg, errs } = await page('?q=low');
    const st = await state(pg);
    ok(!st.gate && st.owned, 'web default: gate off, owned ' + JSON.stringify([st.gate, st.owned]));
    ok(st.facs === 8, 'web default: all 8 countries open got ' + st.facs);
    ok(!st.lockedOpts.length && !st.lockedPresets.length && !st.endTab.includes('🔒'), 'web default: no 🔒 on maps/presets/Endless ' + JSON.stringify(st));
    for (const m of LOCKED.filter(m => m !== 'endless').concat(st.featured)) { const r = await pick(pg, m); ok(r.val === m && !r.offer, 'web default: map ' + m + ' selectable'); }
    const all = await pg.evaluate(() => LOCKED_ALL = ['volcano', 'volcano8', 'razorwheel', 'hellgate', 'endless'].every(m => unlockMapOk(m)));
    ok(all, 'web default: unlockMapOk true for every map');
    // presets with locked-on-native maps still apply on web
    const pr = await pg.evaluate(() => { document.querySelector('#presets button[data-p="t4v4"]').click(); return { map: document.getElementById('mapSel').value, n: lobbyRead().filter(r => r[0] !== 'off').length }; });
    ok(pr.map === 'volcano8' && pr.n === 8, 'web default: 4v4 preset sets volcano8 + 8 rows ' + JSON.stringify(pr));
    const en = await pg.evaluate(() => { setMode('endless'); const r = MENU.mode; setMode('skirmish'); return r; });
    ok(en === 'endless', 'web default: Endless tab works');
    ok(!errs.length, 'web default: no page errors ' + errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  // --- 2. ?unlock=0 forces gate ---
  {
    const { ctx, pg, errs } = await page('?q=low&unlock=0');
    const st = await state(pg);
    ok(st.gate && !st.owned, 'unlock=0: gate on, not owned');
    ok(st.facs === 4, 'unlock=0: 4 free countries got ' + st.facs);
    const want = LOCKED.filter(m => m !== 'endless').concat(st.featured).sort().join(',');
    ok(st.lockedOpts.filter(v => v !== 'endless').sort().join(',') === want, 'unlock=0: 🔒 on locked maps ' + st.lockedOpts.join(','));
    ok(FREE.every(m => !st.lockedOpts.includes(m)), 'unlock=0: classic + frost not locked');
    ok(['t4v4', 'hellgate', 'ffa8', 'mix8'].every(p => st.lockedPresets.includes(p)) && ['duel', 'ffa2', 't3v3', 'coop'].every(p => !st.lockedPresets.includes(p)), 'unlock=0: locked-map presets show 🔒 ' + st.lockedPresets.join(','));
    ok(st.endTab.includes('🔒'), 'unlock=0: Endless tab shows 🔒');
    for (const m of FREE) { const r = await pick(pg, m); ok(r.val === m && !r.offer, 'unlock=0: free map ' + m + ' selectable'); }
    await pick(pg, 'frost');
    for (const m of LOCKED.filter(m => m !== 'endless').concat(st.featured)) { const r = await pick(pg, m); ok(r.val === 'frost' && r.offer && /Full Unlock/.test(r.body), 'unlock=0: locked ' + m + ' opens offer, snaps back to frost ' + JSON.stringify([r.val, r.offer])); }
    // preset with locked map: offer, lobby untouched
    const pr = await pg.evaluate(() => { const before = JSON.stringify(lobbyRead()), mb = document.getElementById('mapSel').value; document.querySelector('#presets button[data-p="hellgate"]').click(); const o = document.getElementById('unlockOffer'); const r = { same: JSON.stringify(lobbyRead()) === before, map: document.getElementById('mapSel').value, mb, offer: o && o.style.display === 'flex' }; o.style.display = 'none'; return r; });
    ok(pr.same && pr.map === pr.mb && pr.offer, 'unlock=0: Hellgate preset -> offer, lobby + map unchanged ' + JSON.stringify(pr));
    const pf = await pg.evaluate(() => { document.querySelector('#presets button[data-p="ffa2"]').click(); return { map: document.getElementById('mapSel').value, n: lobbyRead().filter(r => r[0] !== 'off').length }; });
    ok(pf.n === 4 && pf.map === 'frost', 'unlock=0: free 2v2 preset applies ' + JSON.stringify(pf));
    const en = await pg.evaluate(() => { setMode('endless'); const o = document.getElementById('unlockOffer'); const r = { mode: MENU.mode, map: document.getElementById('mapSel').value, offer: o && o.style.display === 'flex' }; o.style.display = 'none'; return r; });
    ok(en.mode !== 'endless' && en.map !== 'endless' && en.offer, 'unlock=0: Endless tab -> offer, stays skirmish ' + JSON.stringify(en));
    // DEPLOY guard: force a locked value without change event
    const dep = await pg.evaluate(() => { document.getElementById('mapSel').value = 'volcano'; document.getElementById('startBtn').click(); const o = document.getElementById('unlockOffer'); const r = { started: typeof started !== 'undefined' && started, menu: document.getElementById('menu').style.display, offer: o && o.style.display === 'flex' }; o.style.display = 'none'; document.getElementById('mapSel').value = 'classic'; return r; });
    ok(!dep.started && dep.menu !== 'none' && dep.offer, 'unlock=0: DEPLOY on locked map blocked ' + JSON.stringify(dep));
    // bots unrestricted: AI rows may still be any country
    const bots = await pg.evaluate(() => { const s = buildSlots([['human', 'A', 'usa'], ['si', 'B', 'jpn']], null, 'classic'); return s[1].fac; });
    ok(bots === 'jpn', 'unlock=0: bots unrestricted (Japan bot)');
    // free map game actually starts
    const go = await pg.evaluate(() => { document.querySelector('#presets button[data-p="duel"]').click(); const ms = document.getElementById('mapSel'); ms.value = 'classic'; ms.dispatchEvent(new Event('change')); document.getElementById('startBtn').click(); return { map: G.mapName || (G.opts && G.opts.map), started: document.getElementById('menu').style.display === 'none' }; });
    ok(go.started, 'unlock=0: classic duel starts ' + JSON.stringify(go));
    await pg.waitForTimeout(1500);
    ok(!errs.length, 'unlock=0: no page errors ' + errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  // --- 3. ?unlock=0&preset=hellgate (locked URL preset) falls back to the menu, no crash ---
  {
    const { ctx, pg, errs } = await page('?q=low&unlock=0&preset=hellgate');
    const r = await pg.evaluate(() => ({ menu: document.getElementById('menu').style.display, offer: (document.getElementById('unlockOffer') || {}).style ? document.getElementById('unlockOffer').style.display : '' }));
    ok(r.menu !== 'none' && r.offer === 'flex', 'unlock=0 + ?preset=hellgate: menu + offer, no game ' + JSON.stringify(r));
    ok(!errs.length, 'locked URL preset: no page errors ' + errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  // --- 4. ?unlock=1: everything open ---
  {
    const { ctx, pg, errs } = await page('?q=low&unlock=1');
    const st = await state(pg);
    ok(st.owned && st.facs === 8 && !st.lockedOpts.length && !st.lockedPresets.length, 'unlock=1: all maps/presets/countries open ' + JSON.stringify(st));
    for (const m of LOCKED.filter(m => m !== 'endless')) { const r = await pick(pg, m); ok(r.val === m && !r.offer, 'unlock=1: ' + m + ' selectable'); }
    const pr = await pg.evaluate(() => { document.querySelector('#presets button[data-p="hellgate"]').click(); return document.getElementById('mapSel').value; });
    ok(pr === 'hellgate', 'unlock=1: Hellgate preset works');
    const en = await pg.evaluate(() => { setMode('endless'); return MENU.mode; });
    ok(en === 'endless', 'unlock=1: Endless works');
    ok(!errs.length, 'unlock=1: no page errors ' + errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  // --- 5. native (fake Capacitor) without purchase: gated by default; replays not gated ---
  {
    const { ctx, pg, errs } = await page('?q=low', () => { window.Capacitor = { isNativePlatform: () => true, Plugins: {} }; });
    const st = await state(pg);
    ok(st.gate && !st.owned && st.lockedOpts.includes('volcano8') && st.facs === 4, 'native default: maps + countries gated ' + JSON.stringify([st.gate, st.owned, st.facs]));
    const rp = await pg.evaluate(() => { try { startGame('normal', { replay: { cmds: [], hash: [], slots: [{ ai: true, diff: 'easy', ally: 0, fac: 'jpn' }, { ai: true, diff: 'easy', ally: 1, fac: 'chn' }] }, map: 'volcano', seed: 3, slots: [{ ai: true, diff: 'easy', ally: 0, fac: 'jpn', row: 0 }, { ai: true, diff: 'easy', ally: 1, fac: 'chn', row: 1 }] }); return G.opts.map; } catch (e) { return 'ERR ' + e.message; } });
    ok(rp === 'volcano', 'native: replay on a locked map still plays ' + rp);
    await pg.waitForTimeout(800);
    ok(!errs.length, 'native: no page errors ' + errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  await br.close();
  console.log(fail ? 'MAPGATE FAIL ' + fail : 'MAPGATE OK');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
