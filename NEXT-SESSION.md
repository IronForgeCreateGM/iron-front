## SHIPPED night Nov 6: v7.8.5 Full Unlock free-tier scaffolding LIVE
Country gate only (map gating next). Free You-factions: USA, Russia, Germany, France. Locked until $4.99 Full Unlock: Brazil, Iran, China, Japan. `js/unlock.js` + IronIAP stub; QA `?unlock=1`/`0`; Settings Restore. Bots unrestricted. No sim/AI/stat changes.

## RESUME NOTE ~12:45 AM PT Fri Nov 6 (nightly)
- Live target after push: v7.8.5. Primary item (queue 8 / Nov 4 monetization) shipped as country unlock.
- **Next (map gating):** free tier = classic-style / 2v2 access (classic + frost safe); Full Unlock = all maps (volcano, volcano8, razorwheel, hellgate, endless maps as decided). Prefer a clean map gate similar to unlockFacOk; do not half-break lobby presets.
- **Native IAP:** Swift StoreKit plugin not started (no ios/ Xcode project yet). Fill `window.IronIAP` / Capacitor plugin; product id suggested `ironfront_full_unlock`.
- **4c-math leftovers:** held tonight after primary ship — France fortress further tune / silo EV / fortress-punish / stuck-army math only if Hard benches non-weaker (≤~6 games). Do NOT start SC2 construction rewrite.
- LLC / seller name (MBEP Apps vs Creations) still needs Nicholas.
- Game Center Swift still needs Nicholas's Mac (GAME-CENTER.md).

## SHIPPED day Nov 5: v7.8.4 lobby teams + Razorwheel corners LIVE
Phone lobby Team headers + Hellgate→FFA footgun + teamIdx harden + end-screen Team N (letter). Razorwheel diagonal spawns pushed out (96² kept).

