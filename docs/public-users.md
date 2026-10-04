# Public user count

The README shows the number of **verified public GitHub accounts with a profile installation**. Each account counts once, including maintainer accounts. It is a lower bound on public adoption; it does not measure total people, private installations, visitors or active users.

An account qualifies when its public, non-fork, unarchived `USERNAME/USERNAME` repository has all of the following at the same default-branch commit:

- a root `README.md` embedding its own `project-map/galaxy.svg` and linking to its Project Map viewer, as determined from GitHub's rendered HTML;
- a generated `project-map/graph.json` whose owner and owner node identify that account;
- the corresponding `project-map/galaxy.svg` file.

[The checked-in evidence](../data/public-users.json) records the verification time, qualifying accounts and immutable links to their profile README and generated files. The graph generation time is recorded separately; an old graph is still an installation and is not presented as an active user.

The image can use the relative output path or the standard `raw.githubusercontent.com` URL. If it references a different branch or commit, that reference is resolved and its SVG verified separately; the evidence records the embedded SVG's immutable URL. Code examples, missing root READMEs and broken image references do not qualify.

## Refresh the README

Use Node.js 24 and an authenticated [GitHub CLI](https://cli.github.com/manual/gh_auth_login):

```bash
npm run update:users
```

The command discovers candidate profiles through public GitHub code search and rechecks previously verified accounts. It updates `data/public-users.json` and the marked README block together after the API checks succeed. Review and commit those two files to publish the refreshed count. It does not publish automatically.

GitHub search indexing can omit installations. To verify an additional public account:

```bash
npm run update:users -- --include USERNAME
```

Additional accounts still have to meet the same installation criteria. An uninstalled or invalid profile is removed on the next successful refresh. API/authentication/rate-limit failures, incomplete searches and searches exceeding GitHub's 1,000-result limit stop the refresh without replacing the previous count. See [GitHub's code-search restrictions](https://docs.github.com/en/rest/search/search#search-code).

## Validate the checked-in count

```bash
npm run check:users
```

This offline check ensures that the README matches the evidence snapshot. It also runs as part of `npm run verify`; it does not make fresh network requests during CI.
