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

## 2026-10-30: multiplayer debug (v7.6.3, in progress)
- Problem: Nicholas and his brother could not get into the same online lobby on Oct 29 (error screenshot not available yet).
- Transport (from the code): js/online.js uses Trystero. Matchmaking/signalling runs over 3 strategies at once (Nostr relays, public MQTT brokers, WebTorrent trackers); game data is a WebRTC data channel (host-relay lockstep in js/net.js). STUN: Trystero defaults (Google/Cloudflare). TURN (js/net-config.js): freestun.net + openrelay.metered.ca static creds. Host checks codeHash() (NET_VERSION + sim function sources) in 'hello' and kicks a guest on mismatch. No cache-busting on script tags (GitHub Pages serves max-age=600; home-screen app caches longer).
- Likely failure modes found in the code:
  1. Version mismatch: v7.5.0 and v7.5.1 both shipped on Oct 29 (7:18 AM, 11:34 AM), and 3 more builds on Oct 30. One player on a cached build gets "Version mismatch — reload" with only opaque hashes, no reload button.
  2. NAT: both TURN entries are dead or best-effort (Metered discontinued the openrelayproject static creds; freestun is a test box). Between two home/mobile networks with symmetric/CGNAT NAT, WebRTC fails after signalling works -> "found the host but could not open a direct connection".
  3. Join box has maxlength=6, so a pasted invite link becomes "HTTPS:" -> wrong room.
  4. Error states are text only, no Retry button; host-left only says "Host left the lobby."
- Live test ~1:00 PM PT (two Chrome processes, live v7.6.2): signalling OK (host and guest exchanged offers/answers via Nostr+MQTT+torrent), WebRTC never connected, guest showed the "could not open a direct connection" error after 20s. Caveat: this box's Chrome is policy-locked to no non-proxied UDP and the box blocks outbound UDP, so it behaves like a very strict network. That is exactly the case a TURN-less game cannot handle.
- Plan: (a) WebSocket relay fallback over public MQTT brokers when WebRTC fails (works on any network that can open a website); (b) refresh TURN list (freeturn.net free:free, TURNS 5349); (c) version.json no-store check + "new version, reload" banner + ?v= cache-busting on scripts; (d) clear on-screen errors with Retry; (e) accept pasted links / spaces in the join box.
- ~1:10 PM PT: relay reliability layer fixed (it fell behind under loss: NACKs now list every missing number, tail loss detected from heartbeats). Node test with 30% simulated loss: 285/285 messages in order both ways.
- v7.6.3 wiring: relay.js loaded before online.js, 'relay' added to strategies, TURN list = freestun.net + freeturn.net (openrelay dropped), ?v=7.6.3 on every script/css, version.json + "new version, reload" banner, join box takes a pasted link (maxlength 200).
- Checks: det73 node hashes (seeds 11/202/3003) identical to v7.6.2; js/ai.js and js/sim.js unchanged; net-test and net4-test OK; MODE=local online-e2e OK.
- Local two-Chrome E2E over the real internet (default strategies; box has no WebRTC so it is a worst-case network): guest fell back to the relay, joined in 27 s, lobby both sides, start, client move seen on host, 7 hash checks over 2.5 min all MATCH, no desync, client kill -> AI. Ran at ~19 ticks/s on the box (2 swiftshader Chromes share the CPU). Lobby screenshots: /workspace/iron-front-v7.6.3-lobby-local-{host,guest}.png. Only console noise: Trystero's own "connack timeout" for MQTT brokers the box cannot reach.
- LIVE: pushed 620b8ff to main at 1:22 PM PT; site served v7.6.3 (version.json + relay.js?v=7.6.3) at 1:24 PM PT.
- Live two-browser E2E (two separate Chrome processes against the live site): guest found the host and fell back to the relay in 28 s; lobby on both, start, guest move seen on host, 7 hash checks over 2.5 min all MATCH, no desync, guest kill -> AI. Mobile guest (iPhone landscape emulation): joined in 28 s, mobile UI live, move seen on host, 3 hash checks MATCH. Logs: /workspace/mpdebug/live-e2e-763*.log.
- online-e2e MOBILE step fixed: since place-then-build a card tap starts placement, so the old check never moved units (failed on transport=local too, not a network problem); it now also sends a move through NET.
- Error UI checked live: joining a room with no host shows the red box after 30 s with the two checks, Retry, Reload page and [v7.6.3]. Screenshots: /workspace/iron-front-v7.6.3-live-lobby-guest.png, /workspace/iron-front-v7.6.3-live-error.png.
- Remaining risk: the box cannot do WebRTC at all, so the direct/TURN path was not exercised; the relay covers that case. Relay depends on public.cloud.shiftr.io (port 443) plus emqx/hivemq (8084/8884); if all three are down there is no fallback. Relay adds ~0.2-0.3 s latency (game raises its input delay to 6 turns, about 0.2 s).

