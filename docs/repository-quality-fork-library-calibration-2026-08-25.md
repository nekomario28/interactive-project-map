# Repository Quality fork/library calibration — 2026-08-25

Status: **frozen real-evidence calibration / project Quality separated from Personal Contribution / no composite scores**

This receipt extends the first application-only calibration to a different artifact family and fork lineage. It compares two current fork snapshots that both route through `artifact:library` but have different observed local-default-branch delta states.

## Cases

| Local repository | Upstream | Category | Default-branch compare |
| --- | --- | --- | --- |
| `nekomario28/gz-sim` | `gazebosim/gz-sim` | `robotics-automation` | 0 ahead / 2 behind / no local-ahead changed files |
| `nekomario28/turing-smart-screen-python-owl` | `mathoudebine/turing-smart-screen-python` | `hardware-embedded` | 3 ahead / 24 behind / local changed files observed |

Both remain `ownership=owned`, `lineage=fork`, and `collaboration=unknown` for personal attribution purposes.

## Project-side Quality evidence

The current `gz-sim` fork snapshot includes a detailed README covering purpose, features, install, usage, documentation and testing paths. Its CMake configuration declares CMake 3.22.1+, project/distribution identity, C++17 and build/dependency behavior. Repository metadata declares Apache-2.0.

The current `turing-smart-screen-python-owl` snapshot includes an explicit local fork section documenting the OWL CPU COOLER DISPLAY target, Rev. C protocol and ImageOnly setup, while retaining the broader library usage documentation. Its requirements file records bounded dependency versions and platform/Python conditions. Repository metadata declares GPL-3.0.

For this calibration each therefore has direct project-side evidence:

```text
understandability  supports
verification       unknown
reproducibility    supports
stewardship        supports
```

Verification stays unknown because this calibration did not execute the projects or validate the README badges as exact-head runtime evidence.

For the current library route, six dimensions are REQUIRED/RECOMMENDED targets, so each case currently has:

```text
target dimensions       6
inspected dimensions    3
directional dimensions  3
```

This is Confidence coverage, not a Quality score.

## Provenance boundary for fork Quality

Current fork contents can provide project-side Quality evidence even when much of that content is inherited from upstream. That answers whether the repository snapshot as delivered contains understandable/reproducible/stewarded material.

It does **not** answer who authored that merit.

The fixture therefore preserves source claims such as inherited/current snapshot documentation separately and never feeds them into direct personal merit.

## Person-side local delta

### `gz-sim`

The bounded comparison:

```text
gazebosim/main...nekomario28/main
```

observed:

```text
state     = observed
presence  = absent
0 commits ahead
2 commits behind
no local-ahead changed files
```

This means only that no local commit delta is observed in that ref comparison. It does not prove no non-default branch, upstreamed PR, review, issue, release, or earlier contribution exists.

### `turing-smart-screen-python-owl`

The bounded comparison:

```text
mathoudebine/main...nekomario28/main
```

observed:

```text
state     = observed
presence  = present
3 commits ahead
24 commits behind
```

The local-ahead delta includes changes in display communication, configuration, requirements, README/theme setup, and workflows. That establishes a real local branch delta but does not by itself quantify contribution merit.

## Cross-case invariant

The two repositories intentionally demonstrate:

```text
similar project-side Quality evidence coverage
              does not imply
similar Personal Contribution evidence
```

The project-side Quality vectors remain independent from fork local-delta evidence. Upstream Stars/Forks and inherited repository merit do not grant direct personal credit.

## What remains unresolved

- collaboration remains unknown for both;
- no Personal Contribution composite exists;
- no Quality composite exists;
- no Confidence composite exists;
- non-default branches and upstreamed contribution channels are not exhausted here;
- no portfolio prominence or tier is produced.

## Next gate

With application originals/contributed work and library forks now covered, the next useful calibration is an artifact family whose Quality contract differs materially, such as dataset/model/research/documentation, before selecting candidate Quality aggregation. If no real portfolio example exists, use a clearly labeled external fixture rather than inventing a fake repository score.
