# AI replay study: 2026-10-30, bot 1v1 on volcano8 (si2 vs si2)

Replay: `ironfront-replay-2026-10-30-bot1v1-volcano8.json`. Game v7.6.4, seed 943231385, no fog, 112x112.
- Blue: USA, start 0 (NW).
- Red: Brazil, start 3 (SE).

The master re-sim matched 49/49 state hashes. Red won; blue was eliminated at 1442.5 s.
The same replay was then re-run on hard4c-b code (94d0d88, `nt:1`), which is what has since been merged as d1364e4. Red won again, this time at 1413 s.
Tools, outputs and heatmaps are on the box in `/workspace/r1030/`. Key files: `ex.js`, `probe*.js`, `FINDINGS.txt`, `heat-master.png` and `heat-hard4cb.png`.

Nicholas's complaints:
- Red expanded well, but its army got stuck and struggled to enter blue's base.
- Red never used the ready middle silo.
- Blue was slow, hardly expanded, and never moved its army out.

Note: volcano8 has no neutral silo. The "middle silo" is red's own Warhead Launcher.

## 1. Blue was slow and hardly expanded: safe76 locked up its economy

`safe76` (ai.js:48): `S.safe76 = G.time < 480 && compTot > myArmy*1.2 + 1500`.
While it is true, it does three things:
- blocks new CCs (l.52)
- caps refineries at 2 (l.53)
- stops harvesters at max(4, refs*2) (l.79)

With fog off, `compTot` (the intel71 memory) counts red's whole army. So safe76 was **true for blue the whole time from 150 s to 480 s**. At 480 s, compTot was 58.5k against blue's own army of 26.7k.

| t | blue mined | red mined | blue harv | red harv | blue bases | red bases |
|---|---|---|---|---|---|---|
| 300 s | 30.2k | 43.8k | 10 | 14 | 1 | 2 |
| 480 s | 54.5k | 118.9k | **10 (flat since 270 s)** | 27 | 1 | 4 |

This is a death spiral: falling behind switches off greed, and that keeps blue behind.

Other blue problems:
- It built 6 turrets during peace.
- Its first CC came at 556 s at W-mid (13.5, 56.5), right next to red's parked army. It was killed and rebuilt at 666 s and 827 s.
- Blue's army never attacked. army71's `need` was about 77–91k against `av` of about 27–32k. The army was wiped at about 840 s.

**hard4c-b makes blue worse, not better.**
- Blue built CCs only at 520 s and 600 s.
- Blue's army was 16.8k at 480 s (26.7k on master) and 0 at 840 s.
- Blue had 9 harvesters at 480 s and 6 at 840 s.

er76's unseen-army prior and its "hold under turrets" behaviour add to safe76's passivity. **Neither fix touches the root cause.**

Fix direction:
- Put a time limit on safe76.
- Never let it cap harvesters below saturation, and never let it block the first natural expansion.
- Replace the raw value-ratio trigger with a Lanchester / time-to-arrive check: "can they hit me before my investment pays back?" Red's army was parked about 48 tiles from blue's HQ and never came.

## 2. Red's army got stuck

There were 236 red stuck samples. They come from two separate causes.

### 2a. Two units sealed into a pocket by red's own buildings (88 of the 236 samples)
- heavy#1749 and arty#1801 sat at (81, 101) from 870 s to the end of the game.
- A flood-fill finds a pocket of 148–183 tiles along the south edge, already sealed at 600 s. It is closed off by:
  - a diagonal wall line from (109.5, 97.5) to (104.5, 104.5), whose gates open only into the SE corner
  - the row of factories and power plants from (88.5, 106.5) to (104.5, 107.5)
  - barracks at (84, 102)
- findPath explores about 180 nodes and returns an empty path.
- **This is exactly what nt76/wg76 target. With hard4c-b the pocket is gone.**

### 2b. The main army dithered for about 250 s (A* was fine)
A* is not the problem here:
- Red base to blue HQ: 123–131 tiles, 3.2k–4.8k nodes, under the 8000 cap.
- Red's park point (32, 50) to blue HQ: 48 tiles, 931 nodes.

From 541 s to 790 s, the centroid of red's 96–99 unit group stayed inside x 29.7–43, y 46.7–55.2. Red's army was 64–66k against blue's 27–33k, and only 0–10 units were ever fighting.

Red issued 65 group move orders in that window:
- 35 (54%) targeted blocked tiles. The step-toward-target point is not snapped to a passable tile.
- 11 were stuck-army reissues toward blue's HQ. Each was overwritten about 4 s later by the step logic, which chased blue's rebuilt W-mid CC because `cc` is first in the si pref list.
- Regroup pulled the group back whenever more than 30% of the 99 units were spread beyond 5 + sqrt(n)*0.9 tiles, which added more churn.

Red finally committed at about 799 s and wiped blue's army by 840 s.

On hard4c-b, red's stuck samples move to (16, 40) and (16, 32), about 85 samples / 56 units each from 772 s to 1326 s, just outside blue's main. A probe at 1000 s finds a direct path from there to blue's HQ: 16–20 tiles in 27–45 nodes. So this is **still steering/commit logic, not pathing.**

Red was also at the pop cap from about 8 minutes. It floated 146k credits at 15 min and 520k at 24 min, plus 9.6k gas: income with nothing to spend it on.

## 3. Red's silo was never used (master)

- The silo went up at (109, 103), in the far SE corner, at 757 s.
- At build time warhead76 chose a **cluster** missile (range 65). It was ready at 928.2 s.
- Every blue target was 104–125 tiles away, so the missile was never fired.
- `siloBuild` only builds into an empty silo. The cluster can't be swapped for a Titan (range 200), even with 500k credits and 9.6k gas available. That is a permanent deadlock.

**hard4c-b fixes this one in practice:**
- The silo is placed at (83, 102).
- Heavy missiles were ready at 969.4 s and launched at once at blue's CC (56.5, 13.5).
- A second was ready at 1049.9 s and launched at 1089.9 s at (13.5, 56.5).
- A third was ready at 1170.2 s.

The deadlock is still possible in the code, though. Phase 1 should add: recycle or swap an out-of-range missile, place the silo with target range in mind, and utility-based targeting (see ai-math-plan.md §Silo).

## 4. What hard4c-b fixed and what is still open

| issue | hard4c-b | still to do |
|---|---|---|
| own-building pocket trap | fixed (nt76/wg76) | — |
| silo never fires | fixed in this replay | swap/recycle, range-aware placement, utility targeting |
| main-army dither / no commit | no | commit/contain state, passable step targets, target hysteresis, unstick keeps its target |
| blue safe76 eco freeze | no (er76 worse) | time-limit; never cap harvesters or the first CC; Lanchester/ETA trigger |
| max-pop float | no | spend sink: silo, tech, upgrades, replacement army queue |

Hard must not get weaker: every fix above changes decisions only. No stats and no bonuses.
