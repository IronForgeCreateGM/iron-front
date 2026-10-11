// node --experimental-websocket test/record.js <seed> <ticksPerFrame> <outdir> [maxFrames]
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const [seed = 3, tpf = 4, out = '/workspace/rec', maxF = 99999] = process.argv.slice(2);
const url = 'file://' + path.resolve(__dirname, '..') + `/index.html?watch=hard&seed=${seed}&rec=1&q=high`;
const ch = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--remote-debugging-port=9333', '--window-size=1280,720', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let ws; for (let i = 0; i < 50; i++) { try { const l = await (await fetch('http://127.0.0.1:9333/json')).json(); const pg = l.find(x => x.type === 'page'); if (pg) { ws = pg.webSocketDebuggerUrl; break; } } catch (e) {} await sleep(300); }
  const so = new WebSocket(ws); await new Promise(r => so.onopen = r);
  let id = 0; const pend = new Map(); so.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); so.send(JSON.stringify({ id: i, method, params })); });
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url }); await sleep(6000);
  let f = 0, endF = -1; const t0 = Date.now();
  while (f < maxF) {
    const r = await cmd('Runtime.evaluate', { expression: `JSON.stringify(window.__rec(${f === 0 ? 0 : tpf}))`, returnByValue: true });
    const st = JSON.parse(r.result.result.value || '{}');
    const s = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
    fs.writeFileSync(`${out}/f${String(f).padStart(5, '0')}.jpg`, Buffer.from(s.result.data, 'base64')); f++;
    if (f % 100 === 0) console.log(`frame ${f} game ${(st.t / 60).toFixed(2)}min ${((Date.now() - t0) / f).toFixed(0)}ms/frame`);
    if (st.over && endF < 0) { endF = f; console.log('OVER', st.over, (st.t / 60).toFixed(2)); }
    if (endF >= 0 && f - endF > 90) break;
  }
  ch.kill(); process.exit(0);
})();
