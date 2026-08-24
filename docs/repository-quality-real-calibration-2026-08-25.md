# Repository Quality real calibration — 2026-08-25

Status: **frozen real-evidence calibration / no composite Quality score / no repository ranking**

This receipt applies the experimental Quality evidence vector to three real repositories that all route through `artifact:application`. The purpose is to prove that direct supporting evidence, direct weakening evidence, neutral absence, and uncollected evidence can coexist without turning mechanism presence or repository popularity into a Quality score.

## Calibration cases

| Repository | Context | Direct evidence used |
| --- | --- | --- |
| `nekomario28/interactive-project-map` | `visualization-knowledge` + `application` | README, package metadata + lockfile, exact-head Verify, MIT license metadata |
| `nekomario28/ProjExD_Group10` | `game-development` + `application` | README runtime/game/feature documentation, repository license metadata |
| `c0c25034/ProjExD_4` | `game-development` + `application` | root snapshot, direct Pygame source, repository description/license metadata |

Stars and forks are deliberately absent from this fixture. They remain Impact inputs.

## Expected Quality findings

```text
interactive-project-map
  understandability  supports
  verification       supports
  reproducibility    supports
  stewardship        supports

ProjExD_Group10
  understandability  supports
  verification       unknown
  reproducibility    supports
  stewardship        weakens

c0c25034/ProjExD_4
  understandability  weakens
  verification       unknown
  reproducibility    weakens
  stewardship        weakens
```

These are evidence summaries, not numeric scores or final judgments about the projects.

## Why each finding is bounded

### interactive-project-map

The README directly documents purpose, onboarding, architecture, controls, validation behavior, Action inputs, and development commands. `package.json` declares the supported Node floor and verification commands, while lockfile v3 records dependency resolution. The exact-head Verify run for the finding-direction contract completed successfully, including project tests/validation and twelve-preset rendering comparison. Repository metadata declares MIT.

Those facts support the named outcomes. They do not prove every possible Quality dimension, and they do not create a composite score.

### ProjExD_Group10

The README directly records Python/Pygame requirements, game behavior, controls, implementation notes, explicit feature ownership, and TODOs. That supports Understandability and provides basic Reproducibility evidence.

No repository-native verification run was executed for this calibration, so Verification remains `unknown`; the absence of a CI directory or test suite is not silently converted into failure.

Repository metadata has no declared license. For the Stewardship outcome, that is direct weakening evidence because public reuse terms are unclear. It is not treated as a failure of unrelated dimensions.

### c0c25034/ProjExD_4

The repository has no README and no description. Its root snapshot contains only `fig/` and `musou_kokaton.py`. The source directly imports Pygame, but no dependency manifest or documented install/run requirements are present. Repository metadata also has no declared license.

Those observed absences weaken Understandability, Reproducibility, and Stewardship respectively. Verification remains unknown because the application was not executed or otherwise validated in this calibration.

The source evidence is sufficient to route the repository as `game-development` + `application`, but routing evidence is not itself a positive Quality score.

## What this calibration proves

1. `observed` evidence can support or weaken an outcome; observation alone has no favorable meaning.
2. A well-documented repository can still have unknown Verification when no run was inspected.
3. Missing CI/tests are not universal Quality failures.
4. Missing documentation, dependency declaration, or licensing may be direct weakening evidence only for the outcomes they materially affect.
5. All three repositories can share the same artifact route without using one universal mechanism checklist.
6. Impact counters are unnecessary for this Quality comparison and remain isolated.
7. No total Quality score, rank, tier, or portfolio prominence is justified yet.

## Next gate

The next scoring step should not begin by inventing weights. First expand this calibration to at least one different artifact family and one fork/local-delta case, then define Confidence from evidence class + coverage. Only after those vectors behave sensibly should candidate dimension aggregation be evaluated.
