# Iron Front — replay study, 29 Oct 2026 (v7.5.1, volcano8, 4v4)

Analysis and plan only: no game code was changed. Scripts and extracted data live in `/workspace/replay-study/`, which is outside the repo:

| file | contents |
|---|---|
| `resim.js` | plain deterministic re-simulation (hash check) |
| `extract.js` + `sampler.js` | per-player timeline every 30 s: `out/timeline.json`; kills, losses and buildings: `out/events.json`; 5 s samples after 11:00: `out/fine-late.json` |
| `probe.js` | read-only aiStep wrapper that classifies every bot unit as grp/flank/hsq/raid/home/ORPHAN: `out/orphans.json` |
| `matrix.js` | equal-cost (12 000 cr) field-battle matrix, 12 compositions × 2 seeds: `out/matrix-12000.json` |
| `siege.js` | equal-cost assault on a fixed defended block |

## 0. Replay integrity

- `ironfront-replay-2026-10-29-nicholas.json`: v7.5.1, map volcano8, peace 300 s, fog off, 313 human commands, 28 755 ticks (15:58).
- **It re-simulated cleanly.** All 32 of 32 state hashes matched, both plain and instrumented. The winner was ally 1 (white, orange, red, yellow).
- **Side finding:** the replay has no `seed` field. The lobby passes `seed: undefined`, so `newGame` falls back to seed 1. **Every lobby game is therefore seed 1**: the same AI dice every game, given the same inputs. Fix: in main.js, the lobby should pass `seed = (Date.now() ^ rand) >>> 0` and save it into the replay. This is a one-line change and is part of the replay item in the plan.
- Replay auto-save already exists: `js/main.js` writes `ifLastReplay` to localStorage every 1800 ticks and at game end. The queued item "replay auto-save of last game" only needs the seed fix and a visible "Download last replay" button in the menu.

| team | colour | faction | ally | start |
|---|---|---|---|---|
| 0 | blue | bra | 0 | NW |
| 1 | red | irn | 1 | SE |
| 2 | yellow | ger | 1 | SW |
| 3 | green | ger | 0 | NE |
| 4 | purple | chn | 0 | W-mid |
| 5 | orange | bra | 1 | E-mid |
| 6 | teal | jpn | 0 | N-mid (56,13) |
| 7 | **white = Nicholas** | bra | 1 | S-mid |

## 1. Timelines: white vs the bots

Army value (k cr), unit count, banked credits ($) and defensive structures (D), sampled from `out/timeline.json`:

| t | blue (A0) | red (A1) | yellow (A1) | green (A0) | purple (A0) | orange (A1) | teal (A0) | **white** |
|---|---|---|---|---|---|---|---|---|
| 2:00 | 2.5k/7u $465 D1 | 1.9k/6u D4 | 3.8k/11u D3 | 3.7k/6u D1 | 3.6k/9u D3 | 3.4k/8u D5 | 2.5k/8u D1 | 1.4k/4u **$3 895** D0 |
| 4:00 | 9.3k/17u | 7.8k/19u | 14.1k/34u | 11.6k/23u | 11.1k/25u | 16.0k/27u | 9.5k/21u | 10.9k/28u |
| 5:00 | 10.4k | 12.8k | 17.4k | 14.4k | 10.7k D19 | 17.2k | 10.9k | 13.8k **$8 144** |
| 6:00 | 6.2k | 12.8k | 7.3k | **1.6k** | 7.5k D22 | 16.2k | **1.3k** | **35.0k/88u** |
| 8:00 | 7.0k $20 | 11.4k $10 | 4.7k $10 | 0.6k | 7.9k D43 | 33.1k/53u $46 | 2.6k $0 | 39.4k/99u **$28 081** |
| 10:00 | 12.6k $12 | 9.8k $2 | 6.5k $0 | 2.8k | 3.1k D47 | 50.9k/76u | 12.1k | 39.4k **$44 888** D32 |
| 12:00 | 15.8k $21 | 13.0k $0 | 11.7k $1 | 0 | 2.2k | 60.9k/95u | 14.8k $0 | 37.6k **$70 918** D102 |
| 14:00 | 13.7k | 17.5k | 2.5k | out | 0 | 65.1k/93u | 13.7k $0 | 39.6k **$84 521** D103 |

Income (cr/min, harvesters h, derricks dk) and **income per harvester** after the derrick share is removed (675 cr/min per derrick):

