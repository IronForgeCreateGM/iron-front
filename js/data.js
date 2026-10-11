'use strict';
// ===== Static data tables (all original names) =====
const MW = 96, MH = 96, DT = 1 / 30;
// damage-type x armor multipliers (counter system)
const DMG = {
  bullet: { inf: 1.0, light: 0.45, heavy: 0.2, bldg: 0.2, air: 0.6 },
  cannon: { inf: 0.35, light: 1.0, heavy: 0.85, bldg: 0.8, air: 0 },
  rocket: { inf: 0.25, light: 1.0, heavy: 1.25, bldg: 0.7, air: 1.1 },
  shell:  { inf: 1.0, light: 0.8, heavy: 0.6, bldg: 1.3, air: 0 },
  flak:   { inf: 0.35, light: 0.2, heavy: 0.1, bldg: 0.1, air: 1.6 },
  snipe:  { inf: 1.0, light: 0.12, heavy: 0.04, bldg: 0.04, air: 0.1 },
  fire:   { inf: 1.3, light: 0.6, heavy: 0.25, bldg: 1.0, air: 0 },
  bomb:   { inf: 0.6, light: 1.0, heavy: 1.1, bldg: 1.8, air: 0 },
  aam:    { inf: 0, light: 0, heavy: 0, bldg: 0, air: 1.5 },
  cmdo:   { inf: 1.25, light: 0.5, heavy: 0.3, bldg: 1.6, air: 0.3 },
};
// weapons: dmg, rng(tiles), cd(sec), type, spd(proj tiles/s), ground/air capability
const W = {
  rifle:  { dmg: 14, rng: 4.5, cd: 0.9, type: 'bullet', spd: 40, ground: 1, air: 1, snd: 'rifle' },
  rocket: { dmg: 55, rng: 5.5, cd: 2.2, type: 'rocket', spd: 12, ground: 1, air: 1, snd: 'rocket' },
  lcannon:{ dmg: 40, rng: 5, cd: 1.6, type: 'cannon', spd: 25, ground: 1, air: 0, snd: 'cannon' },
  hcannon:{ dmg: 70, rng: 5.5, cd: 2.0, type: 'cannon', spd: 25, ground: 1, air: 0, snd: 'cannon', twin: 1 },
  arty:   { dmg: 90, rng: 10, minRng: 3, cd: 3.5, type: 'shell', spd: 9, ground: 1, air: 0, splash: 1.4, arc: 1, snd: 'arty' },
  flak:   { dmg: 26, rng: 7, cd: 0.5, type: 'flak', spd: 30, ground: 0, air: 1, splash: 0.8, snd: 'flak' },
  mg:     { dmg: 9, rng: 4.5, cd: 0.4, type: 'bullet', spd: 40, ground: 1, air: 1, snd: 'rifle' },
  gun:    { dmg: 45, rng: 4, cd: 1.4, type: 'rocket', spd: 16, ground: 1, air: 0, snd: 'rocket' },
  snipe:  { dmg: 125, rng: 9, cd: 3.2, type: 'snipe', spd: 70, ground: 1, air: 0, snd: 'snipe' },
  flame:  { dmg: 20, rng: 2.6, cd: 0.45, type: 'fire', spd: 9, ground: 1, air: 0, splash: 0.9, snd: 'flame' },
  jbomb:  { dmg: 230, rng: 1.6, cd: 0.6, type: 'bomb', spd: 8, ground: 1, air: 0, splash: 1.4, snd: 'arty', ammo: 2 },
  cbomb:  { dmg: 170, rng: 1.8, cd: 0.25, type: 'bomb', spd: 7, ground: 1, air: 0, splash: 1.5, snd: 'arty', ammo: 6, spread: 1.6 },
  aam:    { dmg: 95, rng: 6.5, cd: 1.4, type: 'aam', spd: 22, ground: 0, air: 1, snd: 'rocket', ammo: 4 },
  sbomb:  { dmg: 300, rng: 1.6, cd: 0.6, type: 'bomb', spd: 8, ground: 1, air: 0, splash: 1.3, snd: 'arty', ammo: 2 },
  tsarc:  { dmg: 120, rng: 6.5, cd: 2.2, type: 'cannon', spd: 24, ground: 1, air: 0, snd: 'cannon', twin: 1 },
  gcan:   { dmg: 280, rng: 15, minRng: 3, cd: 4.5, type: 'shell', spd: 12, ground: 1, air: 0, splash: 1.6, arc: 1, snd: 'arty' },
  kmg:    { dmg: 30, rng: 6, cd: 0.45, type: 'cmdo', spd: 45, ground: 1, air: 1, snd: 'rifle' },
  titan:  { dmg: 85, rng: 7, cd: 1.7, type: 'rocket', spd: 14, ground: 1, air: 1, snd: 'rocket', twin: 1 },
  tcannon:{ dmg: 55, rng: 6.5, cd: 1.5, type: 'cannon', spd: 25, ground: 1, air: 0, snd: 'cannon' },
};
// Buildings. cat: bld (structures) | def (defenses). req: buildings needed.
const BT = {
  hq:      { n: 'Command Yard', w: 3, h: 3, hp: 3000, cost: 3000, pow: 20, time: 30, cat: 'bld', req: ['__never'] },
  power:   { n: 'Power Plant', w: 2, h: 2, hp: 700, cost: 300, pow: 100, time: 5, cat: 'bld', req: [] },
  refinery:{ n: 'Ore Refinery', w: 3, h: 3, hp: 1000, cost: 1400, pow: -30, time: 9, cat: 'bld', req: ['power'] },
  barracks:{ n: 'Barracks', w: 2, h: 2, hp: 700, cost: 400, pow: -15, time: 5, cat: 'bld', req: ['power'] },
  factory: { n: 'War Factory', w: 3, h: 3, hp: 1400, cost: 1600, pow: -40, time: 10, cat: 'bld', req: ['refinery', 'barracks'] },
  airpad:  { n: 'Helipad', w: 2, h: 2, hp: 800, cost: 1000, pow: -40, time: 8, cat: 'bld', req: ['factory', 'tech'] },
  tech:    { n: 'Research Lab', w: 2, h: 2, hp: 1000, cost: 1800, pow: -100, time: 12, cat: 'bld', req: ['factory'] },
  turret:  { n: 'Guard Turret', w: 1, h: 1, hp: 700, cost: 600, pow: -20, time: 5, cat: 'def', req: ['barracks'], wpn: 'tcannon', sight: 7 },
  aagun:   { n: 'Flak Battery', w: 1, h: 1, hp: 500, cost: 700, pow: -25, time: 5, cat: 'def', req: ['barracks'], wpn: 'flak', sight: 8 },
  airfield:{ n: 'Airfield', w: 3, h: 3, hp: 1200, cost: 1500, pow: -50, time: 12, cat: 'bld', req: ['factory', 'tech'] },
  cc:      { n: 'Command Center', w: 3, h: 3, hp: 2200, cost: 2200, pow: 10, time: 25, cat: 'bld', req: ['refinery'] },
  extractor:{ n: 'Gas Extractor', w: 2, h: 2, hp: 900, cost: 800, pow: -20, time: 8, cat: 'bld', req: ['refinery'] },
  gcannon: { n: 'Grand Cannon', w: 2, h: 2, hp: 2200, cost: 2500, gas: 300, pow: -80, time: 20, cat: 'def', req: ['tech'], wpn: 'gcan', sight: 15, fac: 'fra' },
  wall:    { n: 'Wall', w: 1, h: 1, hp: 400, cost: 50, pow: 0, time: 1, cat: 'def', req: ['barracks'] },
};
// Units. armor: inf|light|heavy|air. sp tiles/sec. r radius.
const UT = {
  rifle:  { n: 'Rifleman', hp: 110, sp: 1.6, armor: 'inf', wpn: 'rifle', cost: 100, time: 3, from: 'barracks', sight: 6, r: 0.22, req: [] },
  rocketeer:{ n: 'Rocketeer', hp: 100, sp: 1.4, armor: 'inf', wpn: 'rocket', cost: 300, time: 5, from: 'barracks', sight: 6.5, r: 0.22, req: [] },
  engineer:{ n: 'Engineer', hp: 80, sp: 1.5, armor: 'inf', wpn: null, cost: 500, time: 6, from: 'barracks', sight: 5, r: 0.22, req: [], engineer: 1 },
  sniper: { n: 'Sniper', hp: 90, sp: 1.4, armor: 'inf', wpn: 'snipe', cost: 600, time: 7, from: 'barracks', sight: 10, r: 0.22, req: [] },
  pyro:   { n: 'Pyro', hp: 170, sp: 1.6, armor: 'inf', wpn: 'flame', cost: 350, gas: 25, time: 5, from: 'barracks', sight: 5.5, r: 0.24, req: [] },
  medic:  { n: 'Field Medic', hp: 120, sp: 1.7, armor: 'inf', wpn: null, cost: 400, time: 5, from: 'barracks', sight: 6, r: 0.22, req: [], heal: 14 },
  kommando:{ n: 'Jäger Kommando Squad', hp: 600, sp: 1.8, armor: 'inf', wpn: 'kmg', cost: 1500, gas: 150, time: 14, from: 'barracks', sight: 8, r: 0.4, req: ['tech'], squad: 3, fac: 'ger' },
  scout:  { n: 'Raider Buggy', hp: 200, sp: 3.6, armor: 'light', wpn: 'mg', cost: 500, time: 5, from: 'factory', sight: 9, r: 0.38, req: [] },
  light:  { n: 'Lancer Tank', hp: 380, sp: 2.2, armor: 'heavy', wpn: 'lcannon', cost: 700, time: 7, from: 'factory', sight: 7, r: 0.45, req: [], turret: 1 },
  heavy:  { n: 'Bastion Tank', hp: 800, sp: 1.4, armor: 'heavy', wpn: 'hcannon', cost: 1400, gas: 75, time: 12, from: 'factory', sight: 7, r: 0.58, req: ['tech'], turret: 1 },
  arty:   { n: 'Howler Artillery', hp: 260, sp: 1.6, armor: 'light', wpn: 'arty', cost: 1000, time: 10, from: 'factory', sight: 6, r: 0.48, req: ['tech'], turret: 1 },
  aa:     { n: 'Skyguard', hp: 320, sp: 2.2, armor: 'light', wpn: 'flak', cost: 700, time: 7, from: 'factory', sight: 8, r: 0.45, req: [], turret: 1 },
  titan:  { n: 'Titan Walker', hp: 1500, sp: 1.3, armor: 'heavy', wpn: 'titan', cost: 2600, gas: 250, time: 18, from: 'factory', sight: 8, r: 0.75, req: ['tech'], turret: 1, mech: 1 },
  tsar:   { n: 'Tsar Siege Tank', hp: 2600, sp: 1.0, armor: 'heavy', wpn: 'tsarc', cost: 3200, gas: 300, time: 24, from: 'factory', sight: 8, r: 0.9, req: ['tech'], turret: 1, regen: 6, fac: 'rus' },
  harv:   { n: 'Ore Hauler', hp: 1000, sp: 1.5, armor: 'heavy', wpn: null, cost: 1400, time: 10, from: 'factory', alt: ['hq', 'cc'], sight: 5, r: 0.6, req: [] },
  jet:    { n: 'Falcon Strike Jet', hp: 420, sp: 7.0, armor: 'air', wpn: 'jbomb', cost: 2000, gas: 150, time: 14, from: 'airfield', sight: 8, r: 0.6, req: [], air: 1, jet: 1 },
  intercept:{ n: 'Talon Interceptor', hp: 360, sp: 7.5, armor: 'air', wpn: 'aam', cost: 1300, time: 10, from: 'airfield', sight: 10, r: 0.55, req: [], air: 1, jet: 1 },
  bomber: { n: 'Thunder Bomber', hp: 950, sp: 3.6, armor: 'air', wpn: 'cbomb', cost: 2800, gas: 250, time: 20, from: 'airfield', sight: 8, r: 0.9, req: [], air: 1, jet: 1 },
  stealth:{ n: 'Nightshade Stealth Fighter', hp: 380, sp: 7.5, armor: 'air', wpn: 'sbomb', cost: 2400, gas: 200, time: 16, from: 'airfield', sight: 8, r: 0.6, req: [], air: 1, jet: 1, stealthy: 1, fac: 'usa' },
  gunship:{ n: 'Hornet Gunship', hp: 340, sp: 3.4, armor: 'air', wpn: 'gun', cost: 1200, time: 10, from: 'airpad', sight: 8, r: 0.5, req: [], air: 1 },
};
const CATS = { bld: 'Structures', def: 'Defenses', inf: 'Infantry', veh: 'Vehicles', air: 'Aircraft' };
const FROMCAT = { barracks: 'inf', factory: 'veh', airpad: 'air', airfield: 'air' };
const TEAMCOL = [0x3f7fd0, 0xd04a36, 0x2fc4d0, 0xf08a2a]; // accents only (re-assigned per game by alliance)
const TEAMPAINT = [0x2e4a73, 0x7a2d25, 0x2a6a72, 0x8a5222];
const TEAM_COLORS = { blue: { n: 'Blue', paint: 0x2e4a73, acc: 0x3f7fd0, css: '#5fb0ff' }, red: { n: 'Red', paint: 0x7a2d25, acc: 0xd04a36, css: '#ff5040' }, yellow: { n: 'Yellow', paint: 0x8a7420, acc: 0xe0c030, css: '#ffd84a' }, green: { n: 'Green', paint: 0x2f5e2a, acc: 0x4caf50, css: '#6fdc6a' } };
const MMCOL = ['#5fb0ff', '#ff5040', '#5fe6f0', '#ffa040']; // strong but realistic military blue / oxide red // olive drab vs desert tan
const DIFF = {
  easy:   { expandAt: 1000, income: 0.55, think: 2.5, wave0: 3, waveMax: 7, waveInc: 1, harass: 0.15, harassAfter: 1080, firstAttack: 570, waveGap: 150, build: 0.6, scoutAfter: 600 },
  normal: { expandAt: 480, income: 1.0, think: 1.2, wave0: 6, waveMax: 14, waveInc: 2, harass: 0.3, harassAfter: 0, firstAttack: 0, waveGap: 30, build: 1.0, scoutAfter: 20 },
  chief:  { expandAt: 330, income: 1.0, think: 0.5, wave0: 10, waveMax: 30, waveInc: 3, harass: 0.4, harassAfter: 240, firstAttack: 0, waveGap: 45, build: 1.0, scoutAfter: 15, chief: 1 },
  si:     { expandAt: 210, income: 1.0, think: 0.4, wave0: 10, waveMax: 30, waveInc: 3, harass: 0.4, harassAfter: 240, firstAttack: 0, waveGap: 40, build: 1.0, scoutAfter: 10, chief: 1, si: 1 },
  hard:   { expandAt: 300, income: 1.35, think: 0.7, wave0: 7, waveMax: 20, waveInc: 2, harass: 0.5, harassAfter: 0, firstAttack: 0, waveGap: 30, build: 1.3, scoutAfter: 20 },
};
// economy
const ORE_VALUE = 0.91, HARV_CAP = 600, MINE_RATE = 40, UNLOAD_RATE = 300, ORE_REGROW = 0.8, ORE_MULT = 11; // per second
// defense upgrades: level 2/3 cost & time per structure; per-level multipliers
const UPG = { turret: [[450, 15], [800, 25, 100]], aagun: [[450, 15], [800, 25, 100]] };
const UPG_DMG = [1, 1.35, 1.75], UPG_RNG = [0, 1, 2];
const DEF_RESEARCH = { n: 'Hardened Defenses', cost: 1500, gas: 200, time: 40, dmg: 1.15, rng: 0.5, hp: 1.25 };

