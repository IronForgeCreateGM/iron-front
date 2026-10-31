// v7.6.9 light AI test setup: one command instead of set12.sh/fresh8.sh + grepping.
// Runs seat-swapped NEW-vs-OLD headless games (test/m7-vs.js) in parallel and prints one tally line.
//   node test/ai-bench.js [set] [--par N] [--min M] [--out dir]      set = set12 | fresh8 | quick4 | all20 (default quick4)
//   env SION / SIOFF / OLDSKIP / BOTHOLD pass straight through to m7-vs.js (same meaning as before)
// quick4 (4 games, ~2-4 min on 8 cores) is the "did I break it" check; set12 + fresh8 (= all20) is the ship gate.
const { spawn } = require('child_process'), os = require('os'), fs = require('fs'), path = require('path');
const SETS = {
  set12: ['volcano8 943231385 usa bra', 'classic 5 fra rus', 'volcano 77 ger chn', 'frost 33 usa rus', 'volcano 63 bra fra', 'classic 12 usa ger'],
  fresh8: ['frost 57 rus ger', 'classic 61 chn usa', 'volcano 93 fra bra', 'hellgate 15 jpn irn'],
  quick4: ['volcano8 943231385 usa bra', 'classic 5 fra rus'],
};
SETS.all20 = SETS.set12.concat(SETS.fresh8);
const a = process.argv.slice(2), opt = k => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : null; };
const set = a.find(x => SETS[x]) || 'quick4', par = +(opt('par') || Math.max(1, os.cpus().length)), min = +(opt('min') || 25), out = opt('out');
const jobs = []; for (const g of SETS[set]) for (const sw of [0, 1]) jobs.push(g.split(' ').concat(String(sw)));
if (out) fs.mkdirSync(out, { recursive: true });
const t0 = Date.now(), res = new Array(jobs.length); let next = 0, done = 0;
const run = () => new Promise(ok => {
  const go = () => { if (next >= jobs.length) return ok(); const i = next++, [map, seed, fa, fb, sw] = jobs[i];
    const env = Object.assign({}, process.env, map === 'volcano8' ? { FOG: '0', PEACE: '180' } : {});
    const p = spawn(process.execPath, [path.join(__dirname, 'm7-vs.js'), map, seed, fa, fb, sw, String(min), '0', '3'], { env }); let s = '';
    p.stdout.on('data', d => s += d); p.stderr.on('data', d => s += d);
    p.on('close', code => { res[i] = s.trim(); if (out) fs.writeFileSync(path.join(out, `g${i}.txt`), s); done++;
      const line = s.split('\n').find(l => / (NEW|OLD|TIE)/.test(l)) || ('ERROR exit ' + code + ' ' + s.split('\n')[0]);
      console.log(`[${done}/${jobs.length}] ${line.slice(0, 140)}`); go(); }); };
  go(); });
Promise.all(Array.from({ length: Math.min(par, jobs.length) }, run)).then(() => {
  const t = { NEW: 0, OLD: 0, TIE: 0, ERR: 0 }; for (const r of res) { const m = / (NEW|OLD|TIE)(\(pts\))? /.exec(r || ''); t[m ? m[1] : 'ERR']++; }
  const sum = `${set}: NEW ${t.NEW} - OLD ${t.OLD} - TIE ${t.TIE}${t.ERR ? ' - ERR ' + t.ERR : ''}  (${jobs.length} games, ${((Date.now() - t0) / 1000) | 0}s)`;
  console.log(sum); if (out) fs.writeFileSync(path.join(out, 'summary.txt'), sum + '\n');
  process.exitCode = t.ERR ? 1 : 0;
});
