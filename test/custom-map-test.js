// v7.7 map builder: custom maps (opts.map 'custom' + opts.cmap) generate, seat 8 players with any team numbers, and 8 bots play without errors.
// usage: node test/custom-map-test.js [size=224] [minutes=6] [teams=ffa|2v2v2v2|4v4]
const fs = require('fs'), vm = require('vm'), path = require('path');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,cmapRle,cmapLayer,get G(){return G},get MW(){return MW}};');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const S = +(process.argv[2] || 224), MIN = +(process.argv[3] || 6), TM = process.argv[4] || 'ffa';
function makeMap(S) { // ring of 8 spawns, base ore + gas each, rich centre, a lake, lava pools, rock ridges, a plateau
  const N = S * S, t = new Uint8Array(N), h = new Uint8Array(N), o = new Uint8Array(N), c = S / 2, starts = [], vents = [], derricks = [], outposts = [];
  const disc = (cx, cy, r, f) => { for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(S, cy + r + 1); y++) for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(S, cx + r + 1); x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) f(y * S + x); };
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + 0.3, R = S * 0.39, x = Math.round(c + Math.cos(a) * R), y = Math.round(c + Math.sin(a) * R); starts.push([x, y]);
    const ox = c + Math.cos(a) * (R - 8), oy = c + Math.sin(a) * (R - 8); disc(ox, oy, 2.6, i => o[i] = 2); vents.push([Math.round(c + Math.cos(a + 0.12) * (R - 6)), Math.round(c + Math.sin(a + 0.12) * (R - 6))]);
    const ex = c + Math.cos(a + Math.PI / 8) * S * 0.3, ey = c + Math.sin(a + Math.PI / 8) * S * 0.3; disc(ex, ey, 2.4, i => o[i] = 3); derricks.push([Math.round(ex + 5), Math.round(ey)]);
    disc(c + Math.cos(a) * S * 0.2, c + Math.sin(a) * S * 0.2, 3, i => t[i] = k % 2 ? 4 : 1); }
  disc(c, c, S * 0.08, i => h[i] = 1); disc(c, c, 3, i => o[i] = 4); disc(c + S * 0.12, c - S * 0.12, 5, i => t[i] = 2); disc(c - S * 0.12, c + S * 0.12, 5, i => t[i] = 5);
  outposts.push([Math.round(c - S * 0.15), Math.round(c - S * 0.15), 'North Watch']);
  return { v: 1, name: 'Test Ring ' + S, w: S, h: S, theme: 'space', t: A.cmapRle(t), h2: A.cmapRle(h), o: A.cmapRle(o), starts, vents, derricks, outposts, monument: [Math.round(c), Math.round(c + S * 0.1)] };
}
const cmap = makeMap(S);
{ const N = S * S, back = A.cmapLayer(cmap.o, N); ok(back.length === N && A.cmapRle(back) === cmap.o, 'RLE round-trip (' + cmap.t.length + '+' + cmap.o.length + ' chars)'); }
const ally = i => TM === '4v4' ? (i < 4 ? 0 : 1) : TM === '2v2v2v2' ? i >> 1 : i;
const slots = [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ ai: true, diff: 'hard', ally: ally(i), start: i }));
const t0 = Date.now(); A.newGame({ seed: 7, map: 'custom', cmap, slots }); const G = A.G;
ok(A.MW === S && G.mapName === 'custom' && G.starts.length === 8, `map ${A.MW}x${A.MW}, 8 starts, gen ${Date.now() - t0} ms`);
ok(new Set(G.players.map(P => P.start)).size === 8, 'every player has its own base');
ok(G.players.every((P, i) => P.ally === ally(i)), 'team numbers kept (' + G.players.map(P => P.ally + 1).join('') + ')');
ok(new Set(G.players.map(P => P.color)).size === 8, 'eight different colours (' + G.players.map(P => P.color).join(',') + ')');
ok(G.sites.filter(s => s.k !== 'main').length >= 4, 'expansion sites found: ' + G.sites.filter(s => s.k !== 'main').length);
ok(G.derricks.length >= 8 && G.derricks.some(d => d.op), 'derricks ' + G.derricks.length + ' incl. outpost');
ok(G.vents.length === 8 && G.monument, 'vents + monument');
const peak = G.players.map(() => 0); let err = null, slow = 0, tk = 0; const tS = Date.now();
try { for (let n = 0; n < 30 * 60 * MIN && !G.over; n++) { const a = Date.now(); A.stepGame(); const d = Date.now() - a; if (d > 33) slow++; tk++; G.events.length = 0;
  if (n % 300 === 0) G.players.forEach((P, i) => { peak[i] = Math.max(peak[i], G.ents.filter(e => e.team === i && e.kind === 'b').length); });
  if (n % 1800 === 0) console.log(`  ${(n / 1800) | 0} min: ents ${G.ents.length}, avg ${((Date.now() - tS) / tk).toFixed(2)} ms/tick`); } } catch (e) { err = e; console.log(e.stack); }
ok(!err, `8 bots run ${MIN} min without errors (avg ${((Date.now() - tS) / tk).toFixed(2)} ms/tick, ${slow} ticks > 33 ms)`);
ok(peak.every(n => n >= 5), 'every bot built a base (' + peak.join(',') + ')');
const mined = G.players.map(P => P.stats.mined | 0); ok(mined.every(m => m > 3000), 'every bot mined (' + mined.join(',') + ')');
console.log(fail ? 'CUSTOM FAIL' : 'CUSTOM OK'); process.exit(fail ? 1 : 0);
