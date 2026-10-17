// v5.7.1: pick "You" in slot 8 on Volcano Crown XL -> correct base/team/colour, camera + fog follow, slot 1 becomes a bot. NODE_PATH=/workspace/pwlib/node_modules node test/slot-test.js [url]
const { chromium } = require('playwright-core'), path = require('path');
const URL0 = process.argv[2] || 'file://' + path.resolve(__dirname, '../index.html');
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1400, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  await pg.goto(URL0 + '?q=low'); await pg.waitForTimeout(2000); await pg.click('#playBotsBtn'); await pg.waitForTimeout(500);
  await pg.click('#presets button:has-text("4v4")'); await pg.waitForTimeout(300);
  const labels = await pg.evaluate(() => [...document.querySelectorAll('#lobby .lrow:not(.lh)')].map(r => [...r.querySelector('.lt').options].some(o => o.textContent === 'You')));
  ok(labels.every(Boolean), 'every slot has a "You" option');
  const rows = await pg.$$('#lobby .lrow:not(.lh) .lt'); await rows[7].selectOption('human'); await pg.waitForTimeout(200);
  const lt = await pg.evaluate(() => [...document.querySelectorAll('#lobby .lrow:not(.lh) .lt')].map(s => s.value)); ok(lt[7] === 'human' && lt[0] !== 'human' && lt.filter(v => v === 'human').length === 1, 'slot 8 = You, slot 1 became ' + lt[0]);
  const cs = await pg.$$('#lobby .lrow:not(.lh) .lc'); await cs[7].selectOption('white');
  await pg.click('#startBtn'); await pg.waitForTimeout(5000);
  const r = await pg.evaluate(() => { const P = G.players[ME], hq = G.ents.find(e => e.team === ME && e.t === 'hq'); return { ME, ai: P.ai, start: P.start, ally: P.ally, color: P.color, map: G.v8, spect: !!G.spectate, fog: G.vis === G.visT[ME], cam: Math.hypot(R3.cam.tx - hq.x, R3.cam.ty - R3.cam.d * 0.18 - hq.y), p0ai: G.players[0].ai, humans: G.players.filter(q => !q.ai).length, vents: (G.vents || []).filter(v => Math.hypot(v[0] - hq.x, v[1] - hq.y) < 16).length }; });
  ok(r.map && !r.ai && !r.spect && r.humans === 1 && r.p0ai, 'game started with you as the only human ' + JSON.stringify(r));
  ok(r.start === 7 && r.ally === 1, 'you got base 8 on team B'); ok(r.vents >= 2, 'your base has ' + r.vents + ' gas vents'); ok(r.cam < 6, 'camera starts at your base (' + r.cam.toFixed(1) + ')'); ok(r.fog, 'fog follows your team');
  ok(r.color === 'white', 'you have the colour picked for slot 8: ' + r.color);
  await pg.waitForTimeout(3000); const t = await pg.evaluate(() => [G.time | 0, G.players.filter(p => p.ai).every(p => p.aiS)]); ok(t[0] >= 1 && t[1], 'bots running, t=' + t[0]);
  ok(!errs.length, 'no page errors ' + errs.slice(0, 2).join(' | ')); console.log(fail ? 'SLOT FAIL' : 'SLOT OK'); await br.close(); process.exit(fail ? 1 : 0);
})();
