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
