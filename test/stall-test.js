// v5.4: 3v3 sim must not leave bots stalled (walled-in, idle production, blackout)
const fs = require('fs'), vm = require('vm'), path = require('path');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,get G(){return G}};');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

function exitFree(P) {
  const me = A.G.ents.filter(e => e.team === P.team && e.hp > 0);
  const hq = me.find(e => e.t === 'hq' || e.t === 'cc'); if (!hq) return true;
  return aiExitFree(P, hq);
}

function run(map, seed) {
  const slots = [0, 2, 4, 3, 1, 5].map((start, i) => ({ ai: true, diff: i < 3 ? 'si' : 'hard', ally: i < 3 ? 0 : 1, start, fac: 'fra' }));
  A.newGame({ seed, map, slots });
  let mid = null;
  for (let n = 0; n < 16 * 60 * 30 && !A.G.over; n++) {
    A.stepGame(); A.G.events.length = 0;
    if (!mid && A.G.time >= 540) {
      mid = A.G.players.map(P => {
        const me = A.G.ents.filter(e => e.team === P.team && e.hp > 0);
        const army = me.filter(e => e.kind === 'u' && UT[e.t].wpn && e.t !== 'harv').length;
        const fac = me.filter(e => e.t === 'factory' || e.t === 'barracks').length;
        const q = Object.values(P.queues).reduce((a, qq) => a + qq.length, 0);
        const walls = me.filter(e => e.t === 'wall').length, gates = me.filter(e => e.t === 'gate').length;
        return { team: P.team, out: !!P.out, pow: P.pow, exit: exitFree(P), army, fac, q, cr: P.cr | 0, walls, gates };
      });
    }
  }
  return { mid, t: A.G.time, over: !!A.G.over };
}

const r = run('volcano', 77);
console.log('t', (r.t / 60).toFixed(1), 'over', r.over);
console.log(r.mid.map(x => `P${x.team} exit=${x.exit} wall=${x.walls}g${x.gates} pow=${x.pow} army=${x.army} fac=${x.fac} q=${x.q}`).join('\n'));
ok(r.mid && r.mid.every(x => x.out || x.exit || x.walls === 0), 'no bot sealed by its own walls (terrain-only blocks ignored)');
ok(r.mid && r.mid.filter(x => !x.out && x.walls > 0).every(x => x.gates > 0), 'walled bots also have gates');
ok(r.mid && r.mid.filter(x => !x.out).every(x => x.fac >= 1), 'alive bots have factories/barracks');
ok(r.mid && r.mid.filter(x => !x.out).every(x => x.pow > -80 || x.cr < 250), 'no rich bot sits blacked-out');
ok(r.mid && r.mid.some(x => !x.out && (x.army >= 4 || x.q >= 1)), 'someone is producing or has an army');
ok(r.t >= 540, 'reached the 9min checkpoint');
console.log(fail ? 'STALL FAIL' : 'STALL OK');
process.exit(fail ? 1 : 0);
