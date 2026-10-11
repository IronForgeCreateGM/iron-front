// Real end-to-end online test: two headless Chromes join a Trystero room via public Nostr relays,
// host+client lockstep a match; checks progress, client command reaching host, and no desync.
// node --experimental-websocket test/online-e2e.js   (needs internet; serves the game on http://127.0.0.1:8765)
const { spawn } = require('child_process'), path = require('path'), fs = require('fs'), os = require('os');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const root = path.resolve(__dirname, '..'), PORT = 8765;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
async function browser(port, reuse) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chr'));
  const ch = reuse ? null : spawn('google-chrome', ['--headless=new', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--remote-debugging-port=' + port, '--user-data-dir=' + dir, '--window-size=800,500', '--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection', 'about:blank'], { stdio: 'ignore' });
  if (reuse) await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
  let ws; for (let i = 0; i < 60 && !ws; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const pg = l.filter(x => x.type === 'page' && x.url === 'about:blank')[0]; if (pg) ws = pg.webSocketDebuggerUrl; } catch (e) {} await sleep(300); }
  const so = new WebSocket(ws); await new Promise(r => so.onopen = r); let id = 0; const pend = new Map();
  so.onmessage = m => { const d = JSON.parse(m.data); if (d.method === 'Runtime.consoleAPICalled' && process.env.CONS) console.log('  [' + port + ']', d.params.args.map(a => a.value || a.description).join(' ').slice(0, 200)); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); so.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => { const r = await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400)); return r.result.result.value; };
  return { ch, cmd, ev, nav: async u => { await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Page.navigate', { url: u }); await sleep(4000); } };
}
(async () => {
  let ok = false; const t0 = Date.now();
  const LOCAL = process.env.MODE === 'local'; const A = await browser(9341), B = LOCAL ? await browser(9341, true) : await browser(9342);
  try {
    const base = `http://127.0.0.1:${PORT}/index.html?q=low` + (process.env.RELAYS ? '&relays=' + process.env.RELAYS : '') + (LOCAL ? '&transport=local' : '');
    await A.nav(base); console.log('loopback rtc', await A.ev(`(async()=>{const a=new RTCPeerConnection(),b=new RTCPeerConnection();a.onicecandidate=e=>e.candidate&&b.addIceCandidate(e.candidate);b.onicecandidate=e=>e.candidate&&a.addIceCandidate(e.candidate);const dc=a.createDataChannel('x');const p=new Promise(r=>{dc.onopen=()=>r('open');setTimeout(()=>r('timeout '+a.iceConnectionState),8000)});await a.setLocalDescription();await b.setRemoteDescription(a.localDescription);await b.setLocalDescription();await a.setRemoteDescription(b.localDescription);return p})()`)); await A.ev(`document.getElementById('pname').value='HostBot'; document.getElementById('hostBtn').click(); 1`);
    const code = await A.ev('ONL.code'); console.log('room', code); await sleep(5000); console.log('relays', await A.ev(`JSON.stringify(Object.entries(Trystero.nostr.getRelaySockets ? Trystero.nostr.getRelaySockets() : {}).map(([k,v])=>k+':'+v.readyState))`));
    await B.nav(base + '&room=' + code + '&name=GuestBot'); 
    let joined = false; for (let i = 0; i < 40 && !joined; i++) { await sleep(1000); joined = await A.ev('Object.keys(ONL.peers).length > 0'); }
    console.log('dbgA', await A.ev(`JSON.stringify([Object.keys(ONL.room.getPeers()), document.getElementById('onStatus').textContent.slice(0,80)])`)); console.log('dbgB', await B.ev(`JSON.stringify([ONL.code, ONL.room && Object.keys(ONL.room.getPeers()), document.getElementById('onStatus').textContent.slice(0,120), document.getElementById('err').textContent.slice(0,300)])`));
    console.log('peer joined lobby:', joined, ((Date.now() - t0) / 1000).toFixed(0) + 's'); if (!joined) throw new Error('no peer connection (relays/WebRTC)');
    await B.ev(`document.getElementById('readyBtn').click(); 1`); await sleep(2000);
    console.log('host start button:', await A.ev(`document.getElementById('startBtn').textContent`));
    await A.ev(`document.getElementById('startBtn').click(); 1`); await sleep(8000);
    const st = async X => JSON.parse(await X.ev(`JSON.stringify({ tick: G.tick, me: ME, online: NET.online, host: NET.host, desync: NET.desync, players: G.players.map(p => p.name + (p.ai ? '[AI]' : '')) })`));
    console.log('A', await st(A)); console.log('B', await st(B));
    // client orders its army to a point; verify on host
    await B.ev(`(() => { const u = G.ents.filter(e => e.team === ME && e.kind === 'u' && e.t !== 'harv'); NET.issue({ c: 'move', u: u.map(e => e.id), x: 48, y: 48, am: false }); return u.length; })()`);
    await sleep(6000);
    const moved = await A.ev(`G.ents.filter(e => e.team === 1 && e.kind === 'u' && e.t !== 'harv').some(e => e.order === 'move' || Math.hypot(e.x - 48, e.y - 48) < 30)`);
    const sa = await st(A), sb = await st(B); console.log('after 6s A', sa, 'B', sb, 'client move seen on host:', moved);
    // compare state hash at a common tick: pause both via stepping comparisons
    const hA = await A.ev(`(() => { NET.cmpT = G.tick + 60; return NET.cmpT; })()`); await B.ev(`NET.cmpT = ${hA}; 1`);
    await A.ev(`(() => { const o = NET.tick.bind(NET); NET.tick = () => { const r = o(); if (G.tick === NET.cmpT) window.__h = stateHash(); return r; }; return 1; })()`);
    await B.ev(`(() => { const o = NET.tick.bind(NET); NET.tick = () => { const r = o(); if (G.tick === NET.cmpT) window.__h = stateHash(); return r; }; return 1; })()`);
    await sleep(8000); const ha = await A.ev('window.__h'), hb = await B.ev('window.__h');
    console.log('hash @tick', hA, ha, hb, ha === hb ? 'MATCH' : 'MISMATCH');
    ok = sa.tick > 100 && sb.tick > 100 && !sa.desync && !sb.desync && moved && ha != null && ha === hb;
    // disconnect: kill client, host should hand slot to AI and continue
    if (LOCAL) await B.cmd('Page.navigate', { url: 'about:blank' }); else B.ch.kill('SIGKILL'); await sleep(15000); const after = await st(A); console.log('after client quit:', after);
    ok = ok && after.players[1].includes('[AI]');
  } catch (e) { console.log('ERROR', e.message); }
  console.log(ok ? 'ONLINE E2E OK' : 'ONLINE E2E FAIL', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  A.ch.kill('SIGKILL'); try { B.ch && B.ch.kill('SIGKILL'); } catch (e) {} srv.kill(); process.exit(ok ? 0 : 1);
})();
