// v7.7.6 multiplayer security in the page: escaped names, dispatch filter (host lock, host-only types, rate, size, try/catch),
// and "Hide my IP" = relay-only (no WebRTC strategy is started).  NODE_PATH=/workspace/pwlib/node_modules node test/netsec-browser-test.js [url]
const { chromium } = require('playwright-core');
const URL0 = process.argv[2] || 'http://localhost:8765/index.html';
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  const p = await br.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message)); let dialogs = 0; p.on('dialog', d => { dialogs++; d.dismiss(); });
  await p.goto(URL0 + '?q=low'); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    const X = '<img src=x onerror="window.__pwn=1">';
    homeShow && homeShow('online'); document.getElementById('onPanel').style.display = 'block';
    onlRenderPeers({ rows: [['human', 'A'], ['remote', 'B']], peers: { a: { name: X, row: 1, ready: true } }, hostName: '<svg onload="window.__pwn=2">', hostRow: 0 });
    const imgs = document.querySelectorAll('#onPeers img, #onPeers svg').length, txt = document.getElementById('onPeers').textContent;
    // client side filter
    ONL.host = false; ONL.hostLock = null; ONL.hostId = null; const got = []; ONL.handlers = { turn: d => got.push('turn'), lobby: d => got.push('lobby'), chat: d => got.push('chat'), start: () => got.push('start'), kick: () => { throw new Error('boom'); } };
    onlDispatch('start', { seed: 1, slots: [] }, 'evil'); onlDispatch('turn', { t: 1 }, 'evil'); onlDispatch('lobby', { rows: [], peers: {} }, 'hp');
    ONL.hostLock = 'hp'; onlDispatch('lobby', {}, 'evil'); onlDispatch('turn', { t: 1 }, 'evil'); onlDispatch('turn', { t: 1 }, 'hp'); onlDispatch('hack', {}, 'hp'); onlDispatch('turn', 'str', 'hp');
    onlDispatch('kick', { reason: 'x' }, 'hp'); // throws inside handler -> caught
    for (let i = 0; i < 50; i++) onlDispatch('chat', { m: 'spam' }, 'hp'); const chats = got.filter(x => x === 'chat').length;
    onlDispatch('lobby', { rows: [], peers: {}, pad: 'x'.repeat(70000) }, 'hp');
    // host side: guests can't send host-only types
    ONL.host = true; const g2 = []; ONL.handlers = { start: () => g2.push('start'), sync: () => g2.push('sync'), turn: () => g2.push('turn'), in: () => g2.push('in') };
    onlDispatch('start', { seed: 1, slots: [] }, 'g1'); onlDispatch('sync', {}, 'g1'); onlDispatch('turn', {}, 'g1'); onlDispatch('in', { t: 1 }, 'g1'); ONL.host = false; ONL.hostLock = null;
    return { imgs, txt, got: got.filter(x => x !== 'chat'), chats, g2, sec: ONL_SEC, pwn: window.__pwn };
  });
  await p.waitForTimeout(300);
  ok(r.imgs === 0 && /<img src=x/.test(r.txt) === false && !(await p.evaluate(() => window.__pwn)), 'peer/host names are cleaned + escaped, no HTML injected (' + r.txt.slice(0, 80) + ')');
  ok(JSON.stringify(r.got) === '["lobby","turn"]', 'client: pre-lock only lobby accepted; post-lock only the host, known types, object payloads (' + r.got + ')');
  ok(r.chats > 0 && r.chats <= 7, 'chat rate limit (' + r.chats + ' of 50 accepted)');
  ok(JSON.stringify(r.g2) === '["in"]', 'host ignores host-only types from guests (' + r.g2 + ')');
  ok(r.sec.errors >= 1 && r.sec.why.size >= 1 && r.sec.why.rate >= 40, 'handler exception caught; oversize + rate drops counted ' + JSON.stringify(r.sec.why));
  // Hide my IP: only the relay strategy is joined
  const h = await p.evaluate(() => { const joined = []; const fake = name => ({ selfId: 'me-' + name, joinRoom: () => { joined.push(name); return { makeAction: () => ({ send() {}, onMessage: null }), getPeers: () => ({}), leave() {}, onPeerJoin: null, onPeerLeave: null }; } });
    const keep = window.Trystero; window.Trystero = { nostr: fake('nostr'), mqtt: fake('mqtt'), torrent: fake('torrent'), relay: fake('relay') };
    const ens = window.onlEnsureRelay; window.onlEnsureRelay = () => {}; localStorage.setItem('if_hideip', '1'); ONL.host = true; onlJoinRoom('SECTEST'); const a = joined.slice(); try { ONL.room.leave(); } catch (e) {}
    joined.length = 0; localStorage.setItem('if_hideip', '0'); onlJoinRoom('SECTES2'); const b = joined.slice(); try { ONL.room.leave(); } catch (e) {}
    window.Trystero = keep; window.onlEnsureRelay = ens; localStorage.removeItem('if_hideip'); ONL.room = null;
    return { a, b, box: !!document.getElementById('hideIp') }; });
  ok(h.a.join() === 'relay', 'Hide my IP on: relay only (' + h.a + ')');
  ok(h.b.length === 4, 'Hide my IP off (default): all strategies as before (' + h.b + ')');
  ok(h.box, 'Hide my IP checkbox present');
  ok(!errs.length && !dialogs, 'no page errors/dialogs (' + errs.join(' | ').slice(0, 200) + ')');
  await br.close(); console.log(fail ? 'NETSEC-BROWSER FAIL' : 'NETSEC-BROWSER OK'); process.exit(fail ? 1 : 0);
})();
