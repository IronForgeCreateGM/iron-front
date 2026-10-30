# What the strongest StarCraft II bots do, mapped to Iron Front (v7.6.1 "si2" Hard)

Sources studied (Oct 30 2026): Blizzard Elite AI behaviour write-ups, AI Arena ladder bots (Eris, Robotina, Overclock),
the python-sc2 / sharpy-sc2 / Ares frameworks (BuildRunner, ConstantWorkerProductionTill, PlanZoneDefense/Gather/Attack,
EngagementResult combat-sim thresholds) and DeepMind's AlphaStar papers / blog.

Iron Front parallels: engineers / derricks / refineries / harvesters = workers & mining, Command Center = expansion,
barracks / factory = production, towers / walls = static defence, warheads = big cooldowns / spells.

| SC2 principle (who) | Iron Front version in si2 | Benchmark / threshold |
|---|---|---|
| Scripted opener, then fully reactive macro (Ares BuildRunner, sharpy, Eris) | Fixed opening (power, barracks, refinery x2, factory) then income-driven macro; si's proven early timing is kept for the 1st Command Center | 1st CC no earlier than si (expandAt 210 s, needs 2 refineries); old si2 150 s / 1-refinery expansion removed (it was the "half army at 5 min" cause) |
| Constant worker production until saturation (ConstantWorkerProductionTill) | Harvesters per refinery + engineers to derricks keep queuing until each base is saturated | 2 harvesters per refinery, 3 engineers max out on derricks; 136k vs 100k mined by 9 min vs old si2 |
| Never float money; add production when banked (Eris, all top ladder bots) | `macro76`: if the smoothed bank (EMA) > 450 cr while both queues are busy, add another factory/barracks (alternating) | up to 4 + 2 per CC production buildings; checked every 20 s |
| Production scales with bases (≈3 gates/base, 1 factory/base) | factory-per-base rule (f76) + prodTarget scaling with credits (pd76) | factory > min(2, CCs) before the next expansion |
| Static defence only vs real threat (Robotina: bunker only vs rush) | defenseMgr caps towers to a share of mined value (+ bonus only under attack); vs infantry mass towers switch from cannon turrets (0.35x vs infantry) to Tesla clusters | 10% of mined value (China 18%, France 27%) |
| Counter model for army mix (Overclock; AlphaStar's strategy diversity) | score71 counter matrix from remembered enemy units + new infantry-mass reaction: Howlers forced to 35% of factory output (range 7 / 10 sieged, splash outranges Iron Marines' 6.1), Japan Raijin 40% (chain lightning 1.25x vs infantry), Tesla instead of turrets | triggers when >55% of seen enemy army value is infantry and ≥3000 cr of it was seen |
| Attack at critical mass, as one army (Eris, Overclock "gather then move as one") | team plan: gather at concave rally points, launch together; in team games (2+ bots) a push now needs the team's combined army ≥ 1.05x the target's army+defence instead of one bot going at 0.8x | no push before 5:00 (300 s); at least 90 s between pushes |
| Focus the weakest / the lone enemy (Elite AI targets; AI Arena team bots) | need76 picks the weakest single enemy player; all allies share one target | target = min(army+towers+distance) |
| Retreat when the combat sim says you lose (Ares EngagementResult, sharpy retreat_multiplier 0.3) | avoid71 / retreat rules read sim71 before and during fights; group retreats when it has bled | engage ≥ 0.7 sim ratio at home, retreat below |
| Defend allies with combined power (sharpy PlanZoneDefense) | defend71 now counts the attacked ally's own units and towers in the sim when deciding to help | help if (my pool + ally forces) / threat > 1.1 (was: my pool alone > 1.3) |
| Rebuild after losses (Eris "remax") | production buildings + queues always full when banked; engineer founds a new Command Center if the last yard dies | engineer CC rule (v7.6 r76) — same price and rule as players |
| Big cooldowns on high-value targets (AlphaStar disruptor/storm targeting) | warhead76 aims warheads at army blobs / production, silo76 timing | — |
| Don't attack blind into static D (Elite AI's weakness vs cannons) | early all-in blocked unless the team army beats remembered army + defence prior | before 5:00 needs 1.5x (2.4x vs fortress factions) |

