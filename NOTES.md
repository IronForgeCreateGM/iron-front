# Architecture
- `index.html`: canvas + sidebar. `game.js`: everything (no build step). `test.js`: node headless sim.
- Data tables `BT` (buildings) and `UT` (units) drive stats/costs. Add content there.
- State globals: `map` (0 grass/1 rock), `ore` (amount per tile), `ents` (buildings have `b:1`, tile coords tx/ty/w/h; units have pixel x/y), `players[team]` {cr,pow,ai}.
- `step()` = one sim tick (60/s via rAF): production queues (`b.q`), unit AI (target acquire, fire, move along `path`), harvester state machine (`harvest`: idle/toOre/mine/ret), cleanup, win check, `ai(1)` every 60 ticks, fog every 10.
- `astar()` rebuilds a blocking grid each call (fine at 64x64; cache if it gets slow).
- Rendering/input only run when `document` exists, so `game.js` is `require`-able from node (exports init/step/etc.).
- Team 0 = human (blue), 1 = AI (red).