| | 4:00 | 8:00 | 12:00 |
|---|---|---|---|
| white | 12 168 (8h, 4dk) | 17 552 (8h, 3dk), **1 941/harv** | 16 454 (8h, 2dk), **1 888/harv** |
| orange | 7 384 (6h) | 20 526 (14h, 3dk), 1 322/harv | 19 413 (14h, 3dk) |
| teal | 5 004 (6h) | 8 884 (14h), 635/harv | 12 748 (14h) |
| yellow | 6 638 (7h) | 7 182 (14h), **513/harv** | 5 694 (14h), **407/harv** |
| blue | 4 814 | 6 904 (12h), 519/harv | 7 472 |
| red | 7 698 | 9 914 (12h), 826/harv | 8 581 |

Lifetime mined: white 231k, orange 243k (it sat on 3 derricks and a natural), the other bots 60–130k.

### What white did that no bot does

1. **Economy**
   - 4 engineers onto 4 derricks by 1:05, worth +2 700 cr/min for life. No bot owned a derrick before ~5:00.
   - **5 refineries on 5 different ore fields** around the main, at (55,102), (38,98), (71,98), (64,82) and (45,82), with only 8 harvesters. That is 1–2 per field, so trips are short, which gives about **2× to 4× the income per harvester** of a bot.
   - Bots build 3 refineries and 12–14 harvesters. The 4-per-field cap (`FIELD_CAP`) pushes the extra trucks onto far fields, and they queue at refineries.
   - The refinery limit is tied to command centres, `refinery < 2 + cc` (ai.js lines 50 and 498). A bot that never expands is stuck at 3.
2. **Production:** 8 barracks by 4:57, giving 88 units at 6:00 and about 99 marines from 8:00 (pop capped).
3. **Defence and tech:** 103 defences, mostly walls plus 8 AA guns and 8 turrets. SM-3 by 8:00 and 2 silos.
4. **The hold:** the army held mid (55,53) from 7:26 to 11:35 while credits rose to $70k–112k.
5. **The finish:** attacked purple at 12:33, blue at 13:59 and teal at 15:10. Heavy (Titan) warheads hit teal's base (56,13) at 12:47, then 15:37 and 15:42.

## 2. Per-bot failures, with game times

### All bots: economy
- **Floating zero, under-producing.** Bots bank $0–$50 from 5:00 onward, so they are spending everything. The cause is low income, not hoarding.
- **Not enough refineries:** 3 for 12–14 harvesters, against white's 5 for 8.
- **Late, contested or no expansion.**
  - The CC gate is `time > 195·(1+0.7·cc)`, refinery ≥ 2+cc, factory, and an `aiSpot('cc')`.
  - blue, green and purple **never** built a CC. Red built its first at 14:17.
  - yellow, orange and teal each built one at 4:00–5:00, but `aiSite` sent some of them across the map: teal (N-mid) put its only CC at (29,44), deep west, and orange took red's natural. These are exposed, unsupported CCs, and orange killed teal's at 12:55.
- **Defences capped at 5 + 3·cc for most factions** (`S.defFull`, ai.js line 57; fra 18+6·cc, chn 10+4·cc). Once full, the bot cancels queued defences.
  - Result: blue 11, red 7–8, yellow 12–13, green 6, teal 8–12. Purple (chn) reached 47 because of its cap.
  - Nicholas's "they don't use turrets" is literally the cap.
- **No superweapon play.**
  - The silo needs `t > 600 && cr > 3500 && gas > 600` (ai.js lines 672 and 865, keepBusy line 752). A bot that spends every credit never has $3 500 banked, so **no bot ever built a silo**.
  - **SM-3 is bought only on the non-v71 path**, so Hard/Chief bots never buy it, even after white's warheads at 12:47.

### Ally 0 (blue, green, purple, teal): the enemy team
- **The peace-end clash (5:00–6:00) decided the game.** Ally 0 lost about 30k of army: teal −11.9k, green −9.6k (to 1 unit), purple −6.6k, blue −4.2k.
- By 6:00 white alone had 35k and ally 1 had about 88k, against about 18k for ally 0.
- **Why they never punished the hold (7:26–11:35):** their attack gate was impossible to meet.
  - The formula is `army71 need = max(2800+3t, eArmy·1.15 + dPrior·0.95)`.
  - eArmy is the remembered army of the **whole** enemy alliance: white's 39k marines plus orange's 50k+. dPrior includes white's 103 defences with the fortress factor.
  - So need ran from **86k to 183k** all game while each bot fielded 2–16k. `S.grp` stayed empty: no group attack after 6:00, only harass squads and raids.
  - A correct answer would have been to hit the **weakest enemy base** (yellow had 2.5–7k armies) or to go up in tech. The planner never compares "what's at the target" with "what's at home".
