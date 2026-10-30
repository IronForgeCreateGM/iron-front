// Base-layout extraction: re-sim a replay, log every building the human (d.me) places (tick, type, tile),
// then describe it relative to HQ, enemy direction, ore fields, base entrances and the HQ->enemy path.
// node layout.js replay.json out.json
const fs = require('fs'), vm = require('vm'), path = require('path');
const JS = process.env.JS || '/workspace/rts-game/js';
const SRC = ['data.js', 'sim.js', 'ai.js', 'net.js'].map(f => fs.readFileSync(path.join(JS, f), 'utf8'));
const c = vm.createContext({ console, Math, Map, Set, Float64Array, Float32Array, Uint8Array, Uint32Array, Int32Array, Int8Array, Uint16Array, Int16Array, Array, Object, JSON, String, Number, isFinite, Date }); c.globalThis = c;
for (const s of SRC) vm.runInContext(s, c);
const RP = process.argv[2], OUT = process.argv[3];
const d = JSON.parse(fs.readFileSync(RP, 'utf8')); c.__d = d;
const ev = s => vm.runInContext(s, c);
ev(`ME=__d.me; G={}; newGame({ seed: __d.seed, r76: __d.r76 ? 1 : 0, diff: __d.diff, map: __d.map, peace: __d.peace, fog: __d.fog, mode: __d.mode, slots: __d.slots.map((s,i)=>Object.assign({},s,{local: i===__d.me && !s.ai})) }); G.replay = { cmds: __d.cmds, hash: __d.hash, i: 0, checked: 0, bad: 0 };
__seen = new Set(); __B = []; __lost = {};
__T = G.players[ME].team; __hq = G.ents.find(e => e.t === 'hq' && e.team === __T);
__foes = G.players.filter(Q => foe(Q.team, __T)).map(Q => G.starts[Q.start]);
__paths = __foes.map(st => { const p = findPath(__hq.x + 2.5, __hq.y + 2.5, st[0], st[1]) || []; return p.map(c => typeof c === 'number' ? [c % MW + 0.5, ((c / MW) | 0) + 0.5] : [c.x, c.y]); });
__ents = baseEntrances(G.players[ME], {}, __hq).map(e => ({ x: e.x, y: e.y }));
__scan = () => { for (const e of G.ents) if (e.kind === 'b' && e.team === __T && !__seen.has(e.id)) { __seen.add(e.id); __B.push({ id: e.id, t: e.t, tick: G.tick, tx: e.tx, ty: e.ty, x: e.x, y: e.y, w: e.w, h: e.h }); }
  const alive = new Set(G.ents.map(e => e.id)); for (const b of __B) if (b.died == null && !alive.has(b.id)) b.died = G.tick; };`);
const LEN = Math.min(d.len + 10, +(process.env.LEN || 1e9)); let tk = 0;
while ((tk = ev(`if (!G.over && G.tick < ${LEN}) { stepGame(); G.events.length = 0; G.tick } else -1`)) >= 0) { if (tk % 15 === 0) ev("__scan()"); if (tk % 9000 === 0) console.log("tick", tk, new Date().toTimeString().slice(0,8)); }
ev('__scan()');
const res = JSON.parse(ev(`JSON.stringify({ map: G.opts.map || __d.map, MW, MH, me: ME, team: __T, fac: G.players[ME].fac, hq: { x: __hq.x, y: __hq.y, tx: __hq.tx, ty: __hq.ty }, foes: __foes, ents: __ents,
  path: __paths, B: __B, ore: (() => { const f = []; for (let i = 0; i < G.ore.length; i++) if (G.ore[i] > 0) f.push([i % MW, (i / MW) | 0]); return f; })(),
  vents: G.vents || [], derricks: (G.derricks || []).map(k => ({ x: k.x, y: k.y })), checked: G.replay.checked, bad: G.replay.bad, over: G.over, tick: G.tick })`));
fs.writeFileSync(OUT, JSON.stringify(res));
console.log('buildings', res.B.length, 'checked', res.checked, 'bad', res.bad, 'over', res.over, 'tick', res.tick, 'ents', res.ents.length);
