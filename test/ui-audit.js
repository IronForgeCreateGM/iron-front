// Opens the game (BASE url or local file), clicks Play vs Bots / Play Online and lists every setup option label.
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const URL0 = process.env.BASE || 'file://' + path.resolve(__dirname, '../index.html');
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chr')), port = 9451;
  const ch = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--remote-debugging-port=' + port, '--user-data-dir=' + dir, URL0], { stdio: 'ignore' });
  let ws; for (let i = 0; i < 60 && !ws; i++) { await sleep(500); try { ws = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(x => x.type === 'page').webSocketDebuggerUrl; } catch (e) {} }
  const so = new WebSocket(ws); await new Promise(r => so.onopen = r); let id = 0; const pend = new Map(); so.onmessage = m => { const d = JSON.parse(m.data); if (pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const ev = e => new Promise(r => { const i = ++id; pend.set(i, d => r(d.result && d.result.result && d.result.result.value)); so.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: e, returnByValue: true } })); });
  await sleep(5000); let ok = true; const out = {};
  out.home = await ev(`[...document.querySelectorAll('#homeBtns button')].map(b => b.textContent.trim())`);
  for (const [mode, btn] of [['bots', 'playBotsBtn'], ['online', 'playOnlineBtn']]) {
    await ev(`document.getElementById('${btn}').click()`); await sleep(1500);
    const r = await ev(`(() => { const vis = e => !!(e && e.offsetParent); const opts = s => s ? [...s.options].map(o => o.textContent.trim()) : null; const row = document.querySelectorAll('#lobby .lrow')[2];
      const ms = document.getElementById('mapSel'), res = { title: document.getElementById('setupTitle').textContent, back: document.getElementById('backBtn').textContent, map: vis(ms) && opts(ms), peace: vis(document.getElementById('peaceSel')) && opts(document.getElementById('peaceSel')),
        presets: [...document.querySelectorAll('#presets button')].filter(vis).map(b => b.textContent), slots: [...document.querySelectorAll('#lobby .lrow')].filter(vis).length - 1, slotType: opts(row.querySelector('.lt')), team: opts(row.querySelector('.la')), faction: opts(row.querySelector('.lf')), colour: opts(row.querySelector('.lc')),
        fog: vis(document.getElementById('fogChk')), start: document.getElementById('startBtn').textContent, online: vis(document.getElementById('hostBtn')) ? [document.getElementById('hostBtn').textContent, document.getElementById('joinBtn').textContent] : null };
      const px = []; for (const m of [...ms.options].map(o => o.value)) { ms.value = m; ms.dispatchEvent(new Event('change')); const c = document.getElementById('mapPrev'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, h = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3]) n++; h = (h * 31 + d[i] + d[i + 1] * 7) >>> 0; } px.push([m, n, h % 1e6]); } ms.value = 'classic'; ms.dispatchEvent(new Event('change')); res.preview = px; return res; })()`);
    out[mode] = r; await ev(`document.getElementById('backBtn').click()`); await sleep(800);
    if (!r || !r.map || !r.peace || r.slots < 4 || !r.slotType || !r.team || !r.faction || !r.colour || r.preview.some(p => p[1] < 1000) || new Set(r.preview.map(p => p[2])).size < r.preview.length) ok = false;
    if (mode === 'online' && !r.online) ok = false;
  }
  console.log(JSON.stringify(out, null, 1)); console.log(ok ? 'UI AUDIT OK' : 'UI AUDIT FAIL'); ch.kill('SIGKILL'); process.exit(ok ? 0 : 1);
})();
