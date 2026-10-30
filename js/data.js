'use strict';
// ===== Static data tables (all original names) =====
let MW = 96, MH = 96; const DT = 1 / 30; // v5.5: MW/MH vary per map (Volcano Crown 4v4 = 112)
// damage-type x armor multipliers (counter system)
const DMG = {
  warhead: { inf: 1.0, light: 1.0, heavy: 0.9, bldg: 1.0, air: 0 },
  zap:    { inf: 1.25, light: 0.95, heavy: 0.8, bldg: 0.4, air: 0 },
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
  gat:    { inf: 1.35, light: 0.8, heavy: 0.35, bldg: 0.3, air: 1.4 }, // v5.9 France Gatling Bastion
  marine: { inf: 1.3, light: 0.65, heavy: 0.38, bldg: 0.35, air: 0.7 },
  bolt:   { inf: 0.5, light: 1.0, heavy: 1.3, bldg: 0.5, air: 0 }, // v7.0.2 China Ballista Tower giant arrow: armour-piercing, wasted on infantry
  kami:   { inf: 1.2, light: 1.1, heavy: 0.9, bldg: 1.1, air: 0 }, // v7.0 Iran Shahed kamikaze drone warhead // v5.8 Brazil Iron Marine dual-purpose carbine
};
// weapons: dmg, rng(tiles), cd(sec), type, spd(proj tiles/s), ground/air capability
const W = {
  tesla:  { dmg: 150, rng: 5.5, cd: 1.9, type: 'zap', spd: 99, ground: 1, air: 0, chain: 3, snd: 'zap' },
  rifle:  { dmg: 14, rng: 4.5, cd: 0.9, type: 'bullet', spd: 40, ground: 1, air: 1, snd: 'rifle' },
  rocket: { dmg: 55, rng: 5.5, cd: 2.2, type: 'rocket', spd: 12, ground: 1, air: 1, snd: 'rocket' },
  lcannon:{ dmg: 40, rng: 5, cd: 1.6, type: 'cannon', spd: 25, ground: 1, air: 0, snd: 'cannon' },
  hcannon:{ dmg: 70, rng: 5.5, cd: 2.0, type: 'cannon', spd: 25, ground: 1, air: 0, snd: 'cannon', twin: 1 },
  mbt:    { dmg: 45, rng: 5.25, cd: 1.8, type: 'cannon', spd: 25, ground: 1, air: 0, snd: 'cannon', twin: 1 }, // v6.2 Warhound: Lancer 40x1/1.6s, Bastion 70x2/2.0s -> 45x2/1.8s
  arty:   { dmg: 90, rng: 7, minRng: 3, cd: 3.5, type: 'shell', spd: 9, ground: 1, air: 0, splash: 1.4, arc: 1, snd: 'arty' },
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
  gcan:   { dmg: 520, rng: 15, minRng: 3, cd: 3.0, type: 'shell', spd: 14, ground: 1, air: 0, splash: 2.4, arc: 1, snd: 'gcan', big: 1 },
  flakB:  { dmg: 60, rng: 8, cd: 0.4, type: 'flak', spd: 34, ground: 0, air: 1, splash: 1.0, snd: 'flak' },
  kmg:    { dmg: 30, rng: 6, cd: 0.45, type: 'cmdo', spd: 45, ground: 1, air: 1, snd: 'rifle' },
  titan:  { dmg: 85, rng: 7, cd: 1.7, type: 'rocket', spd: 14, ground: 1, air: 1, snd: 'rocket', twin: 1 },
  gatl:   { dmg: 20, rng: 7.5, cd: 0.18, type: 'gat', spd: 45, ground: 1, air: 1, snd: 'rifle' },
  marine: { dmg: 21, rng: 6.1, cd: 0.8, type: 'marine', spd: 40, ground: 1, air: 1, snd: 'rifle' },
  tcannon:{ dmg: 85, rng: 6.5, cd: 1.3, type: 'cannon', spd: 25, ground: 1, air: 0, snd: 'cannon' },
  // v7.0 new factions + Endless boss
  kami:   { dmg: 175, rng: 0.7, cd: 1, type: 'kami', spd: 99, ground: 1, air: 0, splash: 1.8, snd: 'arty' },            // Iran Shahed drone (explodes on contact)
  raijin: { dmg: 150, rng: 6, cd: 2.1, type: 'zap', spd: 99, ground: 1, air: 0, chain: 2, snd: 'zap' },                // Japan Raijin mech: lightning cannon
  rjet:   { dmg: 30, rng: 5, cd: 1.0, type: 'rocket', spd: 18, ground: 1, air: 1, snd: 'rocket' },                     // Japan Raijin jet mode: light rockets
  gtow:   { dmg: 53, rng: 10.5, cd: 0.5, type: 'bullet', spd: 40, ground: 1, air: 1, snd: 'rifle', squad: 1 },          // v7.0.2 China Great Wall guard tower: SUMMARY profile only (range ring / AI threat ≈ squad DPS); it actually fires GT_SQUAD
  bolt:   { dmg: 380, rng: 12.5, minRng: 1.5, cd: 3.0, type: 'bolt', spd: 30, ground: 1, air: 0, snd: 'bolt' },      // v7.0.2 China Ballista Tower: one giant single-target arrow (+1.5 height range = 14). NOT in the v5.0 -25% static-defence nerf list
  balS:   { dmg: 170, rng: 12.5, cd: 1.0, type: 'bolt', spd: 30, ground: 1, air: 1, snd: 'bolt', squad: 1 },         // v7.0.2 Ballista Tower SUMMARY profile (range ring / AI threat); it actually fires BALLISTA.w
  colossus:{ dmg: 150, rng: 7.5, cd: 2.0, type: 'shell', spd: 14, ground: 1, air: 0, splash: 1.8, arc: 1, snd: 'gcan', big: 1 }, // Endless boss
};
// v5.0: static defense damage -25%
for (const k of ['tcannon', 'flakB', 'gcan', 'tesla', 'gatl']) if (W[k]) W[k].dmg = Math.round(W[k].dmg * 0.75);
// Buildings. cat: bld (structures) | def (defenses). req: buildings needed.
const BT = {
  hq:      { n: 'Command Yard', w: 3, h: 3, hp: 3000, cost: 3000, pow: 20, time: 30, cat: 'bld', req: ['__never'] },
  power:   { n: 'Power Plant', w: 2, h: 2, hp: 700, cost: 300, pow: 100, time: 5, cat: 'bld', req: [] },
  refinery:{ n: 'Ore Refinery', w: 3, h: 3, hp: 1000, cost: 1400, pow: -30, time: 9, cat: 'bld', req: ['power'] },
  barracks:{ n: 'Barracks', w: 2, h: 2, hp: 700, cost: 400, pow: -15, time: 5, cat: 'bld', req: ['power'] },
  factory: { n: 'War Factory', w: 3, h: 3, hp: 1400, cost: 1600, pow: -40, time: 10, cat: 'bld', req: ['refinery', 'barracks'] },
  tech:    { n: 'Research Lab', w: 2, h: 2, hp: 1000, cost: 1800, pow: -100, time: 12, cat: 'bld', req: ['factory'] },
  turret:  { n: 'Guard Turret', w: 1, h: 1, hp: 700, cost: 600, pow: -20, time: 5, cat: 'def', req: ['barracks'], wpn: 'tcannon', sight: 7 },
  aagun:   { n: 'Flak Battery', w: 1, h: 1, hp: 500, cost: 700, pow: -25, time: 5, cat: 'def', req: ['barracks'], wpn: 'flakB', sight: 8 },
  airfield:{ n: 'Air Command', w: 4, h: 3, hp: 1700, cost: 1800, pow: -60, time: 14, cat: 'bld', req: ['factory', 'tech'], desc: 'v6.2: runway + helipads in one building (replaces Helipad + Airfield). One queue builds every aircraft; docked aircraft rearm and get repaired. 4 dock slots; buy the Extra Pads add-on for 8.' },
  cc:      { n: 'Command Center', w: 3, h: 3, hp: 2200, cost: 2200, pow: 10, time: 25, cat: 'bld', req: ['refinery'], desc: 'Second construction yard: more build speed, a wider build area and a new base. Base wiped out? If you have no Command Yard or Command Center left, an Engineer can found a new Command Center (same $2200) — place it within 9 tiles of the engineer, who walks in and is used up.' },
  extractor:{ n: 'Gas Extractor', w: 2, h: 2, hp: 900, cost: 800, pow: -20, time: 8, cat: 'bld', req: ['refinery'] },
  silo:    { n: 'Warhead Launcher', w: 2, h: 2, hp: 2400, cost: 3000, gas: 500, pow: -80, time: 30, cat: 'bld', req: ['tech'], sight: 8 },
  gcannon: { n: 'Grand Cannon', w: 2, h: 2, hp: 2200, cost: 2500, gas: 300, pow: -80, time: 20, cat: 'def', req: ['tech'], wpn: 'gcan', sight: 15, fac: 'fra' },
  tesla:   { n: 'Tesla Coil', w: 1, h: 1, hp: 900, cost: 1200, pow: -60, time: 8, cat: 'def', req: ['tech'], wpn: 'tesla', sight: 7, noFac: 'fra', desc: 'Chain lightning arcs to 3 more nearby enemies. Very power-hungry (-60): goes dark in low power.' },
  gatling: { n: 'Tourelle Gatling (Gatling Bastion)', w: 1, h: 1, hp: 1500, cost: 1800, pow: -50, time: 10, cat: 'def', req: ['tech'], wpn: 'gatl', sight: 8, fac: 'fra', desc: 'France (replaces the Tesla Coil): rotating six-barrel gatling that spins up and shreds infantry and aircraft. Hits ground AND air; weak vs heavy armor.' },
  gate:    { n: 'Wall Gate', w: 1, h: 1, hp: 900, cost: 150, pow: 0, time: 2, cat: 'def', req: ['barracks'], desc: 'Your and allied units pass through; blocks enemies. Place it in a wall line.' },
  gtower:  { n: 'Great Wall Guard Tower', w: 1, h: 1, hp: 1100, cost: 50, pow: 0, time: 1, cat: 'def', req: ['__never'], wpn: 'gtow', sight: 11, squad: 1, fac: 'chn', hide: 1, desc: 'China: every 5th wall piece you build rises as a guard tower that fights like a garrisoned squad: Rifleman, Sniper, Rocketeer and Iron Marine, each firing its own weapon, +1.5 range from the height (sniper 10.5 tiles). Hits ground + air. No power needed. With a Research Lab, select one to convert it into a Ballista Tower ($1400 + 150 gas, 20s): one giant armour-piercing arrow every 3s (494 vs heavy armour, single target, no splash, 14 range, ground only), 1800 HP, uses 40 power.' },
  wall:    { n: 'Wall', w: 1, h: 1, hp: 600, cost: 50, pow: 0, time: 1, cat: 'def', req: ['barracks'] },
};
// Units. armor: inf|light|heavy|air. sp tiles/sec. r radius.
const UT = {
  rifle:  { n: 'Rifleman', hp: 110, sp: 1.6, armor: 'inf', wpn: 'rifle', cost: 100, time: 3, from: 'barracks', sight: 6, r: 0.22, req: [] },
  rocketeer:{ n: 'Rocketeer', hp: 100, sp: 1.4, armor: 'inf', wpn: 'rocket', cost: 300, time: 5, from: 'barracks', sight: 6.5, r: 0.22, req: [] },
  engineer:{ n: 'Engineer', hp: 80, sp: 1.5, armor: 'inf', wpn: null, cost: 500, time: 6, from: 'barracks', sight: 5, r: 0.22, req: [], engineer: 1, heal: 9, rep: 32, desc: 'Auto-repairs damaged buildings (fast) and patches up nearby units (slower) without being used up. Right-click an enemy building to capture it, or an oil derrick to claim it (those use the engineer up). If your base is wiped out (no Command Yard or Center left), an engineer can found a new Command Center next to itself.' },
  sniper: { n: 'Sniper', hp: 90, sp: 1.4, armor: 'inf', wpn: 'snipe', cost: 600, time: 7, from: 'barracks', sight: 10, r: 0.22, req: [] },
  kommando:{ n: 'Jäger Kommando Squad', hp: 600, sp: 1.8, armor: 'inf', wpn: 'kmg', cost: 1500, gas: 150, time: 14, from: 'barracks', sight: 8, r: 0.4, req: ['tech'], squad: 3, fac: 'ger' },
  marine: { n: 'Fuzileiro Blindado (Iron Marine)', hp: 300, sp: 1.67, armor: 'inf', wpn: 'marine', cost: 400, time: 6, from: 'barracks', sight: 6.5, r: 0.26, req: [], fac: 'bra', marine: 1,
    desc: 'Brazil: heavily armored infantry, shoots ground and air. Attack-move (tap/A-click) engages anything it meets, then resumes; a plain move/retreat breaks off at once and it re-engages nearby enemies when it arrives. Vehicle guns/rockets do 35% less (not artillery), +15% armor vs tanks and aircraft, splash hurts it 45% less. Plating shrugs off 45% of small-arms fire (15–30% vs rockets/flak/marines). Strength in numbers: +5% damage and +3% armor per nearby marine (max 6). Countered by flame, Tesla, artillery/bombs and tank cannons (big target: x2.6).' },
  scout:  { n: 'Raider Buggy', hp: 200, sp: 3.6, armor: 'light', wpn: 'mg', cost: 500, time: 5, from: 'factory', sight: 9, r: 0.38, req: [] },
  heavy:  { n: 'Warhound Battle Tank', hp: 590, sp: 1.8, armor: 'heavy', wpn: 'mbt', cost: 1050, time: 9, from: 'factory', sight: 7, r: 0.52, req: [], turret: 1, desc: 'v6.2 main battle tank (replaces the Lancer and Bastion): HP, firepower and speed halfway between them. Twin 105mm cannon.' },
  arty:   { n: 'Howler Artillery', hp: 260, sp: 1.6, armor: 'light', wpn: 'arty', cost: 1000, time: 10, from: 'factory', sight: 6, r: 0.48, req: ['tech'], turret: 1, siege: 1, desc: 'Mobile range 7. SIEGE MODE (D): 3 s to deploy, then stationary with range 10 and wider splash; 2.5 s to pack up (a move order packs automatically).' },
  aa:     { n: 'Skyguard', hp: 320, sp: 2.2, armor: 'light', wpn: 'flak', cost: 700, time: 7, from: 'factory', sight: 8, r: 0.45, req: [], turret: 1 },
  titan:  { n: 'Titan Walker', hp: 1500, sp: 1.3, armor: 'heavy', wpn: 'titan', cost: 2600, gas: 250, time: 18, from: 'factory', sight: 8, r: 0.75, req: ['tech'], turret: 1, mech: 1 },
  tsar:   { n: 'Tsar Siege Tank', hp: 2600, sp: 1.0, armor: 'heavy', wpn: 'tsarc', cost: 3200, gas: 300, time: 24, from: 'factory', sight: 8, r: 0.9, req: ['tech'], turret: 1, regen: 6, fac: 'rus' },
  harv:   { n: 'Ore Hauler', hp: 1000, sp: 1.5, armor: 'heavy', wpn: null, cost: 750, time: 8, from: 'factory', alt: ['hq', 'cc'], sight: 5, r: 0.42, req: [], desc: 'Gathers ore (360 per load; diamond fields far from the start bases pay +$140 a load). Max 4 haulers per ore field: extra or displaced haulers move to the nearest field with room.' },
  jet:    { n: 'Falcon Strike Jet', hp: 420, sp: 7.0, armor: 'air', wpn: 'jbomb', cost: 2000, gas: 150, time: 14, from: 'airfield', sight: 8, r: 0.6, req: [], air: 1, jet: 1 },
  intercept:{ n: 'Talon Interceptor', hp: 360, sp: 7.5, armor: 'air', wpn: 'aam', cost: 1300, time: 10, from: 'airfield', sight: 10, r: 0.55, req: [], air: 1, jet: 1 },
  bomber: { n: 'Thunder Bomber', hp: 950, sp: 3.6, armor: 'air', wpn: 'cbomb', cost: 2800, gas: 250, time: 20, from: 'airfield', sight: 8, r: 0.9, req: [], air: 1, jet: 1 },
  stealth:{ n: 'Nightshade Stealth Fighter', hp: 380, sp: 7.5, armor: 'air', wpn: 'sbomb', cost: 2400, gas: 200, time: 16, from: 'airfield', sight: 8, r: 0.6, req: [], air: 1, jet: 1, stealthy: 1, fac: 'usa' },
  medevac:{ n: 'Seraph Medevac', hp: 560, sp: 3.0, armor: 'air', cost: 1100, time: 10, from: 'airfield', sight: 7, r: 0.7, req: ['tech'], air: 1, cap: 8, medevac: 1, desc: 'Flying medic + transport (replaces the Hauler Transport). Projects a green healing beam onto damaged friendly ground units within 2.5 tiles (12 HP/s each, up to 3 at once; healers do not stack). Carries 8 slots (infantry 1, vehicles 4): select units and right-click it to board; Unload all = button or Shift+B (B = unload at a spot). Fragile vs flak/AA.' },
  gunship:{ n: 'Hornet Gunship', hp: 340, sp: 3.4, armor: 'air', wpn: 'gun', cost: 1200, time: 10, from: 'airfield', sight: 8, r: 0.5, req: [], air: 1 },
  // ---- v7.0 new faction specials ----
  drone:  { n: 'Shahed Kamikaze Drone', hp: 90, sp: 4.2, armor: 'air', wpn: null, cost: 600, time: 8, from: 'factory', sight: 8, r: 0.3, req: [], air: 1, kami: 1, batch: 3, fac: 'irn',
    desc: 'Iran: launched in batches of 3 ($600). Each drone dives into the densest enemy army or a building and detonates (175 dmg, 1.8-tile splash). Fragile: flak, rifles and any anti-air shoot it down. The blob counter.' },
  raijin: { n: 'Raijin Mech', hp: 1400, sp: 1.6, armor: 'heavy', wpn: 'raijin', cost: 2200, gas: 250, time: 18, from: 'factory', sight: 8, r: 0.7, req: ['tech'], mech: 1, fac: 'jpn', xform: 'raijinJ',
    desc: 'Japan: TRANSFORMS (T / ⚡ button, 1.5 s). Mech mode: heavy walker with a lightning cannon that arcs to 2 more targets. Jet mode: fast flyer (6 tiles/s) that crosses walls and cliffs with light rockets — but anti-air can hit it. Hit and run.' },
  raijinJ:{ n: 'Raijin Mech (Jet)', hp: 1400, sp: 6.0, armor: 'air', wpn: 'rjet', cost: 2200, gas: 250, time: 18, from: 'factory', sight: 9, r: 0.6, req: ['__never'], air: 1, fac: 'jpn', xform: 'raijin', hide: 1 },
  // ---- v7.0 Endless boss (never buildable) ----
  colossus:{ n: 'Colossus', hp: 9000, sp: 0.9, armor: 'heavy', wpn: 'colossus', cost: 8000, time: 1, from: 'factory', sight: 9, r: 1.3, req: ['__never'], mech: 1, turret: 1, hide: 1, boss: 1, vs: 2.3 },
};
const CATS = { bld: 'Structures', def: 'Defenses', inf: 'Infantry', veh: 'Vehicles', air: 'Aircraft' };
const FROMCAT = { barracks: 'inf', factory: 'veh', airfield: 'air' };
const AIRPADS = { n: 'Extra Pads', cost: 600, time: 15 }, AIR_SLOTS = [[-1.45, 0.75], [-0.5, 0.75], [0.25, -0.75], [0.95, -0.75], [0.45, 0.75], [1.4, 0.75], [-0.45, -0.75], [1.65, -0.75]]; // v6.2 Air Command dock slots (4, add-on 8)
const TEAMCOL = [0x3f7fd0, 0xd04a36, 0x2fc4d0, 0xf08a2a, 0xff7a1a, 0x9a4ae0, 0x2fd0c4, 0xe8eef4]; // accents only (re-assigned per game by alliance)
const TEAMPAINT = [0x2e4a73, 0x7a2d25, 0x2a6a72, 0x8a5222, 0x8a4a1a, 0x4a2a6a, 0x1f6a6a, 0x8a8f96];
const TEAM_COLORS = { orange: { n: 'Orange', paint: 0x8a4a1a, acc: 0xff7a1a, css: '#ff8c2a' }, purple: { n: 'Purple', paint: 0x4a2a6a, acc: 0x9a4ae0, css: '#b070ff' }, blue: { n: 'Blue', paint: 0x2e4a73, acc: 0x3f7fd0, css: '#5fb0ff' }, red: { n: 'Red', paint: 0x7a2d25, acc: 0xd04a36, css: '#ff5040' }, yellow: { n: 'Yellow', paint: 0xc4a12c, acc: 0xffd83a, css: '#ffd84a' }, green: { n: 'Green', paint: 0x3f7f37, acc: 0x5fd060, css: '#6fdc6a' }, teal: { n: 'Teal', paint: 0x1f6a6a, acc: 0x2fd0c4, css: '#4fe8dc' }, white: { n: 'White', paint: 0x8a8f96, acc: 0xe8eef4, css: '#eef3f8' } };
const MMCOL = ['#5fb0ff', '#ff5040', '#5fe6f0', '#ffa040', '#ff8c2a', '#b070ff', '#4fe8dc', '#eef3f8']; // strong but realistic military blue / oxide red // olive drab vs desert tan
// v4.3: difficulty = skill only (no economy bonus). think = reaction/APM delay (s), slip = chance a decision cycle is fumbled, sat = worker saturation
const DIFF = {
  easy:   { sys: { sim: 0, hsq: 0, prong: 0, float: 0, prodMax: 1, choke: 0, close: 1 },  sat: 0.6, slip: 0.3, expandAt: 1000, think: 3.0, wave0: 3, waveMax: 7, waveInc: 1, harass: 0.15, harassAfter: 1080, firstAttack: 570, waveGap: 150, scoutAfter: 600 },
  normal: { sys: { sim: 0, hsq: 0, prong: 0, float: 6000, prodMax: 1.5, choke: 0, close: 1 },  sat: 0.8, slip: 0.12, expandAt: 480, think: 1.6, wave0: 9, waveMax: 16, waveInc: 2, harass: 0.3, harassAfter: 0, firstAttack: 0, waveGap: 75, scoutAfter: 20 },
  chief:  { sys: { sim: 1, hsq: 1, prong: 0, float: 1800, prodMax: 4.5, choke: 1, close: 1 },  sat: 1, slip: 0, expandAt: 330, think: 0.45, wave0: 10, waveMax: 30, waveInc: 3, harass: 0.4, harassAfter: 240, firstAttack: 0, waveGap: 45, scoutAfter: 15, chief: 1 },
  si:     { sys: { sim: 1, hsq: 1, prong: 1, float: 1400, prodMax: 5, choke: 1, close: 1 },  sat: 1, slip: 0, expandAt: 210, think: 0.25, wave0: 10, waveMax: 30, waveInc: 3, harass: 0.4, harassAfter: 240, firstAttack: 0, waveGap: 40, scoutAfter: 10, chief: 1, si: 1, v71: 1 },
  si2:    { sys: { sim: 1, hsq: 1, prong: 1, float: 1400, prodMax: 5, choke: 1, close: 1 },  sat: 1, slip: 0, expandAt: 150, think: 0.25, wave0: 10, waveMax: 30, waveInc: 3, harass: 0.4, harassAfter: 240, firstAttack: 0, waveGap: 40, scoutAfter: 10, chief: 1, si: 1, v71: 1, v76: 1 }, // v7.6 Hard (lobby 'Hard AI'): the v7.5.1 'si' brain + the v7.6 rework layer (isV76). 'si' stays frozen for old replays and as the benchmark.
  hard:   { sys: { sim: 1, hsq: 1, prong: 0, float: 4000, prodMax: 2.5, choke: 1, close: 1 },  sat: 1, slip: 0, expandAt: 300, think: 0.8, wave0: 7, waveMax: 20, waveInc: 2, harass: 0.5, harassAfter: 0, firstAttack: 0, waveGap: 30, scoutAfter: 20 },
  // scripted human-style sparring partners (tests only; ignore the peace window like a human would)
  h_strong: { human: 1, doc: 1, sys: { sim: 1, hsq: 1, prong: 1, float: 1400, prodMax: 5, choke: 1, close: 1 }, sat: 1, slip: 0, expandAt: 240, think: 0.35, wave0: 9, waveMax: 30, waveInc: 3, harass: 0.5, harassAfter: 200, firstAttack: 0, waveGap: 35, scoutAfter: 10, chief: 1 }, // v5.3 sparring: a strong, macro-heavy human (fast expand, many factories, defended entrances, no SI tricks)
  h_rush:   { human: 1, order: ['power', 'barracks', 'refinery', 'barracks', 'power', 'factory', 'power', 'refinery', 'power', 'factory', 'turret', 'power', 'tech', 'power'], sys: { sim: 1, hsq: 1, prong: 0, float: 1500, prodMax: 4, choke: 1, close: 1 }, sat: 0.9, slip: 0, expandAt: 9999, think: 0.5, wave0: 6, waveMax: 30, waveInc: 2, harass: 0.6, harassAfter: 0, firstAttack: 0, waveGap: 20, scoutAfter: 10 },
  h_turtle: { human: 1, defCr: 400, order: ['power', 'barracks', 'refinery', 'turret', 'power', 'turret', 'factory', 'turret', 'refinery', 'power', 'aagun', 'turret', 'power', 'tech', 'turret', 'aagun', 'power', 'turret', 'gcannon', 'power', 'turret', 'aagun', 'refinery', 'power', 'turret', 'turret', 'power', 'aagun'], sys: { sim: 1, hsq: 0, prong: 0, float: 3000, prodMax: 4, choke: 1, close: 1 }, sat: 1, slip: 0, expandAt: 600, think: 0.6, wave0: 30, waveMax: 40, waveInc: 2, harass: 0, harassAfter: 9999, firstAttack: 900, waveGap: 120, scoutAfter: 60, chief: 1 },
  h_tower:  { human: 1, defCr: 300, order: ['power', 'barracks', 'turret', 'refinery', 'turret', 'power', 'turret', 'factory', 'aagun', 'power', 'turret', 'refinery', 'turret', 'power', 'aagun', 'turret', 'tech', 'power', 'power', 'tesla', 'turret', 'power', 'aagun', 'tesla', 'power'], sys: { sim: 1, hsq: 1, prong: 0, float: 2500, prodMax: 3, choke: 1, close: 1 }, sat: 1, slip: 0, expandAt: 480, think: 0.6, wave0: 14, waveMax: 30, waveInc: 3, harass: 0.3, harassAfter: 300, firstAttack: 540, waveGap: 60, scoutAfter: 30, chief: 1 },
};
// economy
const DERRICK_RATE = 11.25; // credits / second per captured oil derrick (v6.2: 9 -> 11.25, +25%)
const ORE_VALUE = 0.91, HARV_CAP = 360, MINE_RATE = 40, UNLOAD_RATE = 300, ORE_REGROW = 0.8, ORE_MULT = 14.3; // per second (v6.2: load 600 -> 360 = -40%, patches 11 -> 14.3 = +30% ore)
const MEDEVAC = { r: 2.5, hps: 12, max: 3, escort: true }; // v7.0.2 escort: false = old behaviour (test baseline)
// (prev) MEDEVAC = { r: 2.5, hps: 12, max: 3 }; // v6.3 Seraph Medevac heal beam: radius, HP/s per target, beams per craft (one healer per target)
const FIELD_CAP = 4, DIA_BONUS = 140, DIA_DIST = 20; // v6.2: max haulers per ore field (per team); diamond ore (fields > DIA_DIST tiles from every start) pays +$140 per full load
// defense upgrades: level 2/3 cost & time per structure; per-level multipliers
// v5.2 Warhead Launcher missiles: build one at a time in the silo, then launch at a target (arcs through the atmosphere)
const MIS = {
  small:   { n: 'Viper Missile',   cost: 700,  gas: 200, time: 25, rng: 45,  dmg: 1100, r: 2.4, cd: 25,  T: 6,  icpt: 1, sub: 1 },
  cluster: { n: 'Hydra Cluster',   cost: 1400, gas: 450, time: 45, rng: 65,  dmg: 520,  r: 1.9, cd: 50,  T: 9,  sub: 6, spread: 3.2 },
  heavy:   { n: 'Titan Warhead',   cost: 2800, gas: 1000, time: 80, rng: 200, dmg: 5200, r: 5,   cd: 120, T: 12, sub: 1, big: 1 } };
