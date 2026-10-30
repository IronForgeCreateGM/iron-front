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
  so.onmessage = m => { const d = JSON.parse(m.data); if (d.method === 'Runtime.exceptionThrown' || (d.method === 'Runtime.consoleAPICalled' && /error|warning/.test(d.params.type))) { const t = d.method === 'Runtime.exceptionThrown' ? 'EXC ' + JSON.stringify(d.params.exceptionDetails).slice(0, 300) : d.params.type + ' ' + d.params.args.map(a => a.value || a.description).join(' ').slice(0, 300); (global.CERR = global.CERR || []).push('[' + port + '] ' + t); } if (d.method === 'Runtime.consoleAPICalled' && process.env.CONS) console.log('  [' + port + ']', d.params.args.map(a => a.value || a.description).join(' ').slice(0, 200)); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); so.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => { const r = await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400)); return r.result.result.value; };
  return { ch, cmd, ev, nav: async u => { await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Page.navigate', { url: u }); await sleep(4000); } };
}
(async () => {
  let ok = false; const t0 = Date.now();
  const LOCAL = process.env.MODE === 'local'; const A = await browser(9341), B = LOCAL ? await browser(9341, true) : await browser(9342);
  try {
    const base = (process.env.BASE || `http://127.0.0.1:${PORT}/index.html`) + `?q=low` + (process.env.RELAYS ? '&relays=' + process.env.RELAYS : '') + (LOCAL ? '&transport=local' : '') + (process.env.EXTRA || ''); // v7.6.3: EXTRA='&strategies=relay' etc.
    await A.nav(base); console.log('loopback rtc', await A.ev(`(async()=>{const a=new RTCPeerConnection(),b=new RTCPeerConnection();a.onicecandidate=e=>e.candidate&&b.addIceCandidate(e.candidate);b.onicecandidate=e=>e.candidate&&a.addIceCandidate(e.candidate);const dc=a.createDataChannel('x');const p=new Promise(r=>{dc.onopen=()=>r('open');setTimeout(()=>r('timeout '+a.iceConnectionState),8000)});await a.setLocalDescription();await b.setRemoteDescription(a.localDescription);await b.setLocalDescription();await a.setRemoteDescription(b.localDescription);return p})()`)); await A.ev(`(() => { const hr = ${+(process.env.HOSTROW || 0)}; if (${process.env.HOSTROW ? 1 : 0}) { document.getElementById('playBotsBtn') && 0; const ms = document.getElementById('mapSel'); ms.value = 'volcano8'; ms.dispatchEvent(new Event('change'));
      const L = [['hard','A'],['remote','B'],['hard','A'],['remote','B'],['hard','A'],['hard','B'],['hard','A'],['hard','B']]; if (hr !== 0) L[0] = ['hard','A']; L[hr] = ['human', hr % 2 ? 'B' : 'A']; lobbySet(L); } return 1; })()`);
    await A.ev(`document.getElementById('pname').value='HostBot'; document.getElementById('hostBtn').click(); 1`);
    const code = await A.ev('ONL.code'); console.log('room', code); await sleep(5000); console.log('relays', await A.ev(`JSON.stringify(Object.entries(Trystero.nostr.getRelaySockets ? Trystero.nostr.getRelaySockets() : {}).map(([k,v])=>k+':'+v.readyState))`));
    if (process.env.MAP) console.log('map setup', await A.ev(`(() => { const m = document.getElementById('mapSel'); m.value = '${process.env.MAP}'; m.dispatchEvent(new Event('change')); return JSON.stringify(lobbyRead().map(r => r[0] + r[1])); })()`));
    const MOBILE = !!process.env.MOBILE; // v6.1: the guest is an iPhone-landscape-emulated touch client using the mobile play UI
    if (MOBILE) { await B.cmd('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 3, mobile: true }); await B.cmd('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); }
    await B.nav(base + '&room=' + code + '&name=GuestBot' + (MOBILE ? '&mobile=1' : '')); 
    let joined = false; for (let i = 0; i < 40 && !joined; i++) { await sleep(1000); joined = await A.ev('Object.keys(ONL.peers).length > 0'); }
    console.log('dbgA', await A.ev(`JSON.stringify([Object.keys(ONL.room.getPeers()), document.getElementById('onStatus').textContent.slice(0,80), ONL.strategies, typeof RTCDIAG !== 'undefined' ? RTCDIAG : null])`)); console.log('rtcB', await B.ev(`JSON.stringify([ONL.strategies, ONL.strategy || null, typeof RTCDIAG !== 'undefined' ? RTCDIAG : null])`)); console.log('dbgB', await B.ev(`JSON.stringify([ONL.code, ONL.room && Object.keys(ONL.room.getPeers()), document.getElementById('onStatus').textContent.slice(0,120), document.getElementById('err').textContent.slice(0,300)])`));
    console.log('peer joined lobby:', joined, ((Date.now() - t0) / 1000).toFixed(0) + 's'); if (!joined) throw new Error('no peer connection (relays/WebRTC)');
    await B.ev(`document.getElementById('readyBtn').click(); 1`); await sleep(2000);
    if (process.env.SHOT) for (const [X, nm] of [[A, 'host'], [B, 'guest']]) { const r = await X.cmd('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(process.env.SHOT.replace('.png', '-' + nm + '.png'), Buffer.from(r.result.data, 'base64')); console.log('lobby screenshot', nm, 'saved'); }
    const sbt = await A.ev(`document.getElementById('startBtn').textContent + '|' + document.getElementById('startBtn').disabled + '|' + document.getElementById('onPeers').textContent`); console.log('host start button:', sbt); if (/WAITING|\|true\|/.test(sbt)) throw new Error('start blocked');
    await A.ev(`(() => { const f = document.getElementById('fogChk'); if (f.checked) f.click(); return f.checked; })()`); // v5.7.2: host turns fog OFF; must reach the client
    await A.ev(`document.getElementById('startBtn').click(); 1`); await sleep(8000);
    const st = async X => JSON.parse(await X.ev(`JSON.stringify({ tick: G.tick, me: ME, online: NET.online, host: NET.host, desync: NET.desync, fog: G.opts.fog, vis: +(G.vis.reduce((a, v) => a + v, 0) / G.vis.length).toFixed(3), d: NET.DELAY, ahead: (NET.maxTurn || 0) - G.tick, sent: NET.stats && NET.stats.sent, players: G.players.map(p => p.name + (p.ai ? '[AI]' : '')) })`));
    console.log('A', await st(A)); console.log('B', await st(B));
    if (process.env.MAP) { const mm = async X => JSON.parse(await X.ev(`JSON.stringify({ map: G.mapName, mw: MW, me: ME, ally: G.players[ME].ally, start: G.players[ME].start, humans: G.players.filter(p => !p.ai).map(p => p.start) })`)); const ma = await mm(A), mb = await mm(B); console.log('MAP A', ma, 'B', mb);
      if (ma.map !== process.env.MAP || mb.map !== process.env.MAP || ma.ally !== 0 || mb.ally !== 0 || ma.mw !== mb.mw) throw new Error('map/seat mismatch online'); }
    if (process.env.HOSTROW) { const chk = await A.ev(`JSON.stringify({ me: ME, start: G.players[ME].start, row: G.opts.slots[ME].row, humans: G.players.filter(p => !p.ai).length, n: G.players.length })`); console.log('host slot check', chk); const c = JSON.parse(chk); if (c.row !== +process.env.HOSTROW || c.humans !== 2 || c.n !== 8) { console.log('HOST SLOT FAIL'); throw new Error('host slot'); } }
    // client orders its army to a point; verify on host
    if (MOBILE) { console.log('mobile client', await B.ev(`JSON.stringify({ mob: MOB.on, mplay: document.body.classList.contains('mplay'), cards: document.querySelectorAll('#mCards .item').length, w: innerWidth, h: innerHeight, q: R3.q.label })`));
      // mobile UI path: card tap queues a Power Plant, Army button, Stop button, then tap ground (attack-move) — all through NET
      console.log('mobile actions', await B.ev(`(() => { mobCardTap('power'); mobCmd('army'); const n = UI.sel.length; mobCmd('stop'); const p = worldToScreen(48, 48, 0); jumpTo(40, 40, true); r3Render(0.016); const q = worldToScreen(48, 48, heightAt(48, 48)); mobTap(q.x, q.y); return JSON.stringify({ sel: n, pend: NET.pending.length, q: G.players[ME].queues.bld.length }); })()`));
      // v7.6.3: since place-then-build (v7.x) a card tap starts placement instead of queueing, so the old card/tap check no longer moves units; also send a move through NET from the mobile guest
      await B.ev(`(() => { if (typeof cancelPlace === 'function') try { cancelPlace(); } catch (e) {} const u = G.ents.filter(e => e.team === ME && e.kind === 'u' && e.t !== 'harv'); NET.issue({ c: 'move', u: u.map(e => e.id), x: 48, y: 48, am: false }); return u.length; })()`);
      await sleep(1500); console.log('mobile queue+order', await B.ev(`JSON.stringify({ q: G.players[ME].queues.bld.map(q => q.t), ord: G.ents.filter(e => e.team === ME && e.kind === 'u' && e.t !== 'harv').map(e => e.order).slice(0, 4) })`)); }
    else await B.ev(`(() => { const u = G.ents.filter(e => e.team === ME && e.kind === 'u' && e.t !== 'harv'); NET.issue({ c: 'move', u: u.map(e => e.id), x: 48, y: 48, am: false }); return u.length; })()`);
    await sleep(6000);
    const moved = await A.ev(`G.ents.filter(e => e.team === 1 && e.kind === 'u' && e.t !== 'harv').some(e => e.order === 'move' || e.order === 'amove' || Math.hypot(e.x - 48, e.y - 48) < 30)`);
    const sa = await st(A), sb = await st(B); console.log('after 6s A', sa, 'B', sb, 'client move seen on host:', moved);
    // compare state hash at a common tick: pause both via stepping comparisons
    const hA = await A.ev(`(() => { NET.cmpT = G.tick + 60; return NET.cmpT; })()`); await B.ev(`NET.cmpT = ${hA}; 1`);
    await A.ev(`(() => { const o = NET.tick.bind(NET); NET.tick = () => { const r = o(); if (G.tick === NET.cmpT) window.__h = stateHash(); return r; }; return 1; })()`);
    await B.ev(`(() => { const o = NET.tick.bind(NET); NET.tick = () => { const r = o(); if (G.tick === NET.cmpT) window.__h = stateHash(); return r; }; return 1; })()`);
    for (let i = 0; i < 30 && !(await A.ev('window.__h != null') && await B.ev('window.__h != null')); i++) await sleep(1000); const ha = await A.ev('window.__h'), hb = await B.ev('window.__h');
    console.log('hash @tick', hA, ha, hb, ha === hb ? 'MATCH' : 'MISMATCH');
    ok = sa.tick > 100 && sb.tick > 100 && !sa.desync && !sb.desync && moved && ha != null && ha === hb;
    // v7.6.3: LONG=<seconds> keeps playing (guest keeps issuing orders) and compares state hashes every ~20 s
    const LONG = +(process.env.LONG || 0), tL = Date.now(); let rounds = 0, bad = 0;
    while (LONG && Date.now() - tL < LONG * 1000) {
      await B.ev(`(() => { const u = G.ents.filter(e => e.team === ME && e.kind === 'u' && e.t !== 'harv'); const x = 20 + Math.floor(Math.random() * 60), y = 20 + Math.floor(Math.random() * 60); NET.issue({ c: 'move', u: u.map(e => e.id), x, y, am: true }); return 1; })()`);
      const tt = (await A.ev('G.tick')) + 120; await A.ev(`NET.cmpT = ${tt}; window.__h = null; 1`); await B.ev(`NET.cmpT = ${tt}; window.__h = null; 1`);
      for (let i = 0; i < 40 && !(await A.ev('window.__h != null') && await B.ev('window.__h != null')); i++) await sleep(500);
      const x = await A.ev('window.__h'), y = await B.ev('window.__h'), sA = await st(A), sB = await st(B); rounds++; if (x == null || x !== y || sA.desync || sB.desync) bad++;
      console.log(`  [${((Date.now() - tL) / 1000).toFixed(0)}s] hash@${tt} ${x} ${y} ${x != null && x === y ? 'MATCH' : 'MISMATCH'} ticks ${sA.tick}/${sB.tick} delay ${sA.d} desync ${sA.desync}/${sB.desync}`); await sleep(15000); }
    if (LONG) { console.log('long run:', rounds, 'hash checks,', bad, 'bad'); ok = ok && rounds > 0 && bad === 0; }
    const fogOk = sa.fog === false && sb.fog === false && sa.vis === 1 && sb.vis === 1; console.log('fog off synced to both peers, map fully visible:', fogOk); ok = ok && fogOk;
    // disconnect: kill client, host should hand slot to AI and continue
    if (LOCAL) await B.cmd('Page.navigate', { url: 'about:blank' }); else B.ch.kill('SIGKILL'); await sleep(+(process.env.QUITWAIT || 15000)); const after = await st(A); console.log('after client quit:', after);
    ok = ok && after.players[1].includes('[AI]');
  } catch (e) { console.log('ERROR', e.message); }
  console.log('console errors/warnings:', (global.CERR || []).length); (global.CERR || []).slice(0, 15).forEach(x => console.log('  ' + x));
  console.log(ok ? 'ONLINE E2E OK' : 'ONLINE E2E FAIL', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  A.ch.kill('SIGKILL'); try { B.ch && B.ch.kill('SIGKILL'); } catch (e) {} srv.kill(); process.exit(ok ? 0 : 1);
})();
