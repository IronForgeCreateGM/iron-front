// v6.2 build-card screenshots: infantry / vehicle / aircraft card bars + the full portrait set rendered from the in-game models
const { chromium } = require('playwright-core'), path = require('path'), fs = require('fs');
const URL0 = process.argv[2] || 'file://' + path.resolve(__dirname, '../index.html'), OUT = n => path.resolve(__dirname, '../shots/v6_2-' + n + '.png');
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1400, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(URL0 + '?q=low'); await pg.waitForTimeout(2000); await pg.click('#playBotsBtn'); await pg.waitForTimeout(500);
  await pg.evaluate(() => { const c = [...document.querySelectorAll('.fcard')].find(c => /Brazil/.test(c.textContent)); if (c) c.click(); });
  await pg.evaluate(() => document.getElementById('startBtn').click()); await pg.waitForTimeout(4500);
  await pg.evaluate(() => { const P = G.players[ME]; P.cr = 60000; P.gas = 5000; const hq = G.ents.find(e => e.team === ME && e.t === 'hq'); let i = 0;
    for (const t of ['barracks', 'factory', 'tech', 'airfield', 'power', 'power', 'power']) addB(t, ME, Math.round(hq.x + 4 + (i % 4) * 5), Math.round(hq.y + 4 + ((i++ / 4) | 0) * 5), true); });
  const bar = await pg.evaluate(() => { const r = document.getElementById('botGrid') || document.querySelector('.item').parentNode; const b = r.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  const files = [];
  for (const t of ['inf', 'veh', 'air']) { await pg.evaluate(t => { UI.btab = t; buildBotGrid(); sidebar(); }, t); await pg.waitForTimeout(900); const f = '/tmp/pt/bar-' + t + '.png'; await pg.screenshot({ path: f, clip: { x: 0, y: 752, width: 720, height: 132 } }); files.push(f); }
  await pg.screenshot({ path: '/tmp/pt/side.png', clip: { x: 1100, y: 380, width: 300, height: 380 } });
  const P = await pg.evaluate(() => R3.portraits); fs.mkdirSync('/tmp/pt/por', { recursive: true }); for (const [k, v] of Object.entries(P)) fs.writeFileSync('/tmp/pt/por/' + k + '.png', Buffer.from(v.split(',')[1], 'base64'));
  console.log(JSON.stringify(bar), Object.keys(P).length, errs.length ? 'ERR ' + errs[0] : 'no page errors'); await br.close();
})();
