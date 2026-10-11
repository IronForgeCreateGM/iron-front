# Iron Front — Roadmap

## Done
### v1 – Canvas prototype (map, harvesting, A*, AI waves)
### v2 – Three.js 2.5D, tech tree, 10 units, counters, AI difficulty, audio, groups
### v3 – Graphics + QoL + economy
- **Rendering**: PBR (MeshStandard + per-vertex metal/rough/emissive), PMREM image-based lighting from a procedural sky, tuned PCF soft shadows that follow the camera (snapped to texels), exp fog/atmosphere.
- **Custom HDR post pipeline** (no ES modules): HalfFloat scene RT (MSAA x4 on High/Ultra) → 3-level bloom → ACES → lift/gain grading + saturation → vignette → FXAA (Medium).
- **Models**: every unit and building rebuilt from beveled, merged procedural parts, with team paint, glowing lights, windows, antennas, and animated parts (radar dishes, rotors, harvester drum, visible ore load, turret recoil, blinking lights). The sidebar and info-panel portraits are real 3D renders of these models.
- **Terrain**: a 4x-resolution smoothed heightfield (smooth cliffs and shores), a shader splat (grass/dirt/rock/sand with procedural noise, bump detail, strata) and vertex cavity AO. Water uses an animated normal shader with fresnel sky reflection, sun glints, depth color and shoreline foam. Grass tufts (up to 30k) and pines are instanced and sway in the wind, with displaced boulders. Fog of war is applied inside every shader.
- **FX**: GPU instanced billboard particles with a procedural 16-frame smoke flipbook (smoke, fire, sparks), instanced debris with physics, scorch decals, shockwave rings, glowing tracers, shells and rockets, camera shake.
- **Performance**: units are drawn with InstancedMesh per type, team and part (150 units ≈ 36 draw calls in the stress test). Also: manual view-rect culling, pooled particles/debris/decals/markers, capped pixel ratio, Low/Med/High/Ultra presets with GPU auto-detect and automatic downgrade when FPS < 38, and an FPS/draw-call overlay (F).
- **QoL**: selecting a building switches the tab automatically. The Command Yard can build Ore Haulers. Selected buildings show build buttons in the context panel. Hotkeys (T Y U I O J K) appear on the buttons. Tooltips show cost, stats and strong/weak matchups. Shift-click queues 5; right-click cancels (shift = 5). The info panel has a 3D portrait. Alerts cover idle harvesters (.), idle army (,) and attacks (with minimap ping). Other additions: smooth damped camera, middle-drag pan, edge-pan speed setting, shift waypoints for move and attack-move with path lines, a health-bar mode setting, hover rings, and a settings panel.
- **Economy**: 4.5x ore per tile, ore regrows (faster on live tiles), harvesters carry 1500 with a visible load, a dock queue at refineries, and tile reservation plus spreading penalties.
- **v2 fixes**: wall-adjacent and congestion costs in A*, crowd-arrival logic and an escalating sidestep (fewer chokepoint jams). The AI now only sees what its own fog reveals (it remembers buildings it has seen and scouts the enemy start). The AI also keeps harvesters stocked and sells non-essential structures when broke (no late-game stall).

### v3.1 – Feedback pass
- Punchier grading: lower exposure (0.8), contrast 1.15, saturation 1.22, deeper shadows (less fill light and env light, stronger cavity AO), heavier vignette. Brightness, contrast and saturation sliders in Settings.
- **Easy AI really is easy now:**
  - No attacks or scouting before about 9.5 min, and no harvester raids before 18 min.
  - First wave is 3 units, growing by 1 per wave up to 7, with 150 s gaps.
  - 55% income and 60% build speed.
  - The test `test/sim-test.js` asserts that Easy's first attack, and the first damage to a passive human, happen at 8 min or later (3 seeds).
- Defense upgrades: Guard Turret and Flak Battery go up to level 3 (+35% / +75% damage, +1 / +2 range, costs $450 / $800, 15 s / 25 s). Each level changes the look (bigger head, rank chevrons, armor collar, glowing ring). A range ring appears when selected, hovered or placing. The Research Lab offers "Hardened Defenses" (+15% damage, +0.5 range, +25% HP for all defenses). Upgrade button and hotkey Z, with tooltips. Normal/Hard AI also upgrades its defenses when rich.
- Defensive Formation (G; Shift+G = in front of base): armor in front, infantry/air in the middle, artillery/AA at the back, facing the nearest visible enemy (or the enemy start), units set to hold stance. Stance toggle (V): Aggressive chases; Hold engages in range, then returns to its spot and faces the guard direction.

