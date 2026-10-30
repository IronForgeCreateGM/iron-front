# Base-layout study: how Nicholas builds (for Hard AI 4c)

Source: two replays from 2026-10-29, re-simulated with `tools/layout/layout.js` (both replay cleanly:
A 32 hash checks / 0 bad, B 36 / 0 bad), summarised by `tools/layout/analyze.js`.
Angles are measured at the nearest own base, 0° = towards the nearest enemy start, so "front" = |angle| < 60°,
"back" = |angle| > 120°. Distances are in tiles.

| | Replay A | Replay B |
|---|---|---|
| Match | 4v4 `volcano8`, Nicholas slot 7 (Brazil), all bots `si` | 1v3 `frost`, Nicholas slot 0 (Brazil) vs 3 `si` |
| Base | middle-ish, enemies from several sides, nearest foe start 61 tiles | corner, every enemy in one direction, nearest foe 90 tiles |
| Window | whole game (victory at 16:00) | first 18 min of 28 |
| Buildings logged | 144 (89 walls) | 151 (75 walls) |

## 1. Production core stays tight around the HQ
- Barracks: median 4.5 tiles from the HQ in A (all 8 within 2.5–5.7); 10.5 in B (later batches at 2.5–8.7).
- Factory 7–8 tiles out, tech 8–15. Silos 4 tiles out.
- In B he builds 11 extra barracks in one minute (16:00–16:59), still packed next to the HQ.
- Bot today: similar (aiSpot rings). Fine as is.

## 2. Early AA screen, spread out, before any ground defence
- A: 6 AA guns in 11 seconds (2:06–2:17), all about 11 tiles from the HQ.
  - Angles 157, -65, 124, -34, 8 and 79 degrees: an even ring roughly 60 degrees apart.
- B: 9 AA guns between 3:30 and 3:55 at 16–24 tiles.
  - They form an arc from -85 to +70 degrees, facing the enemy side.
- AA comes 3–6 minutes before the first turret or wall.

## 3. Economy at the edge, refineries on the ore
- Refineries sit about 2 tiles from ore at 16–18 tiles out (A) and up to 34–37 tiles out (B).
- In B he pushes the economy forward, towards the enemy:
  - New refineries at 4:11, 5:02 and 12:08, each with power plants next to them.
- Power plants go mostly to the sides and back (A median |angle| 104°).
  - In B they follow the forward refineries.

## 4. Turrets come in tight lines across the approach path
- A at 8:24–8:40: two lines of 4 turrets, one tile apart, each placed within 1–2 seconds.
  - Both lines sit about 17 tiles out, at 19–28° and 59–69°, 3–9 tiles from the HQ→enemy path.
- B at 5:24–5:29: a line of 5 turrets at 24–26 tiles, crossing the HQ→enemy path at -34 to +13°.
  - Later pairs and fours go out at 34–40 tiles to cover the forward refineries.
- Tesla coils come later (A 10:43) on the same front, about 17 tiles out.

## 5. Walls go up after the towers, far out, with NO gates
- Neither game has a single gate. He walls in long segments and leaves gaps or cliffs open.
- A, 9:43–12:00: 89 pieces in 17 runs, forming a partial ring 15–25 tiles out (median 20).
  - The ring covers about 240° (from -75 to 165 degrees). The back is cliffs.
  - It sits outside the refineries (16–18) and the turret lines (17). The whole economy is inside.
- B, 5:14: a perpendicular 8-piece wall line 25 tiles out, crossing the HQ→enemy path. Turrets go in behind it 10 seconds later.
  - Later lines at 33–42 tiles shield the forward refineries. All 75 pieces are on the front side.
  - 22 pieces were destroyed and rebuilt (13:59–15:21).
- The bot's `baseEntrances()` puts the "entrances" only about 9 tiles from the HQ in both maps.
  - The human's defence perimeter is 2–4 times further out.

## What this means for the Hard AI (4c), in order of payoff
1. **Defence line distance.** Anchor walls and turrets at max(outermost own refinery + 3, ~17) along the HQ→enemy path, not at the 9-tile entrance. Everything worth protecting should be inside.
2. **Turret lines.** Place 4 (later 5) turrets one tile apart across the approach path, then wall in front of them.
3. **AA ring early.** Around 2–4 min, build AA spread evenly around the HQ at 11–20 tiles (an arc towards the enemy when the base is in a corner).
4. **Walls with gaps instead of gates.** Long segments that leave gaps or use cliffs. The no-trap check (Part B step 2) already guarantees every barracks, factory and refinery keeps a path out.
5. **Forward economy when the base is cornered.** Expand refineries towards the enemy and cover them with the outer line.

No bonuses are involved: all of this is placement. Resources and unit stats stay untouched.