const UPG = { turret: [[450, 15], [800, 25, 100]], aagun: [[450, 15], [800, 25, 100]], tesla: [[600, 15], [1000, 25, 150]], gatling: [[700, 15], [1100, 25, 150]] };
const UPG_DMG = [1, 1.35, 1.75], UPG_RNG = [0, 1, 2];
const SM3 = { n: 'SM-3 Interceptor Battery', cost: 1800, gas: 200, time: 35, r: 10, p: 0.5 }; // v6.2 Command Yard / Command Center upgrade: 50% to shoot down EACH incoming missile/rocket/shell near the base
const SM3_KIND = { rocket: 1, shell: 1 };
const DEF_RESEARCH = { n: 'Hardened Defenses', cost: 1500, gas: 200, time: 40, dmg: 1.15, rng: 0.5, hp: 1.25 };
// v6.2 Research Lab tracks (replace Hardened Defenses): level 2 = +15% damage & HP, level 3 = +30% total. Applies to existing units too.
const RES = { cats: ['tank', 'inf', 'air', 'arty', 'def'], nm: { tank: 'Tanks', inf: 'Infantry', air: 'Aircraft', arty: 'Artillery', def: 'Defenses' }, ic: { tank: '🛡', inf: '🪖', air: '✈', arty: '💥', def: '🏰' },
  lv: [null, null, { cost: 1000, gas: 0, time: 60 }, { cost: 2000, gas: 150, time: 90 }] };
