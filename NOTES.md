# Iron Front – Architecture Notes

No build step and no ES modules. Plain `<script>` tags share globals, so opening `index.html` from file:// works in Safari and Chrome.

| File | Role |
|---|---|
| `vendor/three.min.js` | Three.js r149 UMD (the last line of releases that ships `build/three.min.js`). MIT. |
| `js/data.js` | All tuning tables: `DMG` (damage-type × armour), `W` weapons, `BT` buildings, `UT` units, `DIFF` difficulty. **Add content here first.** |
| `js/sim.js` | Deterministic-ish simulation and the global `G` (no DOM): map generation, entities, production, A*, orders, combat and projectiles, harvesters, fog. `stepGame()` = one 30 Hz tick. |
| `js/ai.js` | `aiStep(P)` is called each tick and throttled by `DIFF.think`. It only uses the same API the player uses (enqueue / placeReady / orderMove / orderAttack). |
| `js/render.js` | Three.js scene. `r3Render(dt)` syncs meshes with `G.ents` (map id→object), consumes `G.events` for effects and sound, updates fog DataTexture, ore instances, camera. |
| `js/ui.js` | Sidebar, icons (procedural canvas → dataURL), minimap, 2D overlay (health bars, selection box, rally lines), mouse/keyboard input. |
| `js/audio.js` | `sfx(name, x, y)`: synthesised WebAudio sounds, rate-limited and faded with distance. |
| `js/main.js` | Menu, pause, fixed-timestep loop (accumulator, max 6 steps per frame), demo/selftest URL modes, error banner (`#err`). |
| `test/sim-test.js` | Loads data, sim and ai into node with `vm` and runs AI-vs-AI games. |

## Conventions
- World units are **tiles**. Sim `(x, y)` maps to Three.js `(x, height, y)`. The sim angle `ang` maps to mesh `rotation.y = -ang`.
- Entities: `kind: 'b'` buildings (`tx, ty, w, h`, centre `x, y`), `kind: 'u'` units (`x, y, z` for altitude). `team` 0 is the human player, 1 is the AI.
- Units have `order` (idle / move / amove / attack / capture), `path` (smoothed waypoints), `tgt`, `anchor` (leash point for idle units), `ang` (body), `tang` (turret).
- The block grid is cached and rebuilt when `G.bver` changes (it is bumped whenever a building is added, removed or captured).
- The sim pushes events to `G.events` (`fire`, `hit`, `die`, `place`, `ready`, `unit`, `sell`, `capture`). The renderer drains them each frame; headless code must clear them.
- Production items are `{t, prog 0..1, paid}`. The cost is deducted gradually. Buildings go to `P.ready[cat]` until placed.
- Colours: `THREE.ColorManagement.legacyMode = false` and sRGB output. Vertex colours are converted to linear by hand.
