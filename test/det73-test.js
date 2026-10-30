// v7.3 determinism check (render-side change): node sim hashes + in-browser hashes with the renderer running between sim steps.
// node test/det73-test.js [repoDir]   (env DET_AI=si swaps the browser bot slot; DET_SKIPNODE=1 skips the node part)
//   -> prints hashes; compare two repo dirs (e.g. v7.2.0 worktree vs current)
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const H = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
const STATE = 'JSON.stringify([G.tick, G.ents.map(e => [e.id, e.t, e.team, Math.round(e.x * 1000), Math.round(e.y * 1000), Math.round(e.hp * 100), e.con ? Math.round(e.con.p * 1e4) : -1]), G.players.map(P => [P.cr, P.gas, P.stats.built, P.stats.kills])])';
const out = [];
if (!process.env.DET_SKIPNODE) { const ctx = { console }; vm.createContext(ctx);
  vm.runInContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')).join('\n') + '\nthis.A={newGame,stepGame,get G(){return G}, st(){return ' + STATE + '}};', ctx);
  for (const [seed, d0, d1] of [[11, 'hard', 'hard'], [202, 'normal', 'hard'], [3003, 'easy', 'normal']]) {
    ctx.A.newGame({ seed, map: 'classic', slots: [{ ai: true, diff: d0, ally: 0, start: 0 }, { ai: true, diff: d1, ally: 1, start: 3 }] }); const hs = [];
    for (let n = 1; n <= 30 * 60 * 8 && !ctx.A.G.over; n++) { ctx.A.stepGame(); ctx.A.G.events.length = 0; if (n % 1800 === 0) hs.push(H(ctx.A.st())); }
    console.log(`node seed ${seed} ${d0}v${d1}: ${hs.join(' ')} over=${ctx.A.G.over || '-'}`); out.push(`node seed ${seed} ${d0}v${d1}: ${hs.join(' ')} over=${ctx.A.G.over || '-'}`); } }
(async () => { if (process.env.DET_SKIPBROWSER) return;
  const { chromium } = require('playwright-core');
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1200, height: 800 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + ROOT + '/index.html?q=low'); await pg.waitForTimeout(1500);
  await pg.evaluate(ai => { startGame('hard', { seed: 7, map: 'classic', fog: false, slots: buildSlots([['human', 'A', 'bra'], [ai, 'B', 'rus'], ['normal', 'A', 'fra']]) }); paused = true; }, process.env.DET_AI || 'hard');
  const hs = [];
  for (let k = 0; k < 120; k++) { // 120 chunks x 60 ticks = 4 min sim, renderer draws frames in between
    const h = await pg.evaluate(([k, S]) => { const P = G.players.find(p => !p.ai);
      if (k === 2) { P.cr = 20000; const hq = G.ents.find(e => e.t === 'hq' && e.team === P.team); let n = 0; for (const t of ['power', 'barracks', 'refinery', 'factory']) { outer: for (let r = 4; r < 20; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) { const x = hq.tx + dx, y = hq.ty + dy; if (!buildWhy(P.team, t, x, y)) { execCmd(P.team, { c: 'build', t, x, y }); n++; break outer; } } } }
      for (let i = 0; i < 60; i++) stepGame(); return k % 30 === 29 ? eval(S) : null; }, [k, STATE]);
    if (process.env.DET_PROG) process.stderr.write(k + ' '); if (h) hs.push(require('crypto').createHash('sha1').update(h).digest('hex').slice(0, 12));
    await pg.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); }
  out.push(`browser seed 7 (render on): ${hs.join(' ')} pageErrors=${errs.length}${errs.length ? ' ' + errs[0] : ''}`);
  await br.close(); console.log(out.join('\n'));
})();