const RES_M = [1, 1, 1.15, 1.3];
const SIEGE = { dep: 3, pack: 2.5, rng: 10, splash: 2.0 }; // v6.2 Howler Siege Mode

// v5.8 Iron Marine tuning: base plating (vs small arms/rockets), per-nearby-marine bonus, cap, radius; tank cannons/heavy rounds x TAKE
const MAR = { vsTank: 0.85, splash: 0.55, splashDirect: 0.85, drN: 0.03, dmgN: 0.05, cap: 6, rad: 3, take: { cannon: 2.6 }, veh: 0.65, counter: { shell: 1, fire: 1, bomb: 1, zap: 1, warhead: 1 }, plated: { bullet: 0.45, snipe: 0.45, cmdo: 0.3, flak: 0.3, aam: 0.3, marine: 0.25, rocket: 0.15 } };
const GAS_RATE = 3.0; // per extractor per second
const FACTIONS = {
  usa: { n: 'United States', flag: '🇺🇸', sp: 'stealth', desc: 'Nightshade Stealth Fighter — invisible bomber. Only revealed when enemies are within 3 tiles or it attacks. Precision 300-dmg bombs vs. structures.' },
  rus: { n: 'Russia', flag: '🇷🇺', sp: 'tsar', desc: 'Tsar Siege Tank — 2600 HP super-heavy with twin 120mm guns that slowly repairs itself in the field.' },
  fra: { n: 'France', flag: '🇫🇷', sp: 'gcannon', desc: 'Grand Cannon — fortress artillery with 15-tile range and 280 splash damage. Locks down a whole front. Also fields the Tourelle Gatling (Gatling Bastion) instead of the Tesla Coil.' },
  ger: { n: 'Germany', flag: '🇩🇪', sp: 'kommando', desc: 'Jäger Kommando Squad — three elite commandos in one unit: rapid long-range fire, demolition charges wreck buildings.' },
  bra: { n: 'Brazil', flag: '🇧🇷', sp: 'marine', desc: 'Fuzileiro Blindado (Iron Marine) — armored, mass-produced Barracks infantry that hits ground and air; nearby marines boost each other (strength in numbers).' },
  irn: { n: 'Iran', flag: '🇮🇷', sp: 'drone', desc: 'Shahed Kamikaze Drones — cheap, built 3 at a time at the War Factory. They dive into enemy armies or buildings and explode with heavy splash. Anti-air shoots them down. Breaks up blobs.' },
  chn: { n: 'China', flag: '🇨🇳', sp: 'gtower', desc: 'Great Wall — China walls have +60% HP and every 5th wall piece rises as a Guard Tower: each guard tower fights like a garrisoned squad (rifleman, sniper, rocketeer and Iron Marine), out to 10.5 tiles, ground + air, no power. Long wall lines become a fortress. With a Research Lab, key towers convert into Ballista Towers: one giant tank-killing arrow, no splash.' },
  jpn: { n: 'Japan', flag: '🇯🇵', sp: 'raijin', desc: 'Raijin Mech — transforms between a fast jet (flies over walls and cliffs) and a heavy walking mech with a chain-lightning cannon. Press T or tap ⚡ to switch. Hit and run.' },
};

const FAC_KEYS = Object.keys(FACTIONS);
const CHN_WALL = { hp: 1.6, every: 5 }; // v7.0 China Great Wall
// v7.0.2 guard tower garrison: the real infantry weapons (W.rifle/snipe/rocket/marine), each with its own target + cooldown, +rng tiles from the elevated hut
const GT_SQUAD = { w: ['rifle', 'snipe', 'rocket', 'marine'], rng: 1.5 };
// v7.0.2 Ballista Tower: a guard tower upgrade (select it, pay, wait). The sniper + rocketeer crew the ballista; the rifleman and Iron Marine stay as close guard.
const BALLISTA = { n: 'Ballista Tower', cost: 1400, gas: 150, time: 20, hp: 1800, pow: -40, req: 'tech', w: ['bolt', 'rifle', 'marine'] };
const XFORM = { t: 1.5, cd: 3 };         // v7.0 Raijin transform time / cooldown (s)
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