### v4.0 – Make it FUN: expansions, 2v2, big map
- **Fix:** the AI checks that a building can be placed before queueing it. Unplaceable items (for example a 2nd Gas Extractor) get a 45–60 s cooldown and the AI moves on.
- **Map "Iron Valley" (96x96, 2.25x the area):** four-fold mirrored, so all four corners are fair.
  - Each corner has a main base on a plateau ringed by cliffs, with two ramps.
  - Each corner has two natural expansions with ore and gas, plus a contested mid base with a rich gold field (1.8x value).
  - The middle has small gold fields near the centre and a river crossed by 4 bridges (plank decks with rails).
  - There are forests (noise mask), a central landmark (an "Ancient Reactor Spire" monument) and 16 gas vents.
  - G.sites lists every base site for the AI.
- **Command Center (cc):** $2200, needs a Refinery.
  - It works as a full construction yard (builds structures and haulers) and a harvester drop-off.
  - It can be placed on explored ground or within 26 tiles of your own buildings. It cannot go within 12 tiles of enemy buildings or within 9 tiles of another HQ/CC.
  - HQ and CC give a build radius of 10; other buildings give 5.
- **Win condition:** a player is eliminated when they have no HQ/CC/production/refinery/lab left, and their walls and defenses are then removed. An alliance loses when all its players are out.
- **Players and lobby:**
  - 2–4 players. Entities keep `team` = player index, and `P.ally` = alliance. `foe(a,b)` replaces every old `team !==` check. Vision arrays are shared per alliance.
  - The lobby has 4 slots: Human / Chief SI / Chief / Easy / Medium / Hard / Closed, plus team A/B and faction for each slot.
  - Presets: 1v1, *Me + Chief (SI) vs 2 Medium*, *Watch: Chief SI + Chief vs 2 Hard*, and the two 1v1 watch modes.
  - Ally colours: blue + cyan vs red + orange.
  - Alt-click pings an ally. An ally AI sends its army to an "attack" ping or most of it to a "help" ping.
  - Ally AIs defend allied bases and follow the human's army when picking attack targets.
- **AI on all difficulties expands:** expandAt is 1000 s for Easy, 480 s for Medium, 300 s for Hard, 330 s for Chief and 210 s for SI. More CCs bring more refineries, extractors and harvesters.
  - Extra factories and barracks are built when money is floating.
  - The AI saves money for economy structures and no longer starves its first refinery.
  - Attack groups with no known targets sweep the enemy start and sites, nearest-to-enemy first.
  - Groups regroup with a radius that scales with group size and a cooldown.
  - New idle units reinforce a running attack.
  - There is a unit cap of 100 per player (harvesters excluded).
- **Chief SI:**
  - Turrets are reactive: 2 are built once rushed. Building them pre-emptively lost more games in the ablation runs.
  - The army is recalled if the base is attacked in the first 6 min, and the attack group comes home against a big raid at any time.
  - Wounded units retreat.
  - The SI aims for 3 refinery-harvesters per refinery, 3 factories and 2 barracks.
  - When gas piles up it builds gas-heavy units (Titan/Tsar). It builds its faction special after 5 min as a win condition.
  - Jets strike in waves of at least 3. Interceptor escorts circle the target (or the staging point) instead of hovering.
  - Its attack groups target CCs and production first.
  - It avoids the exposed mid base when expanding.
- **Polish:**
  - Announcer banner: Base / Harvester / Ally under attack, Expansion established, Ally expanding, X eliminated, ally "on my way", and special unit or building ready.
  - The end screen has a per-player stats table (kills, losses, mined, built) and an army-value graph.
  - New sim tools: test/v4-test.js, test/one.js and test/batch.sh (8-way parallel; SIOFF=flag ablations).

### v4.0 sim results (1v1 vs Hard, seeds 101..1010, 30-min cap)
- Chief SI: 7 W / 0 L / 3 timeouts. Chief: 2 W / 6 L / 2 T.
- 2v2 SI+Chief vs 2 Medium: 2/2 wins. 2v2 SI+Chief vs 2 Hard: 0/3 (they survive 9–13 min).
- The Easy timing check still passes (first attack at 9.5 min).

