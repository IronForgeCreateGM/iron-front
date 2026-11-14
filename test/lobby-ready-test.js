// Lean v7.9.7 online lobby test: two Chrome tabs, local transport, host/join, Ready sync, start in sync.
// MODE=local is implied (BroadcastChannel). Optional SHOT=/tmp/v797-lobby.png writes host+guest screenshots.
const { spawn } = require('child_process'), path = require('path'), fs = require('fs'), os = require('os');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const root = path.resolve(__dirname, '..'), PORT = 8767;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
async function browser(port, reuse, size) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chr'));
  const [w, h] = size || [1280, 900];
  const ch = reuse ? null : spawn('google-chrome', ['--headless=new', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--remote-debugging-port=' + port, '--user-data-dir=' + dir, '--window-size=' + w + ',' + h, '--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection', 'about:blank'], { stdio: 'ignore' });
  if (reuse) await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
  let ws; for (let i = 0; i < 60 && !ws; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const pg = l.filter(x => x.type === 'page' && x.url === 'about:blank')[0]; if (pg) ws = pg.webSocketDebuggerUrl; } catch (e) {} await sleep(300); }
  if (!ws) throw new Error('no debugger page on ' + port);
  const so = new WebSocket(ws); await new Promise(r => so.onopen = r); let id = 0; const pend = new Map();
  so.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); so.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => { const r = await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400)); return r.result.result.value; };
  return { ch, cmd, ev, nav: async u => { await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Page.navigate', { url: u }); await sleep(3500); } };
}
function shotName(base, tag) { return base.replace(/\.png$/, '') + '-' + tag + '.png'; }
(async () => {
  let ok = false, why = ''; const t0 = Date.now();
  const A = await browser(9351, false, [1280, 720]), B = await browser(9351, true, [390, 844]);
  try {
    const base = `http://127.0.0.1:${PORT}/index.html?q=low&transport=local&home=online`;
    await A.nav(base + '&name=HostBot');
    await A.cmd('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await B.cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    // Host: pick Delta of Kings (the cramped 8-FFA case), then Host game
    await A.ev(`(() => { const ms = document.getElementById('mapSel'); ms.value = 'deltakings'; ms.dispatchEvent(new Event('change')); document.getElementById('pname').value = 'HostBot'; document.getElementById('hostBtn').click(); return 1; })()`);
    const code = await A.ev('ONL.code'); if (!code) throw new Error('no room code');
    console.log('room', code);
    const hostLobby = JSON.parse(await A.ev(`JSON.stringify((() => {
      const rb = document.getElementById('readyBtn'), cv = document.getElementById('onCodeVal'), inv = document.getElementById('onInviteA');
      const r = rb.getBoundingClientRect(), hint = document.getElementById('onHint'), steps = document.getElementById('onSteps');
      const types = lobbyRead().map(x => x[0]);
      const inView = el => { const b = el.getBoundingClientRect(); return b.height > 0 && b.top >= -2 && b.bottom <= innerHeight + 2; };
      return { code: cv && cv.textContent, codeShow: getComputedStyle(document.getElementById('onCodeBox')).display, readyShow: getComputedStyle(rb).display, readyH: Math.round(r.height), readyW: Math.round(r.width), readyTxt: (rb.innerText || rb.textContent || '').trim(), readyInView: inView(rb), types, ai: types.filter(t => t === 'si' || t === 'easy' || t === 'normal').length, remote: types.filter(t => t === 'remote').length, off: types.filter(t => t === 'off').length, startShow: getComputedStyle(document.getElementById('onStartBtn')).display, stepsShow: getComputedStyle(steps).display, invite: inv && inv.textContent, inviteShow: inv && getComputedStyle(inv).display, menuOverflow: getComputedStyle(document.getElementById('menu')).overflowY, vw: innerWidth, vh: innerHeight };
    })())`));
    console.log('host after host-click', hostLobby);
    if (hostLobby.code !== code) throw new Error('room code not shown big: ' + hostLobby.code);
    if (hostLobby.codeShow === 'none') throw new Error('code box hidden on host');
    if (hostLobby.readyShow === 'none' || hostLobby.readyH < 44) throw new Error('host Ready missing or too small ' + JSON.stringify(hostLobby));
    if (!hostLobby.readyInView) throw new Error('host Ready not in the viewport');
    if (!/ready/i.test(hostLobby.readyTxt)) throw new Error('host Ready label: ' + hostLobby.readyTxt);
    if (hostLobby.ai !== 0) throw new Error('host auto-filled AI: ' + hostLobby.types.join(','));
    if (hostLobby.remote !== 1) throw new Error('expected 1 open remote, got ' + hostLobby.remote);
    if (hostLobby.startShow !== 'none') throw new Error('Start should stay hidden until a friend joins');
    if (hostLobby.stepsShow && hostLobby.stepsShow !== 'none') throw new Error('Host/Join chooser still visible after hosting');
    if (!hostLobby.invite || hostLobby.inviteShow === 'none') throw new Error('invite link missing');
    if (!/auto|scroll/.test(hostLobby.menuOverflow)) throw new Error('menu is not scrollable: ' + hostLobby.menuOverflow);

    await B.nav(base + '&name=GuestBot&mobile=1');
    await B.ev(`(() => { document.getElementById('pname').value = 'GuestBot'; document.getElementById('joinCode').value = '${code}'; document.getElementById('joinBtn').click(); return 1; })()`);
    let joined = false; for (let i = 0; i < 20 && !joined; i++) { await sleep(250); joined = await A.ev('Object.keys(ONL.peers).length > 0'); }
    if (!joined) throw new Error('guest did not join');
    console.log('joined in', Date.now() - t0, 'ms');

    const guestLobby = JSON.parse(await B.ev(`JSON.stringify((() => {
      const rb = document.getElementById('readyBtn'); const r = rb.getBoundingClientRect();
      const peers = document.getElementById('onPeers').innerText;
      return { readyShow: getComputedStyle(rb).display, readyH: Math.round(r.height), readyW: Math.round(r.width), readyTxt: (rb.innerText || rb.textContent || '').trim(), startShow: getComputedStyle(document.getElementById('onStartBtn')).display, peers, status: document.getElementById('onStatus').innerText.slice(0, 200), code: document.getElementById('onCodeVal').textContent };
    })())`));
    console.log('guest lobby', guestLobby);
    const guestView = JSON.parse(await B.ev(`JSON.stringify((() => { const rb = document.getElementById('readyBtn'), b = rb.getBoundingClientRect(); return { inView: b.height > 0 && b.top >= -2 && b.bottom <= innerHeight + 2, top: Math.round(b.top), bottom: Math.round(b.bottom), vh: innerHeight }; })())`));
    console.log('guest ready view', guestView);
    if (guestLobby.readyShow === 'none' || guestLobby.readyH < 44 || guestLobby.readyH > 80) throw new Error('guest Ready missing or too tall ' + JSON.stringify(guestLobby));
    if (!guestView.inView) throw new Error('guest Ready not in the viewport ' + JSON.stringify(guestView));
    if (!/ready/i.test(guestLobby.readyTxt)) throw new Error('guest Ready label: ' + guestLobby.readyTxt);
    if (guestLobby.startShow && guestLobby.startShow !== 'none') throw new Error('guest should not see Start');
    if (guestLobby.code !== code) throw new Error('guest code mismatch');

    const afterJoin = JSON.parse(await A.ev(`JSON.stringify((() => {
      const os = document.getElementById('onStartBtn'), rb = document.getElementById('readyBtn'), facs = document.getElementById('facs');
      const inView = el => { const b = el.getBoundingClientRect(); return !!el && getComputedStyle(el).display !== 'none' && b.height > 0 && b.top >= -2 && b.bottom <= innerHeight + 2; };
      return { types: lobbyRead().map(x => x[0]), peers: document.getElementById('onPeers').innerText, start: os.textContent, startShow: getComputedStyle(os).display, startH: Math.round(os.getBoundingClientRect().height), startInView: inView(os), readyInView: inView(rb), facsInView: inView(facs), menuScroll: document.getElementById('menu').scrollHeight > document.getElementById('menu').clientHeight + 4 };
    })())`));
    console.log('host after join', afterJoin);
    const aiAfter = afterJoin.types.filter(t => t === 'si' || t === 'easy' || t === 'normal').length;
    if (aiAfter !== 0) throw new Error('AI filled after join: ' + afterJoin.types.join(','));
    if (!/not ready/i.test(afterJoin.peers)) throw new Error('host did not show guest as not ready: ' + afterJoin.peers);
    if (afterJoin.startShow === 'none' || afterJoin.startH < 44 || !afterJoin.startInView) throw new Error('host Start missing, small, or off-screen after join ' + JSON.stringify(afterJoin));
    if (!afterJoin.readyInView) throw new Error('host Ready left the viewport after join');

    await B.ev(`document.getElementById('readyBtn').click(); 1`);
    let synced = false, hostPeers = '';
    for (let i = 0; i < 16 && !synced; i++) { await sleep(200); hostPeers = await A.ev(`document.getElementById('onPeers').innerText`); synced = /GuestBot/.test(hostPeers) && /✔ Ready/.test(hostPeers); }
    console.log('after guest ready, host peers:', hostPeers.replace(/\n/g, ' | '));
    if (!synced) throw new Error('guest Ready did not sync to host');

    await A.ev(`document.getElementById('readyBtn').click(); 1`);
    let hostReadyOnGuest = false, guestPeers = '';
    for (let i = 0; i < 16 && !hostReadyOnGuest; i++) { await sleep(200); guestPeers = await B.ev(`document.getElementById('onPeers').innerText`); hostReadyOnGuest = /HostBot/.test(guestPeers) && /✔ Ready/.test(guestPeers); }
    console.log('after host ready, guest peers:', guestPeers.replace(/\n/g, ' | '));
    if (!hostReadyOnGuest) throw new Error('host Ready did not sync to guest');

    const startLabel = await A.ev(`document.getElementById('onStartBtn').textContent`);
    console.log('start label', startLabel);
    if (!/Start game/i.test(startLabel)) throw new Error('expected Start game, got ' + startLabel);

    if (process.env.SHOT) {
      for (const [X, nm] of [[A, 'host'], [B, 'guest']]) {
        const r = await X.cmd('Page.captureScreenshot', { format: 'png' });
        const fp = shotName(process.env.SHOT, nm);
        fs.writeFileSync(fp, Buffer.from(r.result.data, 'base64'));
        console.log('screenshot', fp);
      }
    }

    // Switch to a small map so the match-start check stays lean (lobby itself was verified on Delta of Kings)
    await A.ev(`(() => { const m = document.getElementById('mapSel'); m.value = 'classic'; m.dispatchEvent(new Event('change')); return m.value; })()`);
    await sleep(400);
    await A.ev(`document.getElementById('startBtn').click(); 1`);
    let started = false, sa, sb;
    for (let i = 0; i < 25 && !started; i++) {
      await sleep(400);
      sa = JSON.parse(await A.ev(`JSON.stringify({ tick: typeof G !== 'undefined' && G ? G.tick : 0, online: !!(typeof NET !== 'undefined' && NET.online), host: !!(typeof NET !== 'undefined' && NET.host), desync: !!(typeof NET !== 'undefined' && NET.desync), seed: G && G.opts && G.opts.seed, map: G && G.mapName, humans: G && G.players ? G.players.filter(p => !p.ai).map(p => p.name) : [], n: G && G.players ? G.players.length : 0 })`));
      sb = JSON.parse(await B.ev(`JSON.stringify({ tick: typeof G !== 'undefined' && G ? G.tick : 0, online: !!(typeof NET !== 'undefined' && NET.online), host: !!(typeof NET !== 'undefined' && NET.host), desync: !!(typeof NET !== 'undefined' && NET.desync), seed: G && G.opts && G.opts.seed, map: G && G.mapName, me: typeof ME !== 'undefined' ? ME : null, n: G && G.players ? G.players.length : 0 })`));
      started = sa.tick > 0 && sb.tick > 0 && sa.online && sb.online;
    }
    console.log('start A', sa, 'B', sb);
    if (!started) throw new Error('match did not start on both sides ' + JSON.stringify({ sa, sb }));
    if (sa.host !== true || sb.host !== false) throw new Error('host/guest roles wrong');
    if (sa.seed !== sb.seed || sa.map !== sb.map) throw new Error('seed/map desync');
    if (sa.desync || sb.desync) throw new Error('desync flag set at start');
    if (sa.n !== 2 || sb.n !== 2) throw new Error('expected 2 players (no surprise AI), got ' + sa.n + '/' + sb.n);
    await sleep(2000);
    const ta = await A.ev('G.tick'), tb = await B.ev('G.tick');
    console.log('ticks after 2s', ta, tb);
    if (!(ta > sa.tick && tb > sb.tick)) throw new Error('clocks did not advance');
    ok = true;
  } catch (e) { why = e.message; console.log('ERROR', why); }
  console.log(ok ? 'LOBBY READY TEST OK' : 'LOBBY READY TEST FAIL: ' + why, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  try { A.ch.kill('SIGKILL'); } catch (e) {}
  srv.kill(); process.exit(ok ? 0 : 1);
})();
