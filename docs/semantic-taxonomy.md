# Portfolio Taxonomy State (P3A)

P3A adds a provider-neutral, frozen portfolio taxonomy layer on top of the P1/P2 semantic pipeline.

The invariant remains:

> repository = semantic node; taxonomy/category/language/status = facets; AI runs only at generation time.

## Files

Generation may use two files under the configured `output_dir` (normally `project-map/`):

- `taxonomy.json` — generated freeze state. The Action owns this file.
- `taxonomy-overrides.json` — optional human-authored authoritative schema. The Action reads but never rewrites this file.

Normal browser viewers do not call a taxonomy provider.

## `taxonomy.json`

A frozen taxonomy stores:

- taxonomy schema version;
- corpus fingerprint;
- discovery-time per-repository semantic content fingerprints;
- stable category IDs, editable labels/descriptions/aliases;
- discovery provider/model identity.

Repository fingerprints are hashes of normalized `RepoSemanticDocument` content. Raw README text is not stored in the taxonomy state.

The discovery snapshot intentionally remains the baseline when a small corpus change is tolerated. This prevents repeated small edits from silently moving the baseline and bypassing the drift threshold.

## Reuse policy

Default maximum drift ratio: `0.15`.

Given a valid previous `taxonomy.json`:

1. identical corpus fingerprint → reuse without provider call;
2. changed repository ratio `<= 0.15` → reuse the frozen taxonomy without provider call;
3. larger drift → discovery is eligible;
4. explicit force refresh → discovery is eligible even for an identical corpus;
5. disabled/failing provider → preserve the previous taxonomy instead of destroying it.

The drift ratio is measured against the original discovery snapshot, not the most recently observed small-drift corpus.

## Human override

`taxonomy-overrides.json` version 1 can provide a complete authoritative category schema:

```json
{
  "version": 1,
  "categories": [
    {
      "id": "robotics",
      "label": "Robotics",
      "description": "Robot simulation, control, navigation, manipulation, and sim-to-real projects",
      "aliases": ["ROS2", "Gazebo", "Isaac"]
    },
    {
      "id": "ai-ml",
      "label": "AI / Machine Learning",
      "description": "Model training, inference, agents, evaluation, and machine-learning research",
      "aliases": ["LLM", "PyTorch", "Transformers"]
    }
  ]
}
```

When `categories` is present:

- it is authoritative;
- discovery provider is not called;
- category IDs are validated and normalized;
- the current corpus becomes the new freeze baseline;
- the override file itself is never modified by the Action.

A future provider-enabled setup may also use:

```json
{
  "version": 1,
  "forceRediscovery": true
}
```

`forceRediscovery` never makes a disabled provider mandatory. If no provider is configured, an existing frozen taxonomy is preserved.

## Category validation

P3A enforces:

- 1–16 categories;
- stable lowercase IDs using letters, numbers, and `-`;
- unique IDs;
- non-empty label and description;
- at most 32 normalized aliases per category;
- parent IDs must exist;
- self-parenting and parent cycles are rejected.

Stable IDs are deliberately separated from labels. Future taxonomy discovery must not derive category identity from presentation text on every refresh.

## Discovery provider boundary

P3A defines a provider-neutral boundary:

```ts
interface TaxonomyDiscoveryProvider {
  id: string;
  model: string;
  discover(input: TaxonomyDiscoveryInput): Promise<unknown>;
}
```

The input contains the complete selected repository corpus in bounded form plus the corpus fingerprint and a target category-count hint. Provider output is strictly validated before it can become freeze state.

No production taxonomy provider is selected in P3A. The default provider remains `disabled`.

## Next boundary

P3B should use the frozen taxonomy only after P3A stability gates are green:

1. embed category descriptions with the existing P2 embedding abstraction;
2. assign high-confidence repositories by deterministic/category-embedding evidence;
3. preserve primary category + secondary tags + confidence/evidence;
4. invoke an optional structured LLM judge only for genuinely ambiguous cases;
5. keep deterministic fallback when semantic/LLM providers fail.
