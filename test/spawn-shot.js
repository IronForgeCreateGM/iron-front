// v7.5.1 spawn alignment shots: lobby (You on slot 4) + map preview, then the started game with your HQ at spot 4.
// node test/spawn-shot.js [lobby.png] [ingame.png]   env MAP=classic
const path = require('path'), { chromium } = require('playwright-core');
const ROOT = path.join(__dirname, '..'), A = process.argv[2] || '/workspace/spawn-fix-lobby.png', B = process.argv[3] || '/workspace/spawn-fix-ingame.png', MAP = process.env.MAP || 'classic';
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1400, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + ROOT + '/index.html?home=1&q=low'); await pg.waitForTimeout(2000);
  await pg.evaluate(m => { const ms = document.getElementById('mapSel'); ms.value = m; ms.dispatchEvent(new Event('change'));
    lobbySet([['si', 'A', 'ger', 'green'], ['si', 'B', 'rus', 'red'], ['easy', 'A', 'fra', 'teal'], ['human', 'B', 'usa', 'yellow']]); }, MAP);
  await pg.waitForTimeout(400);
  const su = await pg.$('#setup'); await (su || pg).screenshot({ path: A });
  const pre = await pg.evaluate(() => lobbySeats().rows.map(r => `${r.row + 1}:${r.start}`).join(' '));
  await pg.evaluate(() => { document.getElementById('startBtn').click(); }); await pg.waitForTimeout(2500);
  const info = await pg.evaluate(() => { paused = true; const P = G.players[ME], hq = G.ents.find(e => e.t === 'hq' && e.team === ME), st = G.starts[P.start], lab = seatLabel(G.opts.map, G.players.length, P.start);
    const all = G.players.map((Q, t) => { const h = G.ents.find(e => e.t === 'hq' && e.team === t), s = G.starts[Q.start]; return `slot ${G.opts.slots[t].row + 1} -> spot ${seatLabel(G.opts.map, G.players.length, Q.start)} (hq ${Math.hypot(h.x - s[0], h.y - s[1]).toFixed(1)} from it)`; });
    const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:50%;top:62%;transform:translateX(-50%);z-index:9999;background:rgba(0,0,0,.78);color:#fff;font:bold 18px system-ui;padding:10px 16px;border-radius:8px;border:2px solid #ffd060';
    d.textContent = `You picked slot 4 → your HQ is at map spot ${lab} (${st[1] < MH / 2 ? 'north' : 'south'}-${st[0] < MW / 2 ? 'west' : 'east'} corner, HQ ${Math.hypot(hq.x - st[0], hq.y - st[1]).toFixed(1)} tiles from the marker)`; document.body.appendChild(d);
    return { lab, all, row: G.opts.slots[ME].row + 1 }; });
  await pg.waitForTimeout(600); await pg.screenshot({ path: B });
  console.log('preview', pre, '| game', JSON.stringify(info), 'pageErrors=' + errs.length, errs[0] || '');
  await br.close(); if (info.lab !== 4 || errs.length) process.exit(1);
})();
