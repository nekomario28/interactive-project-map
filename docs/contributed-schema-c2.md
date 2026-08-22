# Contributed graph schema C2

Status: **Accepted** (2026-08-22)

## Core invariant

A repository owned by another user or organization is never represented as Original, Fork, Archived ownership, or as a child of an owned category. It is an explicit **Contributed** relation.

Owned graph semantics stay unchanged:

```text
user --ownership--> category --membership--> owned repository
```

External contribution semantics are separate:

```text
user --contribution--> external owner/repository
```

There is no `ownership` or `membership` path from the Project Map user to a Contributed repository. Classification may be stored as repository metadata, but it does not create an ownership/category edge.

## Repository identity

Owned repositories retain their existing IDs such as `repository:project-name`.

Contributed repositories use the full, case-normalized GitHub identity:

```text
repository:owner/repository
```

Their visible label is also `owner/repository`. This prevents same-name collisions and makes the external owner explicit.

## Node contract

A Contributed repository node contains:

- `type: "repository"`;
- `relation: "contributed"`;
- `repositoryOwner` and `repositoryName`;
- canonical public `https://github.com/OWNER/REPO` URL;
- bounded public description/language/topics/star/fork metadata;
- source `fork` / `archived` flags as metadata only;
- contribution counts for commits, PRs and merged PRs;
- truncation flags;
- optional classification metadata.

Source fork/archive state never changes the Project Map relation from Contributed.

## Graph-level contract

`repositoryCount` continues to mean **owned repository count** for backward compatibility.

`contributedRepositoryCount` is separate.

`externalContributions` records the explicit time window plus ranking/cap diagnostics: candidate, included, omitted and truncated repository counts. A capped result is therefore not presented as exhaustive.

## Static-profile trust boundary

The Worker static sanitizer does not trust serialized edges. It rebuilds the owned graph from validated owned nodes and then reattaches only validated Contributed records through the dedicated `contribution` edge.

A Contributed node is accepted only when:

- it is explicitly marked `relation: "contributed"`;
- its external owner is not the requested profile owner;
- `repositoryOwner`, `repositoryName`, visible `owner/repo` label and canonical GitHub URL agree;
- contribution counts are bounded non-negative integers and merged PRs do not exceed PRs;
- at least one visible commit or PR exists;
- truncation fields are booleans;
- graph-level window/cap diagnostics are valid and agree with the number of contributed nodes;
- the total Contributed slice is at most the C1 hard cap of 12.

An incoming fake `ownership`/`membership` edge to an external node is discarded during sanitization and cannot promote it into owned structure.

## Deliberate C2 exclusions

C2 defines and validates schema only. It does not fetch external contributions during generation, add setup inputs, change renderers, or move `v1` / the inner Action pin. Those remain C3/C4/release-chain work.
