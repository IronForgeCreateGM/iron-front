// v7.7.7 country flags on Command Yards / Command Centers (render only: no sim, AI or stat effect).
// Each base HQ flies its owner's COUNTRY flag on a short mast, framed by a thin trim in that player's colour, so two
// players of the same country still look different. Flags are painted once per (country, colour) on a small canvas
// (no emoji, so they look the same on every device) and shared by every HQ of that player. Animation is a cheap
// sway: one rotation per flag per frame, off in Quiet mode, Low quality and on phones (csLite).
const FLAGS = { tex: {}, geo: null, poleGeo: null, finGeo: null, poleMat: null, W: 1.15, H: 0.74, CW: 160, CH: 104 };
const FLAG_TYPES = { hq: 1, cc: 1 };

function flagStar(c, x, y, r, rot) { // 5-point star centred at x,y
  c.beginPath(); for (let i = 0; i < 10; i++) { const a = (rot || 0) - Math.PI / 2 + i * Math.PI / 5, rr = i & 1 ? r * 0.4 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); }
function flagH(c, w, h, cols) { const n = cols.length; cols.forEach((k, i) => { c.fillStyle = k; c.fillRect(0, Math.floor(i * h / n), w, Math.ceil(h / n) + 1); }); }
function flagV(c, w, h, cols) { const n = cols.length; cols.forEach((k, i) => { c.fillStyle = k; c.fillRect(Math.floor(i * w / n), 0, Math.ceil(w / n) + 1, h); }); }
// Simplified, instantly recognisable versions of the 8 country flags (proportions are fitted to one shared cloth size).
const FLAG_PAINT = {
  usa(c, w, h) { for (let i = 0; i < 13; i++) { c.fillStyle = i & 1 ? '#ffffff' : '#b22234'; c.fillRect(0, Math.floor(i * h / 13), w, Math.ceil(h / 13) + 1); }
    const cw = w * 0.42, ch = h * 7 / 13; c.fillStyle = '#3c3b6e'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#ffffff';
    for (let r = 0; r < 5; r++) for (let k = 0; k < 6; k++) { const x = cw * (k + 0.5 + (r & 1 ? 0.5 : 0)) / 6.5, y = ch * (r + 0.6) / 5.2; if (x < cw - 2) flagStar(c, x, y, ch * 0.075); } },
  rus(c, w, h) { flagH(c, w, h, ['#ffffff', '#0039a6', '#d52b1e']); },
  fra(c, w, h) { flagV(c, w, h, ['#0055a4', '#ffffff', '#ef4135']); },
  ger(c, w, h) { flagH(c, w, h, ['#000000', '#dd0000', '#ffce00']); },
  bra(c, w, h) { c.fillStyle = '#009c3b'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffdf00'; c.beginPath(); c.moveTo(w * 0.08, h / 2); c.lineTo(w / 2, h * 0.1); c.lineTo(w * 0.92, h / 2); c.lineTo(w / 2, h * 0.9); c.closePath(); c.fill();
    c.fillStyle = '#002776'; c.beginPath(); c.arc(w / 2, h / 2, h * 0.24, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = h * 0.045; c.beginPath(); c.arc(w / 2 + h * 0.05, h * 0.95, h * 0.5, Math.PI * 1.23, Math.PI * 1.72); c.stroke(); },
  irn(c, w, h) { flagH(c, w, h, ['#239f40', '#ffffff', '#da0000']); c.fillStyle = '#da0000'; const x = w / 2, y = h / 2, r = h * 0.12; // emblem (simplified tulip)
    c.beginPath(); c.arc(x - r * 0.45, y, r * 0.55, 0, Math.PI * 2); c.arc(x + r * 0.45, y, r * 0.55, 0, Math.PI * 2); c.fill(); c.fillRect(x - r * 0.12, y - r, r * 0.24, r * 2);
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x - r * 0.45, y, r * 0.25, 0, Math.PI * 2); c.arc(x + r * 0.45, y, r * 0.25, 0, Math.PI * 2); c.fill(); },
  chn(c, w, h) { c.fillStyle = '#de2910'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffde00'; const u = h / 20; flagStar(c, 5 * u, 5 * u, 3.6 * u);
    for (const [x, y] of [[10, 2], [12, 4], [12, 7], [10, 9]]) flagStar(c, x * u, y * u, 1.2 * u, Math.atan2(5 - y, 5 - x) + Math.PI / 2); },
  jpn(c, w, h) { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = '#bc002d'; c.beginPath(); c.arc(w / 2, h / 2, h * 0.3, 0, Math.PI * 2); c.fill(); },
};
function flagTrimCss(team) { return (typeof MMCOL !== 'undefined' && MMCOL[team]) || '#dddddd'; }
function flagPaintCanvas(c, fac, team, W, H) { // full cloth: player-colour frame (thin trim) + the country flag inside
  const t = Math.round(H * 0.085); c.fillStyle = flagTrimCss(team); c.fillRect(0, 0, W, H);
  c.fillStyle = '#101214'; c.fillRect(t - 1, t - 1, W - 2 * t + 2, H - 2 * t + 2); // a hairline dark edge keeps a white trim apart from white stripes
  c.save(); c.translate(t, t); c.beginPath(); c.rect(0, 0, W - 2 * t, H - 2 * t); c.clip(); FLAG_PAINT[fac](c, W - 2 * t, H - 2 * t); c.restore(); }
