# Profile Galaxy expansion proposal

Status: **review document, 2026-10-11** — answers the 2026-08-22 expansion prompt
(`Interactive Project Map - Profile Galaxy 拡張プロンプト（追記版）.md`) against the
current shipped architecture and the research-decision-ledger's dormant gates.
Nothing in this document is queued work by itself; adoption requires the normal
roadmap evidence gate.

## 1. Current Profile Galaxy summary

The layered product already exists and is deployed:

- **README layer:** generated animated SVG (Galaxy Classic / Systems / Hybrid
  presets) embedded in the profile README, with automatic framing (`v1`,
  2026-10-04), dark and light palettes, and an embedded legend.
- **Interactive layer:** GitHub Pages viewer with twelve 2D styles plus the 3D
  Lab (Cosmic / Galaxy / Aurora / Wireframe). Galaxy 3D is the moving flagship:
  owner at the nucleus, category systems on 2–4 trailing logarithmic arms,
  co-rotating disc, elliptical local repository orbits, Contributed on external
  lanes, procedural arm-aware disc haze, no persistent graph lines.
- **Semantics layer:** strict Contributed admission, shared status
  (original/fork/archived/contributed), search context, category navigation,
  Local Graph, transferable URL state.

Coverage of the prompt's candidate visual language:

| Prompt element | Status |
|---|---|
| repo = planet | shipped (star-scaled spheres) |
| language = color | shipped (owned repos color-hash on language) |
| stars = planet size | shipped (bounded `log2` scale) |
| same tech = cluster | shipped (category systems / arms) |
| archived = dark planet | shipped (dimmed + reduced opacity) |
| owner = SYSTEM CORE | shipped (nucleus + glow-dominant bulge) |
| topics = satellites | data present (18/node, searchable), not rendered |
| commit activity = glow | **not shipped — dormant overlay** |
| relations = glowing edges | **deliberately not shipped — no-persistent-lines contract; Local Graph is the bounded focus-based form** |
| recent activity = pulse | partial: a uniform breathing pulse exists, not activity-driven → dormant |
| main project = large planet | implicit via stars; no curated featured flag |

Weak points relative to the stated goal
(「何を作っている人か」を数秒で伝える):

- The owner nucleus carries only the username — no role/tagline/bio exists in
  the data pipeline at all.
- Topic data flows through search but has no visual representation.
- The README→Pages path exists but the click-through affordance is whatever the
  profile owner writes around the embed; the SVG itself is not a link.
- "Main projects" are inferred from stars, not curated.

## 2. Missing-element candidates

Evaluated on the prompt's axes: what it represents / why it is valuable /
README-SVG fit / interactive fit / cost / information-density effect / world
contribution / verdict. Verdicts route through ledger reopen conditions, not
enthusiasm.