- **Unit mix was narrow and wrong against marines.** At 10:00:
  - blue: 9 marines, 3 riflemen, 2 titans
  - purple: 4 riflemen, 2 AA, 1 artillery
  - teal: 3 AA, 3 rocketeers, 3 riflemen, 2 Raijins
  - Rifles and rockets do 0.37× and 0.17× damage to marines (see section 4). The Raijin, the one Japanese unit that hard-counters marines (zap, chain), was built 1–2 at a time.
  - By 14:00 teal had 12 AA plus 7 interceptors, chasing red's few gunships while white came on foot.
- **Teal: the collapse after the bombing.** See section 2a.
- **Green** was crippled at the peace-end clash, bled refineries from 10:00 and was out by 12:30. **Purple** went down at 12:33–14:00 under white's push. **Blue** fell at 13:59–15:00.

### Ally 1 (Nicholas's allies)
- **Orange stood around.** See section 2b.
- **Yellow (ger)** peaked at 3 kommandos and had 2.5–11.7k of army all game, on 407–540 cr per harvester.
- **Red (irn)** was the only bot with real air (drones, bombers, up to 5 gunships), but it had only 7 defences and no CC until 14:17.
- Nobody followed up white's heavy warhead at 12:47 on teal. Orange's 60k army was not sent to teal's open base; it was already parked at mid.

### 2a. Why teal shut down: the exact code path

1. **11:30 to 12:55:** teal is broke ($0–12) because every credit goes into unit queues. It sits at home with `underAttack = true` and `grp = 0` (46 units, 22.9k at 13:00).
2. **12:55:** orange kills teal's only CC at (29,44).
3. **13:02:** white's Titan warhead (the 12:47 launch) lands on (56,13). It kills the **HQ**, the factory, a barracks, a refinery, 3 power plants and 2 AA guns.
4. **From 13:10 teal has no HQ and no CC.**
   - `sim.js avail(team,t)` requires `hasBuilt(hq) || hasBuilt(cc)` for **every** structure. There is no MCV or deployable yard, so **teal can never build anything again**, including a new CC.
   - This is a hard lockout, not an AI decision: the build menu is empty for a human in the same spot too.
5. `aiStep` keeps running. At ai.js line 23, `hq = hq || cc || any building` falls back to a surviving building, and the bot keeps queueing units from the barracks, factory and airfield it still has.
6. The last refineries die at 13:09 and 13:54. **Income becomes 0.** Gas creeps from 157 to 637, unspendable.
7. Elimination needs **zero KEY buildings** (hq, cc, barracks, factory, airfield, refinery, tech). Teal's leftover barracks and airfield keep it "alive" as a zombie until 15:58.

**Verdict:** Nicholas's "despite money" doesn't match the data. Teal had $0 and no construction yard. The real problems:
- (a) A one-base bot keeps all of its build capability in one HQ that a single heavy warhead can delete.
- (b) The bot never saved $2 200 for an insurance CC, never built SM-3, and never kept a second CC near home.
- (c) The game offers no recovery path: no MCV, no "engineer can found a CC".

Fixes are in plan items 3 and 6.

### 2b. Why orange's army stood around

Orange reached pop 100 at 11:30 with 87–95 units (51–65k), yet it never made a decisive attack. Three things combine:

1. **The "back the human push" behaviour pointed at white's hold position.**
   - `humanPush71` (ai.js line 906) counts a human unit as "pushing" if it is far from its own start (>18 tiles) and within 60 tiles of an enemy start (`fe < oe·1.8`).
   - White's army holding mid (55,53) qualifies: about 47 tiles from home and about 40 from teal's start. With no enemy building within 18 tiles, the target becomes **the position of white's own army**.
   - `army71` then launches orange's idle army to mid "to back the push". The group arrives next to white and waits. The timeline shows orange's plan waypoint at (57,54) the whole hold.
2. **Once a group exists, `army71` launches nothing else** (`if (!peaceOver(P) || S.grp.length) return false`). Because the group never got a fight at mid, it never dissolved.
3. **Orphan bug: units in `S.attackers` but in no squad.**
   - `home = army.filter(u => !S.attackers.has(u.id))` (line 117).
   - The only general cleanup of stale attackers is line 147, and the Chief/SI path **returns at line 145, before line 147 runs**.
   - So any unit that leaves `S.grp` without being removed from `S.attackers` is invisible to every system: not home, not idle, not reinforcement, not defence. Ways in:
     - flank split, where `S.flank = fast` overwrites the old flank
     - harass and raid squads ending
     - units scattered after a fight
     - `defend71` ally help, which adds `pool` to attackers (line 761) and never removes it. This is the main source.
   - The `maxed && idle.length >= 10` escape doesn't help either, because orphans aren't "idle".
   - Measured by the probe (section 2c): from 13:00, **60–67 orange units (40–44k) were orphans, idle in mid-map, with zero fighting**. The main source is `defend71`'s ally-help branch (line 761).

