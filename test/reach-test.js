// v5.7.3, rewritten v7.9.17 for the v7.9.7 lobby: (a) host keeps the chosen "You" row (slot 8), exactly one human, no surprise AI, lone host can't start;
// (b) joiner with no host sees "Can't reach host" after ~20-50s.  NODE_PATH=<playwright-core> node test/reach-test.js [url]  (needs a static server, e.g. python3 -m http.server 8765)
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
  // v7.9.7 lobby (Host vs Join): leftover seats are closed (never filled with surprise Hard AI), the host keeps the chosen You row,
  // "Start anyway" stays hidden until a friend has joined, so a lone host can never start a match by accident.
  const r = await h.evaluate(() => { const g = id => { const e = document.getElementById(id); return e ? { t: e.textContent.trim(), disp: getComputedStyle(e).display } : null; }; return { lt: lobbyRead().map(x => x[0]), start: g('onStartBtn'), ready: g('readyBtn'), peers: g('onPeers').t, host: ONL.host, started: ONL.started, code: ONL.code }; });
  ok(r.host && !!r.code, 'hosting: room code ' + r.code);
  ok(r.lt[7] === 'human' && r.lt.filter(v => v === 'human').length === 1, 'host keeps slot 8 as the only You: ' + r.lt.join(','));
  ok(r.lt[1] === 'remote' && r.lt.filter(v => v === 'remote').length === 1, 'one open seat for a friend, no extra remote rows: ' + r.lt.join(','));
  ok(r.lt.filter(v => v === 'hard' || v === 'si' || v === 'med' || v === 'easy').length === 0, 'no surprise AI seats were added: ' + r.lt.join(','));
  ok(r.ready && r.ready.disp !== 'none' && r.start && r.start.disp === 'none', 'I\'m Ready shown, Start anyway hidden while alone');
  ok(/Slot 8: .*host/.test(r.peers) && /Slot 2: open/.test(r.peers), 'peer list: ' + r.peers.slice(0, 90));
  await h.evaluate(() => document.getElementById('readyBtn').click()); await h.waitForTimeout(3000);
  const g = await h.evaluate(() => ({ started: ONL.started, inGame: !!(typeof G !== 'undefined' && G && G.players && G.tick > 0) }));
  ok(!g.started && !g.inGame, 'a lone host pressing Ready does not start a match: ' + JSON.stringify(g));
  // v7.7.2: since the relay fallback (v7.6.3) the joiner first shows "no direct route ... trying the relay server" for up to 30 s,
  // then the final "Can't find the host" error; poll for it (up to ~50 s) instead of reading at a fixed 22 s.
  let t = ''; for (let k = 0; k < 50; k++) { t = await j.textContent('#onStatus'); if (/Can't (reach|find)|could not connect/.test(t)) break; await j.waitForTimeout(1000); }
  ok(/Can't (reach|find) the host/.test(t) && /same version/.test(t), 'joiner sees: ' + t.slice(0, 120));
  console.log(fail ? 'REACH FAIL' : 'REACH OK'); await br.close(); process.exit(fail ? 1 : 0);
})();
