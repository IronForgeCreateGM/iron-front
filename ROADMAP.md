# Iron Front — Roadmap

## Done
### v1 – Canvas prototype (map, harvesting, A*, AI waves)
### v2 – Three.js 2.5D, tech tree, 10 units, counters, AI difficulty, audio, groups
### v3 – Graphics + QoL + economy
- **Rendering**: PBR (MeshStandard + per-vertex metal/rough/emissive), PMREM image-based lighting from a procedural sky, tuned PCF soft shadows that follow the camera (snapped to texels), exp fog/atmosphere.
- **Custom HDR post pipeline** (no ES modules): HalfFloat scene RT (MSAA x4 on High/Ultra) → 3-level bloom → ACES → lift/gain grading + saturation → vignette → FXAA (Medium).
- **Models**: every unit and building rebuilt from beveled, merged procedural parts, with team paint, glowing lights, windows, antennas, and animated parts (radar dishes, rotors, harvester drum, visible ore load, turret recoil, blinking lights). The sidebar and info-panel portraits are real 3D renders of these models.
- **Terrain**: a 4x-resolution smoothed heightfield (smooth cliffs and shores), a shader splat (grass/dirt/rock/sand with procedural noise, bump detail, strata) and vertex cavity AO. Water uses an animated normal shader with fresnel sky reflection, sun glints, depth color and shoreline foam. Grass tufts (up to 30k) and pines are instanced and sway in the wind, with displaced boulders. Fog of war is applied inside every shader.
- **FX**: GPU instanced billboard particles with a procedural 16-frame smoke flipbook (smoke, fire, sparks), instanced debris with physics, scorch decals, shockwave rings, glowing tracers, shells and rockets, camera shake.
- **Performance**: units are drawn with InstancedMesh per type, team and part (150 units ≈ 36 draw calls in the stress test). Also: manual view-rect culling, pooled particles/debris/decals/markers, capped pixel ratio, Low/Med/High/Ultra presets with GPU auto-detect and automatic downgrade when FPS < 38, and an FPS/draw-call overlay (F).
- **QoL**: selecting a building switches the tab automatically. The Command Yard can build Ore Haulers. Selected buildings show build buttons in the context panel. Hotkeys (T Y U I O J K) appear on the buttons. Tooltips show cost, stats and strong/weak matchups. Shift-click queues 5; right-click cancels (shift = 5). The info panel has a 3D portrait. Alerts cover idle harvesters (.), idle army (,) and attacks (with minimap ping). Other additions: smooth damped camera, middle-drag pan, edge-pan speed setting, shift waypoints for move and attack-move with path lines, a health-bar mode setting, hover rings, and a settings panel.
- **Economy**: 4.5x ore per tile, ore regrows (faster on live tiles), harvesters carry 1500 with a visible load, a dock queue at refineries, and tile reservation plus spreading penalties.
- **v2 fixes**: wall-adjacent and congestion costs in A*, crowd-arrival logic and an escalating sidestep (fewer chokepoint jams). The AI now only sees what its own fog reveals (it remembers buildings it has seen and scouts the enemy start). The AI also keeps harvesters stocked and sells non-essential structures when broke (no late-game stall).

### v3.1 – Feedback pass
- Punchier grading: lower exposure (0.8), contrast 1.15, saturation 1.22, deeper shadows (less fill light and env light, stronger cavity AO), heavier vignette. Brightness, contrast and saturation sliders in Settings.
- **Easy AI really is easy now:**
  - No attacks or scouting before about 9.5 min, and no harvester raids before 18 min.
  - First wave is 3 units, growing by 1 per wave up to 7, with 150 s gaps.
  - 55% income and 60% build speed.
  - The test `test/sim-test.js` asserts that Easy's first attack, and the first damage to a passive human, happen at 8 min or later (3 seeds).
- Defense upgrades: Guard Turret and Flak Battery go up to level 3 (+35% / +75% damage, +1 / +2 range, costs $450 / $800, 15 s / 25 s). Each level changes the look (bigger head, rank chevrons, armor collar, glowing ring). A range ring appears when selected, hovered or placing. The Research Lab offers "Hardened Defenses" (+15% damage, +0.5 range, +25% HP for all defenses). Upgrade button and hotkey Z, with tooltips. Normal/Hard AI also upgrades its defenses when rich.
- Defensive Formation (G; Shift+G = in front of base): armor in front, infantry/air in the middle, artillery/AA at the back, facing the nearest visible enemy (or the enemy start), units set to hold stance. Stance toggle (V): Aggressive chases; Hold engages in range, then returns to its spot and faces the guard direction.

## Rough edges
- Formation slots ignore cliffs (a blocked slot snaps to the nearest free tile). Hold-stance units still pursue up to 1.5 tiles past their weapon range.
- On Easy, the AI may sit on a large army before the first attack, but waves are capped at wave size + 2 units.
- Real GPU performance can't be measured headless (SwiftShader). Draw calls are low, but the terrain fragment shader is noise-heavy; auto-quality is the safety net.
- No SSAO; it's faked with contact-shadow blobs, building AO decals and vertex cavity AO. There is no mesh LOD (instancing made it unnecessary at 150 units).
- Smoke quads can clip into the ground (no soft particles). Explosions are good but not film-grade.
- Units still overlap a bit in big crowds. Jams are reduced, not eliminated.
- Gunships have no proper landing/rearm. There are no walls in the UI, and engineers only capture.

## Next steps
1. A second faction with unique units and superweapon(s), plus a skirmish map selection/generator.
2. Soft particles + depth-based SSAO (needs a depth pre-pass), GPU-timer-driven dynamic resolution.
3. Flow-field pathing for large groups; formations with facing; unit veterancy.
4. Campaign/mission scripting, save/load, replays; better AI build-order personalities.
