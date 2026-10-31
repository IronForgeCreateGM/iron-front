# RESUME NOTE (1:35 AM PT Oct 31): v7.6.7 LIVE (47e23ab pushed 1:31:39 AM PT, verified 1:32:57). Next version v7.6.8.
- Queue next: France army trading / defence overbuild (volcano 93 fra@0), bank floating at max pop, stuck spots (own factory exits 88,16), lighter AI test setup, flaky tests (endless703 loop-alive, ui7 timeout, fogkeys under load, reach-test needs :8765), App Store steps, visuals (SC2 construction, infantry, desert rocks).
- Push rule: ls-remote must show 47e23ab before the next push.

# v7.6.6 (night Oct 30-31): Hard AI math layer m7 (replay flag m7; SIOFF.m7 / m7a-d turn parts off; P.m7Off = live v7.6.5 brain)
- Code: js/ai.js m7On/field7/step7/tgt7/move7/lan7/spend7/mis7. Test harness: node test/m7-vs.js map seed facA facB swap maxMin [startA startB] (NEW = slot0, or slot1 when swap=1).
- Open: blue (USA) economy in the vs8-943 scenario (mines ~half of Brazil), bank floats at max pop when winning big, stuck spots (volcano8 32,80 / 48,104 open ground), France/China fortress-punish (fp76 still opt-in).
- Flaky: fogkeys ArrowRight check under heavy parallel load; reach-test needs a server on :8765.

# v7.6.5 LIVE (pushed 089269f at 3:51 PM PT, verified 3:52 PM PT): Hard AI 4c. Master = live + local docs-only commits.
- PUSH RULE: never push master blindly. Before any push, compare `git ls-remote https://github.com/IronForgeCreateGM/iron-front.git refs/heads/main` with what you mean to ship, bump the version (next is v7.6.6), and respect game-night windows (nothing after 4:30 PM PT on game nights).
- Shipped (all behind replay flag nt; old replays use the old brain): nt76 no-trap, wg76 wall gates, pw76 counter window (si2), cl76 open-ground gather points (never further from the HQ than before, nor past own defences), er76 early rush response, sf2 safe76 v2 (threat = enemy army within 40 s of the HQ, 6-min cap, never caps harvesters or blocks the first CC). Fortress (SION.fp76) is still opt-in.
- Open: (1) the vs8-943 Brazil side: new Brazil only wins on points vs live USA (kill at 17.4 min with cl76 off) -> find what cl76 does to the Brazil finish; run `NEWT=1 node test/vs8-943.js` and `NEWT=0`. (2) Volcano 77 chn vs ger start0 still lost on economy. (3) Classic 5 fra/rus start0 economy worse with er76. (4) frost 33 ger/fra start1 and volcano 63 usa/bra start1 lost vs live Hard.

