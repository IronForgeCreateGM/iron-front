# Iron Front nightly log

## 2026-10-27: v7.2.0
- Queue item 1: place-then-build construction. DONE.
- What changed for players:
  - Click a building, put it where you want it, and you pay the full price right away.
  - It then builds on the spot with scaffolding and a progress bar; the countdown on the side panel is gone for buildings.
  - Cancel it while it is building and you get all your money back.
  - Enemies can attack and destroy a building while it is going up.
  - Defenses and walls work the same way, and drag-to-lay walls still works, on mobile and online.
  - Bots build the same way with no bonuses. Chief SI is still at least as strong: 31 wins, 0 losses, 1 draw vs the old v7.0.3 Chief SI.
- Live: YES. Pushed c642f85 to main at 7:11 AM PT; https://ironforgecreategm.github.io/iron-front/ showed v7.2.0 at 7:14 AM PT and loaded with no page errors.
- Screenshot: /workspace/iron-front-v7.2.0-under-construction.png (repo copy: shots/v7_2-under-construction.png)

## 2026-10-28: v7.3.1
- Queue item 2: animated construction. DONE. Queue item 3: Easy / Medium / Hard. DONE.
- What changed for players:
  - Buildings now go up in stages: surveyor tape and stakes, rebar and a concrete pour, scaffolding and a crane, a steel frame, then the walls filling in from the ground up with sparks and dust.
  - Team-coloured panels swing in on the crane and snap on; when it finishes the scaffold and crane fall away with a flash, a dust ring and a short chime.
  - Defenses get the same sequence, walls get a lighter version, and phones / Low quality use smaller effects.
  - Difficulty is now just Easy, Medium and Hard. Hard is the strongest bot (the old Chief SI, unchanged). Old Hard/Chief/Chief SI choices in presets, lobbies, links and online backfill all become Hard.
  - The word "Chief" no longer appears anywhere players see it.
- Live: YES. Pushed 75082ca to main at 6:48 AM PT; https://ironforgecreategm.github.io/iron-front/ showed v7.3.1 at 6:49 AM PT and passed the difficulty/no-Chief check with no page errors.
- Tests: full suite run. Only the known failures: ai71 (Russia peak, seed 11 team pushes) and endless703 "loop alive" under software GL. mobile-play and fogkeys failed in the parallel run; fogkeys needed a test fix (it picked the removed "hard" option), mobile-play passed run on its own.
- AI testing: bot code unchanged, Hard is the same si profile. Lean check: 6 games Hard vs v7.0.3 Chief SI (usa x4, rus x2, classic, 12-min cap), about 4 minutes: 6 wins, 0 losses (1 outright, 5 on points). Results in /workspace/bench-v731-lean.
- Screenshots: /workspace/iron-front-v7.3.0-build-10.png, -build-40.png, -build-75.png, -build-done.png, -build-40-phone.png
- Next: queue item 4, the lean AI testing setup plus its one-time comparison vs the 32-game benchmark.

## 2026-10-28 (afternoon): v7.4.0
- Queue item 4 (Blender models): PARTIAL. Shipped early because Nicholas asked for it. Visual change only, so the only AI/sim check needed was determinism.
- What changed for players:
  - All 18 buildings and defenses now use Blender-made 3D models with team colours.
  - 6 vehicles have realistic models: heavy tank, scout, harvester, artillery, AA and Tsar.
  - 7 aircraft each have their own shape and team markings: jet, interceptor, bomber, stealth, drone, gunship and medevac.
  - Phones, Quiet mode and Low quality use lighter LOD1 models. If a model fails to load (or with ?glb=0) the old model shows instead.
- Still to do for item 4: Titan, raijin/raijinJ, colossus, infantry, and cutting Tsar's triangle count (10.1k, budget 8k).
- Determinism: the fixed-seed hashes match with models on (served over http under /iron-front/), with ?glb=0, and on v7.3.1. That covers both the node runs (seeds 11/202/3003) and the in-browser run with rendering (seed 7).
- Tests: full suite run. Only known failures: ai71 (rus special peak and seed 11 team pushes; same on v7.3.1), endless703 "loop alive" under software GL (same on v7.3.1), endgame timeout. mobile-play and slot flaked in the parallel run and passed when re-run.
- Models: 62 files, 10 MB total (LOD1 set 3.0 MB).
- Live: YES, 3:58 PM PT Oct 28 (site shows v7.4.0, models/hq.glb 200)
- Screenshot: /workspace/iron-front-v7.4.0-live.png (local skirmish under /iron-front/: 24/24 models loaded, 0 page errors)