Effect: **Orange had the largest army on the map (65k at 14:00, more than white's 40k) while ally 0 fielded 13–18k in total.** It should have ended the game by 9:00.

### 2c. Orphan probe (probe.js)

Probe run: a read-only aiStep wrapper. It re-simulated cleanly (32/32 hashes) and classified every bot combat unit once a minute.

**Orange (A1), ORPHAN units** (in `S.attackers`, but in no grp, flank, hsq or raid):

| t | ORPHAN | grp | home | orphan value | orphan orders | orphan centroid |
|---|---|---|---|---|---|---|
| 6:00 | 15 | 0 | 15 | 7.1k | 6 idle, 9 amove | (78,37) |
| 8:00 | 16 | 33 | 5 | 8.0k | 12 idle | (80,42) |
| 10:00 | 41 | 33 | 4 | 22.0k | 39 amove | (68,55) |
| 12:00 | 41 | 46 | 9 | 21.8k | **31 idle** | (67,53) |
| 13:00 | **67** | 19 | 6 | **43.8k** | **50 idle** | (65,46) |
| 14:00 | 61 | 31 | 5 | 41.4k | **61 idle, 0 fighting** | (69,45) |
| 15:00 | 60 | 24 | 8 | 40.4k | **60 idle, 0 fighting** | (70,46) |

From 13:00 onward, **about two-thirds of orange's army (40–44k, more than white's entire army) stood idle in the middle of the map as orphans.** The rest was a group parked by the "back the human push" behaviour.

The same bug hit other bots. ORPHAN / total units:
- red: 37/46 at 6:00, 30/35 at 10:00, 27/48 at 15:00
- blue: 20/22 at 9:00, 19/27 at 11:00–14:00
- teal: 13/19 at 11:00

So it also explains why the enemy bots' armies never defended.

**Where orphans come from:** all 756 transitions went **home → ORPHAN** inside a single think cycle, in bulk. Orange's batches were:
- 29 units at 5:06, at home (91,54)
- 16 at 9:14
- 30 at 9:57
- 18 at 11:16
- 53 at 12:22, at mid (52,57)

On the SI/v71 path, the only code that moves a whole home pool into `S.attackers` without putting it in a squad is **`defend71`'s ally-help branch (ai.js line 761)**: `pool.forEach(u => S.attackers.add(u.id)); orderMove(pool, c.x, c.y, true)`.
- Orange is huge, so `sim71 > 1.3` passes every time an ally (white, red, yellow) has intruders.
- The pool walks to the ally's fight and arrives too late or finds nothing. It stays in `S.attackers` forever, because the only generic cleanup (line 147) sits after the Chief path's `return` at line 145.

Smaller contributors, each adding units to attackers with no squad:
- scouts (line 130)
- first-harass raiders (line 136)
- drop teams (line 298)
- red's drones (line 529)
- ally pings (line 566; none in this game)

(This attribution is inferred from batch size, timing and code paths. The probe did not hook individual line numbers.)

## 3. ai.js architecture and its structural limits

`aiStep(P)` runs every `D.think` seconds per bot. It is one long function with several layers:

- **Intel:** known enemy buildings (`S.known`), the eTeam target, `intel71` composition memory (`S.compTot`, `S.mem`).
- **Build:** power emergency, then the CC gate, then the refinery gate, then a fixed order list (`AI_ORDER_SI71`), then `prodTarget71` overrides, then `aiGrowth`. One building at a time.
- **Defence:** the `defFull` cap, `defend71`.
- **Army:**
  - Chief/SI: `chiefArmy` → `army71` (team plan in `G.tp71[ally]`, `launch71`, `rally71`), flank or prong, harass `hsq`, raids, retreat rules, `keepBusy`.
  - Non-chief: the older attack-wave code after line 147.

Structural limits found in this replay:

1. **Membership is spread across 6 overlapping containers** (`S.attackers`, `S.grp`, `S.flank`, `S.hsq`, `S.raid`, `defenders`). They don't own each other, and they are cleaned up in different places, so they leak. There is no single "unit role" field.
2. **One army plan per bot, one plan per alliance.** There is no concept of "main army + defence group + raid group" running at the same time with their own goals. When `S.grp` is non-empty, all strategic thinking stops.
3. **The attack gate is global and absolute.** need is compared against the whole enemy alliance, not against the defenders that can actually reach the target in time. Bots facing a strong human never attack anyone.
4. **The economy is driven by a fixed list, not by goals.**
   - The refinery count is tied to CC count, there is no fields-per-refinery logic, and the harvester target is `refs·2(+refs)`.
   - Expansion is gated by time and `aiSite` nearest-free-site, which can pick a site across the map.
   - Nothing values derricks above about 1 per bot early, though each one is worth 675 cr/min forever (a 400 cr engineer pays back in 36 s).
5. **The defence cap is a constant, not threat-scaled.**
6. **Superweapons are gated on banked cash** (>3 500), which a spend-everything bot never has. Hard skips SM-3 entirely.
7. **Single point of failure:** all construction depends on one HQ or CC, and no bot treats "≥ 2 yards" as a survival goal.
8. **Recovery logic assumes the HQ exists.** `hq` falls back to any building, so the rest of the logic (placement, rally, defence anchor) silently runs around a barracks.

## 4. Unit value: what actually wins, at equal cost

### Field battles
Equal cost, 12 000 cr per side, open ground, attack-move into each other, 2 seeds. Gas is ignored, which flatters gas units. The score is the row army's surviving value % minus the column's.

```
               marines kommandos warhounds    titans     tsars   raijins hound+rkt hound+art rifle+rkt kmd+hound marine+ar  gunships
marines              -       +88       +68       +95       +73       -64       +83       +51       +79       +85       +12       +98
kommandos          -88         -       -53       +24       -48       -91       +33       -57       -68       +36       -83       +73
warhounds          -68       +53         -       -37        -9       -55       -54       +38       -88       +59        +3      -100
titans             -95       -24       +37         -       +39       -22       -20       +65       -89       +45       -52       +69
tsars              -73       +48        +9       -39         -       -51       -43       +50       -91       +57       -21      -100
raijins            +64       +91       +55       +22       +51         -       +61       +67       +38       +80       +78      -100
hound+rkt          -83       -33       +54       +20       +43       -61         -       +16       -91       +18       -58       +64
hound+arty         -51       +57       -38       -65       -50       -67       -16         -        +7       +55       -33      -100
rifle+rkt          -79       +68       +88       +89       +91       -38       +91        -7         -       +79       -79       +97
kmd+hound          -85       -36       -59       -45       -57       -80       -18       -55       -79         -       -63       +40
marine+arty        -12       +83        -3       +52       +21       -78       +58       +33       +79       +63         -       +70
gunships           -98       -73      +100       -69      +100      +100       -64      +100       -97       -40       -70         -
net: marines 6.7, raijins 5.1, rifle+rkt 4.0, marine+arty 3.7, titans -0.5, hound+rkt -1.1, gunships -1.1, tsars -2.5, warhounds -2.6, hound+arty -3.0, kommandos -3.2, kmd+hound -5.4
```

### Assaulting a defended block
3 turrets, a tesla, an AA gun, 3 power plants, a refinery and a factory, attacked with 12 000 cr:

| army | defences dead | all dead | army left |
|---|---|---|---|
| **kommandos** | **10 s** | **18 s** | 90% |
| kmd+hound | 11 s | 20 s | 91% |
| warhounds | 14 s | 26 s | 77% |
| arty | 14 s | 26–29 s | 80% |
| marines | 17 s | 33 s | 85% |
| titans | 20 s | 40 s | 92% |
| tsars | 23 s | 45 s | 96% |
| raijins | 30 s | 62–73 s | 48–79% |

### What the data says
- **Brazil's marine mass is the strongest field army in the game per credit.** It wins every field matchup except Raijins (−64) and is roughly even with marine+arty.
  - Why: the marine has 300 hp and 26 dps for 400 cr, hits ground and air, gets +5% damage per nearby marine, and has the plated rule. Non-counter weapons do 0.17–0.65× damage to it. Only shell, fire, bomb, zap and warhead do full damage.
  - Nicholas's sense that "the marine is fun but not the strongest" is wrong in this version: **it is the strongest**, and the bots don't counter it. Balance belongs to a separate design discussion; the bots must play against it as it is.
- **A German kommando mass loses the open field badly** (−88 vs marines, −53 vs warhounds), but it **razes bases about 1.8× faster than marines** with the fewest losses (kmg ×1.6 vs buildings).
  - So "Germany special mass steamrolls" is true **for bases, not for armies**.
  - The correct German plan: a warhound or marine-killer screen for the field fight, and kommando squads that go around the army into the economy (refineries, power, CC). This doesn't exist in ai.js today.