## SHIPPED day Nov 5: v7.8.3 Razorwheel + Iron Foundry delisted LIVE
Iron Foundry (224², Nicholas's map-builder featured map) removed from the lobby list (data kept for replays). New 8-FFA built-in **Razorwheel** (96² rim/spoke/hub).

## SHIPPED day Nov 5: v7.8.2 screen wake lock LIVE
iPhone home-screen / Safari matches keep the screen awake; menus, end screen, pause, quit release it. Client-only (`js/main.js`). No sim/stat changes.

## SHIPPED day Nov 5: v7.8.0 + v7.8.1 (late-game lag Phase 1+2)
Phase 1 (render/sim hitch) and Phase 2 (selection/UI/minimap) are LIVE. Remaining optional: spatial targeting in sim if made bit-identical; further pick spatial hash for ultra-dense piles.

## TOP PRIORITY TONIGHT (Nicholas, Nov 5 ~9:15 AM PT) — late-game lag — SHIPPED as v7.8.0 (see NIGHTLY-LOG) — was branch `perf-780`
Nicholas: late-game gets slow/glitchy with lots of units (esp. 8-player FFA on volcano8/classic). Shipped day of Nov 5 on Nicholas's ask. Optional leftovers still below. (fast-forward to main) before 4:30 PM PT only if that is a game night window — otherwise after game night.

### Hotspots found (profiled headless 8-FFA volcano8 + browser stress)
1. **Render hitches (biggest feel):** `updFogTex` rewrote every map tile and uploaded the fog texture **every frame** (even with fog off). Off-screen units still ran full lerp/gait. Ambient FX stayed high with 400–700 ents.
2. **GC / pathfinding:** every `findPath` allocated ~100KB of scratch arrays (`Float32Array`/`Int32Array`/`Uint8Array` of MW×MH). Big fights → many A* → GC spikes.
3. **Collision rebuild storm:** **any unit death** bumped `G.bver`, forcing a full `getBlock()` rebuild (buildings-only grid). Wrong — only building changes need that.
4. **Fog sim:** with fog off, `updFog` still painted every sight circle then `fill(1)`. With fog on (FFA), painted by scanning all ents with a foe check.
5. Tried spatial `acquire()` — **diverged sim** (not bit-identical). Reverted. Linear acquire stays. Further O(n²) targeting is optional follow-up behind a replay flag if needed.

### What `perf-780` already has (local, not pushed)
Files: `js/sim.js`, `js/render.js`, `js/gfx/terrain.js`.
- Pool pathfinding scratch buffers; pool `getBlock` buffers.
- Only bump `G.bver` when a **building** dies.
- Fog-off early-out in `updFog`; ally-id paint path (same set as `!foe`).
- Render: skip lerp/anim for off-screen/fog-hidden units; dial `FX.mul` down when ents >300/450/700; skip infantry gait when cam.d > 50.
- Fog tex: clear once when fog off; update every other frame; when zoomed in only update the view rect.

### Before / after numbers
**Browser** (swiftshader, `?q=low&glb=0`, 90 frames of step+ui+render after spawning N units on classic):
| units | before avg ms | after avg ms | before p95 | after p95 |
| 400 | 80.5 | **13.4** | 16.1 | 16.1 |
| 600 | 171.1 | **14.5** | 21.7 | 18.7 |
(Median ~6–7 ms both ways; the win is killing hitch/avg spikes.)

**Headless 12-min 8-FFA volcano8 seed 4242:** bit-identical (maxU 336, finalU 257). Late-game median ~4.1 ms/tick both ways (sim was not the hitch).

**Determinism:** custom hash checkpoints every 30s for 5 min FFA — **DET PASS** (10/10). `test/replay-test.js` **REPLAY OK**. `test/units-test.js` UNITS OK, `test/eight-test.js` EIGHT OK.

### Tonight ship checklist
1. On `perf-780` (or merge into master): bump to **v7.8.0** (`version.json`, `package.json`, `NET_VERSION` in `js/net.js`, `?v=` + title in `index.html`).
2. Gate: `test/replay-test.js`, det73/det74 vs base778 or live v7.7.9, browser suite lean, `npm run check:www`. No PNG commits. No mapbuilder key.
3. NIGHTLY-LOG entry. Push **fast-forward only** to `main` via `GITHUB_TOKEN_IRONFRONT` URL (no force-push). Verify live page shows v7.8.0, 0 console errors.
4. Optional leftover (not required to ship): spatial `acquire` behind a replay flag if mid-fight sim ms grows; AI `G.ents.filter` caching; warhead splash spatial.

### Branch note
Local `master` is ahead of remote `main` with Quick Match / notes commits. `perf-780` branched from that tip. Ship path: merge perf into whatever you push to `main` as FF from `08396c7`… or cherry-pick the 3-file perf commit onto a FFable tip. **Do not force-push.**

## RESUME NOTE 5:16 AM PT Thu Nov 5 (backup run)
- v7.7.9 LIVE (08396c7): f79 AI (warheads fire, recall, France GC fortress), flags 40% smaller, FFA winner text, Quick Match (app only). Flags, warhead and no-time-limit items below are DONE.
- Still open from TOP PRIORITY: late-game lag (item 3) and the 8-player 30+ min FFA verification on the biggest map.

## RESUME NOTE 2:20 PM PT Wed Nov 4 (day run)
- v7.7.7 country flags LIVE (7c3dc39, pushed 2:13 PM PT). Flags item below is DONE.
- Local master is AHEAD of main and NOT pushed:
  - 5f0f332: Game Center Quick Match (js/quickmatch.js, test/quickmatch-test.js, ios-plugin/*.swift, GAME-CENTER.md)
  - this notes commit
- Midnight run, Game Center:
  1. Run `node test/quickmatch-test.js` alone. It needs ~25 min under load, so use `timeout 1800`.
     - The last full run was before two fixes and passed steps 1-4: web hidden; 3 phones matched with the same seed/slots and no desync; forged/junk messages dropped; guest leaves -> AI.
     - Fixes since: the forged-message check no longer expects a 'type' count (an unknown type is dropped in onlDispatch before onlAccept counts it); the guest-leave and host-leave checks now poll for up to 20 s.
     - "Host left mid-match -> guest goes offline" FAILED once (status "") under heavy load. It may be timing; if it still fails, debug the playerDisconnected -> onlPeerLeave -> NET onLeave(hostPeer) path in js/quickmatch.js qmAttach.
     - The host-migration-during-countdown step never ran (browser killed by the 900 s timeout).
  2. If it all passes: gate (det73/det74/spawn-det identical, browser suite, lobby, check:www) and push master to main as a fast-forward (bump the version if anything else changes).
     - Quick Match only shows when the native IronGameCenter plugin exists (iPhone app); the web build hides #qmBox.
  3. The Swift plugin (ios-plugin/) has never been compiled: no ios/ project, no Mac. Nicholas's Xcode/App Store Connect steps and the two-iPhone checklist are in GAME-CENTER.md.
  - Privacy note for Nicholas: GKMatch can connect phones directly (P2P) with Apple relay fallback; IPs are never exposed to game code, but relay-only is not guaranteed.


## TOP PRIORITY TONIGHT (Nicholas, Nov 4 6:17 PM PT)
Nicholas watched an 8-player free-for-all on the biggest map and reported:
1. **No time limits.** Around 13–14 min the game ended with "team with biggest army value wins". He wants NO time limit on any game he plays or observes. Find the rule (search sim/ui/main/endless/ai for the stalemate/army-value win check, and any observer/spectator auto-end) and remove it, or make it off by default with no lobby default turning it on. Games end only by elimination (or surrender).
2. **Bots never launch warheads.** Late game, several bots had Warhead Launchers built but nobody fired, so the game stagnated. Trace warhead76/warheadMgr (js/ai.js ~815 and ~1120): check build gating (gas/cr thresholds, s.con, s.mq), the launch value threshold (bv > 1500 / target scoring on knownB; in FFA on a huge map knownB may be empty from fog), and whether FFA targets are picked. Fix so Hard/all bots that own a launcher build a missile and launch it at a real target. No bot bonuses, no unit stat changes, Hard must not get weaker.
3. **Late-game lag.** With huge armies the game got glitchy and slow. Profile an 8-player FFA on the biggest map at 15–25 min (stress mode exists in main.js ?stress). Optimize sim/render hot paths (spatial grid for targeting, throttle AI think, instancing) without changing gameplay results.
4. **Flags 40% smaller.** Command-center country flags (js/gfx/flags.js): scale to 0.6× of current, on desktop and phone (keep phone relative bump).
Verify: an 8-player FFA on the biggest map runs past 30 min with no auto-end, at least one warhead launch happens, frame time improves. Then report to Chief.

### ALSO TONIGHT: FFA bot decisions (Nicholas's Nov 4 3-way replay, seed 285356597, classic, all si2: fra/bra/jpn) — added 7:20 PM PT
- Re-sim is deterministic (51/51 hash checkpoints OK). Note: 30 ticks/s, so 46185 ticks = 25:40 game time. France out 14:17, Brazil out 25:39, Japan wins.
- France never built a Grand Cannon (it HAS access: tech at 3:00, gcannon avail from 2:31). Cause: defenseMgr/defPlan71 France tier 3 plan is
  [gatling 2, turret 2, gcannon 1...] looped PER ENTRANCE (6 entrances); gatlings kept dying/refilling so the loop always returned before gcannon. France wasn't fort76.
  Tier stays 1 (turrets only) until 5:00 even with tech. France actually had the MOST towers until ~11:00, just all cheap ones.
- Brazil: 65-75k group sat at France's base 12:00-15:09 (still there 50 s after France died, no target). Japan hit Brazil's base from ~14:10 (up to 17k bldg hp / 10 s).
  siExtras recall2 needs iv > max(4500, hv*1.5) where hv = Brazil's home army (~46k) -> fired only at 15:09. No notion of "what the far group is still winning".
- Branch `ai-ffa-fix` (LOCAL, commit 476b785, NOT merged/pushed): new replay flag f78 (old replays unchanged, verified bit-identical). (A) France: >=1 gcannon at tier 3, 2 at tier 4,
  once >=2 gatlings exist, ignoring the per-entrance loop (SIOFF.gc78 off). (B) recall when group is >25 tiles from HQ, iv>4500, iv > 0.8*home army and iv > 0.5*value of enemy buildings
  near the group (SIOFF.rc78 off). Per-player off switch P.f78Off for A/B benches.
- Quick check same seed: B only -> Brazil recalls 14:06 (was 15:09), home bldg damage 89k (was 231k), Brazil survives to end (was out 25:39); France out 14:48.
  A only -> France builds 2 Grand Cannons from 6:10 and survives the whole game. Seeds 11/22/33 (same setup) mixed/noisy: Japan still wins most; in 22/33 Brazil dies EARLIER with fix.
- TODO tonight: proper bench (ai-bench / fp76-vs style, P.f78Off one side) incl. 1v1 Hard, many seeds. Ship only if Hard doesn't get weaker; tune 0.8 / 0.5 / 25 if needed.
  Harness used: /workspace/ana/sim.js (outside repo). Not shipped.


### Nicholas follow-up (Nov 4, 7:27 PM PT) — APPROVED, do tonight
- **Intelligent defense (all bots, FFA especially):** build on branch `ai-ffa-fix` recall (B). Bots should weigh home threat vs what the away army is achieving, recall in time, and not park armies at a dead enemy base. Tune thresholds via a multi-seed benchmark (FFA 3/4/8 + Hard 1v1, P.f78Off side-by-side). Hard must not get weaker.
- **France = Grand Cannon fortress identity (AI build plan, NOT a stat change):** France opening should rush 5–6 Grand Cannons in the main base as fast as economy allows (cover main entrances), then expand and put 2 Grand Cannons + some turrets + AA at the expansion, THEN build a big army and push. Replace/extend fix (A). Goal: France becomes one of the stronger Hard bots. Benchmark France vs each faction before/after.
- **Warheads still never fire (he re-checked on live v7.7.8):** top priority item 2 above. Verify bots that own a launcher build AND launch at least once per game in FFA and 1v1 benchmarks; log aiWar events.
- Ship only if benchmarks are clean; report numbers to Chief.

## RESUME NOTE 3:56 AM PT Wed Nov 4 (backup run)
- v7.7.6 LIVE (6bec943, pushed 3:50 AM PT, verified 0 errors). Security audit done (see NIGHTLY-LOG). Branch sec776 is merged into master.
- Next night: stuck-army math + Nicholas's plain attack-move test, Hard France play, backlog.

## TONIGHT (Tue Nov 3 nightly run) — added 9:25 AM PT Tue Nov 3. Local master, NOT pushed.
- Verify Sentry + PostHog together with the v7.7.4 (builder bots) test, then push them TOGETHER with v7.7.4 (no force-push).
  - Sentry (js/sentry.js): org iron-forge-up, project iron-front. Errors only (no tracing/replay/feedback), release iron-front@<ver>,
    env production on ironforgecreategm.github.io, dev elsewhere. Off on file:// (offline zip), in the App Store app, under webdriver; dev opt-in ?sentry=1, kill ?sentry=0.
  - PostHog (js/analytics.js): project "Iron Front" (id 707699, the org's one allowed project, renamed from "Default project"), host us.i.posthog.com.
    Events only: menu_view, game_start, game_end, mp_connect (+version, env). No autocapture/pageviews/recording/exceptions/surveys/site apps/
    web experiments/toolbar/remote code (disable_external_dependency_loading), no identify, IP anonymized. Same gating; dev opt-in ?analytics=1, kill ?analytics=0; honours DNT/GPC.
  - Both SDKs are pinned (Sentry 11.10.0, posthog-js 1.445.1) with SRI, injected from local JS (check:www still bans remote <script> tags).
    URL query strings, ?key= and 64-hex strings are scrubbed from every payload, so the map builder unlock link never leaves the page.
  - After pushing: load the live site once, check Sentry gets no noise and PostHog shows a production menu_view (filter env = production; dev events have env = dev).
  - If a test needs real events in headless Chrome: PostHog drops navigator.webdriver/HeadlessChrome UAs as bots (prod behaviour, intended).

- RESUME 12:50 AM PT Nov 4: v7.7.5 LIVE (77580d8, pushed 12:45 AM PT; live check classic+frostline 0 errors; PostHog production menu_view v7.7.5 seen; Sentry no production issues). Next: sec776 rebase (fixed rejoin desync 61827d0) -> v7.7.6.

## RESUME NOTE (Wed Nov 4 night run, 00:25 PT)
- master ea5d82d = v7.7.4 + Sentry 11 IP fix (dataCollection off -> infer_ip never) + test/privacy-test.js (PRIVACY OK). Gate /workspace/n1104/g775 running (det vs /workspace/base773, node, browser). If clean -> bump v7.7.5 + push.
- Security work is on branch sec776 in worktree /workspace/rts-sec (commit 6ad7026, test/netsec-test.js NETSEC OK). After v7.7.5 is live: rebase sec776 on master, bump v7.7.6, run det + net/net4/replay/reach/online-e2e/lobby, push.

## HIGH PRIORITY (tonight): Multiplayer security audit
Do not change gameplay or AI. Report the findings in the morning note.
- (a) Validate and whitelist every incoming peer/relay message (js/online.js onlDispatch, js/net.js): check types, ranges and unit ownership,
  drop unknown commands, never eval or innerHTML peer data. Player names go in with textContent and a length cap.
- (b) Rate-limit and size-cap incoming messages, per peer.
- (c) A malformed message must not crash the game: try/catch around each handler and drop the message.
- (d) Add an optional "Hide my IP (always use relay)" setting that forces relay-only (or ICE relay-only when TURN is used). Keep the current default.
- (e) Report the findings (what was unsafe, what was fixed, what still needs work).

## RESUME NOTE 12:58 AM PT Mon Nov 2 (nightly run, lock = .night-run-lock)
- v7.7.2 LIVE (1c148f2, pushed 12:39 AM PT, verified 0 errors). Log entry committed (e09340f).
- r9 (refinery 2-tile gap away from ore) = no gain (1.73% vs 1.64% stuck), held back, branch r9 4995198.
- Local master v7.7.3 candidate (1531de1): App Store app (Capacitor shell) pauses + mutes offline games when backgrounded; browsers unchanged.
  New test/apppause-test.js. Gates running in /workspace/n1102/g773 (det vs base logs /workspace/n1102/det*-base771.log, node, browser).

## RESUME NOTE 12:25 AM PT Mon Nov 2 (nightly run, lock = .night-run-lock)
- Live = v7.7.1 (fce81af). Local master has v7.7.2 candidate (8b0c6c5): spectator bar lists every team in FFA/multi-team games (UI only),
  reach-test polls for the post-relay error, lobbySelfTest covers custom maps (featured Iron Foundry), map builder cramped-base + spawns-too-close warnings,
  App Store bundle check (scripts/check-www.js, npm run check:www). Featured map untouched.
- Gates running: node suite /workspace/n1102/node, det73/det74/spawn-det base771 vs master /workspace/n1102/det*, browser tests /workspace/n1102/br.
- Experiment (worktree /workspace/wt-r9, branch r9): m7j test-only SION.ref9 = 2-tile lane on refinery north side only. Stuck drills /workspace/n1102/stuck/{live,r9}.

## MAP BUILDER STATUS 10:15 AM PT Sun Nov 1 (local master, NOT pushed; live = v7.6.10)
- Done (commits a08a358, 4746059, c899b27, 5c6bd16, c7aca05): the editor (js/editor.js), custom maps in the sim/render/lobby/replays/online start,
  teams A-H per lobby slot on all maps, and the custom-only refinery dock rule. Tests: test/mapbuilder-test.js and test/custom-map-test.js.
- PRIVATE: the editor and "My maps" are hidden unless unlocked. Unlock with https://<site>/?key=<contents of /workspace/.mapbuilder-key> (chmod 600, never commit it);
  relock with ?key=lock. Only the SHA-256 hash is in code (MB_HASH). The unlock is client-side only, so someone reading the source could bypass it.
- Known gaps: online play on custom maps is wired but untested in a real 2-device game. No "cramped base" warning. lobbySelfTest has no custom coverage.
  Version strings are still 7.6.10 (the zip is marked 7.7.0-dev). reach-test's joiner check is failing environmentally (it fails on the base too); update its regex.
- The midnight run moves to the stuck-army work (see the notes below) and polishes map builder leftovers when there is time. Nicholas OKs any push.

## RESUME NOTE 8:20 AM PT Sun Nov 1 (results of runs left going at 12:55; nightly run ended early)
- Control mirror (live vs live, /workspace/n1101/ctl): 3-3, and every game is won by the same seat/faction whichever brain sits there, so 6-game h2h results are dominated by seat bias.
- h2h v2 level 4 (am8 plain attack-move) vs live Hard (/workspace/n1101/h2h2): 2W 2L 2T, same as v1. Versus the control it flipped classic s5 rus@3 to a TIE and volcano s77 ger@0 to a TIE, otherwise matched seat outcomes. No clear edge yet; stuck-drill rates are all noise-level (~1.6-1.8%).
- Next: use more seeds/maps (and swap seats) before judging am8; keep ref8 test-only; nothing pushed, live stays v7.6.10.

## RESUME NOTE 12:55 AM PT Sun Nov 1
- Live = v7.6.10. Master (local, not pushed): m7 level 4 = 'h' am8 plain attack-move (v2 keeps field read for walls/unreachable). Refinery lanes 'i' is test-only (SION.ref8): it cost volcano 77 games.
- Results so far: stuck drills (12 seeds) live 1.64%, h+i 1.59%, i only 1.65%, h only 1.78% (all noise-level). all20 vs old brain: live-level2 16W2L2T, h+i 14W3L3T, h 14W2L4T (wins come much faster), i 16W3L1T. h2h vs live Hard (6 games): 2W 2L 2T. nt76 + stall PASS at level 4.
- Running: control mirror /workspace/n1101/ctl (live vs live, seat bias) + h2h v2 /workspace/n1101/h2h2.

## RESUME NOTE 12:12 AM PT Sun Nov 1 (nightly run, lock = .night-run-lock)
- Live = v7.6.10 (8748723). Working on master: replay level m7=4 (opt-in, default still 2): h = Nicholas's plain attack-move to the enemy base centre (am8), i = refinery lanes (2 free tiles on N/E/W of refineries, 1 on the dock side, falls back to the old rule). m7g is now level 3 ONLY.
- Stuck drills (12 seeds, 12 min) running: /workspace/n1101/stuck/{live,l4} (done.txt when finished). Runner /workspace/n1101/stuck.sh TAG M7 [OFF].

## FINAL NOTE 7:19 AM PT Sat Oct 31 (end of the overnight run)
- Live = v7.6.10 (8748723). git ls-remote and the live page both confirm it at 7:19 AM PT (classic + hellgate, 0 page errors, 0 http fails).
- Pushed tonight: v7.6.6 22817c7 (10:58:54 PM), v7.6.7 47e23ab (1:31:39 AM), v7.6.8 8429b1f (3:16:44 AM), v7.6.9 105b825 (4:22:33 AM), v7.6.10 8748723 (5:19:03 AM). Master has local docs/test-only commits on top (not pushed).
- CARRIES OVER (details below):
  1. SC2-style construction (docs/sc2-construction-plan.md), not started.
  2. Stuck armies: refinery-spacing lead (see STUCK-UNIT LEADS). Branch slot (/workspace/wt-slot) has all experiments, gated at opt-in levels: fs8 level 4, gap5/gap5b level 5, rl6 level 6, dr7 level 7+.
  3. Bank floating at max pop: m7g (level 3) is even because gas runs out first; try a minerals-only sink or earlier extra extractors.
  4. France at parity: needs a stat change, which needs Nicholas's OK.
  5. Known failures unchanged: ai71 (3 FAILs, same as live), v4 900 s timeout.
  6. Housekeeping: old worktrees under /workspace (wt-inf has untracked files; check before removing).
- .night-run-lock deleted at the end of this run.

## RESUME NOTE 6:53 AM PT (box clock)
- Live = v7.6.10 (8748723). Nothing to push. fs8 v3 and gap5 both held (on branch slot). Docs final pass next, lock deleted at the end.

## RESUME NOTE 6:31 AM PT (box clock)
- Live = v7.6.10 (8748723), checked with git ls-remote. Nothing to push.
- Running: fs8 v3 (2-opt only for groups of 12+, uncommitted in wt-slot), bench in /workspace/n1031/slot/b4g.log. Stuck drills: 3.0/2.5/1.8% vs baseline 3.4/2.1/1.0%, so no better; it will be held.
- Then: log v3, final docs check, delete .night-run-lock by 7:45, report.

## STUCK-UNIT LEADS (final, 7:18 AM PT)
- gap5 (2-tile bot building gap, slot dc4e8e5) cut stuck units 1.64% -> 1.43% over 12 seeds but FAILS the nt76 no-trap drill (volcano 77 mining stalls). gap5b (refineries keep the 1-tile gap, slot c22719d) passes nt76 and stall but loses the gain (1.66%) and benched 15W 2L 3T. So the gain comes from refinery spacing. Next: space refineries so that harvester lanes stay open (a 2-tile gap on the side away from the ore only).

## NEXT SESSION PRIORITIES (written 6:26 AM PT Sat Oct 31)
1. SC2-style construction: follow docs/sc2-construction-plan.md (new replay level, full A/B, player test).
2. Stuck armies: branch slot (wt-slot) has fs8 v1 (791eef2) and v2 2-opt (34975cf), both gated m7>=4. v3 (2-opt for groups of 12+, 8c9b3ec on slot) benched 17W 1L 2T vs 16W 2L 2T but stuck drills were not better. None shipped. Like-for-like 12-min drills (n1031/stuck12 vs stuck3) show v3 equal or worse on all 6 seeds; old baselines were 16-min runs, so always compare at the same length. Better lead (NIGHTLY-LOG, end): about 59% of stuck units sit next to their OWN buildings (power plants first). Check the bot's building gaps around the factory/barracks rally first (volcano8 s23, bot 7, about 3 min, around 58,90). Tried gap5 (2-tile building gap, dc4e8e5 on slot): a small drill gain (1.48% vs 1.61% live stuck) but bench 16W 3L 1T; worth a retest with more seeds. rl6 (bot rally 9 tiles out toward the centre, fb43473 on slot) no gain (1.63% vs 1.61%); dr7 (wider spread at the factory door) no gain (1.60%). Stuck rates are already low (about 1.6%); a big gain probably needs the SC2 construction rework or a real flow-field / crowd model. Fixed drill debug shows about 70% of stuck units have all 4 neighbour tiles free, so they are blocked by OTHER UNITS. Target unit-vs-unit avoidance (friendly push/swap), which affects players too and needs a feel test. About 45% of stuck samples are fresh units on plain moves outside attack groups (leaving the factory door), so start there. Older idea: only re-slot when the group's path goes through a choke (narrow corridor) instead of on every move, so open-field moves stay as they are now.
3. Bank floating at max pop: m7g (level 3) is even because gas runs out first. Next idea: a minerals-only sink (walls/basic towers) or more gas extractors earlier.
4. France: weakest faction at parity; anything more needs a stat change, which needs Nicholas's OK.
5. Housekeeping: many old worktrees under /workspace (wt-*, base53, v53b). wt-inf has untracked files, so check them before removing.

## RESUME NOTE 6:21 AM PT (box clock)
- Live = v7.6.10 (8748723). Nothing new to push. fs8 v1 and v2 (2-opt) both held, on branch slot in /workspace/wt-slot.
- Remaining: final NIGHTLY-LOG check by 7:30, delete .night-run-lock by 7:45, report.

## RESUME NOTE 6:05 AM PT Sat Oct 31
- Live = v7.6.10 (8748723). Nothing new is gated for a push.
- fs8 formation fix: HELD BACK. The all20 bench at level 4 went 15W 2L 3T vs 16W 2L 2T at level 2, with slower kills. See the NIGHTLY-LOG section "Stuck armies". Branch slot is in /workspace/wt-slot.
- lanR sweep (SION lanR 1.15 and 1.45, all20) gave byte-identical results to 1.3; even lanR 9 is identical on frost 33. The square-law ratio is almost always far from the threshold (about 0.01 or 9+), so tuning it does nothing. No change.
- Next: wrap-up by 7:30 (NIGHTLY-LOG is complete; check it again), delete the lock at the end, final report.

## RESUME NOTE 5:40 AM PT Sat Oct 31 (header first written as 6:06 by mistake; box clock said ~5:40)
- Live = v7.6.10 (8748723). The NIGHTLY-LOG summary at the top is done.
- Experiment: worktree /workspace/wt-slot, branch slot (791eef2), fs8 at opt-in replay level m7=4. Group moves now hand out formation slots in front-to-back, left-to-right order (instead of greedy nearest), so units stop crossing paths and jamming. m7g is now on only at level 3 exactly.
  - Stuck drill: 2.04% -> 1.44% over hellgate 7/19 and volcano8 5/23 (3 seeds better, s5 worse). Logs: /workspace/n1031/stuck/s4-*.
  - all20 bench at M7=4 running: /workspace/n1031/slot/b4.log. Baseline level 2 = 16W 2T 2L.
  - This also changes how the PLAYER's group moves spread out. Hold it for Nicholas unless every gate is clean in time.

## RESUME NOTE 5:41 AM PT Sat Oct 31
- Live = v7.6.10 (8748723). Stuck spots: the drill now counts units bunched within 3 tiles of their goal as "crowded", not stuck. That was about 40% of the old "stuck" count. Real stuck (16 min): volcano8 s5 1.0%, s23 2.1%; hellgate s7 3.4%, s19 1.9%. Hellgate hot spot is open ground at 40-48,56 (mid-map). Logs are in /workspace/n1031/stuck. Next: diagnose hellgate 40,56 (DUMP=all), no pushes unless fully gated.

## RESUME NOTE 5:22 AM PT Sat Oct 31
- v7.6.10 (realistic infantry + phone menu clamp) PUSHED 5:19:03 AM PT as 8748723, live verified 5:21. master == live main.
- Next: queue items (Hard AI math / France / bank / stuck), with A/B only and no pushes unless fully gated. NIGHTLY-LOG must be complete by 7:30, then delete .night-run-lock at 7:45 and report.
- Worktrees: /workspace/wt-inf (merged, can be removed), /workspace/wt-fra (branch fra, France experiments, rejected).

## RESUME NOTE 4:53 AM PT Sat Oct 31
- v7.6.9 LIVE (105b825). Infantry v7.6.10 is in /workspace/wt-inf (branch inf, 2233a7b). Full suite done apart from v4 (known 900 s timeout). Load flakes are being rerun alone -> /workspace/n1031/g7610/re (done.txt = REDONE). Then bump to v7.6.10, zip, shot and push.
- France AI: tried m7i (lean France static D, branch fra in /workspace/wt-fra, e507235). On fra8 (8 France matchups, both seats) France went 1W 2T 5L vs 3W 0T 5L at baseline. REJECTED. Baseline France loses 5/8 matchups in brain mirrors, so the faction AI is weak. Testing SION fp76=all (fortress for fra/chn) on fra8 -> /workspace/n1031/fra/fp.log; compare France seats vs /workspace/n1031/fra/b2.log.
- ai-bench.js on branch fra has a fra8 set and m7-vs.js has env M7=<level> (cherry-pick if useful).

## RESUME NOTE 4:31 AM PT Sat Oct 31
- v7.6.9 LIVE: 105b825 pushed 4:22:33 AM PT, live verified 4:24:40 AM PT.
- Infantry v7.6.10 in progress: worktree /workspace/wt-inf (branch inf, commit 2233a7b, models only, made with humans.py). det74 OK, shots /workspace/n1031/inf (cmp.png old vs new). Full suite running -> /workspace/n1031/g7610/all (done.txt when finished). Then merge master into inf, bump to v7.6.10, zip, shot, push.
- vs8-943 NEWT=both now: usa mined 917k vs bra 984k (the USA "half economy" gap is gone); army 43k vs 83k at 14 min from fight losses.
- SC2-style construction (a builder unit walks out and builds) is a sim + AI change. Held for a session with full A/B.

## RESUME NOTE 4:17 AM PT Sat Oct 31
- v7.6.9 gated (see NIGHTLY-LOG). Push hash = 936ca97 once uploads.log (/workspace/n1031/g769) shows all 5 old replays bad 0. Live main expected 8429b1f.
- After push: realistic infantry in /workspace/blender-iron-front/scripts/humans.py (backup humans_v75.py). Plan: multicam shirt/pants, team-coloured plate carrier + helmet (high-cut, Comtac, eye-pro, beard). Render with blender -b --python make.py -- u_rifle quick hero, then export and copy to models/, det74 check.
- Stuck drill volcano8 s5 now: 1.4% stuck. Top spots 72,32 open; 16,88 own barracks. Not changed.

## RESUME NOTE 3:33 AM PT Sat Oct 31 (overnight run)
- Live = v7.6.8 (8429b1f). master now has v7.6.9 candidates (not bumped yet), merged from wt-dev branch vis:
  - 8056e27 desert darkening REAL cause (supersedes the 3:05 note): desert-only instanced meshes with instanceColor (mud walls, sandbags) shared PBR_MAT; three r149 keeps one program per material and does not re-check instanceColor, so once GLB rocks changed compile order, units went black. Fix: pbrMatIC() (own material, cache key 'pbrv2ic'); GLB desert rocks back on.
  - 5cf890f endless703 loop-alive test gets 3 windows (flake).
  - 1c84c08 + 4d9ac70 REAL phone bug: title changelog footer grew to cover TAP TO DEPLOY on phones (that was the ui7 timeout). Footer clamped to 2 lines + pointer-events:none; logo fits portrait. Shots /workspace/n1031/foot/cmp.png.
- Next: gate (det, replays, v762 shots all maps, ui7, endless703, hellgate, mobile), bump v7.6.9, zip/shot/log, push by hash.

# RESUME NOTE (3:20 AM PT Oct 31): v7.6.8 LIVE (8429b1f pushed 3:16:44 AM PT, verified 3:17:52 AM PT). Master = live + doc commits.
- Next: the desert lighting fix (wt-dev, branch vis; see the 3:05 note), the endless703 loop-alive flake (make running() retry instead of using one 3 s window), stuck spots, a lighter test setup, then SC2 construction and infantry.
# RESUME NOTE (3:05 AM PT Oct 31): v7.6.7 LIVE (47e23ab). v7.6.8 (a58bba9) gate almost done, NOT pushed yet.
- Run alone, these PASS: endgame, mobile-play, slot. ai71 has the same 3 FAILs as live. Still failing: endless703 (rus/fra loop alive), fogkeys ('s' key), ui7 (TimeoutError). All are queue flakes; the live comparison is running in /workspace/n1031/g768/live (done.txt = LDONE). Uploads: all bad 0.
- Desert "rock darkening": NOT caused by the rocks. With every run done one at a time (zz-dbg TAG=), units look the same with rocks off, loaded, and swapped. Earlier "rk=1 is black" came from parallel runs writing the same png. Units go dark because their camera-facing side is in shadow (sun shadow off = lit). So the fix is desert ambient/fill light, and desert GLB rocks can be turned back on. Work is in wt-dev, branch vis (uncommitted debug in terrain.js/models.js and test/zz-dbg.js; do not commit those).
# RESUME NOTE (2:28 AM PT Oct 31): v7.6.7 LIVE (47e23ab). v7.6.8 (a58bba9, AI-identical, App Store pieces) gating, NOT pushed yet.
- Full suite in /workspace/n1031/g768/all is nearly done. Failures so far: ai71, endgame (timeout), endless703, fogkeys, mobile-play, slot, ui7. These are the known flakes under load, so rerun each alone before pushing. Uploads: v767/v766 bad 0, and the other uploads are still running in uploads.log. Tests dirty shots/*.png, so run `git checkout shots` before committing.
- m7h (range term in score71, level 3 only) is committed in /workspace/wt-dev, branch m7h (0899fa7). Test it with `cd /workspace/wt-dev; OLDSKIP=gh node test/m7-vs.js volcano8 93 fra bra 0 12` (M7 defaults to 3), then run the batteries.
# RESUME NOTE (2:08 AM PT Oct 31): v7.6.7 LIVE (47e23ab). v7.6.8 bumped on master (a58bba9), gating now, NOT pushed.
- v7.6.8 = App Store pieces (privacy.html, credits line in Settings, 1024 icon, appstore-shots.js). The AI is identical to v7.6.7: the default stays at m7=2, and the browser already passes m7:2. Headless hashes of 3 games x 12 min match wt-767 exactly.
- m7g (towers, production and extractors when rich at max pop) is built but stays opt-in at level 3. It was even vs v7.6.7 over 20 seat games, because the bank is gas-limited. A maxed army takes about 1 base/min against 3-base rebuilders (volcano 77 diag). m7h (snipers vs marines for France) made France worse and was reverted.
- France vs Brazil (volcano 93): France mines less from 4 min, overbuilds gatlings (def$ about equal to army$), and loses its army by 8 min to marine mass. Rifles score highest in score71 even though marines outrange them (6.1 vs 4.5): score71 has no range term. That is the next AI item.
- Gate in progress: /workspace/n1031/g768/all (full suite), g768/uploads.log (v767/v766/uploads replays). Then the screenshot, appstore shots, zip, ls-remote = 47e23ab, and push.
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

## Note from Nicholas (Oct 31, 7:59 AM PT)
France is fine for humans (he can beat ~5 Hard AIs with it). NO France stat changes. Treat France weakness as a bot-play problem: improve how Hard plays France (strategy, defenses, timing), not unit stats.

## Stuck-army test idea from Nicholas (Oct 31, 8:02 AM PT)
Try the human way: select the whole army, one plain attack-move (F) to the enemy base center, no extra bot steering/reissued orders on top. Compare stuck units vs live, alongside the refinery/building spacing fix.

## MAP BUILDER spec from Nicholas (Sun Nov 1, 9:15 AM PT) — plan with him before building
- Personal map builder (editor) for Iron Front, reachable from the menu/lobby.
- Up to 8 spawn points per map.
- Lobby team modes beyond Team A vs Team B: Free-for-all plus more team layouts (details TBD with Nicholas).
- Pick map size when creating, including maps quite a bit bigger than today's.
- Terrain themes: grass, desert, space, futuristic/mechanical, and similar.
- Placeable: ore fields with different potency (richness), gas deposits, oil derricks, and the other existing map objects (outposts, rocks, cliffs, etc.).
- Save maps and play them in skirmish; bots must handle custom maps (pathing, expansions).
- Same rules as always: no bot bonuses, Hard must not get weaker, keep phone/touch working.
- Nicholas's choices (9:16 AM PT Nov 1): lobby lets him set ANY team number per slot (covers FFA, 2v2v2v2, 4v4, uneven); biggest map ~3x today's; editor built primarily for Mac (mouse/keyboard), phone just needs to play the maps; START TONIGHT, FIRST, before stuck-army work. Ship a playable v1 (editor + save/load + 8 spawns + per-slot teams + size picker + themes + resources) if gates pass, otherwise leave it on master with a play zip and notes.

- [Nov 3] v7.7.4 local (6b60699, builder bots at construction sites, render only) is committed but UNTESTED and NOT pushed; the Nov 3 run was interrupted. Test then push tonight before other items.

## Country flag on command centers (requested by Nicholas 2026-11-04)
- Show a small flag of each player's COUNTRY/faction (e.g. France, China, etc.) on that player's command center (construction yard / HQ), so a glimpse of the base tells you which country, and so which special units, that player is using. Flag pole can carry a thin team-color trim. Readable at normal zoom; minimap marker optional if cheap. Visual only, no gameplay change. Test in skirmish, multiplayer and custom maps; push with the nightly if clean.

## Quick Match lobby (requested by Nicholas 2026-11-04) — APPROVED: build with Apple Game Center (GKMatchmaker auto-match) in the iPhone app
- Goal: one "Quick Match" button instead of host/join codes. Player joins a public queue/lobby; match starts after a countdown (e.g. 60s, or immediately when full); empty slots fill with Hard bots.
- Options to evaluate and report: (1) Apple Game Center auto-match (GKMatchmaker, min/max players) for the iPhone app, free, uses Apple IDs, no server; (2) a tiny lobby service (Firebase/Supabase realtime or Cloudflare Durable Object) that also works on the web build; keep relay-only "Hide my IP" and all security-audit message validation.
- Host = first player in lobby runs the bots; handle host leaving. Report recommended approach, cost, and effort to Nicholas before building.
- Nicholas approved Game Center on 2026-11-04. Build it in the iOS app wrapper: Quick Match button, countdown, auto-match 2-8 players, empty slots = Hard bots, Game Center relay keeps IPs hidden. Web build keeps current host/join. Needs Game Center capability enabled in App Store Connect/Xcode; report any step only Nicholas can do. Test on simulator + note what needs two real iPhones.

## RESUME NOTE 2026-11-05 ~1:10 AM PT (nightly v7.7.9 in progress)
- master merged live main 56171bb (FF-OK). Committed: flags 0.6x (js/gfx/flags.js), FFA watch winner title (main.js).
- Item 3 (no time limits): only elimination/surrender end games in v7.7.8 — nothing to change.
- Warheads ROOT CAUSE: post76 banks 1000 gas for the empty launcher in P._rvG for the whole think step, so warhead76/mis7 (run later in the same step) never see the gas -> silos sit empty (volcano8 s285: 4 silos, 3 small launches all by one team). Also no credits were banked, FFA knownB only saw the main target, mis7 refused with nothing known in range.
- Fix behind NEW replay flag G.f79 (sim.js newGame f79, main.js startGame default 1 / loadReplay d.f79, net.js recStart f79) + f79On(P,k) in ai.js (SIOFF.f79 / wh79 / rc79 / gc79). UNCOMMITTED while benchmarking (probe: /workspace/n1105/wh.js, env F79=1).
- Quick Match test: 2 fails were test timing (drop cmd lands later; main.js clears NET.status each frame). Fixed: NET.lastStatus + test polls. Rerun alone: NODE_PATH=/workspace/pwlib/node_modules timeout 1800 node test/quickmatch-test.js
- base for det tests: worktree /workspace/base778 (56171bb).
- ~12:45 AM: f79 AI built (uncommitted until Hard gate): wh79 warheads (bank fix, all known enemies, start-spot fallback, small after 90 s), rc79 (recall weighs home threat vs what the group gains abroad + home towers; no parking at dead/empty bases), gc79 France fort79() (5-6 GCs over main entrances, 2 GCs + 2 turrets + flak at the first two expansions). Benches in /workspace/n1105: fra-before/after.txt (France 7 leads/1 loss after vs 2 leads/3 losses before), v8-285 FFA launches 3 -> 12. Gate running: hard.txt (6 mirror games NEW vs OLD), det-new/det-old.txt (f79-off identical to base778).
