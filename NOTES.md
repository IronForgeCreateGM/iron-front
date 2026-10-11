# Iron Front — Architecture notes (v3)

No build step. `index.html` loads classic scripts in order (globals, no ES modules → works from file:// in Safari/Chrome):

| File | Role |
|---|---|
| vendor/three.min.js | Three.js r149 UMD |
| js/data.js | All tuning: damage table, weapons, buildings (BT), units (UT, `alt` = extra producers, e.g. harv from hq), economy constants (ORE_VALUE, HARV_CAP, MINE_RATE, ORE_REGROW) |
| js/sim.js | Deterministic headless sim (`G`): map gen, production, A* (with wall/congestion costs), movement + waypoint queues (`u.wq`), combat, harvesters (reservation, dock queue), per-team fog `G.visT/seenT` |
| js/ai.js | AI using only `visibleTo(team, e)` + remembered buildings (`P.aiS.known`) |
| js/audio.js | WebAudio synth sfx |
| js/gfx/models.js | `MB` model builder: beveled boxes/cyl/etc. merged into one geometry per part with `color` + `pbr`(metal, rough, emissive) attributes; `pbrMaterial()` patches MeshStandardMaterial; `fowPatch()` injects shader fog-of-war; `UNIT_MODELS`/`BLD_MODELS` with pivots (`turret`, `rotor`, `load`, `spin`, `head`, `tip`) |
| js/gfx/terrain.js | heightfield `HF` + `heightAt()`, splat terrain shader, water shader, fog texture, ore instancing, foliage instancing + `clearFoliage()` |
| js/gfx/fx.js | `PSys` instanced billboard particles (ring buffer, shader-side motion), flipbook generator, debris, scorch decals, rings, projectile instancing |
| js/gfx/post.js | HDR render target → bloom chain → final (ACES/grade/vignette/sRGB) → FXAA |
| js/render.js | `R3`: quality presets, env/PMREM, unit InstancedMesh pools (`unitIM`, key `type|team`), building objects, event→fx, camera smoothing, culling rect, picking helpers, portraits |
| js/ui.js | Sidebar/tabs/hotkeys/tooltips/context panel/alerts/minimap/overlay(health bars, waypoints)/input/settings (localStorage `if_settings`) |
| js/main.js | Menu, loop (30 Hz fixed sim, render per rAF), URL modes |

## Conventions
- World tile units; sim (x, y) → three (x, height, y). Units face +x in model space.
- The renderer reads `G` only; sim → renderer communication goes via `G.events` (`fire`, `hit`, `die`, `place`, `ready`, `unit`, `capture`, `attacked`).
- Colors: `ColorManagement.legacyMode=false`; hex colors are converted to linear automatically. The scene renders linear HDR into the post RT; only the final pass does tone mapping and sRGB.
- To add a unit: add `UT` entry in data.js plus `UNIT_MODELS[t](B)` in models.js (body/turret/rotor parts plus `B.piv`). Portraits are generated automatically.

## URL params (testing)
`?autostart=1`, `?demo=SECONDS&zoom=Z&ox=&oy=` (AI vs AI fast-forward, camera on fighting), `?selftest=1`, `?stress=150` (draw-call stress), `?q=low|med|high|ultra`, `?dbg=1`.
Headless: `node test/sim-test.js`; Chrome: `google-chrome --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --virtual-time-budget=4000 --screenshot=... "file://.../index.html?demo=300&q=ultra"`.

## v3.1
- `DIFF` (data.js): `firstAttack`, `waveGap`, `waveInc`, `harassAfter`, `scoutAfter`.
- `UPG`, `UPG_DMG`, `UPG_RNG`, `DEF_RESEARCH` (data.js); `defW(b)` gives the effective upgraded weapon; `upgradeInfo` and `upgradeB` (sim.js); building fields `lvl`, `upT`, `upDur`, `upKind`.
- Formations: `formationSlots`, `orderFormation`, `setStance` (sim.js); unit fields `stance` ('hold'|'aggr'), `guard`, `face`.
- Post uniforms `uExpo`, `uCon`, `uBri`, `uSat` are bound to the Settings sliders (localStorage `if_settings`).
- `?showcase=1` shows a staged scene (upgraded turrets plus a formation).

## v3.2 architecture
- New data: DMG types snipe/fire/bomb/aam; W.ammo (jets), W.spread; UT.heal (medic), UT.jet; BT.airfield; TEAMPAINT (body paint) vs TEAMCOL (accents only); DIFF.chief.
- sim.js: tscore()/acquire() scoring; respond() on damage (src passed through projectiles: p.src, p.est; target.inc = in-flight damage); jetStep() state u.js fly|rtb|landed; medic(); vis0/seen0 + G.spectate for spectator rendering without giving AI vision.
- ai.js: chiefArmy() (group S.grp, staging formation, retreat), AI_ORDER_CHIEF, air strikes block.
- models.js: MB colours 'T' paint, 'TD' dark paint, 'TA' accent, 'TL' accent light. Shader: camo on PBR.PAINT (rough 0.62, units only), buildings use BPAINT; grime + base dirt via vLoc.
- main.js: ?watch=<diff>&seed=N&ff=seconds; ?rec=1 exposes window.__rec(ticks) for frame capture; director() camera.

## v4 architecture
- Players: `G.players[i]` has `{team:i, ally, start, ai, diff, fac, name, out}`. `foe(a,b)` decides hostility. `G.visT/seenT[i]` are shared arrays per alliance. Colours are written into TEAMPAINT/TEAMCOL/MMCOL per game (MODEL_CACHE is cleared).
- Map: genMap builds one 48x48 quadrant and mirrors it with mir(). It sets G.rich, G.bridge, G.forest, G.monument, G.vents, G.starts (4) and G.sites ({x,y,k:main|nat|mid}). Rendering of these is in terrain.js buildLandmarks().
- Lobby: main.js has SLOT_TYPES, PRESETS, buildSlots(), lobbyInit() and lobbyRead(). Use `?preset=coop|wsi|w1|w2|duel` and `&ff=secs&auto=1&nofog=1&cx=&cy=&zoom=` for testing.
- AI: aiGrowth() and aiSite() handle expansions and growth; aiFocus() and aiPing() handle ally cooperation; huntTarget() handles search. siExtras() can be ablated with globalThis.SIOFF flags.
- Events: placed, eliminated, allyAck, popcap. Announcer: announce(text, key, gap) in ui.js. History: G.hist (every 10 s) feeds the end graph.