function flagTex(fac, team) {
  const key = fac + '|' + flagTrimCss(team); if (FLAGS.tex[key]) return FLAGS.tex[key];
  const cv = document.createElement('canvas'); cv.width = FLAGS.CW; cv.height = FLAGS.CH; const c = cv.getContext('2d');
  flagPaintCanvas(c, fac, team, FLAGS.CW, FLAGS.CH);
  const tx = new THREE.CanvasTexture(cv); tx.anisotropy = 4; tx.generateMipmaps = true; tx.minFilter = THREE.LinearMipmapLinearFilter;
  return FLAGS.tex[key] = tx;
}
function flagGeo() { // cloth with a gentle baked ripple (left edge on the mast at x=0), pivot at the mast
  if (FLAGS.geo) return FLAGS.geo;
  const g = new THREE.PlaneGeometry(FLAGS.W, FLAGS.H, 8, 1); g.translate(FLAGS.W / 2, 0, 0); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(x / FLAGS.W * Math.PI * 1.6) * 0.06 * (x / FLAGS.W)); }
  g.computeVertexNormals(); FLAGS.poleGeo = new THREE.CylinderGeometry(0.035, 0.045, 1, 6); FLAGS.finGeo = new THREE.SphereGeometry(0.075, 8, 6);
  FLAGS.poleMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a6 }); return FLAGS.geo = g;
}
function flagMats(fac, team) { // shared per (country, colour): one texture + two materials however many HQs a player has
  const key = 'm' + fac + '|' + flagTrimCss(team); if (FLAGS.tex[key]) return FLAGS.tex[key];
  const tx = flagTex(fac, team), trim = new THREE.Color(flagTrimCss(team));
  return FLAGS.tex[key] = { cloth: new THREE.MeshLambertMaterial({ map: tx, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.38 }),
    trim: new THREE.MeshLambertMaterial({ color: trim, emissive: trim, emissiveIntensity: 0.35 }) };
}
const FLAG_SCALE = 0.6; // v7.7.9 (Nicholas): flags 40% smaller than v7.7.7
const FLAG_MAST = 2.75; // mast height (the Command Yard roof is ~1.6, its antenna ~1.8)
function makeHqFlag(b) { // -> THREE.Group or null; placed on the front-left corner of the footprint so the camera (south) sees it
  if (!FLAG_TYPES[b.t] || typeof G === 'undefined' || !G.players) return null;
  const P = G.players[b.team]; if (!P || !FLAG_PAINT[P.fac]) return null;
  flagGeo(); const grp = new THREE.Group(); grp.position.set(-b.w / 2 + 0.22, 0, b.h / 2 - 0.22);
  const pole = new THREE.Mesh(FLAGS.poleGeo, FLAGS.poleMat); pole.scale.y = FLAG_MAST; pole.position.y = FLAG_MAST / 2; pole.castShadow = true; grp.add(pole);
  const M = flagMats(P.fac, b.team);
  const fin = new THREE.Mesh(FLAGS.finGeo, M.trim); fin.position.y = FLAG_MAST + 0.05; grp.add(fin);
  const band = new THREE.Mesh(FLAGS.poleGeo, fin.material); band.scale.set(1.5, 0.12, 1.5); band.position.y = 0.9; grp.add(band); // team band low on the mast
  const cloth = new THREE.Mesh(FLAGS.geo, M.cloth); cloth.position.set(0.03, FLAG_MAST - FLAGS.H / 2 - 0.04, 0); cloth.castShadow = false; grp.add(cloth);
  grp.userData = { cloth, ph: (b.id || 0) * 1.7, fac: P.fac, team: b.team }; grp.name = 'hqFlag'; grp.visible = !b.con && !(b.sell >= 0); // a new site starts hidden even before its first on-screen frame
  return grp;
}
function flagUpdate(o, e, dt) { // per visible HQ per frame: hide on construction/sell, cheap sway unless Quiet/Low/phone-lite
  const f = o.flag; if (!f) return;
  const show = !o.cs && !e.con && !(e.sell >= 0); f.visible = show; if (!show) return;
  const k = FLAG_SCALE * (typeof R3 !== 'undefined' && R3.qName === 'mobile' ? 1.45 : 1); // v7.7.9: 40% smaller everywhere; phones keep their relative 1.45x bump
  f.scale.set(k, k * Math.max(0.02, o.body.scale.y), k);
  if (typeof csLite === 'function' && csLite()) return;
  const u = f.userData, t = (typeof R3 !== 'undefined' ? R3.time : 0) + u.ph; u.cloth.rotation.y = -0.18 + Math.sin(t * 1.9) * 0.12 + Math.sin(t * 3.7) * 0.04;
}
