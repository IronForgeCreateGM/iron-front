// v3.2 mechanics: sniper/pyro/medic, jet ammo+rearm, auto fight-back, smart targeting
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = ['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n');
vm.runInThisContext(src + '\nglobalThis.__api={newGame,stepGame,addU,addB:typeof addB!=="undefined"?addB:null,get G(){return G}};');
const A = globalThis.__api; let ok = true; const chk = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); ok = ok && c; };
const run = s => { for (let i = 0; i < s * 30; i++) { A.stepGame(); A.G.events.length = 0; } };
function fresh() { A.newGame({ seed: 1, diff: 'normal', aiTeams: [], fog: false }); A.G.ents = A.G.ents.filter(e => e.kind === 'b' && e.t === 'hq'); }
fresh(); const sn = A.addU('sniper', 0, 30, 30), r = A.addU('rifle', 1, 38, 30); run(4); chk('sniper outranges & kills rifleman', r.hp <= 0, 'riflehp=' + r.hp.toFixed(0));
fresh(); const s2 = A.addU('sniper', 0, 30, 30), tk = A.addU('heavy', 1, 34, 30); tk.order = 'idle'; run(3); chk('sniper weak vs tank', tk.hp > tk.mhp * 0.9, 'tankhp=' + tk.hp.toFixed(0));
fresh(); const md = A.addU('engineer', 0, 30, 30), hurt = A.addU('rifle', 0, 32, 30); hurt.hp = 30; run(10); chk('engineer heals units (v6.2, replaces medic)', hurt.hp > 90 && md.hp > 0, 'hp=' + hurt.hp.toFixed(0));
fresh(); const v = A.addU('rifle', 0, 30, 30), at = A.addU('arty', 1, 37, 30); at.tgt = v; at.order = 'attack'; at.forced = true; run(8); chk('idle unit fights back vs out-of-sight attacker', v.tgt === at || at.hp < at.mhp, 'arty hp=' + at.hp.toFixed(0));
fresh(); A.G.ents.push(...[]); const af = A.G.ents.find(e => e.team === 0 && e.t === 'hq'); const jt = A.addU('jet', 0, af.x, af.y); const tb = A.G.ents.find(e => e.team === 1 && e.t === 'hq'); jt.tgt = tb; jt.order = 'attack'; jt.forced = true; const h0 = tb.hp; let maxD = 0; for (let i = 0; i < 30 * 40; i++) { A.stepGame(); A.G.events.length = 0; if (jt.ammo === 0) maxD = 1; }
chk('jet bombs base, runs out of ammo, rearms', tb.hp < h0 && maxD === 1 && jt.ammo > 0, `hqdmg=${(h0 - tb.hp).toFixed(0)} ammo=${jt.ammo} js=${jt.js}`);
fresh(); const ic = A.addU('intercept', 0, 30, 30), gs = A.addU('gunship', 1, 34, 30); run(8); chk('interceptor kills gunship', gs.hp <= 0);
console.log(ok ? 'UNITS OK' : 'UNITS FAIL');