## 2026-10-30 (afternoon): v7.6.4 drone visuals (4d) + Hard AI 4c groundwork
- PUSH WINDOW: nothing pushed after 4:30 PM PT (Nicholas + brother play online tonight).
- ~1:50 PM PT: 4d drones committed locally (cf77c37). Iran Shahed uses the original v7.0 procedural design again ('drone' removed from GLB.UNITS; models/u_drone*.glb kept but unused), drawn 1.75x (render-only RVS table in render.js, contact shadow scaled too; UT.r/hitbox/stats untouched), wing in bright team paint (new 'TB' colour = team paint lerped 0.6 to team colour, like the glb aircraft), dark leading edges, glowing team chevron + tip bands, white roundels. Lite variant (phone / Quiet / Low): 222 vs 382 tris, no roundels; toggling Quiet rebuilds it. Shots: /workspace/iron-front-drone-before.png, -after.png, -after-quiet.png (+ -crop). Test: test/v764-drone-shot.js.
- 4d DONE: v7.6.4 LIVE. Pushed 6b692e2 -> main at 1:59 PM PT (fast-forward 2fbe554..6b692e2, no force); live version.json = v7.6.4 at 2:01 PM PT, index ?v=7.6.4 tags and NET_VERSION v7.6.4 confirmed. Checks before push: determinism identical to v7.6.3 (node seeds 11/202/3003 + browser seed 7, /workspace/v764/det-76{3,4}.txt), full suite green (/workspace/v764/suite-764.txt; place701 rerun clean after a brief ai.js edit overlapped it; fogkeys flaked once under load, passes alone).