- **Raijins (jpn) are the marine counter**, +64 against them. Japan should mass them whenever the enemy is infantry-heavy. Teal built 1–2.
- **rifle+rocketeer** is cheap and strong against vehicles and titans (+88/+89) but terrible against marines (−79). That is exactly what red, blue and purple were building.
- **Gunships** crush vehicle and Raijin armies (+100) but die to marines (−98) and AA. Use them only when the enemy has no marines or AA.
- **Artillery** pays off against static defences and blobs, and marine+arty is the best non-Japanese answer to marines.

## 5. Per-faction best plans

These are pure play, with no bonuses.

| faction | opener (0–5 min) | mid-game core | vs a marine mass | tech and finisher |
|---|---|---|---|---|
| **bra** | 2 engineers on derricks by 1:00, 1 refinery per field (4–5), 3–4 barracks by 4:00 | marine mass (the strongest per cr), arty behind | marine + arty, more barracks | silo + SM-3; warheads on production |
| **ger** | derricks, 4 refineries, factory early | warhound + marine/rifle screen; **kommando squads of 6–10 raid the economy** | warhounds + arty; kommandos never fight marines head-on | kommandos to snipe the CC and HQ; silo |
| **jpn** | derricks, 4 refineries | **Raijin mass** (beats marines, warhounds, tsars, rifles); gunships only if the enemy has no marines | Raijins | silo |
| **irn** | derricks | drones and gunships against vehicle armies; ground marine-killers otherwise | shell/zap units + bombers (bomb is a counter type) | silo |
| **chn** | turtle cap 10+4·cc | turrets and gate towers, tesla (zap chain 3 beats marines) | tesla at the choke, arty | silo |
| **fra** | Grand Cannon (fra only, range 15, shell = full damage vs marines) | gcannon line plus a mobile army | gcannons + arty | silo |
| **rus** | tsars are slow and lose to marines | mixed armour + arty | arty, not tsars | silo |

Universal pro habits the bots lack:
- derricks first
- one refinery per field, at most 2 harvesters per field early
- a 2nd base by 4:00 near home, not across the map
- production buildings scaled to income
- a timing attack on the **weakest** enemy when ahead
- never park an army; keep one stockpile of SM-3 money once warheads exist

## 6. Prioritised plan (ranked by impact)

Each item lists the symptom, the replay evidence, the implementation and a verification drill. Drills use `test/` harnesses (vm, seeded, no UI). The budget is **6 full test games**; every other check is a cheap skirmish or unit drill.

### 1. Unit role ownership: unstick and gather armies (fixes orphans and "stood around")
- **Symptom:** big armies idle in the field. Orange had 60–77 idle units at 13:30–15:30 and attackers at 182 vs grp 19–49.
- **Implementation:**
  - Replace the overlapping sets with one `u.role` field: `home | main | flank | hsq | raid | help | drop`, plus `S.squads`.
  - Every think cycle on the Chief path, run a sweep **before** line 145's return. Any live unit whose role container no longer holds it, or that has been idle with no target for more than 8 s outside home radius, is reset to `home` and ordered to the rally point.
  - At minimum, move the line 147 cleanup above line 145 and also delete units that aren't in grp/flank/hsq/raid.
  - Release `help` units after `S.helpT`.
- **Drill:**
  - Re-run `probe.js`-style classification on a bot-only 4v4 (game 1/6). Pass if ORPHAN = 0 at every sample and no bot has more than 10% of its army idle beyond 25 tiles from home for more than 20 s.
  - Re-run this replay's bot side with the patched AI as an unchecked divergent sim. Orange's idle-field count should stay below 5.

### 2. Target the weakest reachable enemy, not the whole alliance (attack gate)
- **Symptom:** ally 0 never group-attacked after 6:00, with need 86k–183k against armies of 2–16k. Orange's 60k never went for the kill either.
- **Implementation:** in `army71`:
  - Compute need **per target**: the defenders' remembered army within 30 tiles of the target + static defence at the target + (reinforcement value of enemies that can arrive within the fight window) × 0.5.
  - Score candidate targets by (myTeamAv − needT) / distance and pick the best, so exposed CCs, the weakest player and a human army's undefended base all qualify.
  - When `maxed && idle ≥ 10`, always attack the best target (maxed armies must trade).
  - Add a **"hold punisher"**: if a human army has sat still at one spot for more than 90 s, target that human's base with ≥ 60% of team army value.
