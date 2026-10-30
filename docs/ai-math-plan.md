# AI math plan: decision methods for the si2 bot

Motivation: the 2026-10-30 replay study (`docs/ai-replay-study-2026-10-30.md`). The si2 bot loses mainly through bad **decisions**, not bad stats:
- an economy frozen by a fear threshold
- a 99-unit army dithering for 250 s
- a silo holding a missile it could never fire

This plan sets out which mathematical methods fit which si2 manager, what each costs, and the order to build them in.

## Hard constraints (apply to everything below)
- **No cheats.** No resource or stat bonuses for bots and no unit stat changes. Hard must never get weaker. Each change has to be A/B tested against the current Hard: at least 20 seeds over 3+ maps, win rate must not drop.
- **Lockstep determinism.**
  - All AI maths runs inside the sim tick on every client.
  - Use integer or fixed-point maths (scale by 1000 and `Math.floor`) and the seeded RNG only. No `Math.random`, no wall-clock, no `Float` sums whose order depends on `Map`/`Set` iteration.
  - Sort before choosing, and break ties by unit/building id.
  - Gate new behaviour behind a replay flag (as `nt` does), so old replays keep re-simulating to matching hashes.
- **Budget:** the AI currently runs in time slices. Target under 1 ms per bot per tick on average, with spikes spread over ticks (for example one manager per tick, round-robin).

## Methods

### 1. MDP / POMDP: the frame, not a solver
- **Decides:** the macro posture, out of {greed, safe, tech, pressure, all-in, defend}. Today this is ad hoc flags (safe76, er76, pw76).
- **Inputs:** own economy (income/s, harvesters, bases), army value, the enemy belief (see §2), game time.
- **Cost:** negligible if we use it as a *structure*: one explicit posture state machine with defined transitions, plus a one-step look-ahead value per posture. Do not do full POMDP value iteration; the state space is far too large.
- **Determinism:** trivial (integer scores, fixed tie order).
- **Priority:** medium. This is the place to *put* the safe76 fix: one posture variable instead of scattered booleans, with hysteresis and a minimum dwell time so it can't flip every tick.
- **Impact:** fewer contradictory behaviours, like safe76 and er76 stacking to make blue passive.

### 2. Bayesian inference: enemy belief
- **Decides:** what the enemy probably has and where. Feeds safe/rush/greed choices and army71's `need`.
- **Inputs:** scouted units/buildings with timestamps, the enemy's income estimate (bases × harvesters × rate), elapsed time.
- **Method:**
  - Prior army value = estimated mined − buildings seen − decay. Update on each sighting.
  - Keep a per-type count belief as a capped Poisson-ish integer estimate.
  - Replaces the hard-coded "unseen-army prior until 7 min" in er76.
- **Cost:** O(seen units) every 2–5 s. Cheap.
- **Determinism:** fixed-point rates; update only on sim-tick events.
- **Priority:** medium-high. It is the right fix for "fog off, so I see everything, so I panic" (safe76 compared *total* enemy value with *local* army, ignoring distance and intent).
- **Impact:** removes false panic and false greed.

### 3. Utility AI: build, tech, target and silo choices
- **Decides:**
  - the production queue (what to build next)
  - expansion timing and site
  - attack-target choice (replacing the fixed si pref list that made red chase a rebuilt CC)
  - silo missile type and target
- **Inputs:** per-option features (cost, time to finish, value, threat, distance, counter matrix). Each is normalised to 0..1000 and combined with integer weights and response curves (piecewise-linear tables).
- **Cost:** O(options) per decision, about 20–60 options every 1–3 s. Cheap.
- **Determinism:** integer curves; ties broken by id.
- **Priority: high (phase 1).** It directly fixes the expansion freeze, the target churn and the silo deadlock.
- **Impact:** large. Also the natural place to plug in tuned weights later (§9).

