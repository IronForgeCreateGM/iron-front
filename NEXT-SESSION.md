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