- **Drill:** skirmish setups (no full game).
  - (a) A bot facing 2 enemies, one with 40k and one with 5k, must attack the 5k one within 60 s.
  - (b) A human-style static army parked at mid: the bot team must hit its base within 120 s.

### 3. Economy rework: derricks, one refinery per field, expand near home, more production (also fast re-expansion)
- **Symptom:** bots made 400–900 cr/min per harvester against white's 1 900. No bot had derricks before 5:00. blue, green and purple never expanded. Teal's CC was across the map.
- **Implementation:**
  - (a) An opener with 2–4 engineers to the nearest free derricks before 1:30.
  - (b) Refinery target = the number of unsaturated ore fields within 26 tiles of any own yard (drop the `2+cc` limit). Harvesters = 2 per refinery field (3 for big fields), capped at `FIELD_CAP`.
  - (c) The CC gate keys off income per harvester and saturation, not time.
  - (d) `aiSite` ranks sites by distance from own HQ and safety (own army and towers nearby), and rejects sites closer to enemy starts than to mine.
  - (e) Production buildings scale with income: one barracks or factory per ~2.5k cr/min.
  - (f) **Fast rebuild:** if a CC or refinery dies and the yard still exists, the rebuild jumps to the front of the queue. Keep $2 200 "insurance" banked once income is above 8k/min.
- **Drill:**
  - A 1v1 bot-vs-bot mirror (game 2/6). Pass if, at 8:00, the bot has ≥ 3 derricks, ≥ 5 refineries, 2 CCs, and income per harvester ≥ 1 300.
  - Plus a "nuke the CC at 6:00" scripted skirmish: a new refinery and CC are placed within 45 s.

### 4. Defend own and ally bases with real armies, and scale towers with threat
- **Symptom:** defences were capped at 5+3·cc (7–13 for most bots). Ally help is all-or-nothing (sim > 1.3) and leaks units. Ally 0 bases fell one by one at 12:33, 13:59 and 15:10 with nobody helping.
- **Implementation:**
  - defFull = f(threat): base 6+3·cc, +1 per 2k of remembered enemy army within 40 tiles, up to 24; faction multipliers as now.
  - Place on approach lanes (the chokePoint code exists).
  - Ally help: when an allied base within 45 tiles is under attack and team sim (all allies' home groups) > 0.9, every ally sends its home group with role `help` and returns it afterwards.
- **Drill:** a 2v1 skirmish where the enemy attacks ally B. Ally A's army must arrive within 40 s, and B's HQ must survive.

### 5. Coordinated team attacks
- **Symptom:** after 6:00 only orange ever launched, and it went to the wrong place. `tp71` exists but needs the gate from item 2.
- **Implementation:**
  - The alliance plan picks one target and one rally point 20–25 tiles out.
  - Armies leave staggered so they **arrive together**: each member gets a go-time based on its path distance.
  - The commit rule is sim ≥ 1.2 at the rally point, using all members.
  - Members not ready within 45 s are skipped.
  - When a human ally is pushing, use the human's **attack target** (the nearest enemy building to the human army's anchor or destination), **not the human army's position**, and only if the human is moving toward an enemy (`pushOrd71` anchor), not standing still.
- **Drill:** a 3-bot alliance vs a static 3-bot defence (skirmish). Pass if ≥ 80% of the members' army is within 12 tiles of the target within 10 s of the first contact.

### 6. Superweapon layer: SM-3 when warheads are seen, attack the enemy silo, and Hard builds and uses all 3 warhead types
- **Symptom:** zero silos, warheads or SM-3 by any bot. White's heavy warhead deleted teal's HQ at 13:02 and ended teal.
- **Implementation:**
  - (a) Track `G.events` missile launches, and visible or known enemy silos.
  - (b) SM-3 on HQ and CC (1 800 + 200 gas) **on every path including v71/Hard** as soon as an enemy silo is known or a warhead has been seen, ahead of units.
  - (c) The silo gate changes from "banked > 3 500" to a **savings goal**: after 8:00, or when ahead, reserve money until silo + 500 gas.
  - (d) Warhead use:
    - small (700+200, range 45, 1 100 dmg) on turret clusters before an attack
    - cluster (1 400+450, range 65) on army blobs, especially marine masses (warhead is a counter type)
    - heavy (2 800+1 000, range 200, 5 200 dmg, radius 5) on enemy HQ/CC/factory clusters, timed with the army push
  - (e) An enemy silo becomes the top attack and raid target (kommando drops, gunships, artillery).