## Rough edges (v4)
- 2v2 against two Hard AIs is too tough for the AI team: Hard's +35% income compounds with expansions. Balance ideas are to drop Hard to 1.25 or to stagger the two Hards' attack timing.
- Some SI games time out at 30 min while SI is clearly ahead. Hard rebuilds from scattered CCs, so finishing takes a long time.
- Water shows blotchy white patches in some unexplored or remembered areas (FOW sampling on water). It is cosmetic only.
- The game ends for the human when their alliance is gone. If you are eliminated while your ally lives, you keep spectating with your ally's shared vision. No "continue watching" option yet.
- Only one map; it serves 1v1, 2v2 and FFA. A map selector is a next step.

## Rough edges
- Formation slots ignore cliffs (a blocked slot snaps to the nearest free tile). Hold-stance units still pursue up to 1.5 tiles past their weapon range.
- On Easy, the AI may sit on a large army before the first attack, but waves are capped at wave size + 2 units.
- Real GPU performance can't be measured headless (SwiftShader). Draw calls are low, but the terrain fragment shader is noise-heavy; auto-quality is the safety net.
- No SSAO; it's faked with contact-shadow blobs, building AO decals and vertex cavity AO. There is no mesh LOD (instancing made it unnecessary at 150 units).
- Smoke quads can clip into the ground (no soft particles). Explosions are good but not film-grade.
- Units still overlap a bit in big crowds. Jams are reduced, not eliminated.
- Gunships have no proper landing/rearm. There are no walls in the UI, and engineers only capture.

### v4.1 – Online multiplayer (lockstep P2P)
- **Commands:** all player input (move, attack, formation, stance, queue/cancel, place, sell, repair, rally, upgrade, ping, surrender) goes through `NET.issue()` and is executed by `execCmd(team, cmd)` in `js/net.js`. Offline, a command executes immediately. Online, it is scheduled for tick + 4.
- **Lockstep (host relay):**
  - Each human sends its input for a tick (empty turns too). The host merges them and broadcasts the turn, and every peer executes it before `stepGame()`.
  - A peer that lags makes everyone show "Waiting for <name>…".
  - The sim keeps running in hidden tabs (interval fallback).
  - Disconnects: if a client drops, the host injects a deterministic `drop` command and a Medium AI takes the slot. If the host drops, clients continue offline against AI.
- **Determinism:**
  - `dsin/dcos/datan2/dhypot` (only + − × ÷ and sqrt) replace Math.* in sim/ai.
  - All randomness uses the seeded xorshift RNG.
  - Every 30 ticks an FNV state hash (exact float bits) is checked by the host; a mismatch shows a "Desync detected" banner.
  - The version hash (from the sim function sources) is checked when joining.
- **Lobby:**
  - Host online game / Join with code / `?room=CODE` share link. The host assigns 4 slots (Human you / Human remote / Chief SI / Chief / Easy / Medium / Hard / Closed), teams, factions and colours.
  - Remote players are auto-seated, pick their faction, and Ready up; the host can only start when everyone is ready.
  - Lobby chat. Surrender in the Esc menu.
- **Transport:** Trystero (Nostr signalling + WebRTC) is vendored as a classic IIFE in `vendor/trystero-nostr.js`. Relays and TURN can be set in `js/net-config.js` or with `?relays=`. `?transport=local` uses BroadcastChannel for 2-tab testing.
- **Team colours:** Blue / Red / Yellow / Green are selectable per slot and unique. They apply to paint, accents, minimap and UI.
- **Local-player perspective (`ME`):** the UI and renderer no longer assume team 0. The end result is computed per alliance.
- **Fix (v4.0 regression):** units rendered almost black. The ore's per-instance colour switched the shared PBR material to an instanceColor shader program, so other instanced meshes got a zero colour. Ore now has its own material.
- GitHub Pages ready: relative paths, `.nojekyll`, README "Play online with friends".

## Next (v4.2+)
- Real-network soak test on GitHub Pages: WebRTC could not run in this sandbox. Tested with the node fake transport and two real Chrome tabs over BroadcastChannel.
- Adaptive input delay (measure RTT, 3–8 ticks); reconnect/rejoin; spectators; in-game chat.
- Client colour choice in lobby (host sets it today), map select, 2v2 balance (2v2 sims eliminate too fast).
- Optional: replay files (the command log + seed already reproduce a game exactly).

