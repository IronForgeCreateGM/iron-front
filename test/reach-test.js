// v5.7.3 online lobby: (a) host keeps chosen "You" row (slot 8), exactly one human, START never blocked by empty remote rows;
// (b) joiner with no host sees "Can't reach host" after ~20s.  NODE_PATH=/workspace/pwlib/node_modules node test/reach-test.js [url]
const { chromium } = require('playwright-core'), path = require('path');
const URL0 = process.argv[2] || 'http://localhost:8765/index.html';
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  const j = await br.newPage(); await j.goto(URL0 + '?q=low&room=NOHOST' + Date.now().toString(36).slice(-4).toUpperCase());
  const h = await br.newPage(); await h.goto(URL0 + '?q=low'); await h.waitForTimeout(2000);
  await h.evaluate(() => { homeShow('online'); const ms = document.getElementById('mapSel'); ms.value = 'volcano8'; ms.dispatchEvent(new Event('change'));
    lobbySet([['human', 'A'], ['remote', 'B'], ['hard', 'A'], ['remote', 'B'], ['hard', 'A'], ['hard', 'B'], ['hard', 'A'], ['hard', 'B']]); });
  const s8 = (await h.$$('#lobby .lrow:not(.lh) .lt'))[7]; await s8.selectOption('human'); await h.waitForTimeout(200);
  await h.click('#hostBtn'); await h.waitForTimeout(1500);
  const r = await h.evaluate(() => ({ lt: lobbyRead().map(x => x[0]), sb: document.getElementById('startBtn').textContent, dis: document.getElementById('startBtn').disabled, peers: document.getElementById('onPeers').textContent }));
  ok(r.lt[7] === 'human' && r.lt.filter(v => v === 'human').length === 1, 'host keeps slot 8 as the only You: ' + r.lt.join(','));
  ok(r.lt[1] === 'remote' && r.lt[3] === 'remote', 'host-made remote rows kept');
  ok(!r.dis && /START ONLINE \(2 empty slots become Hard AI\)/.test(r.sb), 'START enabled: ' + r.sb);
  ok(/Slot 8: .*\(host\)/.test(r.peers) && /Slot 2: open/.test(r.peers), 'peer list: ' + r.peers);
  await h.evaluate(() => document.getElementById('startBtn').click()); await h.waitForTimeout(4000);
  const g = await h.evaluate(() => ({ me: ME, n: G.players.length, ai: G.players.filter(p => p.ai).length, start: G.players[ME].start }));
  ok(g.me === 7 && g.start === 7 && g.n === 8 && g.ai === 7, 'solo-hosted start: empty remotes became AI ' + JSON.stringify(g));
  await j.waitForTimeout(Math.max(0, 22000 - 8000));
  const t = await j.textContent('#onStatus'); ok(/Can't reach the host/.test(t) && /same version/.test(t), 'joiner sees: ' + t.slice(0, 120));
  console.log(fail ? 'REACH FAIL' : 'REACH OK'); await br.close(); process.exit(fail ? 1 : 0);
})();