- **Drill:** a scripted skirmish where the enemy has a silo. The bot must buy SM-3 within 60 s of seeing it and target it. In a 1v1 Hard (game 3/6), the bot must launch all 3 warhead types by 16:00.

### 7. Counter marine masses (and composition logic in general)
- **Symptom:** bots fought white's 95–99 marines with rifles and rockets (0.37×, 0.17×), titans (0.09×), and AA and interceptors (teal had 12 AA and 7 interceptors at 14:00).
- **Implementation:**
  - Composition targets come from a counter table built from the real damage rules: `damageVs(attackerType, defenderType)` taken straight from sim.js, plus the `matrix.js` results.
  - Against marine share > 40%:
    - jpn: Raijins
    - chn: tesla
    - fra: gcannon and arty
    - all factions: arty + marines/flame + bombers + cluster warheads
  - Never build AA beyond what the enemy's air value justifies (AA value ≤ 1.2 × enemy air value).
- **Drill:** `matrix.js`-style. The bot's chosen composition against a 12k marine blob must keep ≥ 40% of its value (equal cost). A unit test checks that the counter picks per faction match the table.

### 8. Faction signature plans (Germany kommando raids, Japan Raijin, France Grand Cannon line, air and drops)
- **Symptom:** yellow peaked at 3 kommandos, green at 1. There were no helicopter drops or jet strikes worth mentioning and no Grand Cannon lines (no fra bot here). Air was red-only.
- **Implementation:**
  - A per-faction "signature squad" in the role system (item 1).
  - **ger:** 6–10 kommandos with role `raid`, pathing around the enemy army to refineries, power and CC; retreat if marines or warhounds are within 8 tiles.
  - **jpn:** the core is ≥ 50% Raijins.
  - **fra:** gcannon on 2 lanes by 7:00.
  - **all:** helicopter drop of 6–8 infantry onto the enemy refinery line when the enemy army is out of base; jets and bombers on artillery and power when the enemy AA value is low.
- **Drill:** a 1v1 ger-bot vs bra-bot (game 4/6). Kommando raids kill ≥ 3 economic buildings by 12:00, and the kommandos never engage a marine blob head-on.

### 9. Survival and recovery when the yard is lost
- **Symptom:** teal became a zombie from 13:10 to 15:58 with no yard and no income.
- **Implementation (AI):**
  - Always keep ≥ 2 yards (HQ + CC near home) by 8:00.
  - If down to 1 yard and an enemy silo is known, SM-3 first, then a CC.
  - If the HQ dies but a CC lives, re-anchor everything on the CC; `hq` is currently "any building".
  - If no yard exists, sell remaining structures for credits, send all units in one final attack, or regroup at an ally.
- **Optional design change (Nicholas's call):** allow an engineer to found a CC (or sell a factory into an "MCV") so a lost yard isn't permanent for humans either. This is game design, not AI, so flag it rather than doing it silently.
- **Drill:** a skirmish where the bot's HQ is deleted at 8:00 while the CC survives. It must keep building within 10 s. A second variant has both yards deleted: the bot must not idle more than 30 s.

### 10. Replay and test infrastructure
- **Symptom:** the lobby seed is always 1, and the replay doesn't record a seed.
- **Implementation:**
  - A random seed per lobby game, written into the replay.
  - A visible "Save last replay" button reading `ifLastReplay`; auto-save already exists in main.js.
  - Move `probe.js` and `extract.js` into `test/replay-study.js` so every future upload gets the same report in one command.
- **Drill:**
  - Start 2 lobby games and confirm the seeds differ.
  - Download the replay and re-sim it with 32/32 hashes OK (the current replay already does this).

### Test budget (6 full games)

| game | setup | checks |
|---|---|---|
| 1 | 4v4 bots, volcano8 | items 1, 2, 4, 5 |
| 2 | 1v1 mirror bra | item 3 |
| 3 | 1v1 Hard | item 6 |
| 4 | ger vs bra | items 7, 8 |
| 5 | rerun of game 1 after fixes | regression vs the old AI (win rate and income) |
| 6 | spare, or a jpn vs bra marine test | — |

Everything else uses ≤ 120 s skirmishes or unit drills, which cost almost nothing.

### Ordering for tonight
1. Items 1, 2 and 5 together. They share army71 and roles, and they fix both the "stood around" and the "never attacked" bugs.
2. Item 3, the economy: the biggest skill gap in raw numbers.
3. Items 6 and 9, the superweapon and survival layer, which together prevent another "teal".
4. Items 4, 7 and 8.
5. Item 10 is small; do it whenever.
