// v7.5.1 spawn-alignment determinism diff: same lobby rows -> buildSlots (+ startGame's seat fix if present) -> newGame -> 2 min of sim, per repo.
// node test/spawn-det.js [repoDir]   -> lines "case | starts by row | hash"; diff the output of two repo dirs (old worktree vs current).
const path = require('path'), { chromium } = require('playwright-core'), ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const F = ['usa', 'rus', 'ger', 'fra', 'bra', 'irn', 'chn', 'jpn'], C = ['blue', 'red', 'green', 'yellow', 'teal', 'orange', 'purple', 'white'];
const T = s => [...s].map((t, i) => [i === 0 && t === t.toLowerCase() ? 'human' : 'si', t.toUpperCase(), F[i], C[i]]);
const CASES = [['duel', 'classic', [['human', 'A', 'usa', 'blue'], ['normal', 'B', 'rus', 'red']]],
  ['2v2 new ABAB', 'classic', T('aBAB')], ['2v2 old AABB', 'classic', T('aABB')], ['coop new', 'classic', [['human', 'A', 'usa', 'blue'], ['normal', 'B', 'rus', 'red'], ['si', 'A', 'ger', 'green'], ['normal', 'B', 'fra', 'yellow']]],
  ['coop old', 'classic', [['human', 'A', 'usa', 'blue'], ['si', 'A', 'ger', 'green'], ['normal', 'B', 'rus', 'red'], ['normal', 'B', 'fra', 'yellow']]],
  ['wsi new', 'classic', T('ABAB')], ['wsi old', 'classic', T('AABB')], ['w2', 'classic', T('AB')],
  ['3v3 new', 'classic', T('aBABAB')], ['3v3 old', 'classic', T('aAABBB')], ['3v3 new', 'frost', T('aBABAB')], ['3v3 old', 'frost', T('aAABBB')],
  ['3v3 new', 'volcano', T('aBABAB')], ['3v3 old', 'volcano', T('aAABBB')], ['2v2 new', 'frost', T('aBAB')], ['2v2 new', 'volcano', T('aBAB')],
  ['4v4 new', 'volcano8', T('aBABABAB')], ['4v4 old', 'volcano8', T('aAAABBBB')], ['hellgate preset', 'hellgate', T('aABBBBBB')], ['hellgate 1v1', 'hellgate', T('aB')]];
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1000, height: 700 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + ROOT + '/index.html?home=1&q=low'); await pg.waitForTimeout(1500);
  for (const [name, map, rows] of CASES) {
    const r = await pg.evaluate(([map, rows]) => { const slots = buildSlots(rows, null, map); if (typeof seatFix === 'function') seatFix(slots, map);
      newGame({ seed: 7, map, slots }); const st = G.players.map(P => P.start).join(',');
      for (let i = 0; i < 3600; i++) { stepGame(); G.events.length = 0; }
      return [st, JSON.stringify([G.tick, G.ents.map(e => [e.id, e.t, e.team, Math.round(e.x * 1000), Math.round(e.y * 1000), Math.round(e.hp * 100)]), G.players.map(P => [P.cr, P.gas, P.stats.built, P.stats.kills])])]; }, [map, rows]);
    console.log(`${(name + ' @' + map).padEnd(26)} rows ${rows.map(x => x[1]).join('')}  starts ${r[0].padEnd(16)} ${require('crypto').createHash('sha1').update(r[1]).digest('hex').slice(0, 12)}`); }
  console.log('pageErrors=' + errs.length, errs[0] || ''); await br.close();
})();
