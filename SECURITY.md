# Security Policy

## Supported versions

Security support follows the current public deployment and the immutable GitHub Action commit referenced by `src/action-ref.ts`.

Generated installation workflows intentionally pin the Action to a full commit SHA. If a later security fix changes that pin, regenerate the setup workflow (or update the pinned SHA manually) to receive the fix. Older copied Action SHAs are not maintained indefinitely.

## Reporting a vulnerability

Please do not publish exploit details, tokens, private repository data, or other sensitive material in a public issue.

If GitHub shows a **Report a vulnerability** option for this repository, use that private channel. If private vulnerability reporting is unavailable, open a minimal public issue stating that you need a private security contact channel, without including exploit details.

Useful reports include the affected surface, impact, reproducible preconditions, and the smallest safe proof needed to verify the problem.

## Security-sensitive surfaces

Examples include:

- GitHub token or workflow-permission handling
- generated GitHub Actions workflows and supply-chain pins
- untrusted repository metadata rendered into SVG, HTML, JSON, or the interactive viewer
- script injection, XSS, CSP bypasses, or unsafe URL handling
- unexpected access to private repository data
- privilege changes between read-only generation and write-enabled publishing jobs

Classification accuracy, visual layout issues, performance tuning, and ordinary feature requests are not security vulnerabilities unless they create a concrete security impact.