## Not borrowed (and why)
- AlphaStar-level APM micro: Iron Front bots already focus-fire with priorities (PRI71); more micro is not the bottleneck.
- Cheese / proxy rushes: Hard must stay fair and stable; no resource or stat bonuses are used anywhere.

## v7.6.1 — si2 as a set of SC2-style managers (python-sc2 / sharpy-sc2 / Ares architecture)

SC2 framework bots split the brain into managers that each own one job and talk through shared state
(sharpy `KnowledgeBot` managers, Ares `Manager` mediator, Eris macro/army/intel). si2 now does the same inside `js/ai.js`;
every v7.6.1 piece has a `SIOFF` flag so it can be switched off for ablation tests.

| Manager | SC2 source idea | Iron Front implementation (v7.6.1) | SIOFF |
|---|---|---|---|
| **Macro** | ConstantWorkerProduction, supply-ahead, "never float", production scales with income (Eris, sharpy `AutoWorker`/`AutoPylon`) | `macro76` adds a factory/barracks when the smoothed bank stays > 450 cr; with infantry stopped at high pop, a busy factory alone now triggers more production | `m76`, `pp76` |
| **Supply efficiency** | Late-game SC2 bots remax on high-value supply (no zerglings at 200/200) | `popInf76`: past pop 32 non-marine factions stop rifles/rocketeers/scouts once 8 exist (except vs air); pop slots go to tanks/Howlers (≈1000 cr per pop vs 100–300) | `pp76` |
| **Defense** | PlanZoneDefense: static D only vs a real threat; Robotina bunker only vs rush | `defCap76`: no towers beyond the basic pair until 75 s before peace ends; afterwards the tower budget is 1500 + 0.5 × seen enemy army + 0.2 × my army (+2500 under attack); the Great Wall follows the same rule | `dc76` |
| **Combat sim** | Ares/sharpy `EngagementResult`: simulate with every friendly unit in the area | retreat/avoid sims now count allied units within 12–14 tiles, so bots fighting together no longer each run away from a ball they beat together | `as76` |
| **Joint defence** | sharpy PlanZoneDefense pulls all nearby forces | `teamHome76`: when an ally is hit, each bot's help sim counts the other bots' idle home armies that answer the same call, so the whole team arrives instead of nobody | `jd76` |
| **Army / timing** | "Gather then move as one", attack at power spikes (Eris, Overclock) | `stage76`: one shared staging point ~28 tiles short of the target on the team's side (out of the defender's reach) instead of separate rally points 17 tiles from its base; waits up to 100 s for every member; plans with no live member reset after 20 s instead of blocking the team for 200 s | `tg76`, `ps76` |
| **Macro (greed window)** | SC2 bots go greedy when no attack can arrive (scouted-safe economy) | `pg76`: during a long peace (≥ 5 min) bots take 2 extra refineries on the main before expanding; 1v1 vs the sparring profile: 115k vs 97k mined and 52k vs 41k army at 8:00 (was 37k) | `pg76` |

### Release bench (v7.6.1, Oct 30 2026)
- si2 vs v7.6.0 si, 6 full games (30-min cap): 5-1 (4 knockouts + 1 on points; the loss is classic seed 8 si Japan vs si2 USA).
- 3 si2 vs the sparring profile on frost, peace 8:00: 3/3 knockouts at 12.3, 14.0 and 12.9 min (seeds 9, 4, 12). The v7.6.0 si bots only led on points at 20 min.
- 1v1 si2 Brazil vs the sparring profile: 1-1 (seed 4 si2 on points at 25 min, seed 9 the profile won at 24.3 min).

### Ordered plan for what is not done yet
1. Counter-attack window: after a won defense (enemy army < 50 % of ours), launch the team immediately (SC2 "punish after hold").
2. Time budget: cap AI work per tick (stagger the heavy scans across bots: humanPush71, teamHome76, enemy memory) for phones.
3. Multi-prong harass: a small squad hits harvesters while the main army stages (sharpy `PlanHarass`).
4. Build-order benchmarks per faction with checks (pop/army at 3:00/5:00/8:00) and a transition when behind.
5. Scout-driven counters: detect "maxed and holding" human (like the sparring profile) and time the team strike just after it moves out.