## 2026-10-30 (afternoon) Part B: Hard AI 4c groundwork, LOCAL ONLY (branch hard4c-b in /workspace/wt-b, not pushed)
- Base-layout study: docs/base-layout-study.md (tools/layout/layout.js + analyze.js, data in /workspace/replay-study/layout/). Human bases have a tight production core (barracks 2.5-6 tiles from HQ in replay A, ~10 in B), an early AA screen at 2-4 min (even ring at ~11 tiles, or a front arc at 16-24), refineries on the ore edge (16-18 tiles, pushed to 34-37 in B), turrets in tight lines of 4-5 across the HQ->enemy path at 17-26 tiles, and walls built after the towers, far out (15-25 ring / 25-42 front lines) with NO gates (gaps or cliffs instead). The bot's baseEntrances sits only ~9 tiles out. Next: anchor the defence line beyond the outermost refinery, turret lines, early AA ring, walls with gaps.
- No-trap pathing check (nt76, si2 only, gated by the new replay flag `nt`, so old replays keep the old brain; SIOFF.nt76 disables): before the bot places a building/wall it re-floods walkability from the HQ in a "picture" with the new footprint and rejects the spot if it would cut off a barracks/factory spawn tile (the real spawnUnit/nearFree tile, radius 12), any other building's ring, or the ore. Cache lives on G (G.ntC) so games can't share state. The 2-wide lane check is written but OFF (it starved classic 5 economy: 92k mined vs 144k). Seed-77 stall fix: aiWallEntrance skips gateless walls when nt76 is on.
- Drills (test/nt76-drill.js, /workspace/v764/b/nt-game-on5.txt vs -off4): volcano 77 0 trapped units / 0 trapped exits (P1 mined 183k vs 158k with it off; P0 64k vs 40k and survives; 142 out-cut rejections); frost 9 and classic 5 identical to off (0 rejections); unit drill NT76 OK, 0.1 ms per check.
- Head-to-head vs the live Hard brain (test/nt76-vs.js, 6 games, 25 min, /workspace/v764/b/vs6.txt): NEW 3 (frost 9 start0, volcano 77 start0 on points, classic 5 start0 on points), OLD 2, TIE 1. Frost and classic just mirror the start position (frost start0 game had 0 rejections, i.e. identical play). Not "most of 6" -> Part B NOT shipped, stays local for tonight.
- Determinism: det73 node seeds 11/202/3003 + browser seed 7 identical to v7.6.4 (det74 too); see /workspace/v764/b/checks-b.txt for replay-uploads / replay-test / stall-test.
- Nicholas feedback (2:10 PM PT, 4v4 all-Hard): focused attacks + army building look great, but ARMIES STILL GET STUCK A LITTLE. Wants France + China to lean hard into defence: bigger bases, lots of very powerful defences (Grand Cannon lines for France, Great Wall/Ballista for China), absorb the enemy push, then counter-attack while the attacker's army is weak. One seeded strategy option among several, not the only one.
- Fortress-punish prototype (flagged, DEFAULT OFF, globalThis.SION; no effect on live play or replays):
  - SION.pw76: counter-attack window. pw76Track remembers every ground attacker that came into the base; 6 s after the base is clear, if they brought >= 2500 and >= 65% of it died, a 50 s window opens (70 s for fortress) against the main attacking team. pw76Launch (in army71) goes straight at that team's nearest non-defence building if idle >= 8 and army >= max(3500, 1.8x their remembered army + their known defences).
  - SION.fp76: fra/chn pick a 'fortress' style from hash(seed, team), 1 in 3 ('all' forces it): heavier tier-3/4 defence plans (France gatling + Grand Cannon lines up to 5 gcannon; China turret + tesla up to 4 each, plus the usual Great Wall/Ballista managers), normal pushes need 1.4x, punish via the window.
  - Drill test/fp76-vs.js (FP=all|1 PW=1 node test/fp76-vs.js map seed facA facB swap maxMin), 20 min vs the live brain: window alone (tuned) classic 5 chn/rus 2/2 NEW on points (first version with lower bars lost classic start0: windows 7, one bad punish). Fortress on: frost fra/ger 1-1 (same as baseline), classic chn/rus 1-1 vs baseline 2-0: fortress China LOST classic start0 (18.6 min, 0 punishes) -> the defence spend + 1.4x bar starves the army. Not ready; logs /workspace/v764/b/fp*.txt pw*.txt.
