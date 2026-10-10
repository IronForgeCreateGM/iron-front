# Iron Front – Roadmap

## v1 (done)
Canvas 2D prototype: map, harvesting, 5 buildings, 3 units, A*, basic AI.

## v2 (done)
- **Renderer:** Three.js r149 (UMD, vendored at `vendor/three.min.js`, loads from file://), 2.5D perspective camera with wheel zoom, ACES tone mapping, soft shadows from the sun light.
- **Terrain:** generated height-mapped terrain (grass, cliffs, lakes, ore ground), instanced boulders, trees and ore crystals that shrink as they are mined. Point-symmetric random map with a guaranteed corridor between bases.
- **Models:** units and buildings built from primitive shapes in team colours. Tank turrets rotate and recoil, rotors and radars spin, infantry bob, the harvester's ore load shows.
- **Building animation:** buildings rise with a scaffold when placed and sink when sold.
- **Particles:** muzzle flashes, tracers, rocket/shell trails, explosions, smoke, debris with physics, scorch marks, damaged-building smoke and fire, harvester dust, screen shake.
- **Fog of war:** soft shroud that follows the terrain (explored / visible).
- **Movement:** A* (binary heap, octile, no corner cutting), line-of-sight path smoothing, formation slots facing the move direction, spatial-hash separation, stuck re-pathing, vehicles turning on the spot, aircraft flying straight.
- **Production:** RA2-style queues per category (Structures / Defenses / Infantry / Vehicles / Aircraft). Credits are paid as progress is made, with progress bars; up to 6 units queued; right-click cancels and refunds. Buildings show "ready to place". Low power halves production and shuts off defenses. Rally points, sell (50%), repair (costs credits). Extra producer buildings speed up their queue.
- **Tech tree:** Power → Barracks/Refinery → War Factory → Research Lab → Helipad, Bastion tank, Howler artillery.
- **Units:** Rifleman, Rocketeer, Engineer (captures enemy buildings / fully repairs own), Raider buggy, Lancer light tank, Bastion heavy tank, Howler artillery (minimum range, splash), Skyguard AA, Ore Hauler, Hornet gunship (air).
- **Defenses:** Guard Turret, Flak Battery, Wall.
- **Damage system:** damage types × armour classes (bullet/cannon/rocket/shell/flak vs inf/light/heavy/bldg/air).
- **AI:** build order that rebuilds losses, power management, placement with gaps and refineries near ore, defenses facing the enemy, harvester quota, army that counters the enemy's mix, base defense, scouting, harvester harassment, growing waves, auto-repair. Easy/Normal/Hard change income, think speed, wave size and build speed.
- **Audio:** WebAudio-synthesised sound effects that fade with distance.
- **Screens and controls:** main menu, pause, victory/defeat stats, minimap (left-click pans, right-click orders a move), hotkeys, control groups (Ctrl+1-9; double-tap centers the camera), double-click selects all units of that type.
- **Tests:** `node test/sim-test.js` (headless AI-vs-AI on all difficulties), `index.html?autostart=1&selftest=1` (input smoke test, result shown in the tab title), `index.html?demo=230` (AI-vs-AI fast-forward, used for screenshots).

## Known rough edges
- Units can still bunch up at chokepoints. There is no flow field, and crowds can jam. Harvesters sometimes queue up on the same ore patch.
- When both sides run out of money late in the game (harvesters dead, no credits) the match can stall. The AI should sell buildings or keep money aside for a harvester.
- The AI can see the whole map (no fog for the AI). Gunships have no landing or rearming.
- The models are simple primitives. Cliffs are steep slabs with no proper cliff mesh. Water is a flat plane.
- Rendering and fog are only checked in headless Chrome with software rendering. Safari is not verified yet (the code uses ES2017-level JS and WebGL1/2 through Three.js r149).
- Performance has not been profiled. Each unit is a group of meshes; instancing would help past about 300 units.

## Next steps
1. Flow fields or group pathing plus local avoidance (RVO), so large armies move smoothly through chokepoints.
2. Visual pass: proper cliff and shoreline meshes, an animated water shader, LOD and instanced unit rendering, a post-processing bloom pass (vendor EffectComposer), and nicer building models.
3. A second faction with its own units and tech, plus veterancy.
4. AI: respect fog, retreat damaged units, use transports, have strategic personalities; fix the late-game money stall.
5. Map editor and JSON maps, 2v2 / free-for-all, save/load, a replay of order commands (the sim is deterministic apart from Math.random use in the AI and renderer).
6. Music (generated), voice-like acknowledgement blips, settings menu (volume, scroll speed, key bindings).
