// v7.6.2 live check: version text, manifest 200, skirmish on each theme loads models/props/textures with 0 page errors / 0 http fails
const { chromium } = require('playwright-core'); const URL0 = process.argv[2] || 'https://ironforgecreategm.github.io/iron-front/';
(async () => { const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const man = await (await br.newPage()).request.get(URL0 + 'manifest.webmanifest'); console.log('manifest', man.status());
  for (const map of (process.argv[3] || 'classic,hellgate').split(',')) {
    const ctx = await br.newContext({ viewport: { width: 1400, height: 900 } }); const pg = await ctx.newPage(); const errs = [], fails = [], ok = { glb: 0, props: 0, tex: 0 };
    pg.on('pageerror', e => errs.push(e.message)); pg.on('requestfailed', r => fails.push('FAILED ' + r.url()));
    pg.on('response', r => { const u = r.url(); if (r.status() >= 400) fails.push(r.status() + ' ' + u); else if (/props\/.*\.glb/.test(u)) ok.props++; else if (/terrain\/.*\.webp/.test(u)) ok.tex++; else if (/\.glb/.test(u)) ok.glb++; });
    await pg.goto(URL0 + '?q=high&cb=' + Date.now()); await pg.waitForTimeout(2500);
    const ver = await pg.evaluate(() => [document.querySelector('.tsFoot span') && document.querySelector('.tsFoot span').textContent, typeof NET_VERSION !== 'undefined' ? NET_VERSION : '?']);
    await pg.evaluate(map => startGame('normal', { seed: 7, map, fog: false, slots: buildSlots([['human', 'A', 'bra'], ['easy', map === 'hellgate' ? 'A' : 'B', 'rus']], null, map) }), map);
    await pg.waitForTimeout(12000);
    const st = await pg.evaluate(() => ({ ter: typeof TEX !== 'undefined' ? TEX.st : 'n/a', props: typeof PROPS !== 'undefined' ? Object.entries(PROPS.cache).map(([k, v]) => k + ':' + v.st).join(',') : 'n/a', glb: typeof GLB !== 'undefined' ? JSON.stringify(Object.values(GLB.st).reduce((a, v) => (a[v] = (a[v] || 0) + 1, a), {})) : 'n/a' }));
    if (map === 'classic') await pg.screenshot({ path: '/workspace/iron-front-v7.6.2-live.png' });
    console.log(map, 'version', ver.join(' '), 'pageErrors', errs.length, errs.slice(0, 2).join(' | '), 'httpFails', fails.length, fails.slice(0, 3).join(' | '), 'loaded', JSON.stringify(ok), JSON.stringify(st)); await ctx.close(); }
  await br.close(); })();
