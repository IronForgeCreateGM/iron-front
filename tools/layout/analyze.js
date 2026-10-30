const R = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
const hq = R.hq, mm = t => { const s = Math.round(t / 30); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ore = R.ore.map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 }));
const foes = R.foes.map(([x, y]) => ({ x, y })); const nf = foes.slice().sort((a, b) => D(a, hq) - D(b, hq))[0];
const ang0 = Math.atan2(nf.y - hq.y, nf.x - hq.x);
const path = R.path.flat().map(([x, y]) => ({ x, y }));
console.log('map', R.map, 'fac', R.fac, 'team', R.team, 'hq', hq.x, hq.y, 'nearest foe start', nf.x, nf.y, 'dist', D(nf, hq).toFixed(0), 'entrances', R.ents.map(e => `(${e.x.toFixed(0)},${e.y.toFixed(0)} d${D(e, hq).toFixed(0)})`).join(' '), 'checked', R.checked, 'bad', R.bad);
const rows = [];
for (const b of R.B) {
  const bases = R.B.filter(o => (o.t === 'hq' || o.t === 'cc') && o.tick <= b.tick && (o.died == null || o.died > b.tick)).concat([{ ...hq, t: 'hq' }]);
  const base = bases.sort((p, q) => D(p, b) - D(q, b))[0];
  const a = Math.atan2(b.y - base.y, b.x - base.x) - Math.atan2(nf.y - base.y, nf.x - base.x); let ad = ((a * 180 / Math.PI) % 360 + 540) % 360 - 180;
  const dOre = Math.min(...ore.map(o => D(o, b))), dPath = path.length ? Math.min(...path.map(p => D(p, b))) : -1, dEnt = R.ents.length ? Math.min(...R.ents.map(e => D(e, b))) : -1;
  rows.push({ t: b.t, tick: b.tick, at: mm(b.tick), tx: b.tx, ty: b.ty, base: base === hq || (base.x === hq.x && base.y === hq.y) ? 'HQ' : 'CC@' + Math.round(base.x) + ',' + Math.round(base.y), dBase: +D(b, base).toFixed(1), dHQ: +D(b, hq).toFixed(1), ang: Math.round(ad), dOre: +dOre.toFixed(1), dPath: +dPath.toFixed(1), dEnt: +dEnt.toFixed(1), died: b.died != null ? mm(b.died) : '' });
}
require('fs').writeFileSync(process.argv[2].replace('.json', '-rows.json'), JSON.stringify(rows));
const by = {}; for (const r of rows) (by[r.t] = by[r.t] || []).push(r);
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
for (const [t, a] of Object.entries(by).sort((p, q) => q[1].length - p[1].length)) {
  console.log(`${t.padEnd(9)} n=${String(a.length).padStart(3)} first ${a[0].at} last ${a[a.length - 1].at} | dBase med ${med(a.map(r => r.dBase))} [${Math.min(...a.map(r => r.dBase))}-${Math.max(...a.map(r => r.dBase))}] | |ang| med ${med(a.map(r => Math.abs(r.ang)))} front(<60) ${a.filter(r => Math.abs(r.ang) < 60).length} side ${a.filter(r => Math.abs(r.ang) >= 60 && Math.abs(r.ang) < 120).length} back ${a.filter(r => Math.abs(r.ang) >= 120).length} | dOre med ${med(a.map(r => r.dOre))} | dPath med ${med(a.map(r => r.dPath))} onPath(<3) ${a.filter(r => r.dPath < 3).length} | dEnt med ${med(a.map(r => r.dEnt))} | at CC ${a.filter(r => r.base !== 'HQ').length} | died ${a.filter(r => r.died).length}`);
}
console.log('ORDER (first 45):'); console.log(rows.slice(0, 45).map(r => `${r.at} ${r.t}(${r.base === 'HQ' ? '' : r.base + ' '}d${r.dBase} a${r.ang} ore${r.dOre} path${r.dPath})`).join('\n'));