## Older next-steps steps
1. A second faction with unique units and superweapon(s), plus a skirmish map selection/generator.
2. Soft particles + depth-based SSAO (needs a depth pre-pass), GPU-timer-driven dynamic resolution.
3. Flow-field pathing for large groups; formations with facing; unit veterancy.
4. Campaign/mission scripting, save/load, replays; better AI build-order personalities.

## v3.2 (done)
- Economy: ore per tile x11 (was x4.5), harvester load 600 (was 1500), slower mining (40/s), ore value 0.7, slower regrow. ~6-7k credits/min with 7 haulers; a side's fields are ~75% mined at 20 min under full harvesting (test: see NOTES).
- Graphics: no more roof hotspots (metal roughness 0.48, env 0.42, bloom threshold 2.4 / intensity 0.32, HDR clamp before bloom + tonemap).
- Realism: military paint (olive drab vs desert tan), procedural camo on unit paint, grime noise + ground dirt on all models, team colour reduced to accent stripes/patches/lights; new infantry body (plate carrier, pouches, helmet, backpack, realistic proportions).
- Unit combat AI: smarter target scoring (counter effectiveness, low HP finish, threats on me, focus fire, overkill avoidance via in-flight damage), periodic retarget, fight back when hit (+ nearby idle allies respond), kiting for out-ranging units, rally = attack-move. Hold stance only engages in range; explicit move still ignores enemies.
- Infantry: Sniper, Pyro (flamethrower splash), Field Medic (heals infantry).
- Air: Airfield (3x3), Falcon Strike Jet (bomb runs, 2 bombs, returns to rearm), Talon Interceptor (air-to-air missiles), Thunder Bomber (6-bomb carpet). Landed jets park on airfield.
- Chief commander AI (`?watch=hard`, menu "Watch: Chief vs Hard"): faster eco, staged formation defense, attacks when army value > 1.4x seen enemy, regroups, retreats on bad trades, air strikes on eco. Spectator camera director.
- Tests: test/units-test.js, test/chief-test.js. (test/record.js = optional CDP frame recorder; video skipped per user — watch live via ?watch=hard.)

## Rough edges / next
- Chief vs Hard ~75% (6/8 seeds); losses vs early Hard pressure on some seeds.
- Jets are simplified (hover-free but no true circling flight paths); no transport yet.
- Camo pattern is object-space, can stretch on long panels.

## v3.4 (done)
- Procedural infantry animation: jointed legs (thigh/shin/boot parts), distance-synced gait phase (no foot sliding), walk→run blend, torso bob/lean/twist, idle sway, aim stance + recoil kick, death fall (corpses crumple, linger, sink). All infantry incl. Kommando squad (3 soldiers per unit) and the Titan mech walker.
- Rendering stability: light-space texel-snapped shadow frustum (quantized size), dynamic near/far planes, tuned shadow bias, derivative-faded high-frequency terrain/water noise (no shimmer), water polygonOffset + softer shore alpha, wrapped water time, per-frame smoothed fog-of-war (float buffer), anisotropic filtering on textures.
- HD: pixel ratio up to 2 on Medium(1.25)/High/Ultra, sharpening pass (uSharp), High uses MSAA 2x at retina.
- Plasma Gas: 4 symmetric vents (2 per side, one contested), Gas Extractor (on vent, 3 gas/s), HUD ◆ counter, minimap markers. Gas costs: Pyro 25, Bastion 75, Jet 150, Bomber 250, turret/flak Lv3 100, Hardened Defenses 200, Titan 250, faction specials 150-300. Refunded on cancel.
- Factions (menu cards + enemy faction select; AI random): USA Nightshade Stealth Fighter (hidden unless enemies within 3.2 tiles or it fired), Russia Tsar Siege Tank (2600 HP, twin guns, self-repair), France Grand Cannon (15-range fortress artillery), Germany Jäger Kommando Squad (3 elite commandos, demolition-grade damage vs buildings). Elite for all: Titan Walker.
- Team colour ~50%: military blue vs oxide-red paint on hulls/uniforms, building walls tinted; camo/grime/metal on the rest.
- Test scene: ?v34=<seconds>&zoom=&cx=&cy= ; extractors allowed on any vent within 14 tiles of your buildings.

## Rough edges
- No true TAA (MSAA/FXAA + sharpen instead). Arms are part of the upper body (weapon held, no swing).
- Squad takes damage as one unit. Stealth reveal is simple distance-based.
- Corpses ignore terrain slope; Tsar model is chunky.