- Checks on hard4c-b (/workspace/v764/b/checks-b.txt, replay-3hard.txt, stall-b.txt vs stall-live.txt): det73/det74 identical to v7.6.4; replay-test REPLAY OK; old replays Oct 29 1v1 32/32 bad 0 + 3-Hard frost 56/56 bad 0, both victory at the recorded tick; same-seed si2 drills reproduce byte-identical result lines (determinism). stall-test SD=si2: FAIL "walled bots also have gates" on hard4c-b (P3, an old 'hard'-profile bot, not si2, ends with 4 walls 0 gates because the si2 games around it changed) while live v7.6.4 passes on this seed. Look at this first tonight (old 'hard' wall code, or the test's 3-wall threshold).
- Part B NOT pushed (did not meet the ship bar: 3/6 head-to-head, stall-test fail). Live stays v7.6.4.

## 2026-10-30 (2:40-3:00 PM PT) Part B round 2, still LOCAL (branch hard4c-b, commits 2ff92cf + stuck drill), NOT pushed
- (1) Stall fix: the stall-test failure was aiGrowth's 5-piece wall line toward the enemy: if the gate could not go on the middle tile it built 4 walls around an empty middle (a gap, but no gate). Now, in games with the nt replay flag (all bots, all difficulties; wg76, SIOFF.wg76 disables; old replays unaffected), the gate tries every tile of the line from the middle out, and if no gate fits the line is not built; aiWallEntrance likewise builds no wall line without a gate. stall-test SD=si2 STALL OK (was FAIL), SD=si STALL OK.
- (2) Fortress-punish tuning (still opt-in, SION.fp76): static D capped at a share of everything mined (France 0.30, China 0.24, +0.06 under attack; normal is 0.27/0.18), normal-push bar 1.0x (1.2-1.4x starved the army: classic 5 China start0 lost at 1.2x, won on points at 1.0x). Drills vs live brain, 20 min, fortress vs same code without fortress: equal in 6 of 7 pairs, better in 1 (volcano 77 chn vs ger start1: TIE vs a loss). Logs fp4/fp5/fp5base.txt. Volcano 77 chn vs ger start0 dies to a 7-min German rush either way.
- (3) Counter-attack window ON for lobby Hard (si2) in games with the nt replay flag (SIOFF.pw76 disables).
- Ship check (6 quick games vs live Hard brain, test/fp76-vs.js, 25 min, /workspace/v764/b/ship6.txt): NEW 2 (frost 9 start0, volcano 77 start0 pts), OLD 2 (frost 9 start1, classic 5 start1 pts), TIE 2 (classic 5 start0, volcano 77 start1). Not "most of 6" -> NOT shipped. Live stays v7.6.4.
- Other checks on 2ff92cf: det73 identical to v7.6.4; replay-test REPLAY OK; nt76 unit drill OK (0.09 ms); stall OK (si2 + si); old replays Oct 29 1v1 32/32 bad 0 + 3-Hard frost 56/56 bad 0, both victory at the recorded tick.
- Ablation (classic 5 ger mirror, abl.txt): the start0 game that nt alone won on points becomes a TIE because of the wall-gate change (OFF=wg76 -> NEW(pts) again; OFF=pw76 -> still TIE); the window launched 0 punishes there. start1 is OLD(pts) in every variant. test/fp76-vs.js now takes OFF=a,b (SIOFF flags) for this.
- Armies stuck (new test/stuck76-drill.js, volcano8 4v4 all-Hard seed 5, 12 min): moving units stuck >30 s: NEW 0.9% (32/3559) vs LIVE brain 1.9% (64/3419). Live jams are mid-map "open" ground (64,24-64,56 on the centre line); new ones are scattered (own turret, ally factory/refinery edges).

## 2026-10-30 (3:00-3:40 PM PT) Part B round 3: NOT SHIPPED (live stays v7.6.4)
- Code (branch hard4c-b 94d0d88, all behind replay flag nt, old replays unaffected):
  - cl76 (SIOFF.cl76): home/stage/rally points move to the nearest tile within 9 that has no building within 3 tiles (clear76/home76, cached per G.bver), so groups stop gathering inside turret lines and ally building clusters. Retreating units get spread spots (golden-angle ring, 1.5-4.5 tiles) instead of all piling onto one point.
  - er76 (SIOFF.er76): early rush response before 6 min. If threatened and my army + towers within 9 sim to < 0.8 of the attackers, units hold at the nearest tower (pulled 25% toward HQ) instead of walking into the fight. Plus an unseen-army prior: until 7 min the early-attack check assumes the enemy has at least (time-60)*45 of army, so the bot does not launch blind on stale intel.
- Results:
  - Fresh 6-game check vs live Hard (new seeds frost 21 rus/usa, classic 13 usa/fra, volcano 41 ger/chn, both starts, 25 min): NEW 5, OLD 1 (/workspace/v764/b/r3/g-*.txt).
  - det73 identical to v7.6.4. replay-test OK. nt76 drill OK. stall si2 + si OK. Old replays Oct 29 1v1 32/32 + 3-Hard 56/56 bad 0, victory at the recorded tick.
  - Stuck drill: units stuck next to buildings 72 vs 90 with cl76/er76 off (seeds 5/7/9). Overall stuck count is noisy (open-ground group holds).
  - Volcano 77 chn vs ger start0 still lost, but China lasts 16.5 min instead of 10.4 min. Germany out-mines China about 2.5x.
- Why it was NOT pushed: a check added at 3:30 PM PT from the parallel replay study (test/vs8-943.js: volcano8 seed 943231385, USA si2 start0 vs Brazil si2 start3, fog off, peace 180) shows Hard gets WEAKER there (/workspace/v764/b/r4):
  - live vs live: Brazil wins at 24.0 min, USA army 30.7k at 480 s.
  - new USA vs live Brazil: Brazil wins at 21.0 min, USA army 1.0k at 300 s and 13.2k at 480 s. With OFF=cl76 it is identical to live vs live, so cl76 is the cause. er76, nt76, pw76 and wg76 make no difference on this side.
  - new Brazil vs live USA: only Brazil(pts) at 25 min, vs a kill at 24.0 min live. With OFF=er76,cl76 the new Brazil wins at 19.8 min (better than live).
  - Trace (trace-on.txt vs trace-off.txt): cl76 puts USA's home stage at (27.5,26.5), about 11 tiles out from the HQ at (16,19) and away from its own turrets. The live Brazil brain sees that exposed group, attacks at ~210 s instead of ~315 s, and USA loses 9.5k of army by 300 s.
- Master now has a v7.6.5 bump (c0d2d1c) + merges that are NOT live. Live = v7.6.4 (6b692e2). Nothing was pushed today after 1:59 PM PT.

## 2026-10-30 (3:37-4:00 PM PT) Part B round 4: blocker fix (branch hard4c-b 8972c95, merged to master 616ff95)
- cl76 fix: a gather/stage/rally point is only moved if the original spot is boxed in. When moved, it may never end up further from the HQ than the original point, nor past the bot's outermost own defence (SIOFF.cl76b disables the limit).
- safe76 v2 (sf2, replay flag nt, si2 only, SIOFF.sf2 disables; the live brain/old replays keep the old rule):
  - The threat now counts only enemy army that could reach my HQ within 40 s (straight-line distance / unit speed). It no longer uses the whole remembered army, which with fog off is the entire enemy army.
  - Active only before 6 min (was 8).
  - It never caps harvesters and never blocks the first expansion CC.
- vs8-943 replay-study check (/workspace/v764/b/r5, 25 min):
  - live vs live: Brazil kills USA at 24.0 min. USA mined 200k; army 30.7k at 480 s and 8k at 840 s.
  - new USA vs live Brazil: USA SURVIVES 25 min, Brazil(pts). USA mined 603k (3x), has 5 CCs and 27 harvesters at 840 s, and its army is 51.7k at 840 s. At 480 s the army is 24.4k because the eco came first. -> new USA not weaker.
  - Without sf2 (cl76 fix only), USA dies at 22.9 min: sf2 is the main fix.
  - Brazil side (new Brazil vs live USA): Brazil(pts) at 25 min (val 257k vs 81k), vs a kill at 24.0 live. With cl76 off the new Brazil kills at 17.4 min, so cl76 still costs Brazil the finish on this seed. But with cl76 off the new USA dies at 22.8 min (worse than live), so cl76 stays on. Follow-up: why cl76 slows the Brazil finish.
- Fresh 6-game set vs live Hard (frost 33 ger/fra, classic 27 chn/rus, volcano 63 usa/bra, both starts, 25 min): NEW 4 (classic both, frost start0, volcano start0), OLD 1 (frost start1), OLD(pts) 1 (volcano start1).
  - A second set with cl76 off (r5c: frost 45, classic 51, volcano 87) went 4-2 too. It was only used for the cl76 decision.
- Other checks:
  - det73 identical to v7.6.4 (node 11/202/3003 + browser 7, branch and master).
  - replay-test REPLAY OK. nt76 unit drill NT76 OK (0.10 ms). stall SD=si2 + SD=si STALL OK.
  - Old replays: Oct 30 bot1v1 volcano8 49/49 bad 0 (defeat at the recorded tick). Oct 29 1v1 32/32 + 3-Hard 56/56 bad 0, victory at the recorded tick.
- All checks passed -> pushed master by hash as v7.6.5 (no force, fast-forward from 6b692e2); push time and live check: see the next line.
- PUSHED 089269f -> main at 3:51 PM PT (fast-forward 6b692e2..089269f, no force). LIVE VERIFIED 3:52 PM PT: version.json v7.6.5, 28 ?v=7.6.5 tags, NET_VERSION v7.6.5, live ai.js has sf2. This log line is a local docs-only commit on top (not pushed).

## 2026-10-30 (night, 9:20 PM PT -) v7.6.6: Hard AI math layer m7 (replay flag m7; si2 lobby Hard only; old replays have no m7 key -> old brain)
- What Hard bots do differently:
  - (a) Lanchester attack timing: every 3 s the idle army is fought against the remembered enemy army + defences near the target (square law, survivors = sqrt(1-1/r)); it attacks when r >= 1.3 instead of waiting for a fixed army size.
  - (b) Distance-field movement: armies walk a Dijkstra cost map to the target (enemy walls/gates are expensive, no corner cutting), keep a target for 20 s (no flip-flopping) and drop a target they cannot reach for 45 s. No random jitter when stuck; after 3 stuck checks the target is dropped.
  - (c) Knapsack spending: once the bank is 6500+ (or the bot is maxed out) it spends on the best mix of silo, research and defence towers instead of floating money.
  - (d) Smart silo: picks the missile with the best expected damage, never builds one with no target in range, and holds a loaded heavy missile up to 45 s so its army arrives with it.
- Tests:
  - 12 seat-games vs live Hard (v7.6.5 brain) from the replay study + open items (/workspace/n1031/r5-full): NEW 7 wins (4 by kill), 2 ties, 3 losses. All 3 losses are seats that also lose in the live-vs-live mirror. Brazil scenario seat now kills at 16.4 min (live: points only). Volcano 77 China seat: seeds 78-81 4/4 wins.
  - det73: browser hash ca37914941ee identical for live v7.6.5, new m7=0 and new m7=1 (x2). replay-test OK, nt76 drill OK, stall OK.
  - Old replays: Oct 29 1v1 32/32, 3-Hard 56/56, Oct 30 bot1v1 volcano8 49/49, bad 0, results at the recorded tick.
  - Stuck drill volcano8 seeds 5/7/9: 165 stuck samples new vs 176 old (no regression).
  - Unit tests: sim, units, factions7, endless, net, gate, tesla, transport, marine, medevac, engcc76, place701 OK. fogkeys OK alone (one ArrowRight flake under 14 parallel tests). reach-test needs a local server on :8765 (not run).
  - Browser: test/v766-shot.js, 9 min Hard vs Hard, 0 page errors. Screenshot /workspace/iron-front-v7.6.6.png.
- Fresh 8 seat-games vs live Hard, both starts (frost 57, classic 61, volcano 93, hellgate 15; /workspace/n1031/r8-fresh) + live-vs-live mirror (/workspace/n1031/r8-base): every pair was won by the same start, so 4-4. vs the mirror: better on classic 61 usa (kill 16.2 vs 22.6 min), volcano 93 fra (pts win vs TIE), hellgate jpn (survives to 25 min vs dead at 14.5); worse on volcano 93 bra (pts loss vs TIE) and slower kills on frost rus / hellgate irn. Total with the 12-game set: 11 W, 2 T, 7 L, nearly all losses in seats that also lose live-vs-live.
- France/China fortress-punish (SION.fp76 'all', on top of m7; /workspace/n1031/fp12): 6 seats, 0 better, 1 worse (frost 57 chn: kill at 17.2 min -> points loss), rest identical. Stays OFF.
- PUSHED 22817c7 -> main at 10:58:54 PM PT (fast-forward 089269f..22817c7, no force; ls-remote checked first). NOTE: this was about 1 minute BEFORE the 11:00 PM PT push window (clock misread); not reversible without a force-push, so it was left as is. LIVE VERIFIED 11:01 PM PT: version.json v7.6.6, 28 ?v=7.6.6 tags, NET_VERSION v7.6.6, live ai.js has spend7.

## 2026-10-31 (night, 11:00 PM PT -) v7.6.7: faster Hard AI mining + attack-move keeps going + ally-mouth no-trap (replay level m7=2; v7.6.6 replays have m7=1 and replay exactly)
- What changed for players:
  - Hard AI (m7e): refineries are placed with their dock right next to the ore field, so harvester trips are shorter and Hard bots mine faster.
  - Everyone (sim fix, replay level m7>=2 only): a unit on attack-move that fought/kited on the way now carries on to its attack-move target instead of standing still where the fight ended; if it arrives and has no path left it goes idle cleanly (no jitter).
  - Hard AI (m7f): the no-trap check now also protects an ALLY's barracks/factory exits, so a Hard bot no longer walls its teammate's production in (volcano 77 China factory case).
  - Test fix: nt76 drill now counts every gate (own or enemy) as a door when measuring reach.
- Root cause found on the way: m7e first made the stuck drill worse; the kite code overwrote u.dest so attack-move units forgot their goal. Fixed in sim.js (gated m7>=2 so old replays are untouched).
- Tests (final code, /workspace/n1031/g767g + h-set12/h-fresh8):
  - vs live Hard (v7.6.5/6 brain via P.m7Off): set12 9W 2T 1L, fresh8 7W 1L (v7.6.6 on the same 20 games: 11W 2T 7L). Losses: volcano8 943 usa@0 on points, hellgate 15 jpn@0 on points (both seats lose in every variant).
  - det73 browser hash ca37914941ee pageErrors 0, replay-test OK, stall OK, units OK, nt76 drill OK (after the m7f + drill fix; before: FAIL on volcano 77).
  - Old replays: v7.6.6 m7=1 replay 24/24, Oct 30 bot1v1 volcano8 49/49, Oct 29 1v1 32/32, 3-Hard 56/56, all bad 0.
  - Stuck drill (4v4 volcano8, seeds 5/7/9/11/13/15): 335 stuck samples out of 20.0k (1.67%), v7.6.6 1.93%.
  - Whole node suite on the final code (/workspace/n1031/g767g, g767g/all). The attack-move resume showed up in 3 tests, and the TESTS were fixed, not the game (commit 842ee21): endless slow-boss test (an HQ with no defence now dies in 95 s because the Horde keeps pushing, so the test keeps it alive), marine harness (it set attack-move without the goal anchor that the real command sets), human-order (an enemy all-in really kills the riflemen; it now checks every tick that they were never hijacked). Player effect: Endless Horde units and bot armies no longer stall after a fight, so Endless waves press a bit harder.
  - endgame-test (all-bot games must end): new 5/5 OK, live v7.6.6 3/5 (volcano 44 no winner at 45 min).
  - Also OK: sim, factions7, endless, net, net4, gate, fogkeys, tesla, transport, marine, medevac702, engcc76, place701, defense, build72, diff73, det74 (browser, glb on, 0 errors), eight, six, hellgate, v59, v62, v63, wall-exit, warhead, mobile, slot, ai71-human, chief (4/5 vs Hard), v4 (si vs hard 10/10).
  - Fails that already fail on the live v7.6.6 too: ai71-test (fortress/wall counts, special peaks, AI call time under load; new also has chn special peak 4 < 6), ui7-test (browser timeout), endless703 (the "loop alive" timing check flakes 1-3 factions per run on live as well).
- PUSHED 47e23ab -> main at 1:31:39 AM PT (fast-forward 22817c7..47e23ab, no force; ls-remote checked first). LIVE VERIFIED 1:32:57 AM PT: version.json v7.6.7, 28 ?v=7.6.7 tags, NET_VERSION v7.6.7, live sim.js has the am7 fix. Zip /workspace/rts-game-v7.6.7-play.zip, screenshot /workspace/iron-front-v7.6.7.png.
