// v7.9.11 lobby chat safety browser test: two Chrome tabs (local transport). Word filter, per-player mute, chat off, report link, native default off.
// Optional SHOT=/tmp/v7911/chat.png writes a host screenshot.
const { spawn } = require('child_process'), path = require('path'), fs = require('fs'), os = require('os');
const SHOT = process.env.SHOT || "";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const root = path.resolve(__dirname, '..'), PORT = 8779;
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
(async () => {
  let ok = false, why = ''; const t0 = Date.now();
  const A = await browser(9361, false, [1280, 720]), B = await browser(9361, true, [390, 844]);
  try {
    const base = `http://127.0.0.1:${PORT}/index.html?q=low&transport=local&home=online`;
    await A.nav(base + '&name=HostBot');
    await A.ev(`(() => { localStorage.removeItem('if_chat'); localStorage.removeItem('if_chatMute'); document.getElementById('pname').value = 'HostBot'; document.getElementById('hostBtn').click(); return 1; })()`);
    const code = await A.ev('ONL.code'); if (!code) throw new Error('no room code');
    await B.nav(base + '&name=GuestBot&mobile=1');
    await B.ev(`(() => { localStorage.removeItem('if_chat'); localStorage.removeItem('if_chatMute'); document.getElementById('pname').value = 'GuestBot'; document.getElementById('joinCode').value = '${code}'; document.getElementById('joinBtn').click(); return 1; })()`);
    let joined = false; for (let i = 0; i < 24 && !joined; i++) { await sleep(250); joined = await A.ev('Object.keys(ONL.peers).length > 0'); }
    if (!joined) throw new Error('guest did not join');
    const say = (P, m) => P.ev(`(() => { const i = document.getElementById('chatIn'); i.value = ${JSON.stringify(m)}; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return i.disabled; })()`);
    const lines = P => P.ev(`[...document.querySelectorAll('#chatLog .chatLine')].filter(d => d.style.display !== 'none').map(d => d.textContent)`);
    const tools = JSON.parse(await A.ev(`JSON.stringify({ tg: document.getElementById('chatToggle').textContent, rep: document.getElementById('chatReport').getAttribute('href'), show: getComputedStyle(document.getElementById('chatTools')).display })`));
    console.log('tools', tools);
    if (!/Chat on/.test(tools.tg) || tools.rep !== 'support.html#report' || tools.show === 'none') throw new Error('chat tools wrong on web ' + JSON.stringify(tools));
    await say(B, 'gg you fucking noob'); await sleep(800);
    let la = await lines(A), lb = await lines(B); console.log('host lines', la, 'guest lines', lb);
    if (!la.some(t => /GuestBot: gg you f\*+ noob/.test(t))) throw new Error('host did not get the masked line');
    if (!lb.some(t => /GuestBot: gg you f\*+ noob/.test(t))) throw new Error('guest did not get the masked echo');
    if (la.concat(lb).some(t => /fucking/.test(t))) throw new Error('unmasked word shown');
    if (!(await A.ev(`!!document.querySelector('#chatLog .chatLine[data-from="guestbot"] .chatMute')`))) throw new Error('no mute button on the guest line (host side)');
    if (await B.ev(`!!document.querySelector('#chatLog .chatLine[data-from="guestbot"] .chatMute')`)) throw new Error('mute button on your own line');
    if (SHOT) { fs.mkdirSync(path.dirname(SHOT), { recursive: true }); await A.cmd('Page.bringToFront'); await A.ev(`document.getElementById('chatTools').scrollIntoView({ block: 'center' })`); await sleep(500); const s = await Promise.race([A.cmd('Page.captureScreenshot', { format: 'png' }), sleep(15000).then(() => null)]); if (!s) throw new Error('screenshot timed out'); fs.writeFileSync(SHOT, Buffer.from(s.result.data, 'base64')); console.log('shot', SHOT); }
    // host mutes GuestBot: old + new messages hidden on host, saved in localStorage
    await A.ev(`document.querySelector('#chatLog .chatLine[data-from="guestbot"] .chatMute').click()`);
    await say(B, 'second message'); await sleep(800);
    la = await lines(A); console.log('host after mute', la);
    if (la.some(t => /GuestBot:/.test(t))) throw new Error('muted player still visible on host');
    const stored = await A.ev(`localStorage.getItem('if_chatMute')`); if (!/guestbot/.test(stored || '')) throw new Error('mute not saved: ' + stored);
    if (!/Unmute all \(1\)/.test(await A.ev(`document.getElementById('chatMutedN').textContent`))) throw new Error('Unmute all count missing');
    await A.ev(`document.getElementById('chatMutedN').click()`); la = await lines(A);
    if (!la.some(t => /GuestBot: second message/.test(t))) throw new Error('unmute all did not bring messages back');
    // guest turns chat off: host messages hidden, input disabled, toggle says off
    await B.ev(`document.getElementById('chatToggle').click()`);
    // (both tabs share one Chrome profile/localStorage for the local transport, so feed the host's message straight into the guest's receive path)
    await B.ev(`ONL.handlers.chat({ m: 'hello guest', n: 'HostBot' }, ONL.hostId)`); await sleep(200);
    lb = await lines(B); const offSt = JSON.parse(await B.ev(`JSON.stringify({ dis: document.getElementById('chatIn').disabled, tg: document.getElementById('chatToggle').textContent, ls: localStorage.getItem('if_chat') })`));
    console.log('guest chat off', lb, offSt);
    if (lb.some(t => /HostBot:|GuestBot:/.test(t)) || !offSt.dis || !/off/i.test(offSt.tg) || offSt.ls !== 'off') throw new Error('chat off did not hide/disable');
    await B.ev(`document.getElementById('chatToggle').click()`); lb = await lines(B);
    if (!lb.some(t => /HostBot: hello guest/.test(t))) throw new Error('turning chat back on did not show messages ' + JSON.stringify(lb) + ' host:' + JSON.stringify(await lines(A)));
    // App Store app (Capacitor native): chat defaults to OFF
    const nat = await B.ev(`(() => { localStorage.removeItem('if_chat'); window.Capacitor = { isNativePlatform: () => true }; const r = chatEnabled(); delete window.Capacitor; return r; })()`);
    if (nat !== false) throw new Error('native default should be chat off');
    const sup = await (await fetch(`http://127.0.0.1:${PORT}/support.html`)).text(); if (!/id="report"/.test(sup)) throw new Error('support.html#report missing');
    ok = true;
  } catch (e) { why = e.message; console.log('ERROR', why); }
  console.log(ok ? 'CHATSAFE BROWSER TEST OK' : 'CHATSAFE BROWSER TEST FAIL: ' + why, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  try { A.ch.kill('SIGKILL'); } catch (e) {}
  srv.kill(); process.exit(ok ? 0 : 1);
})();