### 4. Knapsack / LP: spending
- **Decides:** how to split the current bank and the next N seconds of income between harvesters, expansion, production, tech, silo and defences, under the pop cap.
- **Method:** a bounded knapsack with small integer weights (unit costs / 50) solved by DP. Capacity is bank + projected income over a 30–60 s horizon; value comes from the utility scores (§3). A greedy ratio sort is an acceptable fallback. A real LP (simplex) is overkill and float-heavy, so avoid it.
- **Cost:** a DP over about 40 items × about 200 capacity buckets = about 8k ops every 2 s. Fine.
- **Determinism:** integer DP.
- **Priority: high (phase 1).** It fixes red floating 520k at max pop: when pop is capped, value moves to silo, tech, upgrades, turrets at forward bases and a reserve "replacement queue".
- **Impact:** medium-high.

### 5. MCTS: tactical look-ahead (later, narrow use only)
- **Decides:** engage or disengage, and which of 2–4 attack routes or targets to take, using a cheap abstract combat model (Lanchester, §6) as the rollout.
- **Cost:** high. Even 200 rollouts × an abstract model costs about 1–3 ms. It must be time-sliced and run rarely (every 10–15 s per group).
- **Determinism:** OK if it uses the seeded RNG and a fixed iteration count. **Never** use a time budget, because a time-bounded search diverges across clients.
- **Priority:** low (phase 3). Utility plus Lanchester covers 80% of the value at 2% of the cost.
- **Impact:** small to medium, and hard to tune.