## 2026-10-29: v7.5.0
- Queue item 4 (Blender models): DONE. Every unit and every building/defense (including faction specials) now uses a Blender-made model. Visual change only.
- What changed for players:
  - All 6 infantry (rifleman, rocketeer, engineer, sniper, kommando, marine) are now detailed 3D soldiers with walking legs and team-coloured armour.
  - The Titan, Raijin, Raijin jet form and Colossus have new mech/boss models.
  - China's Ballista Tower and Great Wall posts have their own models: a stone keep with a crossbow that turns and fires, and stone wall posts with a team-colour band.
  - The Tsar is lighter (7.8k triangles, down from 10.1k).
  - Team colour is easy to read at normal zoom, and every team gets the same look. Footprints, sizes and hitboxes are unchanged. Phones, Quiet mode and Low quality use lighter LOD1 models, and ?glb=0 brings back the old look.
- Determinism: the fixed-seed hashes match with models on (over http under /iron-front/), with ?glb=0, and on v7.4.0. That covers the node runs (seeds 11/202/3003), the in-browser run with rendering (seed 7), and an extra China-vs-China in-browser run. Sim and AI code are byte-identical to v7.4.0.
- Tests: full suite run. Only known failures: ai71 (rus special peak, seed 11 team pushes; the "worst AI call" timing went over 60 ms only while other tests shared the CPU), endless703 "loop alive" under software GL, and the endgame timeout. fogkeys, slot, mobile-play, ui7 and reach (pointed at a local server) flaked in the parallel run and passed when re-run. v4 (the long AI sim) timed out in the parallel run and passed when re-run on its own.
- Models: 86 files, 13 MB total (LOD1 set 4.0 MB).
- Live: YES. Pushed 069e408 to main at 7:18 AM PT. https://ironforgecreategm.github.io/iron-front/ showed v7.5.0 at 7:19 AM PT, and models/u_titan.glb, gtowerB.glb and wallChn.glb returned 200. The live load had 34/34 models, 0 page errors and 0 http failures.
- Screenshot: /workspace/iron-front-v7.5.0-live.png (live site: the infantry and Titan close up). Repo copies: shots/v7_5-infantry-titan.png, shots/v7_5-china-ballista.png
- Play zip: /workspace/rts-game-v7.5.0-play.zip
- Next: queue item 4b (Hard AI army fix + last-game replay auto-save).

## 2026-10-29 (late morning): v7.5.1
- Nicholas request: lobby spot N now spawns at map spot N for humans and bots on every map/lobby; preview shows slot numbers at real bases in team colours; Hellgate fixed sides move wrong-side picks to their own side (shown in lobby).
- Tests: new lobbytest (720 setups) passes; det73 identical; only known failures (endless loop alive, hellgate shot name check, endgame seed 22), same as v7.5.0. Online end-to-end not testable on the box.
- Live: YES, pushed ec4c80e, site showed v7.5.1 at 11:34 AM PT.
- Screenshot: /workspace/spawn-fix-ingame.png

## 2026-10-30: v7.6.0 (finished the interrupted nightly run)
- Live: YES. Pushed 71dc0ff to main at 6:50 AM PT. https://ironforgecreategm.github.io/iron-front/ showed v7.6.0 at 6:51 AM PT (js/net.js NET_VERSION v7.6.0). The live load had 34/34 models, 0 page errors and 0 http failures.
- What the bots do differently: nothing in this release. The lobby's "Hard AI" still plays the v7.5.1 Hard brain ('si'). The reworked Hard layer ('si2': early derricks, faster expansion, a factory for each new base, SM-3 when it sees a warhead, money saved for a backup Command Center and the launcher, repairs and upgrades, all three warhead types) lost 1-3 to the old Hard in the release bench. "Hard must never get weaker" ruled it out, so it is in the code but switched off. That work carries over.
- Other changes for players:
  - Engineer Command Center rule (all players, same rules for bots and humans). Once a side has no Construction Yard or Command Center left, an engineer can found a new Command Center at the normal $2200 price. It must be placed within 9 tiles of the engineer, and the engineer is used up. The new CC builds without a yard. Normal rules apply while a side still has a yard. The live Hard bot does not use this yet (it is part of the si2 layer).
  - Fewer stuck armies. Idle units drifting from their spot no longer re-plan their path every tick (this also fixes the path-finding storm that made big armies freeze).
  - Every skirmish now gets a fresh random map seed. It is saved in the replay. Online games use the host's seed.
  - Last game replay: the menu keeps your last game. "Last game replay" plays it and "Download" saves it.
