// v7.0.2 China guard-tower squad shot -> shots/v7_0_2-china-tower.png (based on v70-shot.js)
// v7.0 screenshots -> shots/v7_0-*.png : Endless (mid-wave, boss, high scores), Iran drones, China towers, Raijin mech/jet,
// title, lobby, iPhone. NODE_PATH=/tmp/tb/node_modules node test/v702-shot.js [china|medevac|ballista]
const { chromium } = require('playwright-core'), path = require('path');
const URL0 = 'file://' + path.resolve(__dirname, '../index.html'), OUT = n => path.resolve(__dirname, '../shots/v7_0_2-' + n + '.png');
const only = process.argv[2] || 'all', want = k => only === 'all' || only === k;
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  const page = async (vp, mob) => { const pg = await br.newPage(mob ? { viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: vp || { width: 1400, height: 900 } }); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message)); return pg; };
  const start = async (fac, endless) => { const pg = await page(); await pg.goto(URL0 + '?q=low'); await pg.waitForTimeout(2000);
    const tb = await pg.$('#titleScreen'); if (tb && await tb.isVisible()) await pg.evaluate(() => document.getElementById('titleScreen').click()), await pg.waitForTimeout(600);
    await pg.click(endless ? '#playEndlessBtn' : '#playBotsBtn'); await pg.waitForTimeout(600);
    await pg.evaluate(f => { const c = [...document.querySelectorAll('.fcard')].find(c => c.textContent.includes(f)); if (c) c.click(); }, fac);
    await pg.evaluate(() => document.getElementById('startBtn').click()); await pg.waitForTimeout(4500);
    await pg.mouse.move(400, 300); await pg.evaluate(() => { UI.mouse.x = -1; G.opts.fog = false; G.players.forEach(Q => { if (Q.team !== ME && !Q.horde) Q.aiS && (Q.aiS.next = 1e9); }); }); return pg; };
  const cam = (pg, x, y, d) => pg.evaluate(([x, y, d]) => { R3.cam.td = R3.cam.d = d; jumpTo(x, y, true); ANN.q = ANN.q.filter(s => !/UNDER ATTACK/i.test(s)); const a = document.getElementById('announce'); if (a && /UNDER ATTACK/i.test(a.textContent)) { a.classList.remove('on'); ANN.t = 0; } }, [x, y, d]);
  const fast = (pg, s) => pg.evaluate(s => { for (let i = 0; i < s * 30 && !G.over; i++) stepGame(); }, s);
  if (want('endless')) {
    const pg = await start('Brazil', true);
    // a defended pass: walls + towers at pass 1, money, then jump to wave 6
    await pg.evaluate(() => { const P = G.players[ME]; P.cr = 40000; const ps = G.passes[1], px = Math.floor(ps.x), py = Math.floor(ps.y);
      for (let dy = -3; dy <= 3; dy++) if (Math.abs(dy) > 0) { if (canPlace('wall', ME, px - 1, py + dy)) addB('wall', ME, px - 1, py + dy, true); }
      for (const q of G.passes) for (const [dx, dy] of [[-4, -3], [-4, 2], [-7, 0]]) { const x = Math.floor(q.x) + dx, y = Math.floor(q.y) + dy; if (G.map[y * MW + x] === 0 && G.map[y * MW + x + 1] === 0 && G.map[(y + 1) * MW + x] === 0) addB(dx === -7 ? 'aagun' : 'turret', ME, x, y, true); }
      for (let i = 0; i < 4; i++) addB('power', ME, 8 + i * 2, 54, true);
      for (let i = 0; i < 6; i++) { const u = addU(i < 3 ? 'heavy' : 'rifle', ME, px - 6 - (i % 3), py - 1 + (i / 3 | 0) * 2); u.stance = 'hold'; }
      G.end.wave = 5; G.end.next = G.time; });
    const near = () => pg.evaluate(() => { for (let i = 0; i < 30 * 50 && !G.over; i++) { stepGame(); if (i % 30 === 0 && G.ents.some(u => u.team === G.end.horde && u.kind === 'u' && u.x < G.passes[0].x + 7)) break; } });
    await fast(pg, 3); await near();
    const st = await pg.evaluate(() => { const hs = G.ents.filter(u => u.team === G.end.horde && u.kind === 'u'); hs.sort((a, b) => a.x - b.x); const f = hs.slice(0, 3); return { wave: G.end.wave, phase: G.end.phase, alive: hs.length, x: f.reduce((a, u) => a + u.x, 0) / (f.length || 1) - 2, y: f.reduce((a, u) => a + u.y, 0) / (f.length || 1) }; });
    ok(st.wave === 6 && st.phase === 'wave' && st.alive > 0, 'endless mid-wave ' + JSON.stringify(st));
    await cam(pg, st.x - 3, st.y - 4, 17); await pg.waitForTimeout(3500); await pg.screenshot({ path: OUT('endless-wave') });
    const hud = await pg.evaluate(() => { const h = document.getElementById('waveHud'); return h && getComputedStyle(h).display !== 'none' && h.textContent; }); ok(/WAVE\s*6/i.test(hud || ''), 'wave HUD shows wave 6: ' + (hud || '').slice(0, 60));
    // boss wave
    await pg.evaluate(() => { for (const u of G.ents) if (u.team === G.end.horde && u.kind === 'u') u.hp = 0; }); await fast(pg, 1);
    await pg.evaluate(() => { G.end.wave = 9; G.end.next = G.time; }); await fast(pg, 3); await pg.waitForTimeout(1500); await fast(pg, 26);
    const bs = await pg.evaluate(() => { const c = G.ents.find(u => u.t === 'colossus'); return c ? { x: c.x, y: c.y, boss: G.end.boss } : null; });
    ok(bs && bs.boss, 'boss wave with Colossus ' + JSON.stringify(bs));
    if (bs) { await cam(pg, bs.x - 1, bs.y - 4, 22); await pg.evaluate(() => { setSel([G.ents.find(u => u.t === 'colossus')]); ANN.q = ['☠ WAVE 10 — BOSS INCOMING']; ANN.t = 0; }); await pg.waitForTimeout(3500); await pg.screenshot({ path: OUT('endless-boss') }); }
    // game over + high scores
    await pg.evaluate(() => { localStorage.setItem('ifEndlessHS', JSON.stringify({ solo: [{ score: 9400, wave: 14, kills: 300, fac: 'fra', n: 1, name: 'You', date: '2026-10-20' }, { score: 3100, wave: 7, kills: 90, fac: 'bra', n: 1, name: 'You', date: '2026-10-21' }], coop: [{ score: 15200, wave: 19, kills: 600, fac: 'bra', n: 2, name: 'You', date: '2026-10-22' }] }));
      G.end.score = Math.max(G.end.score, 6200); for (const e of G.ents) if (e.team === ME) e.hp = 0; });
    await pg.waitForTimeout(3000);
    const end = await pg.evaluate(() => ({ t: document.getElementById('endTitle').textContent, run: (document.getElementById('endRun') || {}).textContent || '' }));
    ok(/GAME OVER/.test(end.t) && /High|Solo/i.test(end.run), 'game-over high-score screen ' + end.t + ' | ' + end.run.slice(0, 80));
    await pg.screenshot({ path: OUT('endless-highscore') });
    ok(!pg.errs.length, 'endless: no page errors ' + pg.errs.slice(0, 3).join(' | ')); await pg.close();
  }
  // open flat ground near the map centre
  const flatSpot = pg => pg.evaluate(() => { const flat = (x, y) => { for (let dy = -5; dy <= 5; dy++) for (let dx = -6; dx <= 6; dx++) { const i = (y + dy) * MW + x + dx; if (G.map[i] !== 0 || G.lvl[i] > 0 || (G.forest && G.forest[i]) || G.ore[i] > 0) return false; } return true; };
    let cx = Math.round(MW * 0.42), cy = Math.round(MH * 0.4); for (let r = 0; r < 30; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (flat(cx + dx, cy + dy)) return [cx + dx, cy + dy]; return [cx, cy]; });
  if (want('drone')) {
    const pg = await start('Iran'); const [cx, cy] = await flatSpot(pg);
    await pg.evaluate(([cx, cy]) => { const foeT = G.players.find(Q => Q.team !== ME).team; window.__blob = []; for (let i = 0; i < 8; i++) { const u = addU(i % 3 ? 'rifle' : 'heavy', foeT, cx + 3 + (i % 4) * 0.7, cy + (i >> 2) * 0.8); u.stance = 'hold'; window.__blob.push(u); }
      window.__dr = []; for (let i = 0; i < 6; i++) { const d = addU('drone', ME, cx - 9 + (i % 3) * 0.8, cy - 1 + (i / 3 | 0) * 1.1); window.__dr.push(d); } setSel(window.__dr); }, [cx, cy]);
    await cam(pg, cx - 1, cy - 2, 10); await pg.waitForTimeout(1500);
    await pg.evaluate(() => { orderAttack(window.__dr, window.__blob[1]); for (let i = 0; i < 30 * 1.6; i++) stepGame(); ANN.q = []; ANN.t = 0; }); await pg.waitForTimeout(1500);
    await pg.screenshot({ path: OUT('iran-drones') });
    const boom = await pg.evaluate(() => { for (let i = 0; i < 30 * 4; i++) { stepGame(); if (window.__dr.some(d => d.hp <= 0)) { for (let k = 0; k < 6; k++) stepGame(); return true; } } return false; });
    await cam(pg, cx + 4, cy - 3.5, 11); await pg.evaluate(() => { ANN.q = []; ANN.t = 0; }); await pg.waitForTimeout(250); await pg.screenshot({ path: OUT('iran-drone-blast') });
    const hurt = await pg.evaluate(() => window.__blob.filter(u => u.hp < u.mhp).length); ok(boom && hurt >= 3, `drones exploded, ${hurt} blob units hit`);
    await pg.evaluate(() => { UI.btab = 'veh'; buildBotGrid && buildBotGrid(); sidebar(); }); await pg.waitForTimeout(600);
    ok(!pg.errs.length, 'drone: no page errors ' + pg.errs.slice(0, 3).join(' | ')); await pg.close();
  }
  if (want('china')) {
    const pg = await start('China'); const [cx, cy] = await flatSpot(pg);
    const n = await pg.evaluate(([cx, cy]) => { G.players[ME].cr = 20000; let t = 0; for (let i = -7; i <= 7; i++) { const b = addB('wall', ME, cx + i, cy, true); if (b.t === 'gtower') t++; } addB('gate', ME, cx + 8, cy, true);
      const foeT = G.players.find(Q => Q.team !== ME).team; for (let i = 0; i < 5; i++) { const u = addU(i % 2 ? 'rocketeer' : 'rifle', foeT, cx - 6 + i * 3, cy + 6 + (i % 3)); u.stance = 'hold'; } for (const [dx, dy] of [[-3, 9], [4, 8.5]]) { const k = addU('heavy', foeT, cx + dx, cy + dy); k.stance = 'hold'; } const j = addU('gunship', foeT, cx + 2, cy + 4); j.stance = 'hold'; setSel([G.ents.filter(e => e.t === 'gtower').sort((a, b) => Math.abs(a.tx - cx) - Math.abs(b.tx - cx))[0]]); return t; }, [cx, cy]);
    ok(n === 3, 'China 15-piece wall line -> ' + n + ' guard towers');
    await cam(pg, cx, cy + 2.5, 17); await pg.waitForTimeout(2600); await pg.screenshot({ path: OUT('china-tower') });
    const info = await pg.evaluate(() => (document.getElementById('ctxinfo') || {}).textContent || ''); ok(/Garrison: Rifle .*Sniper .*Rocket .*Marine/.test(info), 'tower info shows garrison: ' + info.slice(0, 120));
    ok(!pg.errs.length, 'china: no page errors ' + pg.errs.slice(0, 3).join(' | ')); await pg.close();
  }
  if (want('ballista')) { // v7.0.2 Ballista Tower: convert a guard tower from its panel, then fire a giant bolt at a tank column
    const pg = await start('China'); const [cx, cy] = await flatSpot(pg);
    const tid = await pg.evaluate(([cx, cy]) => { G.players[ME].cr = 20000; G.players[ME].gas = 2000; for (let i = 0; i < 6; i++) addB('power', ME, 6 + i * 2, 6, true);
      let tw = null; for (let i = -7; i <= 7; i++) { const b = addB('wall', ME, cx + i, cy, true); if (b.t === 'gtower' && !tw && i >= -2) tw = b; } window.__tw = tw; setSel([tw]); return tw.id; }, [cx, cy]);
    await pg.waitForSelector('#upBtn', { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(400);
    const b0 = await pg.evaluate(() => { const b = document.getElementById('upBtn'); return b && { t: b.textContent, d: b.disabled }; });
    ok(b0 && /needs a Research Lab/.test(b0.t) && b0.d, 'without a Research Lab the button explains the requirement: ' + (b0 && b0.t));
    await pg.evaluate(([cx, cy]) => { addB('tech', ME, cx - 4, cy - 7, true); }, [cx, cy]); await pg.waitForFunction(() => /\$1400/.test((document.getElementById('upBtn') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
    const b1 = await pg.evaluate(() => { const b = document.getElementById('upBtn'); return b && { t: b.textContent, d: b.disabled }; });
    ok(b1 && /Ballista Tower \$1400/.test(b1.t) && !b1.d, 'tower panel offers the Ballista conversion: ' + (b1 && b1.t));
    await pg.hover('#upBtn'); await pg.waitForTimeout(300);
    const tip = await pg.evaluate(() => UI.tip.style.display !== 'none' && UI.tip.textContent); ok(/no splash/i.test(tip || '') && /Research Lab|HP/.test(tip || ''), 'hover tooltip explains the Ballista: ' + (tip || '').slice(0, 90));
    const cr0 = await pg.evaluate(() => G.players[ME].cr); await pg.click('#upBtn'); await pg.mouse.move(300, 300); await pg.waitForTimeout(500);
    const st = await pg.evaluate(c0 => ({ paid: c0 - G.players[ME].cr, up: window.__tw.upKind, tip: UI.tip.style.display }), cr0);
    ok(st.up === 'bal' && st.paid >= 1399 && st.tip === 'none', 'click converts (paid ' + Math.round(st.paid) + ', tooltip ' + st.tip + ')');
    await fast(pg, 21); const bal = await pg.evaluate(() => ({ bal: window.__tw.bal, hp: window.__tw.mhp })); ok(bal.bal && bal.hp >= 1800, 'tower is now a Ballista ' + JSON.stringify(bal));
    await pg.evaluate(([cx, cy]) => { const tw = window.__tw, foeT = G.players.find(Q => Q.team !== ME).team; window.__tk = []; for (let i = 0; i < 4; i++) { const u = addU('heavy', foeT, tw.x + 1 + (i % 2) * 1.6, tw.y + 6.5 + (i >> 1) * 1.4); u.stance = 'hold'; window.__tk.push(u); } setSel([tw]); }, [cx, cy]);
    const fl = await pg.evaluate(() => { for (let i = 0; i < 30 * 8; i++) { stepGame(); const p = G.projs.find(p => p.w && p.w.type === 'bolt'); if (p && Math.hypot(p.x - p.sx, p.y - p.sy) > 2.6) return { x: p.x, y: p.y }; } return null; });
    ok(!!fl, 'giant bolt in flight ' + JSON.stringify(fl));
    const tw = await pg.evaluate(() => [window.__tw.x, window.__tw.y]); await cam(pg, tw[0] + 1, tw[1] + 2.6, 15);
    await pg.evaluate(() => { paused = true; ANN.q = []; ANN.t = 0; }); await pg.hover('#upBtn'); await pg.waitForTimeout(2200); await pg.screenshot({ path: OUT('ballista') });
    await pg.evaluate(() => { paused = false; }); await pg.mouse.move(300, 300);
    const hit = await pg.evaluate(() => { for (let i = 0; i < 30 * 12; i++) stepGame(); return window.__tk.map(u => Math.max(0, Math.round(u.hp))); }); ok(hit.some(h => h <= 0), 'bolts kill tanks one at a time: ' + hit.join(','));
    const info = await pg.evaluate(() => (document.getElementById('ctxinfo') || {}).textContent || ''); ok(/Ballista/.test(info), 'garrison shows the ballista crew: ' + info.slice(0, 120));
    ok(!pg.errs.length, 'ballista: no page errors ' + pg.errs.slice(0, 3).join(' | ')); await pg.close();
    // mobile: tap the button, tooltip must not stick
    const ph = await page({ width: 844, height: 390 }, true); await ph.goto(URL0 + '?q=low'); await ph.evaluate(() => mobSet(true)); await ph.waitForTimeout(2000);
    const tp = await ph.$('#titleScreen'); if (tp && await tp.isVisible()) { await ph.tap('#tsGo'); await ph.waitForTimeout(800); }
    await ph.click('#playBotsBtn'); await ph.waitForTimeout(600); await ph.evaluate(() => { const c = [...document.querySelectorAll('.fcard')].find(c => c.textContent.includes('China')); if (c) c.click(); document.getElementById('startBtn').click(); }); await ph.waitForTimeout(4500);
    await ph.evaluate(() => { G.players.forEach(Q => { if (Q.team !== ME) Q.aiS && (Q.aiS.next = 1e9); }); });
    const [mx, my] = await flatSpot(ph);
    await ph.evaluate(([cx, cy]) => { G.players[ME].cr = 20000; G.players[ME].gas = 2000; for (let i = 0; i < 6; i++) addB('power', ME, 6 + i * 2, 6, true); addB('tech', ME, cx - 4, cy - 7, true); let tw = null; for (let i = -7; i <= 7; i++) { const b = addB('wall', ME, cx + i, cy, true); if (b.t === 'gtower' && !tw) tw = b; } window.__tw = tw; setSel([tw]); }, [mx, my]);
    await ph.waitForSelector('#upBtn', { state: 'visible', timeout: 8000 }).catch(() => {}); const vis = await ph.isVisible('#upBtn');
    if (!vis) console.log('mobile dbg', JSON.stringify(await ph.evaluate(() => ({ sel: UI.sel.map(e => e.t), mctx: getComputedStyle(document.getElementById('mCtx')).display, has: !!document.getElementById('upBtn'), ctx: (document.getElementById('ctx') || {}).innerHTML?.slice(0, 200), mob: MOB.on, started: typeof started !== 'undefined' && started })))); ok(vis, 'mobile: Ballista button visible in the tower panel');
    if (vis) { const bb = await ph.$eval('#upBtn', b => { const r = b.getBoundingClientRect(); return { h: r.height, w: r.width }; }); ok(bb.h >= 30, 'mobile: button is touch-sized ' + JSON.stringify(bb));
      await ph.tap('#upBtn'); await ph.waitForTimeout(1500); const ms = await ph.evaluate(() => ({ up: window.__tw.upKind, tip: UI.tip.style.display })); ok(ms.up === 'bal' && ms.tip === 'none', 'mobile tap converts, no stuck tooltip ' + JSON.stringify(ms)); }
    ok(!ph.errs.length, 'ballista mobile: no page errors ' + ph.errs.slice(0, 3).join(' | ')); await ph.close();
  }
  if (want('medevac')) { // v7.0.2 Medevac hangs back behind the army
    const pg = await start('USA'); const [cx, cy] = await flatSpot(pg);
    await pg.evaluate(([cx, cy]) => { const g = []; for (let i = 0; i < 4; i++) g.push(addU('heavy', ME, cx - 6 + (i % 2) * 1.3, cy - 1 + (i >> 1) * 1.6)); for (let i = 0; i < 5; i++) g.push(addU('rifle', ME, cx - 7.5, cy - 2 + i));
      const m = addU('medevac', ME, cx - 2, cy); g.forEach(u => u.hp = u.mhp * (0.55 + (u.id % 3) * 0.15)); window.__med = m; window.__g = g; setSel([...g, m]); execCmd(ME, { c: 'move', am: 1, u: [...g, m].map(e => e.id), x: cx + 14, y: cy }); }, [cx, cy]);
    await fast(pg, 5); { const [mx, my] = await pg.evaluate(() => { const g = window.__g, m = window.__med; return [(g.reduce((a, u) => a + u.x, 0) / g.length + m.x) / 2, (g.reduce((a, u) => a + u.y, 0) / g.length + m.y) / 2]; }); await cam(pg, mx + 1, my - 2.5, 14); } await pg.waitForTimeout(2500); await pg.screenshot({ path: OUT('medevac-hangback') });
    const r = await pg.evaluate(() => { const m = window.__med, g = window.__g.filter(u => u.hp > 0); return { o: m.order, mx: m.x, lead: Math.max(...g.map(u => u.x)), cx: g.reduce((a, u) => a + u.x, 0) / g.length }; });
    ok(r.o === 'escort' && r.mx < r.cx - 1.5, `medevac trails: order ${r.o}, ${(r.cx - r.mx).toFixed(1)} tiles behind centre, ${(r.lead - r.mx).toFixed(1)} behind lead`);
    ok(!pg.errs.length, 'medevac: no page errors ' + pg.errs.slice(0, 3).join(' | ')); await pg.close();
  }
  if (want('raijin')) {
    const pg = await start('Japan'); const [cx, cy] = await flatSpot(pg);
    await pg.evaluate(([cx, cy]) => { const u = addU('raijin', ME, cx, cy); window.__rj = u; const foeT = G.players.find(Q => Q.team !== ME).team; for (let i = 0; i < 3; i++) { const t = addU('heavy', foeT, cx + 5 + i * 0.9, cy + (i - 1) * 1.1); t.stance = 'hold'; } setSel([u]); }, [cx, cy]);
    await cam(pg, cx + 2, cy, 9); await pg.waitForTimeout(4000);
    const b1 = await pg.evaluate(() => { const b = document.getElementById('xfBtn'); return b && b.textContent; }); ok(/JET/.test(b1 || ''), 'transform button in the panel: ' + b1);
    await pg.screenshot({ path: OUT('raijin-mech') });
    await pg.keyboard.press('t'); await pg.waitForTimeout(600); await pg.evaluate(() => { for (let i = 0; i < 30 * 2; i++) stepGame(); }); await pg.waitForTimeout(800);
    const t2 = await pg.evaluate(() => window.__rj.t); ok(t2 === 'raijinJ', 'hotkey T -> jet mode (' + t2 + ')');
    await pg.evaluate(([cx, cy]) => { for (let i = 0; i < 6; i++) stepGame(); }, [cx, cy]);
    { const p = await pg.evaluate(() => [window.__rj.x, window.__rj.y]); await cam(pg, p[0] - 0.5, p[1] - 4.5, 10); } await pg.waitForTimeout(3500);
    await pg.screenshot({ path: OUT('raijin-jet') });
    const b2 = await pg.evaluate(() => document.getElementById('xfBtn') && document.getElementById('xfBtn').textContent); ok(/MECH|Recharg/.test(b2 || ''), 'button flips to land: ' + b2);
    ok(!pg.errs.length, 'raijin: no page errors ' + pg.errs.slice(0, 3).join(' | ')); await pg.close();
  }
  if (want('ui')) {
    const pg = await page(); await pg.goto(URL0 + '?title=1&q=low'); await pg.waitForTimeout(2500);
    await pg.screenshot({ path: OUT('title') }); ok(await pg.isVisible('#titleScreen'), 'title screen visible');
    const tb = await pg.$('#titleScreen'); if (tb && await tb.isVisible()) { await pg.keyboard.press('Enter'); await pg.waitForTimeout(800); }
    await pg.click('#playBotsBtn'); await pg.waitForTimeout(700); await pg.screenshot({ path: OUT('lobby') });
    await pg.evaluate(() => document.querySelector('#modeTabs [data-m="endless"]') && document.querySelector('#modeTabs [data-m="endless"]').click()); await pg.waitForTimeout(500); await pg.screenshot({ path: OUT('lobby-endless') });
    ok(!pg.errs.length, 'ui: no page errors ' + pg.errs.slice(0, 3).join(' | ')); await pg.close();
    const ph = await page({ width: 844, height: 390 }, true); await ph.goto(URL0 + '?title=1&q=low'); await ph.evaluate(() => mobSet(true)); await ph.waitForTimeout(2500); await ph.screenshot({ path: OUT('iphone-title') });
    const tp = await ph.$('#titleScreen'); if (tp && await tp.isVisible()) { await ph.tap('#tsGo'); await ph.waitForTimeout(800); }
    await ph.click('#playEndlessBtn'); await ph.waitForTimeout(600); await ph.screenshot({ path: OUT('iphone-lobby') });
    await ph.evaluate(() => document.getElementById('startBtn').click()); await ph.waitForTimeout(5000); await ph.screenshot({ path: OUT('iphone-game') });
    ok(!ph.errs.length, 'iphone: no page errors ' + ph.errs.slice(0, 3).join(' | ')); await ph.close();
  }
  await br.close(); console.log(fail ? 'V70SHOT FAIL' : 'V70SHOT OK'); process.exit(fail ? 1 : 0);
})();
