// v7.9.23: rude player names are masked in the online lobby seat list, chat lines and the end-of-game scoreboard (App Store guideline 1.2).
// NODE_PATH=<playwright-core> node test/namesafe-browser-test.js [shot.png]  (starts its own http server)
const { chromium } = require('playwright-core'), path = require('path'), { spawn } = require('child_process');
const root = path.resolve(__dirname, '..'), PORT = 8770 + Math.floor(Math.random() * 20), B = `http://127.0.0.1:${PORT}/`, SHOT = process.argv[2];
(async () => {
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' }); await new Promise(r => setTimeout(r, 1200));
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  try {
    const ctx = await br.newContext({ viewport: { width: 874, height: 402 }, deviceScaleFactor: 2 }), pg = await ctx.newPage(), errs = []; pg.on('pageerror', e => errs.push(e.message));
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, rt => rt.fulfill({ status: 200, contentType: 'text/html', body: '<p>external</p>' }));
    await pg.goto(B + 'index.html?q=low&howto=0&transport=local&home=online'); await pg.waitForTimeout(2000);
    await pg.fill('#pname', 'Sh1tLord'); await pg.click('#hostBtn'); await pg.waitForTimeout(1200);
    ok(await pg.evaluate(() => ONL.name) === 'S*******', 'own typed name is masked: ' + await pg.evaluate(() => ONL.name));
    await pg.evaluate(() => { localStorage.setItem('if_chat', 'on'); chatApplyUi(); ONL.peers.fake = { name: netSafeName('fuckface'), row: 1, ready: true, cid: 'x' }; onlRenderPeers({ rows: [['human'], ['remote']], peers: ONL.peers, hostName: ONL.name, hostRow: 0, hostReady: false });
      onlChatLine(ONL.peers.fake.name + ': gg', ONL.peers.fake.name); onlChatLine('* ' + ONL.peers.fake.name + ' joined (slot 2)'); });
    const peers = await pg.textContent('#onPeers'), chat = await pg.textContent('#chatLog');
    ok(!/fuck|sh1t/i.test(peers) && /f\*{7}/.test(peers) && /S\*{7}/.test(peers), 'lobby seat list masked: ' + peers.replace(/\s+/g, ' ').slice(0, 120));
    ok(!/fuck/i.test(chat) && /f\*{7}: gg/.test(chat), 'chat lines masked');
    ok(await pg.evaluate(() => netSafeName('Commander42') === 'Commander42' && netSafeName('Scunthorpe') === 'Scunthorpe'), 'clean names unchanged');
    if (SHOT) await pg.screenshot({ path: SHOT });
    ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
    await ctx.close();
  } catch (e) { ok(false, 'exception ' + e.message); }
  await br.close(); srv.kill(); console.log(fail ? 'NAMESAFE-BROWSER FAIL' : 'NAMESAFE-BROWSER OK'); process.exit(fail ? 1 : 0);
})();
