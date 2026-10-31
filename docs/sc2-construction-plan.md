# SC2-style construction: plan (written 6:06 AM PT, Oct 31 2026; NOT started in code)

## What players would see
- Place a building. A worker (the Engineer, or a new cheap "Builder" from the yard) walks to the spot and builds it. Scaffolding rises only while a worker is on site.
- More yards no longer speed up one site. More workers mean more sites at once (SC2 Terran style: one SCV per site).
- The worker can be killed or pulled away. Then the site pauses at its progress and resumes when any worker is ordered onto it (right-click).
- Cancel still refunds 100% (keeps v7.2 "no grind" feel); destroyed site = no refund (as now).

## Where it plugs in (js/sim.js)
- `placeBuild` (~line 445): today it pays and calls `addB(..., con)`. New: also pick the nearest idle builder (deterministic: distance, then id) and give it `order: 'build', bld: b.id` + `setPath` to the nearest free tile on the site's edge.
- `stepConstruction` (~line 460): today = one site per lane per team, rate from yard count (`yards`, `lane`). New (replay level gated, e.g. `G.cw8`): a site progresses only if a builder with `bld === b.id` is within 1.2 tiles of its footprint; rate = 1 x low-power factor. The lane/`CON_CAP` limits go (cap = builder count).
- Unit step: new `order === 'build'` branch: walk, then stand (no auto-acquire). On `conDone` -> idle, or the next item in `u.wq` (shift-queue several buildings).
- Old replays: everything behind a new replay flag (`cw8`) saved in recStart (js/net.js) and passed in main.js line 128 like `m7`. Absent = current v7.2 behaviour.

## AI (js/ai.js)
- `placeReady` already places like a player. Needs: keep 2-4 builders (Hard 4), send the nearest, re-send if the builder dies (site with no builder for 5 s -> assign), never pull the last builder into a fight.
- Risk: base-build pace drops when builders walk far (expansions). Must A/B with ai-bench all20 + 943 scenario. Expect the bots to need a "builder escort" to the expansion.

## UI
- Builder card in the yard panel; placement ghost unchanged; selected builder shows its build queue; site tooltip "Paused: no builder" when idle.
- Mobile: tapping a building card with no builder selected auto-assigns the nearest one (so phone play stays one-tap).

## Tests to write first
- unit: place -> builder arrives -> progress only while present -> kill builder -> paused -> new builder resumes -> done; cancel refund 100%.
- determinism: det73/det74 with cw8 on; old replays (cw8 absent) unchanged.
- AI: all20 vs live Hard at cw8, stuck drill (builders must not jam at sites), endgame-test 5/5.

## Size
- About 1 session of sim+UI and 1 of AI tuning. Not doable in the tail of a night run with full gates. That is why it was held tonight.
