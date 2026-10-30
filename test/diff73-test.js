// v7.3 difficulties: only Easy / Medium / Hard are player-facing; old options (hard/chief/si) map to Hard (the 'si' profile); no "Chief" text anywhere a player sees.
// node test/diff73-test.js [url]
const { chromium } = require('playwright-core'), path = require('path');
const URL0 = process.argv[2] || 'file://' + path.resolve(__dirname, '../index.html');
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let fail = 0; const ok = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined ? ' ' + JSON.stringify(x) : '')); if (!c) fail++; };
  for (const [vw, vh, tag] of [[1400, 900, 'desktop'], [844, 390, 'phone']]) {
    const pg = await br.newPage({ viewport: { width: vw, height: vh }, isMobile: vw < 1000, hasTouch: vw < 1000 }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(URL0 + (URL0.includes('?') ? '&' : '?') + 'q=low'); await pg.waitForTimeout(1500);
    const noChief = async where => { const t = await pg.evaluate(() => document.body.innerText + ' ' + [...document.querySelectorAll('option,button,[title]')].map(o => o.textContent + ' ' + (o.title || '')).join(' ')); ok(!/chief/i.test(t), `${tag} ${where}: no "Chief" text`, (t.match(/.{0,30}chief.{0,30}/i) || [])[0]); };
    await noChief('title');
    const r = await pg.evaluate(() => { homeShow('bots'); const opts = [...document.querySelector('#lobby .lrow:not(.lh) .lt').options].map(o => o.value + '=' + o.textContent);
      lobbySet([['human', 'A'], ['hard', 'B'], ['chief', 'B'], ['si', 'A'], ['normal', 'B'], ['easy', 'A']]); const vals = lobbyRead().slice(0, 6).map(r => r[0]);
      const bs = buildSlots([['human', 'A'], ['hard', 'B'], ['chief', 'B'], ['si', 'A'], ['normal', 'B'], ['easy', 'A']]).map(s => s.diff);
      return { opts, vals, bs, names: ['easy', 'normal', 'hard', 'chief', 'si'].map(DIFF_NAME), presets: Object.values(PRESETS).map(p => p.n) }; });
    ok(JSON.stringify(r.opts) === JSON.stringify(['off=Closed', 'human=You', 'remote=Human (remote)', 'easy=Easy AI', 'normal=Medium AI', 'si=Hard AI']), tag + ' lobby offers only Easy/Medium/Hard', r.opts);
    ok(JSON.stringify(r.vals) === JSON.stringify(['human', 'si', 'si', 'si', 'normal', 'easy']), tag + ' old lobby rows map to nearest', r.vals);
    ok(JSON.stringify(r.bs) === JSON.stringify(['normal', 'si2', 'si2', 'si2', 'normal', 'easy']), tag + ' buildSlots maps hard/chief -> Hard (si2, v7.6)', r.bs);
    ok(JSON.stringify(r.names) === JSON.stringify(['Easy AI', 'Medium AI', 'Hard AI', 'Hard AI', 'Hard AI']), tag + ' player names', r.names);
    ok(!r.presets.some(n => /chief/i.test(n)), tag + ' preset names', r.presets);
    await noChief('lobby');
    for (const pk of ['t3v3', 'wsi']) {
      const g = await pg.evaluate(pk => { lobbySet(PRESETS[pk].slots); document.getElementById('startBtn').click(); return G.players.map(P => P.ai ? P.diff : 'you'); }, pk);
      await pg.waitForTimeout(1500); ok(g.every(d => ['you', 'si2'].includes(d)), `${tag} preset ${pk} bots are Hard (si)`, g); await noChief('in game ' + pk);
      await pg.evaluate(() => { G.over = true; showMenu && showMenu(); }).catch(() => {}); await pg.goto(URL0 + (URL0.includes('?') ? '&' : '?') + 'q=low'); await pg.waitForTimeout(1200); await pg.evaluate(() => homeShow('bots'));
    }
    const e = await pg.evaluate(() => { setMode('endless'); document.getElementById('startBtn').click(); return { end: !!G.end, n: G.players.length }; }); await pg.waitForTimeout(1500);
    ok(e.end, tag + ' Endless starts', e); await noChief('endless');
    ok(errs.length === 0, tag + ' no page errors', errs.slice(0, 3)); await pg.close();
  }
  await br.close(); console.log(fail ? 'DIFF73 FAIL ' + fail : 'DIFF73 OK'); process.exit(fail ? 1 : 0);
})();