### 6. Lanchester models: fight / commit maths
- **Decides:**
  - Should this group attack now, wait or retreat?
  - How much army does an attack really need (replacing army71's `need` of about 77–91k, which blue could never reach)?
  - Is the enemy a real threat to my expansion (replacing safe76's ratio)?
- **Method:**
  - Square law for ranged mass: strength = Σ dps × Σ hp, with a counter-matrix multiplier per type pair. Add a linear-law term for melee and choke fights. Static defences enter as dps+hp with a range bonus.
  - Predicted outcome: survivor fraction = sqrt(1 − (E/A)²) when A > E.
  - Combine with travel-time ETA (path length / speed) for threat-to-base.
- **Cost:** O(units) aggregate every 2–4 s per group. Cheap.
- **Determinism:** integer (scaled hp×dps in 64-bit-safe range; use BigInt-free fixed point, e.g. sqrt via integer Newton).
- **Priority: highest (phase 1).**
  - Red sat at 2:1 army advantage for 250 s.
  - Blue never felt safe with an army that couldn't be reached.
  - Both are failures to compute the fight outcome.
- **Impact:** large. Commit when predicted survivors are 40% or more. Hold or contain otherwise.

### 7. A* / Dijkstra plus flow fields: movement
- **What we have:** A* (sim.js ~549) with an 8000-node cap and a partial-path fallback. It is *fine* on volcano8: 123–131 tiles, at most 4.8k nodes.
- **What actually fails is choosing a goal:**
  - 54% of red's dither-window orders targeted blocked tiles.
  - Units sealed into their own base had no way to report it.
- **Plan:**
  - (a) Snap every AI move goal to the nearest passable tile reachable from the group, using a cheap BFS ring search.
  - (b) A **per-team Dijkstra distance field** to each enemy base (flow field), recomputed every 10–20 s or when a building is placed/destroyed. Groups follow the gradient. No per-unit A*, chokes are visible, and "unreachable" is an O(1) lookup.
  - (c) Choke detection from the field (narrow cut tiles). Gather on the *near* side of a choke, then cross as one group (contain → commit).
  - (d) Keep nt76 as the no-trap guard, and add a periodic "pocket audit" that flood-fills from the HQ and sells or opens a gate for any building that seals units in.
- **Cost:**
  - one Dijkstra over 12.5k tiles ≈ 0.5–1 ms, so amortise it over several ticks (incremental, a fixed number of nodes per tick)
  - 1–3 fields per team
  - memory about 25 KB per field (Uint16)
- **Determinism:** integer costs (10 straight / 14 diagonal), a fixed neighbour order and a stable priority queue (tie by index).
- **Priority: high (phase 1).** Choke-aware gathering plus passable goals removes the dither and churn.
- **Impact:** large for "army can't get into the base".

### 8. Nash equilibrium / regret matching: strategy mix
- **Decides:** the opening and strategy archetype per game, out of {rush, eco/greed, turtle/fortress}. Mixing makes Hard less predictable to humans.
- **Method:**
  - Start with a fixed **25/50/25 blend** (rush/standard/greed), drawn from the seeded RNG at game start.
  - A **fortress-punish** rule: if belief (§2) says the opponent is turtling (many statics, no army moves), switch the mix weight toward greed/tech plus silo, and contain instead of attacking walls. Turtles lose to out-expanding.
  - Across games (offline, or per player profile in localStorage *outside* the sim), update the mix with regret matching on win/loss per archetype vs that player's archetype. Feed it into the next game as a seed-time parameter that is recorded in the replay.
- **Cost:** nothing in-game.
- **Determinism:** the mix is chosen at game start and saved in the replay header.
- **Priority:** medium (phase 2).
- **Impact:** medium vs humans, zero vs bot-on-bot balance.

### 9. PPO / RL: honestly, not yet
- PPO needs millions of fast headless games, a stable observation/action API and float neural-net inference inside a lockstep sim (which breaks determinism unless the net is quantised to integers).
- That is a multi-week project with uncertain payoff, so it is not justified at our scale.
- **Do first:** **CMA-ES (or a simple (1+λ) evolution strategy) over the utility/Lanchester weights**, with headless self-play.
  - The node harness already re-sims at about 30–50× real time.
  - 30–60 weights × about 200 games per generation runs overnight on the box.
  - Fitness: win rate vs the frozen current Hard over a fixed seed/map set, plus a tie-break on time-to-win.
  - The result is just new integer constants, so determinism stays intact and the change is fully reviewable.
- **Priority:** CMA-ES in phase 2. PPO is phase 4 at most, only if the ES plateaus.
- **Impact:** CMA-ES is realistic and good for tuning. PPO is speculative.

### 10. Multi-agent coordination
- **Decides:** how several groups (main army, harass squad, defence squad, silo) and allied bots (2v2/FFA teams) share targets and timing.
- **Method:**
  - A per-team "blackboard" (shared target list with claims).
  - Contract-net style assignment: groups bid utility for tasks, the highest bid wins, ties by id.
  - Synchronised timing: the silo launch is scheduled to land just before the main army arrives (ETA from the flow field).
  - Allies share belief (§2) and commit together when the combined Lanchester check passes.
- **Cost:** O(groups × tasks) every 5 s. Cheap.
- **Determinism:** sorted claim order.
- **Priority:** medium (phase 2). Phase 1 only needs silo↔army sync.
- **Impact:** medium. Large in team games.

## Silo / superweapon section
Observed on master: a cluster missile (range 65) was loaded in a corner silo 104–125 tiles from every target, so it never fired. hard4c-b placed the silo better and fired heavies, but the deadlock is still possible in the code.

1. **Placement:** score candidate sites by the number of high-value enemy targets within the range of the missile we will be able to afford. Prefer sites at least 15 tiles behind our front line (safety). This uses the flow field / threat map.
2. **Load choice:** utility over {small, cluster, heavy}:
   - value = Σ expected target value within range × kill probability
   - cost = credits + gas + opportunity cost
   Never queue a type whose range can't reach any known target from this silo.
3. **Swap / recycle:** if the loaded missile has had no valid target for T seconds (say 60 s) and a better type is affordable, scrap (accept the loss) or fire at the best in-range target, and rebuild. This fixes the deadlock.
4. **Targeting:** utility = value of buildings and units in the blast (economy buildings, CCs, production, clumped armies) − friendly-fire risk. Prefer just-before-army-arrival timing (§10). Avoid targets an enemy repair or rebuild would undo immediately.
5. **Spend sink:** at max pop with a bank over 30k, the knapsack (§4) should value silo builds and missiles highly. Red's 520k float would have been dozens of missiles.

All of this is decision logic only. Silo stats are unchanged.

## Phased roadmap

**Phase 1** (next; the nightly 4c run, after the hard4c-b merge d1364e4):
1. **Lanchester fight evaluator** plus a commit/contain/retreat group state. It replaces army71 `need` and the 12 s "unstick" churn. Add target hysteresis: keep a target for at least 20 s unless it dies or becomes unreachable.
2. **Choke-aware pathing:** passable goal snapping (cheap and immediate), then a per-team Dijkstra flow field with choke gather points, plus a pocket audit.
3. **Utility plus knapsack spending:**
   - fix safe76: time-limited, never caps harvesters below saturation or blocks the first natural, trigger = Lanchester + ETA threat
   - a max-pop spend sink
4. **Silo:** range-aware placement, load utility, swap/recycle, utility targeting, army-synced launch.

Acceptance:
- Replay this volcano8 seed plus 20 other seeds/maps, si2 vs si2 and new vs old Hard.
- The new Hard must not lose more than the old Hard.
- Red-style dither windows (centroid inside a 15-tile box for more than 90 s while ahead ≥1.5×) should drop to near zero.
- No unit should be stuck for more than 60 s in a sealed pocket.
- Bots should never float over 50k at max pop for more than 60 s.
- All old replays must still verify to matching hashes with the new flag off.

**Phase 2:** Bayesian belief (replaces er76/compTot heuristics), the MDP posture state machine, multi-agent blackboard, Nash mix plus fortress-punish, and CMA-ES self-play tuning of all phase-1 weights.

**Phase 3:** MCTS for engage/route choice using the Lanchester rollout. Only if phase-2 measurements show tactical choices are still the bottleneck.

**Phase 4 (optional):** RL/PPO research with an integer-quantised policy. Only if CMA-ES plateaus.

## Honest expectations
- **Most of the visible win comes from phase 1:** Lanchester + commit, passable goals/flow fields, the safe76 fix, the spend sink and the silo fixes. All are cheap, deterministic, and directly target the failures in the 10-30 replay.
- **CMA-ES tuning is the best "learning" bang for the buck.**
- MCTS and PPO are expensive. Inside a 30 Hz lockstep JS sim their gains are uncertain. Treat them as research, not roadmap commitments.

## Standing rule and extra methods (Nicholas, 3:34 PM PT Oct 30)
Whenever bots hit a problem, pick the best-fitting math method first. Keep Nicholas's ten in the roadmap (MDP/POMDP, Bayesian inference, utility AI, knapsack/LP, MCTS, Lanchester, A*/Dijkstra, Nash/regret matching, PPO, multi-agent) and add these where they fit:
- Influence maps / potential fields: threat and safety maps that steer expansions, rally points and retreat paths, and help avoid tight building clusters.
- Kalman or particle filters: track enemy army position and size under fog from last-seen scouting.
- Hungarian algorithm: assign units to targets (focus fire, AA to air, AT to tanks) without overkill.
- Max-flow / min-cut: pick wall and turret positions that close chokes while keeping a guaranteed gate route (pairs with the no-trap check).
- k-means / DBSCAN clustering: group the army into squads for flanks, drops and multi-prong attacks.
- CMA-ES with overnight headless self-play: tune the bots' weight vector (the realistic first "learning" step before PPO).
- TrueSkill/Elo: rate bot versions against a frozen ladder so "Hard never gets weaker" is measurable.
- Build-order search (bounded branch-and-bound over timings): opening timings per faction and matchup.
- Queueing theory: production-queue and harvester saturation targets so money never floats.
All of it must stay integer/fixed-point and deterministic, with bounded per-tick cost.
