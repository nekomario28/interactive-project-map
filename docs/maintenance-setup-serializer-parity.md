# Setup workflow serializer parity

The production GitHub Pages setup UI and the retained dormant Worker installer both emit the same user-owned profile workflow.

They intentionally remain separate runtime implementations because one executes as browser JavaScript and the other as Worker TypeScript. Sharing a runtime function would add a build/runtime coupling that is larger than the remaining duplication.

`tests/setup-workflow-runtime-parity.test.mjs` is therefore the contract boundary: representative stable, contributed, and pinned-generator configurations must produce byte-identical workflow text in both runtimes.

If that parity gate fails, update both serializers together or move only the proven common mechanism into a shared build-time contract. Do not weaken the test by normalizing away semantic differences.