- Old replays: games recorded before v7.6.0 replay with the old rules (the r76 flag is off when a replay has none). Nicholas's two uploaded replays (Oct 29 1v1 and the frost 3-Hard game) re-simulated with 32/32 and 56/56 hash checks matching (bad 0).
- Marine check (equal cost, test/marine check script, no stats changed). Each cell shows the % of value left for marines / for the counter, at $6300 and at $12600:
  - Warhound MBT: 63/0 and 67/0. Marines win.
  - Tsar: 56/0 and 56/0. Marines win.
  - Raijin: 0/55 and 0/67. Raijin wins.
  - Howler (sieged): 6/26 and 0/68. Howler wins.
  - Falcon jets: 69/4 and 72/5. Marines win.
  - Thunder bombers: 33/14 and 39/15. Marines win.
  - 2 Tesla + rifles: 0/20 and 0/37. Tesla wins.
  - MBT + Howler mix: 3/31 and 0/61. The mix wins.
  - Recommendation: no stat change. Marine mass does have real counters (Raijin, sieged Howlers, Tesla, a tank + artillery mix), but it beats pure tank and pure air armies of equal cost. That is a bot composition problem, not a balance bug. The bots should answer marine mass with artillery, Tesla and Raijin, and that goes into the 4b-continued plan. A small stat tweak (tank cannon vs marine armour, or marine HP) is something to consider later only if players also get stuck on it.
- Release bench (6 full games, new Hard 'si2' vs the v7.5.1 Hard 'si', same sim):
  - G1 classic seed 21, si2 USA vs si Russia: si won at 15.1 min.
  - G2 same game with sides swapped: si2 won at 11.9 min.
  - G3 classic seed 3, si2 China vs si Germany: si won at 25.9 min.
  - G4 frost 2v2 seed 5, si2 Brazil+Germany vs si Brazil+Germany: si won at 22.7 min.
  - Result: si2 went 1-3. It expands and builds towers but fields about half the army at 5 minutes and cannot rebuild after losing a fight (one game built 131 turrets). Not shipped.
- Nicholas sparring profile on frost, seed 9, 20 min cap. These games were against si2, not the live Hard:
  - 1v1 nick (Brazil marines) vs si2 Brazil: nick won at 11.7 min (28k vs 12k army at 5 min).
  - 3 si2 (Brazil, China, China) vs nick: the bots led on points at 20 min, but nobody was knocked out. Nick was maxed at 100 pop with a 40k army.
  - Earlier run, last night: the v7.5.1 Hard beat nick at 23.6 min.
- Tests:
  - Full serial suite on the final code. These pass: sim, units, warhead, det73, det74, replay, marine, defense, factions, placement, walls/gates, tesla, transport, medevac, reach (with a local server), build, human orders, diff73 (expects Hard = si), chief, six, eight, hellgate, v59/62/63, net, net4, endless, slot, fogkeys, ui7, mobile, mobile-play, v4 (si vs hard 10/10). The new engcc76 test passes.
  - Known failures, which also fail on v7.5.1: ai71 (special peaks; here also the China wall count on seed 11), ui-audit, endless703 "loop alive", and the endgame timeout.
  - stall-test volcano seed 77: one bot had 5 walls and 0 gates at the checkpoint, but its exit was still open. Seeds 78 and 79 pass, and seed 77 passes with the old rules. This is a seed-specific side effect of the pathing change.
- Screenshot: /workspace/iron-front-v7.6.0-live.png (live site, in-game). Local copy: /workspace/iron-front-v7.6.0-local.png. Menu: shots/v7_6-menu.png
- Play zip: /workspace/rts-game-v7.6.0-play.zip
- 4b-continued (carries over):
  - Fix si2's army size: production first, a cap on towers, and rebuilding after a lost fight. Then re-bench it against si and switch the lobby Hard to si2 only when it wins.
  - Let bots use the engineer Command Center rule (the si2 layer already has it).
  - Bots defend their base with the army.
  - Coordinated team attacks.
  - Bots answer marine mass with artillery, Tesla and Raijin.
  - Faction signature plans.
  - Look at the stall seed 77 gate case.

