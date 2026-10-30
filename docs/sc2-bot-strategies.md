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