const GAS_RATE = 3.0; // per extractor per second
const FACTIONS = {
  usa: { n: 'United States', flag: '🇺🇸', sp: 'stealth', desc: 'Nightshade Stealth Fighter — invisible bomber. Only revealed when enemies are within 3 tiles or it attacks. Precision 300-dmg bombs vs. structures.' },
  rus: { n: 'Russia', flag: '🇷🇺', sp: 'tsar', desc: 'Tsar Siege Tank — 2600 HP super-heavy with twin 120mm guns that slowly repairs itself in the field.' },
  fra: { n: 'France', flag: '🇫🇷', sp: 'gcannon', desc: 'Grand Cannon — fortress artillery with 15-tile range and 280 splash damage. Locks down a whole front.' },
  ger: { n: 'Germany', flag: '🇩🇪', sp: 'kommando', desc: 'Jäger Kommando Squad — three elite commandos in one unit: rapid long-range fire, demolition charges wreck buildings.' },
};

// ===== deterministic math (lockstep): only + - * / and sqrt (IEEE-exact) =====
let ME = 0; // local player index (UI/render perspective)
const D_PI = 3.141592653589793, D_2PI = 6.283185307179586, D_HPI = 1.5707963267948966;
function dsin(x) {
  x = x - Math.round(x / D_2PI) * D_2PI;            // [-pi, pi]
  if (x > D_HPI) x = D_PI - x; else if (x < -D_HPI) x = -D_PI - x; // [-pi/2, pi/2]
  const x2 = x * x;
  return x * (1 + x2 * (-1 / 6 + x2 * (1 / 120 + x2 * (-1 / 5040 + x2 * (1 / 362880 + x2 * (-1 / 39916800 + x2 * (1 / 6227020800)))))));
}
function dcos(x) { return dsin(x + D_HPI); }
function datan01(a) { // atan for a in [0,1]
  let off = 0; if (a > 0.41421356237309503) { off = D_PI / 4; a = (a - 1) / (a + 1); }
  const a2 = a * a; let r = 0, t = a; for (let k = 0; k < 14; k++) { r += t / (2 * k + 1) * (k & 1 ? -1 : 1); t *= a2; }
  return off + r;
}
function datan2(y, x) {
  if (x === 0 && y === 0) return 0;
  const ax = Math.abs(x), ay = Math.abs(y); let r = ay <= ax ? datan01(ay / ax) : D_HPI - datan01(ax / ay);
  if (x < 0) r = D_PI - r; return y < 0 ? -r : r;
}
function dhypot(x, y) { return Math.sqrt(x * x + y * y); }
