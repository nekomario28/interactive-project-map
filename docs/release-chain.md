# Project Map release chain

Status: **Accepted** (2026-08-22)

Project Map has two independent release targets. Treating them as one is a correctness bug.

## 1. Outer reusable-workflow release

Consumers normally call:

```yaml
uses: nekomario28/interactive-project-map/.github/workflows/generate-project-map.yml@v1
```

`v1` identifies the reviewed reusable workflow. Advanced consumers may replace `v1` with a full workflow commit SHA. This outer ref selects the workflow definition, its inputs, permissions, artifact handoff, and the inner Action pin stored in that workflow.

## 2. Inner Action release

Inside the reusable workflow, generation is intentionally immutable:

```yaml
uses: nekomario28/interactive-project-map@<40-character Action SHA>
```

That SHA selects the actual `action.yml` plus generator implementation. Moving `v1` does **not** change this SHA. Therefore a feature can be present on `main` and even in the reusable workflow source while production profiles still execute an older Action if the inner pin was not advanced.

The reviewed **main candidate** inner SHA is mirrored in `src/action-ref.ts` and `scripts/postprocess-public-pages.mjs`. Those values do **not** identify the Action currently executed by the independently moving stable `v1` branch. Pages and Worker setup output therefore avoid claiming that the current candidate Action runs on `@v1`. `tests/release-chain.test.mjs` catches main-chain drift, while `scripts/audit-release-channel.mjs` resolves the actual `refs/heads/v1` and its inner Action through the GitHub API.

## Audit the actual stable branch

`v1` is a **release branch**, not a Git tag. An Action SHA in `main` or generated setup comments is not evidence that `v1` executes it.

Use `GH_TOKEN=<read-only token> node scripts/audit-release-channel.mjs` to print a JSON report containing the exact current `v1` branch SHA, its nested Action SHA, the main candidate's Action SHA, and differences. Use `--require-current` only after the stable branch has deliberately been promoted to the exact candidate SHA; that mode fails closed on any difference. The manual GitHub Actions **Audit stable v1 release channel** workflow saves this report as an artifact.

## Promotion protocol

For a feature release, name the final implementation commit **F** and the later reusable-workflow release commit **R**.

1. Finish the feature on `main` and run the feature-specific/full gates required for that risk level. Do not move `v1`.
2. For data-boundary features, run the real-profile/privacy proof directly against **F** (or another exact implementation SHA) so the proof cannot accidentally execute the old inner pin.
3. Update the reusable workflow's **inner Action pin** to **F**. Update the two public installer metadata mirrors to the same SHA. The commit containing those release-chain edits becomes **R** after its gates pass.
4. Validate an exact caller of the reusable workflow at **R** and prove that it resolves the inner Action at **F** and emits the intended artifact.
5. Review the compatibility and rollback plan for every existing `@v1` caller. Only then move the **release branch `v1` → R** (never force-update it ahead of verification). Immediately run `node scripts/audit-release-channel.mjs --require-current` at R to confirm exact equality.
6. Run the canonical production profile workflow through `@v1` and verify the generated `graph.json` / SVG. A `v1` move without the inner-pin proof is not a release.

This ordering intentionally avoids a cycle: the inner Action points to the already-reviewed implementation commit F; the outer reusable workflow points to that Action and is released later as R.

## Contributed release acceptance

The Contributed feature is not complete merely when schema/UI code reaches `main`. Before `v1` promotion it must prove, in order:

- ranking policy;
- graph schema and privacy invariants;
- generator inclusion;
- all 12 preset semantics;
- a real-profile public-only privacy proof against the exact implementation SHA;
- inner Action pin advancement to that implementation SHA;
- exact reusable-workflow proof;
- `v1` promotion and canonical profile regeneration.

If the canonical profile map does not contain an eligible Contributed repository after the final `@v1` run, the release is RED even when repository CI is green.
