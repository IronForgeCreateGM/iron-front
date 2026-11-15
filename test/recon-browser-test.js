// v7.9.8 reconnect browser test: two Chrome tabs (local transport), real lobby + match, then:
//  1) both sides see the other drop (fake leave) -> guest shows "Reconnecting…" overlay with a way out, rejoins, own seat back, stays in sync
//  2) the guest re-opens the room from scratch (fresh join path) and is taken back
//  3) "Stop waiting — play on vs AI" button works

const { spawn } = require('child_process'), path = require('path'), fs = require('fs'), os = require('os');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const root = path.resolve(__dirname, '..'), PORT = 8769;
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
  const A = await browser(9361, false, [1280, 720]), B = await browser(9361, true, [1280, 720]);
  const st = X => X.ev(`JSON.stringify({ tick: G.tick, online: NET.online, recon: !!NET.recon, reconOK: NET.reconOK, resyncs: NET.resyncs, desync: !!NET.desync, ai: G.players.map(P => P.ai ? 1 : 0).join(''), wait: document.getElementById('netWait').innerText, waitShow: getComputedStyle(document.getElementById('netWait')).display, btn: !!document.getElementById('reconAi') })`).then(JSON.parse);
  const until = async (f, ms, step = 250) => { const e = Date.now() + ms; let v; while (Date.now() < e) { v = await f(); if (v) return v; await sleep(step); } return v; };
  try {
    const base = `http://127.0.0.1:${PORT}/index.html?q=low&transport=local&home=online`;
    await A.nav(base + '&name=HostBot');
    await A.ev(`(() => { const ms = document.getElementById('mapSel'); ms.value = 'classic'; ms.dispatchEvent(new Event('change')); document.getElementById('pname').value = 'HostBot'; document.getElementById('hostBtn').click(); return 1; })()`);
    const code = await A.ev('ONL.code'); if (!code) throw new Error('no room code');
    await B.nav(base + '&name=GuestBot');
    await B.ev(`(() => { document.getElementById('pname').value = 'GuestBot'; document.getElementById('joinCode').value = '${code}'; document.getElementById('joinBtn').click(); return 1; })()`);
    if (!await until(() => A.ev('Object.keys(ONL.peers).length > 0'), 6000)) throw new Error('guest did not join');
    await B.ev(`document.getElementById('readyBtn').click(); 1`); await A.ev(`document.getElementById('readyBtn').click(); 1`); await sleep(600);
    await A.ev(`document.getElementById('startBtn').click(); 1`);
    if (!await until(async () => { const a = await st(A).catch(() => null), b = await st(B).catch(() => null); return a && b && a.tick > 30 && b.tick > 30 && a.online && b.online; }, 12000)) throw new Error('match did not start');
    await sleep(2500);
    // 1) blip: both sides see the other leave
    await B.ev(`ONL.leaveCbs.forEach(f => f(NET.hostPeer)); 1`); await A.ev(`ONL.leaveCbs.forEach(f => f(Object.keys(NET.peerTeam)[0])); 1`);
    const mid = await st(B); console.log('guest right after the drop', mid);
    const back = await until(async () => { const b = await st(B), a = await st(A); return !b.recon && b.reconOK === 1 && b.online && a.ai === '00' && b.ai === '00' ? [a, b] : null; }, 12000);
    if (!back) throw new Error('guest did not reconnect after a blip ' + JSON.stringify([await st(A), await st(B)]));
    console.log('1) reconnected', back);
    const r0 = (await st(B)).resyncs; await sleep(4000); const a1 = await st(A), b1 = await st(B);
    console.log('after 4 s', a1, b1);
    if (b1.resyncs !== r0 || a1.desync || b1.desync) throw new Error('state mismatch after reconnect (extra resync or desync)');
    if (!(b1.tick > back[1].tick + 20 && Math.abs(a1.tick - b1.tick) < 40)) throw new Error('clocks not advancing together after reconnect');
    // 2) fresh room re-open: the guest's quick rejoin asks are muted, so only the 5 s "re-open the room" path can bring it back
    await B.ev(`window.__ask = NET._askRejoin; NET._askRejoin = () => {}; NET._reconStart(); setTimeout(() => { NET._askRejoin = window.__ask; }, 9000); 1`);
    await sleep(1200); const m2 = await st(B); if (!m2.recon || m2.waitShow === 'none' || !m2.btn || !/reconnecting/i.test(m2.wait)) throw new Error('no Reconnecting overlay with a Stop waiting button ' + JSON.stringify(m2));
    const back2 = await until(async () => { const b = await st(B); return !b.recon && b.reconOK === 2 && b.online && b.ai === '00' ? b : null; }, 10000);
    if (!back2) throw new Error('fresh re-open did not reconnect ' + JSON.stringify(await st(B)));
    const t2 = Date.now() - 0; console.log('2) re-opened the room and reconnected', back2, await B.ev('ONL.strategy || null'));
    await sleep(3000); const a3 = await st(A), b3 = await st(B); console.log('after 3 s', a3, b3);
    if (a3.desync || b3.desync || !(Math.abs(a3.tick - b3.tick) < 40) || b3.tick <= back2.tick + 15) throw new Error('not in step after the re-open');
    // 3) way out
    await B.ev(`NET._askRejoin = () => {}; NET._reconStart(); 1`); await sleep(800);
    await B.ev(`document.getElementById('reconAi').click(); 1`); await sleep(800);
    const b4 = await st(B); console.log('3) after Stop waiting', b4);
    if (b4.online || b4.recon || b4.waitShow !== 'none') throw new Error('Stop waiting did not hand over to offline play');
    const tk = b4.tick; await sleep(1500); if ((await st(B)).tick <= tk) throw new Error('offline game did not keep running');
    ok = true;
  } catch (e) { why = e.message; console.log('ERROR', why); }
  console.log(ok ? 'RECON BROWSER TEST OK' : 'RECON BROWSER TEST FAIL: ' + why, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  try { A.ch.kill('SIGKILL'); } catch (e) {}
  srv.kill(); process.exit(ok ? 0 : 1);
})();
