# nekomario28 public portfolio — semantic evaluation review candidate

> **Status: AI-assisted draft; human review required.**
>
> This file is **not ground truth yet** and must not be used as a release/promotion gate until a person reviews and accepts or edits every repository label. The machine-readable companion is `semantic-evaluation-nekomario28.candidate.json`.

## Scope

The current public-map corpus contains 12 graph-eligible public repositories. The profile repository `nekomario28/nekomario28` is intentionally excluded by the graph builder and is not part of this fixture.

This first draft deliberately prefers a small portfolio taxonomy over implementation-language or loader-specific categories. Forge vs NeoForge, Java vs Python, and similar technologies remain technical facets rather than primary semantic domains.

## Candidate taxonomy

| Stable ID | Candidate label | Meaning | Repositories |
|---|---|---|---:|
| `minecraft-modding` | Minecraft Modding | Minecraft mods, addons, mod libraries, gameplay/server extensions | 7 |
| `robotics` | Robotics & Simulation | Robot applications, ROS/Gazebo integration, navigation/manipulation/simulation | 2 |
| `game-development` | Game Development | Standalone game projects and game-development coursework | 1 |
| `hardware-integration` | Hardware Integration & Monitoring | Software integrating desktop/system telemetry with external display hardware/protocols | 1 |
| `developer-tools` | Developer Tools & Visualization | Tools for developers, repository analysis, generated documentation/visualization | 1 |

Largest candidate category share is `7 / 12 = 58.3%`. That is large because the public portfolio genuinely contains many Minecraft projects, but it is still below the example 70% catch-all warning gate used in the evaluation documentation. Do not split it merely to make the distribution look balanced; split only if human review finds distinct durable portfolio concepts worth preserving.

## Repository review table

| Repository | Candidate category | Evidence summary | Review |
|---|---|---|---|
| `turing-smart-screen-python-owl` | `hardware-integration` | README calls it an OWL CPU cooler display fork and a Python system-monitor / abstraction library for small USB displays, with serial/USB display protocols and hardware sensor output. | ☐ |
| `lime_tidyup` | `robotics` | README describes TurtleBot3 Lime + Jetson + 6-DOF manipulator, Gazebo/RViz, Behavior Trees, Nav2, MoveIt2, camera analysis, grasping and picking. | ☐ |
| `ProjExD_Group10` | `game-development` | README describes “Othello 2.0”, a Python/Pygame competitive board game with board expansion, hazards, skill points and effects. | ☐ |
| `BuyClaimChunks` | `minecraft-modding` | README describes a Minecraft 1.21.1 NeoForge server-side economy addon for FTB Chunks claim capacity. | ☐ |
| `antifullbright` | `minecraft-modding` | README explicitly identifies a Minecraft 1.21.1 / NeoForge mod for dark-mining detection and optional client scanning. | ☐ |
| `FTBPublicClaims` | `minecraft-modding` | README identifies a Minecraft Forge 1.20.1 / FTB Chunks addon for player-created public protected claim areas. | ☐ |
| `recruits` | `minecraft-modding` | README: recruit/command villagers and manage armies; links to the Villager Recruits Minecraft mod. | ☐ |
| `workers` | `minecraft-modding` | README explicitly says it is a Minecraft mod adding Worker Villagers. | ☐ |
| `OffHandCombat` | `minecraft-modding` | README identifies a NeoForge 1.21.1 continuation implementing server-authoritative off-hand combat. | ☐ |
| `sable` | `minecraft-modding` | README identifies Sable as an intrusive Minecraft library mod implementing interactive moving block structures / sub-levels. | ☐ |
| `interactive-project-map` | `developer-tools` | README describes generating static/interactive project maps from GitHub repositories with 12 visualization presets and static-first publishing. | ☐ |
| `ros_gz` | `robotics` | README describes ROS 2 ↔ Gazebo integration packages, bridges, simulation launch support and point-cloud/image transport. | ☐ |

## Review questions

For each row, a human reviewer should answer:

1. Is the primary category the best description of **purpose/domain**, not implementation technology?
2. Would the same category still make sense if the repository changed language/framework?
3. Is a singleton category semantically necessary, or should it merge into a durable broader concept?
4. Is `minecraft-modding` too broad for this portfolio, or does splitting it create artificial/unstable subcategories?
5. Are there public repositories that should be excluded from portfolio evaluation even though they are public and graph-eligible (for example upstream mirrors/forks)?

## Promotion rule

After human review:

1. copy/edit the accepted labels into a non-`candidate` expected fixture;
2. freeze that file as the independent reference for provider comparisons;
3. run `npm run evaluate:semantic` against candidate embedding/taxonomy/adjudicator configurations;
4. compare assigned accuracy **together with** coverage/ambiguity, category balance, churn and call/cache metrics;
5. only then consider promoting `taxonomyAssignment` into `classification/groupId`.

No provider should be selected merely because it reproduces this draft; the human-reviewed fixture, privacy/cost constraints, and stability tests are the actual decision inputs.
