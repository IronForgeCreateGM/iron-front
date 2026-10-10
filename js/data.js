'use strict';
// ===== Static data tables (all original names) =====
const MW = 64, MH = 64, DT = 1 / 30;
// damage-type x armor multipliers (counter system)
const DMG = {
  bullet: { inf: 1.0, light: 0.45, heavy: 0.2, bldg: 0.2, air: 0.6 },
  cannon: { inf: 0.35, light: 1.0, heavy: 0.85, bldg: 0.8, air: 0 },
  rocket: { inf: 0.25, light: 1.0, heavy: 1.25, bldg: 0.7, air: 1.1 },
  shell:  { inf: 1.0, light: 0.8, heavy: 0.6, bldg: 1.3, air: 0 },
  flak:   { inf: 0.35, light: 0.2, heavy: 0.1, bldg: 0.1, air: 1.6 },
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
  wall:    { n: 'Wall', w: 1, h: 1, hp: 400, cost: 50, pow: 0, time: 1, cat: 'def', req: ['barracks'] },
};
// Units. armor: inf|light|heavy|air. sp tiles/sec. r radius.
const UT = {
  rifle:  { n: 'Rifleman', hp: 110, sp: 1.6, armor: 'inf', wpn: 'rifle', cost: 100, time: 3, from: 'barracks', sight: 6, r: 0.22, req: [] },
  rocketeer:{ n: 'Rocketeer', hp: 100, sp: 1.4, armor: 'inf', wpn: 'rocket', cost: 300, time: 5, from: 'barracks', sight: 6.5, r: 0.22, req: [] },
  engineer:{ n: 'Engineer', hp: 80, sp: 1.5, armor: 'inf', wpn: null, cost: 500, time: 6, from: 'barracks', sight: 5, r: 0.22, req: [], engineer: 1 },
  scout:  { n: 'Raider Buggy', hp: 200, sp: 3.6, armor: 'light', wpn: 'mg', cost: 500, time: 5, from: 'factory', sight: 9, r: 0.38, req: [] },
  light:  { n: 'Lancer Tank', hp: 380, sp: 2.2, armor: 'heavy', wpn: 'lcannon', cost: 700, time: 7, from: 'factory', sight: 7, r: 0.45, req: [], turret: 1 },
  heavy:  { n: 'Bastion Tank', hp: 800, sp: 1.4, armor: 'heavy', wpn: 'hcannon', cost: 1400, time: 12, from: 'factory', sight: 7, r: 0.58, req: ['tech'], turret: 1 },
  arty:   { n: 'Howler Artillery', hp: 260, sp: 1.6, armor: 'light', wpn: 'arty', cost: 1000, time: 10, from: 'factory', sight: 6, r: 0.48, req: ['tech'], turret: 1 },
  aa:     { n: 'Skyguard', hp: 320, sp: 2.2, armor: 'light', wpn: 'flak', cost: 700, time: 7, from: 'factory', sight: 8, r: 0.45, req: [], turret: 1 },
  harv:   { n: 'Ore Hauler', hp: 1000, sp: 1.5, armor: 'heavy', wpn: null, cost: 1400, time: 10, from: 'factory', alt: ['hq'], sight: 5, r: 0.6, req: [] },
  gunship:{ n: 'Hornet Gunship', hp: 340, sp: 3.4, armor: 'air', wpn: 'gun', cost: 1200, time: 10, from: 'airpad', sight: 8, r: 0.5, req: [], air: 1 },
};
const CATS = { bld: 'Structures', def: 'Defenses', inf: 'Infantry', veh: 'Vehicles', air: 'Aircraft' };
const FROMCAT = { barracks: 'inf', factory: 'veh', airpad: 'air' };
const TEAMCOL = [0x2f8cff, 0xff4433, 0x33dd66, 0xffcc22];
const DIFF = {
  easy:   { income: 0.55, think: 2.5, wave0: 3, waveMax: 7, waveInc: 1, harass: 0.15, harassAfter: 1080, firstAttack: 570, waveGap: 150, build: 0.6, scoutAfter: 600 },
  normal: { income: 1.0, think: 1.2, wave0: 6, waveMax: 14, waveInc: 2, harass: 0.3, harassAfter: 0, firstAttack: 0, waveGap: 30, build: 1.0, scoutAfter: 20 },
  hard:   { income: 1.35, think: 0.7, wave0: 7, waveMax: 20, waveInc: 2, harass: 0.5, harassAfter: 0, firstAttack: 0, waveGap: 30, build: 1.3, scoutAfter: 20 },
};
// economy
const ORE_VALUE = 0.9, HARV_CAP = 1500, MINE_RATE = 150, UNLOAD_RATE = 600, ORE_REGROW = 1.2; // per second
// defense upgrades: level 2/3 cost & time per structure; per-level multipliers
const UPG = { turret: [[450, 15], [800, 25]], aagun: [[450, 15], [800, 25]] };
const UPG_DMG = [1, 1.35, 1.75], UPG_RNG = [0, 1, 2];
const DEF_RESEARCH = { n: 'Hardened Defenses', cost: 1500, time: 40, dmg: 1.15, rng: 0.5, hp: 1.25 };