## 2026-10-30: v7.6.2 map graphics + full screen (5b DONE)
- Live: YES. Pushed 9ff83d8 to main at 12:49 PM PT. https://ironforgecreategm.github.io/iron-front/ showed v7.6.2 at 12:50 PM PT (title footer and js/net.js NET_VERSION). manifest.webmanifest returned 200. Live loads of Classic, Hellgate, Frost and Volcano: 24/24 unit/building models, all theme props and 8/8 ground textures, 0 page errors, 0 http failures.
- What changed for players (visual only; sim, AI and net code are byte-identical to v7.6.1):
  - Textured ground on all 4 themes (colour + normal maps; worn dirt paths on grass, wet shores, horizon shading). `?tex=0` turns it off.
  - Blender map props with LOD1: trees, rocks, debris, ruins, bridge, crystals, ice shards, lava-rim rocks. `?props=0` turns them off. Phone, Quiet and Low use LOD1 and lighter ground.
  - Per map: Classic gets textured grass and dirt, new pines/broadleaf trees, carved cliffs, a plank bridge and blue ore crystals. Frost's pines are now snowy, sparser and part-bare, with ruins and ice shards by the frozen lakes. Volcano and Volcano XL get cracked-earth ground, charred trees and lava-rim rocks. Hellgate and Endless get rippled sand with darker dune patches and desert debris, but keep the old procedural rocks.
  - Full screen: web app manifest, iOS meta tags, safe-area padding, a Fullscreen button and a one-time iPhone "Add to Home Screen" tip.
  - Size: +3.4 MB (props 0.76 MB, ground textures 2.7 MB).
- Determinism: node fixed-seed hashes (seeds 11/202/3003) are identical to v7.6.1. The in-browser seed 7 run with rendering (det73, file://) and with models, props and textures on (det74, http) matches v7.6.1 too: cef04e15ece7 e592efdf4c68 63c24f04630a 0df6c2d12f58, 0 page errors.
  - Why det73/det74 "hung" last night: they did not. The node part prints nothing until it has finished all 3 seeds (about 1 min), and the browser part takes about 2 min on swiftshader. With other jobs sharing the CPU it looked stuck. The harness now prints each node line as it goes; DET_PROG=1 shows the browser chunks and DET_SKIPBROWSER=1 skips the browser.
- Old replays (new test/replay-uploads.js): Nicholas's Oct 29 1v1 (v7.5.1) 32/32 hash checks, bad 0, victory at the recorded tick. The frost 3-Hard game 56/56, bad 0, victory.
- Tests (per-test timeouts): these pass: sim, units, warhead, replay, marine, defense, factions7, place701, wall-exit, gate, tesla, transport, medevac702, build72, human-order, diff73, reach (local server), slot, mobile, mobile-play, six, eight, hellgate, v59, v62, v63, net, net4, endless, engcc76 and v762-fs-check. fogkeys and ui7 failed while the shot runs shared the CPU and passed when re-run alone. Known failures that also fail on v7.6.1: endless703 "loop alive" (Germany/Iran) and ui-audit. chief hit the 7-minute cap (it is a long node-only AI run, and that code is unchanged). v4, ai71, endgame and stall were not re-run (node-only; sim/AI unchanged).
- Shots (6 maps at normal zoom + phone landscape, before = v7.6.1 worktree, after = v7.6.2): /workspace/iron-front-v7.6.2-<map>-before.png / -after.png, also -feature- pairs for Classic, Frost, Volcano and Volcano XL. Every map loaded with 0 page errors, before and after. Live shot: /workspace/iron-front-v7.6.2-live.png
- Desert darkening (still open): with GLB rocks on desert, units and tanks near the base render near-black and lose their team colour. Two things were ruled out: (1) giving the split rock meshes their own material instead of sharing the units' PBR material and (2) turning off shadow casting from the split rocks. Neither fixed it. Desert keeps procedural rocks. Next idea: compare the desert rock GLB's attributes (pbr/colour/normal) with the grass one, and test on real GPU vs swiftshader.
- Play zip: /workspace/rts-game-v7.6.2-play.zip
