# Project Map update policy

Project Map keeps generation code and profile-repository write permissions separate.

## Default: Stable Auto

Normal installs use the read-only reusable generator through:

```yaml
uses: nekomario28/interactive-project-map/.github/workflows/generate-project-map.yml@v1
```

`v1` is the reviewed stable channel. Moving that channel can deliver compatible fixes without asking every user to edit their profile workflow. The reusable workflow itself keeps the Project Map Action and GitHub-maintained third-party Actions on reviewed immutable commit SHAs.

This is the recommended mode for normal users.

## Advanced: Pinned

Users who require a completely immutable reusable-workflow reference can pass a full 40-character commit SHA as `generator_ref` when generating or installing the workflow:

```text
/api/install-workflow?username=USER&generator_ref=FULL_40_CHARACTER_SHA
```

The GitHub App one-click path accepts the same option:

```text
/api/install/start?username=USER&generator_ref=FULL_40_CHARACTER_SHA
```

Only `v1` or a 40-character hexadecimal commit SHA is accepted. Branch names such as `main`, short SHAs, tags other than `v1`, and arbitrary workflow references are rejected instead of silently falling back.

GitHub documents SHA references as the safest option for reusable-workflow stability and security. Project Map intentionally does not expose this as a standard homepage control because most users benefit from the reviewed `v1` compatibility channel.

## Update and repair

The existing GitHub App installer owns only workflows beginning with the Project Map managed marker. Re-running the same one-click flow:

- creates the managed workflow when absent;
- updates it in place when its generated content changed, including a change between `v1` and a pinned SHA;
- leaves it unchanged when it is already current;
- dispatches `project-map.yml` after all three outcomes.

Therefore install, update, pin/unpin, and repair/re-generation reuse one managed workflow path. No separate update service, stored GitHub token, database, or polling worker is required.

The generator job remains `contents: read`. The profile repository's local publish job alone has `contents: write` for committing `project-map/galaxy.svg` and `project-map/graph.json`.
