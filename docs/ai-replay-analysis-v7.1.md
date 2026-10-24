# Chief SI replay analysis (v7.1)

Source: `replays/replay-2026-10-24-chiefsi.json` — 4v4 on **Volcano XL** (`volcano8`), 3:00 peace, fog on.
Human = Brazil (slot 0, team A). All 7 bots = **Chief SI** (v7.0.2 brain).

| slot | side | faction | team |
|---|---|---|---|
| 0 | Human | Brazil | A |
| 2 / 4 / 6 | SI | China / Russia / Iran | A (human's allies) |
| 1 / 3 / 5 / 7 | SI | Russia / France / France / Japan | B (enemies) |

Result: **victory for team A at 25:54** (46,635 ticks).

Method: the replay was re-simulated deterministically on the exact v7.0.2 code (`git archive 1d9eff8`).
Every 900-tick state hash matched (42 checks, 0 mismatches). A collector (`/tmp/rp/analyze.js`) logged every building
placement, unit birth/death, attack launch/retreat, air raid, drone swarm and a 15 s economy snapshot per player.
The re-sim runs ~4.5x real time on a 900-entity 8-player map, so the per-player data covers **0:00–21:00**.
The last ~5 minutes (team B collapsing) is taken from the replay result.

## 1. What actually happened (plain language)

* **The human won with one unit.** Brazil built a factory and tech only for prerequisites/medevacs, then **five barracks**
  pumping Iron Marines non-stop. It hit ~90 pop by 10:00 and sat at 96–99 pop for the rest of the game
  (368 marines produced, 6 medevacs). It even floated 20–46k credits. A pro would call that sloppy macro, and it still won.
* **Every bot opened identically** (power 0:05 → barracks 0:10 → refinery 0:19 → power → extractor → factory ~1:00 →
  2nd refinery ~1:30). Then, **from 1:40 to 4:10, every bot built 8–15 Guard Turrets** (one at every base entrance) —
  **6–9k credits in turrets before the game's first real unit wave.**
* **Bots were starved for 15 minutes.** Credits sat at ~0 in 100% of samples after 4:00, so they never floated.
  But income went into structures: by 21:00 Russia#4 owned **23 turrets, 21 flak batteries, 19 tesla coils**
  (~51k credits), and China owned 17/16/14. **Flak batteries were built en masse even though the enemy's only aircraft
  were six medevacs.**
* **Every bot had exactly ONE barracks all game, and usually one factory until 10+ minutes.**
  Army size at 8:00: 10–34 pop (the human had 62). Several bots spent 10 minutes at 15–25 pop.
* **Tech was late**: Russia#1 8:41, France#3 10:10, France#5 8:15, China 5:11, Russia#4 5:24, Iran 5:42.
  Japan was best at 3:19. **Expansions**: China, France#3 and Iran never expanded before 19 min, Russia#1 at 17:24.
  Only Russia#4 (4:36) and Japan (5:09) expanded on time, and those two were also the strongest bots.
* **Specials barely existed.** France built **0 Grand Cannons** (France#5 got its first Gatling at 10:00 and had 17 by 21:00);
  China had **2 guard towers, 0 Ballistas** and a stub of 8–21 wall pieces; Russia made 1–4 Tsars total;
  Japan 7 Raijins (never more than 1 alive). Iran produced 156 drones but launched them in **~60 swarms of 2–3**, so
  they trickled into fortifications one at a time and all died.
* **Attacks were rare, small and uncoordinated.** Team B (four bots) launched exactly one real attack in 21 minutes
  (Japan, 28 units at 3:01, during peace prep, crushed). Team A: Russia#4 at 13:42 (24 units + 6-unit flank, retreated 15:52), then
  8-unit waves from China (15:04, 16:41) and Russia (16:07). **No two allies ever launched within 30 s of each other.**
  The "coordination" the owner noticed was mostly the human's marine ball pulling bot defenders along.
* **The bots' armies evaporated anyway.** Army losses ≈ production: units dribbled out piecemeal to defend allies, to
  answer pings, to chase harass, or got sent forward by the idle watchdog. K/L: France#3 67/200 (eliminated 14:33),
  Iran 114/219, Russia#1 90/153, France#5 205/256, Japan 423/464 (main base razed by 21:00). The human: 483/299.
* **The counter logic was wrong against the one unit that mattered.** Bots answered "infantry" with **riflemen,
  snipers and rocketeers**. Iron Marines are *plated* vs bullets (−45%), snipers (−45%), rockets (−15%), and resist vehicle guns
  (−35%). Their real counters are **splash/shell, fire, bombs, zap and warheads** (artillery, Tesla/Raijin/Gatling,
  bombers). Japan (39 artillery) and Russia#4 (tesla/heavy mix) were the only bots that traded evenly.
  Every bot also built 7–13 **interceptors** that had nothing to shoot except medevacs.
* **AI cost**: 0.12–0.35 ms per bot per think on average, but spikes of 17–30 ms (base-layout and wall planning on a 112² map),
  vs ~10 ms/tick for the simulation itself at 900 entities.

## 2. Against world-class RTS play

| Pro principle (SC2 / AoE2 / RA2) | Chief SI v7.0.2 | Grade |
|---|---|---|
| **Macro cycle / constant production** — every structure always producing, add production to match income | 1 barracks + 1 factory for 10 min; production limited by credits sunk into static D | F |
| **Never float, never over-build static D** — static D only where it saves more than it costs | Never floated, but sank 30–50k into turrets/flak/tesla, 16–21 flak vs zero air | D |
| **Expand on time** (SC2 natural by ~1:30–2:00 equivalent) | 3 of 7 bots never expanded in 19 min | D |
| **Tech timing** | Tech lab 5–10 min; Japan's 3:19 was the outlier | D |
| **Scouting → counters → tech switch** | Reactive weights from currently-visible units only; wrong counter table vs marines; air counters vs medevacs | D |
| **Max-and-trade** — at max supply, trade armies and remax off production | Never maxed (peak 84 pop, typical 20–40) | F |
| **Timing pushes** — hit at a power spike with everything | Waves of 8–24, 1–2 per bot per 20 min | D |
| **Multi-prong / coordinated team attacks** | Flank sub-groups exist; no shared ally timing | D |
| **Concave / flank / focus fire** | Formation on launch; built-in retargeting only | C |
| **Unit preservation / retreat** | Retreat rule exists, but defenders/pings feed units piecemeal | D |
| **Harass with fast units** | Scout harass from 4 min (scouts mostly died to turrets) | C |
| **Map control / denial** | None; armies sit at home behind static D | D |
| **Specials as the faction's identity** | Specials capped at 4 (2 for buildings), built rarely | D |

## 3. Biggest weaknesses (ranked by how much they cost)

1. **Turret-first opening**: 8–15 turrets between 1:40 and 4:10 delayed tech, expansions and army by ~3 minutes.
2. **Production never scales**: one barracks forever, factories added only at 10+ min, no remax capacity.
3. **Static-D money sink**: flak/tesla/turret counts grew without a threat model (flak vs no air).
4. **Wrong counter matrix**: random weighted picks from the *currently visible* units, using simplified
   "inf → rifle/sniper" rules that ignore marine plating and splash. No memory of enemy composition.
5. **Piecemeal army use**: defenders, ally help, pings and the idle watchdog leak units into bad fights one squad at a time.
6. **No team timing**: allies never attack together; waves of 8 into a 90-pop death ball.
7. **Specials under-built**: no Grand Cannons, almost no Great Wall/Ballistas, Tsar/Raijin trickle, drones wasted in 2-packs.
8. **Late expansion/tech** (3 bots no expansion, tech at 8–10 min).
9. **Gas floats** (1.5–5k unused gas in most bots): specials and upgrades not prioritized.
10. **AI frame spikes** up to 30 ms on layout/wall planning.

## 4. v7.1 Chief SI plan (implemented, see `js/ai.js` `si71` paths)

* **Lean, purposeful defense**: ≤2–3 early static D (at the enemy-facing approach only) until tech + expansion; then a threat-driven budget.
  AA only when enemy *combat* air has been seen. France and China are fortress factions: walls in front, Gatling/Tourelle
  lines plus Grand Cannons behind at the chokes, China Great Wall lines with guard towers converted to Ballistas.
* **Macro**: tech by ~3:00, expansion at ~3:30 and then on income; barracks/factories/airfields scale with income;
  gas sinks into specials; production never idles.
* **Intel + counter matrix**: remembers every enemy unit seen (decaying), then scores each buildable unit by real
  damage-per-cost vs that composition using the sim's own `DMG` table plus marine plating/resistance, and survivability.
  Specials get a guaranteed share.
* **Army discipline**: one home army; defend with everything when the fight is winnable, otherwise fall back under the guns;
  no piecemeal leaks.
* **Team timing**: allied SI bots share a plan — a target, per-bot staging points (multi-prong), a launch time; everyone
  arrives, then engages together. Air strikes on power/AA and drone swarms go in just before the ground army; medevacs follow.
  Reinforcements rally and join as waves. Max-and-trade at high supply.
* **Micro**: focus fire on priority targets (artillery, medevacs, specials, low-HP), pull back badly damaged units,
  retreat from lost fights, keep artillery behind the front.
