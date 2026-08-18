# Contributing

Issues and pull requests are welcome.

For changes to grouping or rendering behavior, please keep these constraints in mind:

1. Public API responses should remain backwards-compatible where practical.
2. Layouts must remain deterministic for the same graph input.
3. GitHub tokens must stay server-side.
4. SVG output must be safe to embed as an image in GitHub README files.
5. The interactive viewer should remain usable with mouse, trackpad, and touch/pointer input.
