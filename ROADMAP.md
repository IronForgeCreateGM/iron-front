# Iron Front – Roadmap
## Done (v1)
- 64x64 tile map, rocks, 5 ore fields, camera (WASD/arrows/edge scroll), minimap
- Select (click/box), right-click move/attack, building rally points (select building + right-click)
- A* pathfinding (8-dir, no corner cutting, nearest-reachable fallback)
- Harvester loop (ore -> refinery -> credits), power (low power halves production)
- Buildings: Command Yard, Power Plant, Refinery, Barracks, War Factory (needs Refinery)
- Units: Rifleman, Light Tank, Harvester; auto-acquire targets, health bars, tracer shots
- Fog of war (explored + visible), AI: build order, trains army, attacks in growing waves
- Win/lose on Command Yard destruction; headless sim test (`node test.js`)
## Next
1. Unit collision/formation + path smoothing (units overlap; separation is crude)
2. Build queue UI with progress bars, sell/repair, construction time for buildings
3. AI improvements: defend base, rebuild, target harvesters, smarter placement
4. Unit counters (infantry vs armor damage types), more units, defensive turret
5. Sound, explosions/particles, sprite art, map editor / more maps, save/load
