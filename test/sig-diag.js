// Signalling diagnostic: two separate headless Chromes join the same Trystero room; logs relay WS traffic (EVENT/OK/NOTICE/CLOSED)
// separately from WebRTC (peer join). node --experimental-websocket test/sig-diag.js [strategy=nostr] [secs=40]
const { spawn } = require('child_process'), path = require('path'), fs = require('fs'), os = require('os');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const root = path.resolve(__dirname, '..'), PORT = 8766;
const STRAT = process.argv[2] || 'nostr', SECS = +(process.argv[3] || 40);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
async function browser(port) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chr'));
  const ch = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--remote-debugging-port=' + port, '--user-data-dir=' + dir, 'about:blank'], { stdio: 'ignore' });
  let ws; for (let i = 0; i < 60 && !ws; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const pg = l.find(x => x.type === 'page'); if (pg) ws = pg.webSocketDebuggerUrl; } catch (e) {} await sleep(300); }
  const so = new WebSocket(ws); await new Promise(r => so.onopen = r); let id = 0; const pend = new Map(); const st = { sent: {}, recv: {}, notes: [], urls: {}, cons: [] };
  so.onmessage = m => { const d = JSON.parse(m.data);
    if (d.method === 'Network.webSocketCreated') st.urls[d.params.requestId] = d.params.url;
    if (d.method === 'Network.webSocketFrameSent' || d.method === 'Network.webSocketFrameReceived') { const u = (st.urls[d.params.requestId] || '?').replace(/^wss?:\/\//, '').slice(0, 30), p = d.params.response.payloadData; let k = 'bin';
      try { const j = JSON.parse(p); k = Array.isArray(j) ? j[0] : (j.type || j.action || 'obj'); if (j[0] === 'OK' && j[2] === false || j[0] === 'NOTICE' || j[0] === 'CLOSED') st.notes.push(u + ' ' + p.slice(0, 160)); } catch (e) { k = p.length > 2 ? 'raw' : 'ping'; }
      const b = d.method.endsWith('Sent') ? st.sent : st.recv; b[u + ' ' + k] = (b[u + ' ' + k] || 0) + 1; }
    if (d.method === 'Runtime.consoleAPICalled') st.cons.push(d.params.args.map(a => a.value || a.description).join(' ').slice(0, 200));
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); so.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => { const r = await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result.result && r.result.result.value; };
  await cmd('Network.enable'); await cmd('Runtime.enable'); await cmd('Page.enable');
  return { ch, ev, st, nav: async u => { await cmd('Page.navigate', { url: u }); await sleep(2500); } };
}
(async () => {
  const A = await browser(9351), B = await browser(9352), room = 'diag' + Date.now().toString(36);
  const js = `(()=>{const T=window.Trystero_${STRAT}||window.Trystero&&window.Trystero.${STRAT}; window.__log=[]; const cfg=window.IRONFRONT_NET||{}; const conf={appId:'ironfront-diag'}; if('${STRAT}'==='nostr'&&cfg.relayUrls) conf.relayConfig={urls:cfg.relayUrls};
    const r=T.joinRoom(conf,'${room}'); window.__r=r; r.onPeerJoin(p=>__log.push('join '+p)); const [s,g]=r.makeAction('ping'); g((d,p)=>__log.push('msg '+d)); window.__s=s; return T.selfId;})()`;
  await A.nav(`http://127.0.0.1:${PORT}/test/sig-page.html?s=${STRAT}`); await B.nav(`http://127.0.0.1:${PORT}/test/sig-page.html?s=${STRAT}`);
  console.log('ids', await A.ev(js), await B.ev(js));
  const t0 = Date.now(); let joined = false; while (Date.now() - t0 < SECS * 1000) { await sleep(2000); const a = await A.ev('__log.join(";")'), b = await B.ev('__log.join(";")'); if (a.includes('join') && b.includes('join')) { joined = true; break; } }
  if (joined) { await A.ev('__s("hello-from-A")'); await sleep(1500); }
  for (const [n, X] of [['A', A], ['B', B]]) { console.log(`--- ${n} rtc:`, await X.ev('JSON.stringify(__rtc)')); console.log(`--- ${n} log:`, await X.ev('__log.join(" | ")'), ' peers:', JSON.stringify(Object.keys(await X.ev('JSON.parse(JSON.stringify(Object.keys(__r.getPeers())))') || {})));
    console.log('  sent', JSON.stringify(X.st.sent)); console.log('  recv', JSON.stringify(X.st.recv)); X.st.notes.slice(0, 8).forEach(x => console.log('  NOTE', x)); X.st.cons.slice(0, 8).forEach(x => console.log('  CONSOLE', x)); }
  console.log(joined ? 'SIG-DIAG JOINED in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's' : 'SIG-DIAG NO PEER after ' + SECS + 's');
  A.ch.kill(); B.ch.kill(); srv.kill(); process.exit(0);
})();
