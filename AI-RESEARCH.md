# AI research notes (v4.4)

Sources
- SC2 built-in AI script (BaseAI.galaxy): https://github.com/SC2Mapster/SC2GameData/blob/b7587cca570f6a7ce27efa3336a6495d54a71720/mods/core.sc2mod/base.sc2data/TriggerLibs/BaseAI.galaxy
- SC2 difficulty enum (s2client-api): https://blizzard.github.io/s2client-api/sc2__gametypes_8h.html
- Liquipedia, SC2 AI: https://liquipedia.net/starcraft2/Artificial_Intelligence
- ares-sc2 (managers/mediator, squads, influence grids): https://aressc2.github.io/ares-sc2/tutorials/unit_squads_group_behaviors.html , https://aressc2.github.io/ares-sc2/tutorials/influence_and_pathing.html
- sharpy-sc2 (python-sc2 framework, build/act plans): https://github.com/DrInfy/sharpy-sc2
- Steamhammer / FAP combat & retreat simulation: http://satirist.org/ai/starcraft/blog/archives/1069-movement-simulation.html , http://satirist.org/ai/starcraft/blog/archives/599-tactical-analysis.html
- C&C TS/RA2 AITriggerTypes / TeamTypes / ScriptTypes: https://modenc.renegadeprojects.com/AITriggerTypes , https://ra2.projectperfectmod.com/scripttypes/
- AoE2 AI scripting (strategic numbers, rule-based build/attack): https://airef.github.io/

Findings
- SC2: difficulty is a set of feature flags + APM limits, not just numbers. Below Hard: APM limited, no flee/retreat logic, no early-defense scouting; Hard+: FleeDamage, EarlyDefenseScout, extra scouts, hold at idle chokes; Elite: no combat APM limit, no forced split attacks. Only Cheater levels get income (1.2→2.0x) / vision.
- ares/sharpy: hub of managers (build-order runner, production/macro, resource, unit roles, squads) behind a mediator; squads by radius; group behaviours (stutter forward/back); influence grids for safe pathing.
- Steamhammer/FAP: per-squad combat sim decides attack vs regroup; retreat toward static defense; never retreat forward through enemies; merge regrouping clusters near an attacking cluster.
- RA2: trigger (condition) -> team (composition) -> script (ordered actions) with weights that shift on success/failure; good for readable plans.
- AoE2: rule engine + "strategic numbers" (percent of units attacking, gather ratios) as tunable knobs.

Adopted in Iron Front
- DIFF[tier].sys feature flags (SC2-style): sim (combat simulator/retreat), hsq (harass squad), prong (multi-prong flank), choke (defense on the ground path), float/prodMax (spending discipline), close (hunt remaining buildings); plus think (APM), slip (mistakes), sat (worker saturation).
- Lanchester combat sim (dps x hp, incl. powered static defenses & upgrade levels) for engage/retreat of the main squad, flank and harass squads.
- Macro manager: spends surplus over a per-tier float threshold across all producers, upgrades defenses.
- Defense manager: static D on the A* path from HQ toward the enemy (natural choke).
- Closer: pop-capped armies always attack; when no enemy buildings known, sweep starts/expansion sites (no stalling).
