// v7.7.5: privacy gate for Sentry (js/sentry.js) + PostHog (js/analytics.js). Every request to Sentry/PostHog is intercepted and answered
// locally (nothing leaves the box). Checks: both OFF on file://, in the App Store app, under webdriver, with ?sentry=0/?analytics=0 and DNT;
// in dev opt-in mode only the two pinned SDK scripts load (SRI), PostHog sends only menu_view/game_start/game_end/mp_connect, no
// pageview/autocapture/recording/flags/remote config, no $ip/$set/identify; Sentry sends errors only (no sessions/tracing/replay/feedback);
// no payload contains a query string, ?key= or a 64-hex string. Needs a server: python3 -m http.server 8765 (repo root).
// NODE_PATH=/workspace/pwlib/node_modules node test/privacy-test.js [http-base]
const { chromium } = require('playwright-core'), path = require('path');
const HTTP = process.argv[2] || 'http://localhost:8765/index.html', FILE = 'file://' + path.resolve(__dirname, '../index.html');
const HEX = 'ab'.repeat(32), ALLOWED = new Set(['menu_view', 'game_start', 'game_end', 'mp_connect']);
const zlib = require('zlib');
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  async function run(url, o = {}) {
    const ctx = await br.newContext(Object.assign({ viewport: { width: 1280, height: 800 } }, o.ua ? { userAgent: o.ua } : {})); const pg = await ctx.newPage();
    const R = { ext: [], ph: [], se: [], errs: [] };
    pg.on('pageerror', e => R.errs.push(e.message));
    if (o.init) await pg.addInitScript(o.init);
    await ctx.route(/^https?:\/\/(?!localhost)/, async rt => {
      const rq = rt.request(), u = rq.url(); R.ext.push(rq.resourceType() + ' ' + u);
      if (/sentry-cdn\.com|cdn\.jsdelivr\.net/.test(u)) return rt.continue(); // real pinned SDK files (SRI-checked by the browser)
      let body = ''; try { const b = rq.postDataBuffer(); if (b) { try { body = zlib.gunzipSync(b).toString(); } catch (e) { body = b.toString(); } } } catch (e) {}
      if (/posthog\.com/.test(u)) R.ph.push({ u, body }); else if (/sentry\.io/.test(u)) R.se.push({ u, body });
      return rt.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' });
    });
    await pg.goto(url); await pg.waitForTimeout(4000);
    if (o.play) {
      await pg.evaluate(() => startGame('normal', { seed: 7, map: 'classic', fog: false, slots: buildSlots([['human', 'A', 'bra'], ['easy', 'B', 'rus']], null, 'classic') }));
      await pg.waitForTimeout(2500);
      await pg.evaluate(h => { setTimeout(() => { throw new Error('privacy probe https://x.example/p?key=' + h + ' ' + h); }, 0); }, HEX);
      await pg.waitForTimeout(1500);
      await pg.evaluate(() => { G.over = 'victory'; try { IF_AN.gameEnd(); } catch (e) {} });
      await pg.waitForTimeout(6000); // posthog batches (flush ~3 s)
    }
    R.flags = await pg.evaluate(() => [!!(window.IF_DIAG && IF_DIAG.on), !!(window.IF_AN && IF_AN.on), !!window.Sentry, !!(window.posthog && posthog.__loaded), location.search]);
    await ctx.close(); return R;
  }
  const off = (tag, R) => ok(!R.flags[0] && !R.flags[1] && !R.ext.length, tag + ': Sentry + PostHog off, 0 external requests ' + JSON.stringify(R.flags.slice(0, 4)) + ' ' + R.ext.slice(0, 2).join(' '));
  off('file:// (offline zip)', await run(FILE + '?sentry=1&analytics=1'));
  off('http under webdriver (no opt-in)', await run(HTTP));
  off('App Store app (Capacitor native)', await run(HTTP + '?sentry=1&analytics=1', { init: () => { window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' }; } }));
  off('?sentry=0&analytics=0', await run(HTTP + '?sentry=0&analytics=0'));
  const dnt = await run(HTTP + '?analytics=1', { init: () => { Object.defineProperty(Navigator.prototype, 'doNotTrack', { get: () => '1' }); } });
  ok(!dnt.flags[1] && !dnt.ph.length, 'Do Not Track: PostHog off');
  // dev opt-in: everything on, requests intercepted
  const R = await run(HTTP + '?sentry=1&analytics=1&key=' + HEX, { play: true, ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', init: () => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); } }); // PostHog drops webdriver/headless UAs as bots (prod behaviour), so look like a normal Mac browser here
  ok(R.flags[0] && R.flags[1], 'dev opt-in: both SDKs on ' + JSON.stringify(R.flags));
  ok(!/key=/.test(R.flags[4]), 'map builder ?key= removed from the address bar (' + R.flags[4] + ')');
  const scripts = R.ext.filter(x => /^script /.test(x)).map(x => x.slice(7));
  ok(scripts.length === 2 && scripts.every(u => u === 'https://browser.sentry-cdn.com/11.10.0/bundle.min.js' || u === 'https://cdn.jsdelivr.net/npm/posthog-js@1.445.1/dist/array.js'), 'only the 2 pinned SDK scripts load (no remote config/recorder/surveys/toolbar) ' + JSON.stringify(scripts));
  const hosts = [...new Set(R.ext.map(x => x.split(' ')[1].split('/')[2]))];
  ok(hosts.every(h => /^(browser\.sentry-cdn\.com|cdn\.jsdelivr\.net|us\.i\.posthog\.com|o4512368931700736\.ingest\.us\.sentry\.io)$/.test(h)), 'only Sentry/PostHog hosts contacted ' + JSON.stringify(hosts));
  ok(!R.ph.some(r => /\/(decide|flags|s|ses|surveys|array)\b/.test(new URL(r.u).pathname)), 'PostHog: no flags/decide/recording/survey/config calls ' + JSON.stringify(R.ph.map(r => new URL(r.u).pathname)));
  const evs = []; for (const r of R.ph) { let j = null; try { j = JSON.parse(r.body); } catch (e) { try { j = JSON.parse(Buffer.from(decodeURIComponent(r.body.replace(/^data=/, '')), 'base64').toString()); } catch (x) {} } const a = j ? (Array.isArray(j) ? j : j.batch || [j]) : []; for (const e of a) evs.push(e); }
  const names = evs.map(e => e.event); if (process.env.DUMP) console.log(JSON.stringify(evs[0], null, 0).slice(0, 3000), '\nSENTRY ', (R.se[0] && R.se[0].body || '').slice(0, 2500));
  ok(names.length > 0 && names.every(n => ALLOWED.has(n)), 'PostHog events only from the allowed list ' + JSON.stringify(names));
  ok(names.includes('menu_view') && names.includes('game_start') && names.includes('game_end'), 'menu_view, game_start, game_end sent');
  ok(evs.every(e => e.properties && e.properties.env === 'dev' && !('$ip' in e.properties) && !e.$set && !e.$set_once && !e.properties.$set && e.properties.$process_person_profile === false), 'PostHog: env=dev, no $ip, no $set, anonymous (no person profile)');
  const all = R.ph.map(r => r.body).concat(R.se.map(r => r.body)).join('\n');
  ok(!all.includes(HEX) && !/key=(?!\[redacted\])/i.test(all) && !/localhost:8765\/[^"\s]*\?/.test(all), 'no payload carries the 64-hex key, ?key= or a query string');
  const types = R.se.map(r => { const m = r.body.split('\n').map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(x => x && x.type); return m.map(x => x.type).join(','); });
  ok(R.se.length > 0 && types.every(t => /^event$/.test(t)), 'Sentry: only error events (no session/transaction/replay/feedback) ' + JSON.stringify(types));
  ok(/privacy probe/.test(all) && /"infer_ip":"never"/.test(all) && !/"infer_ip":"auto"/.test(all) && !/"ip_address"\s*:\s*"(?!\{\{)/.test(all) && !/"user"\s*:/.test(all), 'Sentry: probe error sent, scrubbed, no user/ip');
  ok(!R.errs.filter(e => !/privacy probe/.test(e)).length, 'no other page errors ' + R.errs.join(' | ').slice(0, 200));
  await br.close(); console.log(fail ? 'PRIVACY FAIL' : 'PRIVACY OK'); process.exit(fail ? 1 : 0);
})();