| # | Element | Represents | Value | README | Interactive | Cost | Density | World | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| M1 | Owner tagline / role on nucleus | builder identity | directly serves the "who am I in seconds" goal | label under owner | details panel + label | medium (new user-profile fetch) | low | high | **P1** — needs profile-bio fetch added to the census pipeline; smallest identity win |
| M2 | Featured / pinned repositories | curated "main projects" | answers "what matters" faster than raw stars | halo or ring marker | featured lane/emphasis | medium (needs a curation source: pinned repos or config) | low | medium | **P1** — real value if sourcing is honest; pin data requires an authenticated GraphQL field, so verify availability first |
| M3 | Topic satellites / ring | topic metadata already shipped | uses data we already have | not fit (clutter) | bounded ring on focus | medium-high | medium-high | medium | **P2** — only as bounded focus presentation; always-on satellites would recreate the rejected clutter |
| M4 | Activity-driven glow / pulse | commit recency | fresh-life signal | animated glow (SVG supports it) | pulse amplitude | medium | medium | medium | **Not now** — ledger DORMANT (activity/freshness overlays); reopen on concrete comprehension evidence |
| M5 | Multi-type relations | dependency/domain/lineage | richer semantics | no | focus-contextual only | high | high | medium | **Not now** — persistent chords rejected; focused relations DORMANT pending a concrete navigation case |
| M6 | Time axis (generation/evolution) | project history | narrative depth | no | existing Timeline 2D style covers a form of this | — | — | — | **Adopted elsewhere** — the twelve-style axis already ships a Timeline preset; a Galaxy-time variant stays dormant |
| M7 | Legend / reading key in interactive viewer | visual language literacy | helps first-time viewers decode color/size | n/a (SVG has legend) | small overlay | low | low | medium | **P1** — cheap gap: SVG ships a legend, the Pages viewer does not |
| M8 | Stats strip / badges in README | compact numbers (repo count, top language) | reinforces the "stats" readers expect | strip under SVG | n/a | low | low | low | **P2** — nice-to-have; must not become a generic stats card clone |
| M9 | Curated grouping (main/side/infra lanes) | portfolio narrative | stronger story than raw categories | possible via config | lane separation | medium-high | medium | high | **P2** — requires a curated metadata source; taxonomy override mechanism partially exists |
| M10 | Avatar integration on nucleus | identity literalness | humanizes the core | possible | mesh label | medium | low | medium | **Not now** — avatar fetch/embed adds a binary asset path for small gain |
| M11 | Light/dark adaptive variants | embed context matching | README polish | shipped for 2D SVG palettes already | theme switch exists in 2D | — | — | — | **Mostly shipped** — SVG renders both palettes; remaining gap is selection plumbing, not palette work |
| M12 | Organization / multi-profile map | orgs & teams | expands product scope | no | new mode | high | n/a | medium | **Future** — deferred to the future-version section |
| M13 | Contribution-intensity field | activity heat | overlaps M4 | no | dormant | high | high | medium | **Not now** — same dormant gate as M4 |
| M14 | Click-through affordance inside SVG | conversion to interactive | serves the two-layer design | caption/link hint text | n/a | low | low | low | **P1** — `<a>` wrapping works in most README renderers; verify GitHub sanitization first |

### Notes on scope-excluded items

The prompt's A-section role taxonomy (main/side/experimental/solo/public-face)
maps onto either already-shipped semantics (original/fork/archived/contributed)
or curated metadata (M9) rather than new visual channels. The B-section
relation taxonomy is deliberately bounded to the canonical semantic graph plus
bounded focus presentation — see the ledger's no-persistent-lines contract.

## 3. Priorities

- **P0:** none. The core visual language the prompt describes is already
  shipped; adding elements is not the goal. Any P1 below still needs the normal
  evidence gate before it becomes work.
- **P1:** M1 owner tagline, M2 featured/pinned repos (pending data-source
  check), M7 interactive legend, M14 SVG click-through affordance.
- **P2:** M3 bounded topic satellites, M8 stats strip, M9 curated grouping.
- **Not now (dormant — reopen conditions apply):** M4 activity glow, M5
  multi-type relations, M13 intensity field, M10 avatar, M6 Galaxy-time variant.
- **Future:** M12 organization/multi-profile.

## 4. MVP

The shipped product already exceeds the minimal Profile Galaxy definition. The
MVP bar — "open the profile, understand in seconds what this person builds,
want to click through" — is met by: animated framed SVG with legend, owner
nucleus, category-structured galaxy, and the Pages interactive viewer.

If the P1 batch were adopted, the "MVP+" would add exactly three things:

1. owner tagline (M1) — one line of identity at the core;
2. interactive legend (M7) — decode the visual language without leaving;
3. featured repos (M2) — curated "what to look at first".

Everything else waits for evidence.

## 5. Future version

Ordered by increasing scope:

- bounded topic/technology presentation on focus (M3);
- curated portfolio grouping once a metadata source is chosen (M9, M8);
- activity/freshness presentation **if and only if** real comprehension
  evidence reopens the dormant gate (M4, M13) — never as always-on chords or
  ambient noise;
- organization / multi-profile galaxies (M12), including collaboration maps —
  a product decision, not an increment.