# TONIGHT 4c (code on branch hard4c-b, merge it first) (Oct 30 2026): Hard AI, from Part B (branch hard4c-b in /workspace/wt-b, LOCAL, not pushed; live = v7.6.4)
- ARMIES STILL GET STUCK A LITTLE (Nicholas, 2:10 PM PT 4v4 all-Hard). nt76 no-trap check fixes base traps on volcano 77 but not field-pathing stalls; find where groups jam (chokes, wall gaps, ally bases) with a stuck-unit drill on 4v4 maps.
- Fortress-punish for France/China (Nicholas's request): bigger bases, very strong defence (Grand Cannon lines / Great Wall + Ballista), absorb, then counter-attack while the attacker is weak. One seeded strategy option among several. Prototype exists behind SION.fp76 / SION.pw76 (default off, see NIGHTLY-LOG). Todo: (1) fortress must not starve the army: budget defence as a share of income, keep the army bar at 1.0-1.2x not 1.4x; (2) expand bigger: an extra refinery/CC at a defended forward ore field; (3) place the defence lines with the base-layout study (beyond the outermost refinery, lines of 4-5 across the enemy path, early AA ring, walls with gaps); (4) the punish window looks good (2/2 classic) -> try it for all si2 with more seeds; (5) gate with a replay flag before turning on (like `nt`), then vs-live drills on 4-6 seeds incl. 4v4.
- nt76: 2-wide lane check is coded but off (starved economy); retry with a cheaper rule (only for walls/defence lines). vs-live 3W/2L/1T (mostly start-position mirror) -> needs more seeds where the check fires.
- stall-test SD=si2 failure FIXED in 2ff92cf (wall lines always get a gate, wg76).
- STATUS 3:00 PM PT: branch hard4c-b (2ff92cf+) has nt76 + wall-gate fix (wg76, all bots) + counter-attack window on for si2, all behind replay flag nt; fortress-punish tuned but still opt-in (SION.fp76). Checks green (det, replay, stall si/si2, old replays) but the 6-game vs-live check was 2W/2L/2T, so it was NOT shipped. Tonight: find why the window + wall-gate cost classic 5 start0 (nt alone won it on points), more seeds (only 6 quick games per ship check), then decide on turning fortress on (1 in 3 seeds for fra/chn).
- Armies stuck: test/stuck76-drill.js (4v4 volcano8): NEW 0.9% vs LIVE 1.9% stuck samples; live jams at mid-map open ground. Run more seeds/maps and look at the remaining spots next to own turrets / ally buildings.
- Push rule reminder: nothing after 4:30 PM PT on game nights.

# UNRELEASED (Oct 29 2026): lobby spawn-alignment fix COMMITTED, MUST SHIP WITH TONIGHT'S VERSION (not pushed, version not bumped)
- Commits 373a503, 5add975, 43234b8 (+ this note). Rule: lobby slot N (human or bot) spawns at map spot N = G.starts[SEAT_ORDER[map][N-1]] (sim.js seatPlan; symmetric maps 1 NW, 2 SE, 3 SW, 4 NE, 5 W-mid, 6 E-mid, 7 N-mid, 8 S-mid on Volcano XL). Preview draws slot numbers at the real starts in team colour.
- Exceptions (lobby shows "N->M"): Hellgate spots 1-2 = Team A only, 3-8 = Team B only; a row on the wrong side or a spot the map lacks takes the lowest free spot on its side. Endless: defenders on rows 1-4 -> bases 1-4, solo -> centre base. Other maps do not force sides.
- Presets now alternate A/B so they keep their old layouts. Old replays (no seat flag) use the old start logic. Tests: lobby-test.sh (720 games), test/spawn-det.js (old vs new hashes), test/spawn-shot.js.

# v7.5.0 (Oct 29 2026): Blender models for every unit and building (queue item 4 DONE)
- New glbs: infantry u_rifle/rocketeer/engineer/sniper/kommando/marine (rigged legs for the walk cycle), u_titan, u_raijin, u_raijinJ, u_colossus, plus China gtowerB (Ballista Tower, used when b.bal) and wallChn (Great Wall post). u_tsar LOD0 cut to 7.8k tris. All 23 units + 18 buildings (+2 China variants) now have glb + _lod1. Instanced wall connector segments (R3.wallSeg/wallChn) stay procedural for all factions.
- js/gfx/glb.js: KEYS += gtowerB, wallChn; glbSync maps a China wall to 'wallChn' instead of skipping it. Blender sources: /workspace/blender-iron-front/scripts (defs.py gtowerB/wallChn, make.py).
- Visual only: det74-test (models on vs ?glb=0 vs v7.4.0) identical, plus a chn-vs-chn wall variant. Shots: test/v75-shot.js (infantry/mechs), test/v75-chn-shot.js (China walls + Ballista, env D/OX/OY), test/v75-live-shot.js (live-style load check + infantry/Titan close-up).
- Next: queue item 4b (Hard AI army fix + last-game replay auto-save).

# v7.4.0 (Oct 28 2026): Blender .glb models live (queue item 4 PARTIAL), shipped on Nicholas's request
- Merged blender-trial (8d97671, 2fcac88, 0ac2065). js/gfx/glb.js loads models/<type>.glb (+ _lod1 on mobile/Quiet/Low) via vendor/GLTFLoader.js; procedural fallback on load failure, ?glb=0, or file:// (CORS blocks fetch there, so tests opened from file:// stay procedural).
- Visual only: data/sim/ai untouched; det74-test (models on via fake http origin vs ?glb=0 vs v7.3.1) all identical. test/v74-live-shot.js = skirmish shot with model-load check.
- Still to do for item 4: Titan, raijin/raijinJ, colossus, infantry (need rigs matching B.piv pivots), tsar LOD0 tri reduction (10.1k > 8k budget).

# v7.3.1 (Oct 28 2026): animated construction + Easy/Medium/Hard (nightly, queue item 2 done, item 3 done)
- Construction visuals: js/gfx/construct.js (makeSite/conAnim/conBurst/csDispose), render-only. A per-frame particle budget (csFrameStart) is scaled by FX.mul; csLite() = quiet/mobile/low. Each site clones pbrMaterial with a clipping plane for the course-by-course reveal and restores it when done. Walls take the cheap path. sfx 'clank' (panel snap) and 'built' (completion chime) play only for your own team.
- Difficulties: main.js DIFF_MAP/normDiff maps easy->easy, normal->normal (Medium), hard/chief/si->si (Hard), applied in buildSlots + lobbySet. SLOT_TYPES offers only Easy/Medium/Hard. Replays keep their recorded diffs, and the sim/ai DIFF table is untouched (old 'hard'/'chief' profiles still exist for tests and benchmarks). net.js drop/backfill of a disconnected human stays 'normal' (Medium).
- Tests: test/det73-test.js (determinism; env DET_AI, DET_SKIPNODE), test/v73-shot.js (construction stage shots), test/diff73-test.js (difficulty mapping + no "Chief" text); fogkeys-test lobby rows now pick si (old "hard" option is gone).
- Resume point: next queue item. Follow-ups: real-iPhone look/FPS check of construction sites with several building at once; maybe a crane variant for walls/defense clusters; consider retuning Medium now that the gap Medium->Hard is bigger (old 'hard' profile could become Medium if Medium feels too soft).
- Open (unchanged from v7.2.0): ai71 seed 11 team-push check, endless703 "loop alive" flaky under software GL; fogkeys/mobile-play/slot/ui7 can flake when run 4-way parallel on the box (all pass run one at a time). reach-test needs `python3 -m http.server 8765` running.

# v7.2.0 (Oct 27 2026): place-then-build construction (nightly, queue item 1 done)
- Buildings/defenses/walls: pay in full at placement, build on the ground (e.con = {p, w}), HP grows with progress, cancel refunds b.paid/b.paidG, destroyable while building. One active site per category lane (walls exempt); build rate scales with yards and halves on low power.
- Bots: an order sets its price aside gradually (2x the old build pace, resvOf/it.acc in stepProduction), then becomes P.ready[cat] and is placed by placeReady. aiThink sees only spendable credits. Benchmark vs v7.0.3 SI: 31W/0L/1D (results in /workspace/bench-v720-final).
- Tests: test/build72-test.js (new), test/v72-shot.js (shots/v7_2-under-construction.png).
- Open / known: ai71 seed 11 "coordinated team pushes" gets 1 plan (needs 2). Seeds 12-14 give 9 multi-player plans vs 8 on v7.1.1, so this is seed-specific. ai71 Russia Tsar peak 2 (predates v7.2). endless703 "loop alive" is flaky under software GL (fails on v7.1.1 too). mobile-play "build tabs restored after Upgrade + tap ground" x2 (predates v7.2). js/mobile.js still has dead P.ready.bld/wantPower code to clean up.
- Real-device check: placing on iPhone touch and a two-device online game with sites under construction.

# v7.1.1 (Oct 24 2026): Chief SI tuning, local commits only, NOT pushed (v7.1 390ee59 is live)
Benchmark vs v7.0.3 SI: 26W/0L/6D of 32 (81%), table in docs/ai-replay-analysis-v7.1.md. Open: ai71 4v4 fails China wall /
USA Stealth peak / Russia Tsar peak (losing side on seed 11); stashed attempt in `git stash list` (top entry).

# v7.1 (Oct 24 2026): Chief SI super-intelligence overhaul, local commits only, NOT pushed
All v7.1 logic is gated by isV71(P) (Chief SI only); SIOFF flags allow ablation (test/ai71-test.js, env SIOFF=a,b).
Benchmark vs v7.0.3 SI (mirror, 14 min): see docs/ai-replay-analysis-v7.1.md. Below the 75% outright-win target; France/USA mirrors and Germany weakest.
Known: ai71 Russia Tsar peak check (needs >=3) fails, as Tsars die in 4v4 fights. Real-device play-test of human-push support still needed.

# v7.0.3 (Oct 24 2026): hotfix, local commit only, NOT pushed
Fixed the Endless boss-kill freeze (the Colossus is mech:1 with no leg rig, so the corpse animation threw and main.js rethrew, stopping requestAnimationFrame). Added loop error recovery, boss withering after 7 min, a horde A* budget and a walled-HQ elite fallback. Test: test/endless703-test.js.
Still to verify on a real iPhone: no freeze on the boss kill, and FPS in late waves.

# v7.0 shipped (Oct 24 2026), local commits only and NOT pushed. Nicholas approves pushes.
Done: Endless mode, Iran/China/Japan factions with bot AI, title screen + lobby polish, safe areas/touch targets, PWA + Capacitor + APP-STORE.md.
Next ideas / gaps:
- Online co-op Endless is wired through lockstep (Horde = deterministic bot slot) but not yet play-tested with two real devices.
- Real-device FPS check on iPhone (the box only has software GL); tune Quiet mode defaults if needed.
- Map editor (deferred from v7.0).
- Balance: watch Japan (Raijin) and China walls in real games; Brazil is intentionally a little strong.

# Next coding session list (from Nicholas, Mon Oct 12 2026)
1. AI overhaul, every bot level a TRUE challenge for Nicholas + friends; test vs human-style play.
   - Hard bots: smart base building (defenses, walls), smart expansions, tactical attacks.
   - Chief SI example: sees tower-heavy base -> bombers hit power from behind -> then push front wall with troops/vehicles. Considers everything.
   - Fix late-game money hoarding; Nicholas beat Chief SI 1v1 easily in 4.4.1.
2. Defense damage -25%.
3. Tesla tower: chain lightning, power-hungry.
4. Maps: Volcano Crown (3v3; walkable damaging lava, cooled-rock safe crossings, central high-ground volcano, lava flares, gas vents) and Frostline Pass (2v2; cliff bases, frozen lakes vehicles cross, icy bridge, ruined outpost, blizzards). Concept images in Chief assets.
5. Elevation: tiers + ramps, high-ground bonus; all units move/fight up and down smoothly.
6. Day/night cycle; capturable oil derricks (Engineer capture, trickle income).
7. Main menu cleanup: drop AI-vs-AI watch clutter; clean lobby with map select, team select, colors, friend join.
8. Performance: silky smooth.
Also earlier backlog: wall gate.
- Addendum to #1: Chief SI goal = essentially unbeatable by humans, purely on skill and intelligence (no resource cheats). Aim as high as possible.
- Addendum to #1: early-game peace window. Bots don't attack bases for the first few minutes (DEFAULT 3 min per Nicholas; lobby option: Off/3/5/8 min). Light scouting and skirmishing over derricks/expansions still allowed. Applies to all bot levels.
9. Transport helicopter (large, Chinook-style): carries 8 slots — infantry 1 slot each, tanks/vehicles 4 slots. Load/unload anywhere; drop troops behind enemy walls to bypass front defenses. Vulnerable to flak/AA. AI (esp. Chief SI) should use it for behind-the-wall drops.

## Update Oct 12 2:33pm (after v5.0)
- SCRAPPED: lava flares and blizzard effects (visual and gameplay). Remove blizzard sight-cut from Frostline; keep normal lava damage.
- Remaining: 6-player support so Volcano Crown is true 3v3; more raised ground/ramps across both maps beyond mains/peak; derrick capture alert; dedicated performance pass; Chief SI siege of fortified/turtle bases; re-verify no money hoarding + 2v2 sample.

## Oct 12 7:30pm — ON HOLD (Nicholas saving weekly usage, resets ~Oct 18)
- TOP: Rebuild Volcano Crown + Frostline Pass as genuinely NEW layouts matching the concept sketches (v5.0/5.1 only recolored the old layout). 
- Collect Nicholas's notes on bot mistakes from his games before next AI pass.
- Nicholas live notes (2v2: 2 Hard beat 2 Chief SI, both SI France): SI armies come too late vs Hard's timing; slow to build defenses, poor placement, too few towers; never builds Grand Cannon. Fix SI build order/army timing, defense count+placement, Grand Cannon use; test SI-vs-Hard 2v2 as France specifically.
- More notes: defend EVERY base entrance (2 entrances = defenses at both). Build multiple war factories to mass armies fast and keep up repeated pressure waves.
- More notes: bots build NO air defense (flak) and NO Tesla towers — must build both. Tesla visuals: taller tower with cool crackling electric arcs around it.
- Replay recorder: save Nicholas's games to a small file so Chief can study his build orders/timing and turn them into bot playbooks + win-tests.
- Warhead Launcher (Nicholas idea 10/12 9:18pm): expensive mid-game above-ground missile silo, costs lots of gas. Build several missile types (small/medium/large) with different ranges and damage; arc through atmosphere to strike enemy bases. Needs warning alert, long cooldown, counterplay.
- Air raids (Nicholas 9:24pm): bots send jets/bombers one at a time on the same path = easy kills. Fix: mass 5+ and strike together, and vary approach angles, probing for the side with the weakest AA. Benchmark: Nicholas held off 3 Hard bots 1v3 until he got bored — Hard must be much tougher.
- Team AI (Nicholas 9:26pm): allied bots coordinate — synchronized multi-angle attacks with strong units. Build MANY war factories/barracks/airfields; huge armies, not medium. Don't retreat after a few cannon hits — commit, take out defenses, advance and pick the base apart piece by piece, relentless pressure. 'I want a real challenge.'
- Tesla redesign (Nicholas 10/13): look like tesla-reference.png (tall stacked coil rings, glowing blue orb on top, blue glowing base with side prongs). Big visible electric arc on zap. CHAINING: nearby Tesla towers pass power tower-to-tower to the one closest to the target, stacking damage — more towers clustered = more devastating.
- Defense priority (Nicholas 10/13): bots build MANY defenses in tactical spots plus walls around base/defenses, prioritized OVER quick attacks, so if their army gets wiped, defenses hold while they rebuild.
- BUG (Nicholas 10/13 5:51pm, v5.3): bots build walls then get their own units stuck behind them. Fix: always leave a gate/open lane on every entrance wall, verify path from factories to map exits after each wall placement, and have units route through own gates.
- MAP FIX (Nicholas 10/13 5:55pm): Frostline Pass 2v2 has only one gas site per team base, so a teammate must build a far CC for gas. Give EACH player base its own gas vent near its main.
  - Clarified: TWO gas sites in each team base (one per player).
- FRIEND FEEDBACK (10/14): (a) short descriptions/tooltips for every building and unit; (b) WASD camera pan; (c) UI too far right + hard to read: split build UI StarCraft-style — right panel + bottom bar so you can queue troops and buildings at the same time, bigger readable text; (d) attack-move: press A then click -> units move but stop to fight enemies they meet; also check which units can fire on the move.

## Oct 15 3v3 watch notes (Nicholas) — only 1/6 bots played well
- Bottom-left bot walled itself in, then idled all game (no units could exit). Fix: always leave gates/lanes, path-check after every wall.
- Chief SI army got stuck near top of map; bot then stopped producing army and stopped attacking. Fix: stuck-army detection + re-path, production must never stall.
- Bot ran out of power and never built new power plants. Fix: power watchdog (rebuild/expand power whenever low).
- Games drag: no coordinated finishing pushes. Add late-game "close it out" logic: allied mass attacks on weakest enemy.
- AI should build and fire the warhead launcher when the game stalls / it can't break an enemy.
- SPECTATOR CAMERA (Nicholas 10/15): when spectating a bot game, allow zooming far out to see more of the map, and never auto-zoom back in.

## Oct 15 Discord friend feedback (v5.4)
- HOTKEY REWORK: keep WASD camera pan, but no overlap with other hotkeys (remap conflicting ones, e.g. A attack-move vs A pan, S stop, D, W).
- CLICK ACCURACY: clicks are offset; must aim slightly below-left of a turret to select/upgrade it. Fix picking (raycast vs mesh/bounds, devicePixelRatio/canvas offset) so the cursor lines up exactly.
- ONLINE LAG: friends played online and saw lag. Profile netcode (lockstep input delay, peer latency, sim cost), smooth it out; decide whether to publish to GitHub Pages (needs Nicholas's OK to push).
  - Lag specifically seen with 4 human players online; test and optimize the 4-human case.

## iPhone App Store push (added 2026-10-17, this week's to-do)
1. Super fine-tuned mobile version: full touch controls (drag-select, tap move/attack, pinch zoom, two-finger pan), phone-sized UI, iPhone performance pass, original names/art only (no RA2 IP).
2. Nicholas plays it on iPhone from the GitHub Pages link for a few days.
3. Wrap with Capacitor, build in Xcode on his iMac Pro; Nicholas pays $99 Apple Developer fee.
4. TestFlight for brother + friends, then App Store. Pricing TBD ($4.99 paid vs free + IAP).

## Brazil Iron Marine tweaks (Nicholas, 2026-10-17)
- Cost $450 -> $400.
- Move speed slightly faster.
- Auto-engage: when a marine runs into enemy ground units or air units while moving, it stops and attacks them (attack-move style by default), then resumes.
- (added 9:35 PM) Iron Marine: extra armor vs tank/vehicle damage, and longer attack range. Nicholas is fine with Brazil being a bit OP (his main faction).

## France faction tower (Nicholas, 2026-10-17 9:39 PM)
- France replaces the Tesla tower with its own minigun defense tower.
- Strength between Tesla tower and Grand Cannon.
- Hits ground AND air; especially strong vs infantry and aircraft (weaker vs heavy tanks).
- Make it look really cool: spinning multi-barrel gatling turret, muzzle flash, tracer fire, spent-shell effects.

## Brainstorm 2026-10-20 (Nicholas liked these; brainstorm more before building)
### Unit abilities (SC2-style micro)
- Brazil Iron Marine "Carnaval Rush": 4s sprint + fire burst
- France Grand Cannon "Overcharge": 3x one shot, then 10s shutdown
- Tanks "Siege Lock": stationary, extra range
- Snipers "Cloak": invisible until firing
- Engineers "Field Repair": AoE vehicle heal
- Mobile: one tap fires for selected group; auto-cast toggle via helpers
- Open Q: abilities for all units or only stars?
### Arcade / custom maps
- In-lobby map editor (terrain, ore, gas, derricks, outposts, spawns), save + share link
- Built-in modes first: Tower Defense waves, King of the Hill, Last Stand (2 vs endless warlords)
- Map browser for his and his brother's maps, playable online
- Open Q: editor vs modes first?

## Nicholas ideas 2026-10-20 (8:19 PM)
- Howler artillery: cut normal range ~30%; add Siege Mode (stationary, full long range + splash, pack/unpack delay)
- Research Lab upgrade panel: per-category tracks (Tanks/Infantry/Air/Artillery/Defenses). L2 ~+15% dmg/HP ($1000, 60s); L3 max ~+30% ($2000+gas, 90s, needs 2nd lab/tech). Applies to existing units, chevron visuals, bots research too. L3 could unlock abilities.
- Later modes: Capture the Flag, King of the Hill

## Nicholas next-update list 2026-10-20 (8:26 PM)
- Double-click building selects all same-type buildings on screen: barracks/factories -> set shared rally point for all
- Double-click turret selects all same-type turrets -> blanket upgrade all (as many as affordable)
- Oil derricks: verify payout works; +25% income
- Ore Hauler: smaller footprint (less collision jams), cost $750, gathers 40% less per trip (spam-friendly)
- Mineral patches last 30% longer
- (Research Lab upgrades + Howler siege are future)
- Hauler cap: 4 per ore field (confirmed)
- Smart haulers: when a field is depleted, auto-move to the next nearest field
- Expansion incentive: ore fields away from start spawns are diamond-colored, +$140 per haul load
- Command Center upgrade: SM-3 style interceptor; 50% chance to shoot down incoming missiles/warheads near base
- SM-3: intercepts ALL incoming missiles (superweapon warheads + regular missiles/rocket artillery) near base at 50% chance each
- Merge Helipad + Airfield into one "Air Command" building (runway + helipads): builds all air units, rearms/repairs all aircraft. Ideas: dock slots (e.g., 4) with add-on pads to expand; jets take off from runway, helis from pads; one queue.
- Merge Lancer + Bastion tanks into one mid tank: ~$1050, HP/damage/speed midway between the two (pick name; keep faction specials)
- Build-card portraits (infantry etc.): replace the messy double sprites with ONE clean portrait per card that matches the in-game model
- Remove Pyro and Field Medic
- Engineer: also repairs buildings AND heals units, slower heal rate for units; auto-repairs/heals damaged buildings/units nearby without being consumed (stays a unit; capture-into-building optional/keep separate)
- Brazil Iron Marine (8:46 PM): player move orders MUST override auto-engage (a retreat/redirect move breaks off the target; auto-engage resumes only after arriving/idle — current "pull back then re-engage nearby" feel is liked). Fix walk-cycle legs/feet direction. +5% damage, +10% speed, +15% armor vs tanks AND aircraft/bombers, reduce splash damage vulnerability.
- Scope for v6.2: do everything in this file EXCEPT new game modes / maps / map editor.

## v6.2 status (2026-10-20, not pushed)
- DONE: every item in the two lists above except modes, maps and the editor: Iron Marine orders/legs/buffs, double-click buildings (shared rally, Upgrade all), economy (derricks +25%, $750 hauler, 4 per field, smart haulers, +30% ore, diamond fields), SM-3, Air Command, Warhound MBT, Pyro/Medic removed + Engineer repair/heal, card portraits, Howler range + Siege Mode, Research Lab tracks, mobile ghost/stop fixes.
- NOT DONE (by scope): game modes (TD/KotH/CTF/Last Stand), new maps, map editor/browser; brainstorm faction abilities.

## v6.3 status (2026-10-23, NOT pushed, waiting for Nicholas's approval; v6.2 bbed457 is live)
- DONE: Hauler Transport replaced by the **Seraph Medevac** (healer transport).
  - Same 8-slot cap.
  - Loading: select infantry, then right-click the craft (mobile: tap it). Unloading: Unload all button or Shift+B; B = unload at a spot.
  - Auto green heal beam: 2.5-tile radius, 12 HP/s per target, max 3 targets, no stacking (one healer per target per 0.5 s window).
  - 560 HP air armor (dies to one Skyguard in ~7 s). $1100, Air Command + Research Lab.
  - New model with medical crosses, build card, bot medevacMgr (medium/hard bots: one craft once the army is 10+ and t > 5 min; it heals wounded clusters and retreats below 35% HP).
  - Tests: test/v63-test.js (23 checks). Shots: test/v63-shot.js.
- DONE: Volcano Crown lava visual rework (render only).
  - Blurred lava field gives smooth shorelines with a basalt rim.
  - Animated shader (fbm flow, voronoi crust, pulse, white-hot streaks, heat ripple), plus bubbles, embers and haze FX.
  - Quiet mode = simple shader + no FX. Gameplay is unchanged.
- Shots: shots/v6_3-healer-beam.png, v6_3-healer-card.png, v6_3-cards-air.png, v6_3-lava.png, v6_3-lava-quiet.png.
- Next: get Nicholas's go-ahead, then push. Still open from v6.2: game modes, maps, map editor.

## v6.3.1 (2026-10-23, NOT pushed): mobile build-tab bug from Nicholas's brother
- Cause: the turret Upgrade button's hover tooltip was opened by the touch-emulated mouseenter and never closed, because touch has no mouseleave. It covered the mobile build tabs from then on.
- Fix:
  - Tooltip owner tracking plus tipGuard (hide when the owner is gone or hidden, or after 2.5 s on touch).
  - hideTip runs in setSel.
  - mobTabsGuard safety net (nothing selected means bar and tabs are visible and populated, ctx closed).
  - Ground tap with only turrets selected deselects.
- Regression: mobile-play-test `tabs` part (also runs in the default `play` run).

- v7.0.1: mobile placement rewritten around a world-space ghost (MOB.pl in js/mobile.js: mobPlSet/mobPlSnap/mobPlStart, relative drag, hysteresis 0.75, glide, edge scroll). Regression: test/place701-test.js.
- v7.0.2: China guard towers (BT.gtower.squad) run stepSquad in js/sim.js: four slots using W.rifle/snipe/rocket/marine via sqW (+GT_SQUAD.rng 1.5). W.gtow is only a summary for range ring / AI threat. Medevac escort: escortGroup/escortStep/airThreats in js/sim.js (order 'escort', u.esc, u.spCap), hooked in orderMove/orderAttack (non-queued) and ai.js medevacMgr. Tests: factions7, medevac702, v702-shot.
- v7.0.2 Ballista: gtower keeps t='gtower' with b.bal=true (upKind 'bal', BALLISTA in data.js; crew = BALLISTA.w bolt/rifle/marine via sqList). W.bolt is NOT in the 0.75 static-defence nerf; W.balS is the summary profile. Model 'gtowerB' (render bkey). AI: ballistaMgr earmarks income into S.balFund (90/5 s) because bots otherwise spend every credit; the fund is refunded if no tower is left to convert. Duel harness /tmp/bal/duel2.js (box only).

## 2026-10-30: replay study plus AI maths plan (for the nightly 4c run)
- Read `docs/ai-replay-study-2026-10-30.md` (volcano8 bot 1v1: blue safe76 eco freeze, red army dither and own-building pocket, silo cluster-missile deadlock, and the hard4c-b comparison) and `docs/ai-math-plan.md`.
- hard4c-b is already merged (d1364e4). Next: start the **phase-1** items from ai-math-plan.md:
  - Lanchester commit/contain
  - passable goals plus a choke-aware flow field and pocket audit
  - utility + knapsack spending, including the safe76 fix and a max-pop sink
  - silo placement/swap/targeting
- Put everything behind a new replay flag. A/B against the current Hard; Hard must not get weaker, no bonuses or stat changes.
- Box tools: `/workspace/r1030/` (ex.js extractor, probe*.js, heat-*.png).
