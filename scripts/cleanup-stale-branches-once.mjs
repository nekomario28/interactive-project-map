const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;

if (!repository || !token) {
  throw new Error("GITHUB_REPOSITORY and GITHUB_TOKEN are required");
}

const keep = new Set([
  "main",
  "ci/ros-gz-919-hosted",
  "ci/ros-gz-919-hosted-run",
]);

const targets = [
  "chore/close-standard-taxonomy-migration",
  "chore/pin-p2-action",
  "chore/pin-p3a-action",
  "chore/pin-p3b1-action",
  "chore/pin-p3b2-action",
  "chore/pin-standard-taxonomy-default",
  "chore/pin-standard-taxonomy-parity",
  "docs/contributors-and-credits",
  "docs/license-audit-2026-08-21",
  "docs/link-syun-contributor",
  "docs/p3-current-handoff",
  "docs/p3-human-eval-candidate",
  "docs/p3-provider-benchmark-matrix",
  "experiment/adaptive-label-comparison",
  "experiment/live-layout-comparison",
  "experiment/semantic-label-lod-comparison",
  "feat/adaptive-text-labels",
  "feat/category-label-hierarchy",
  "feat/obsidian-degree-node-size",
  "feat/obsidian-hover-emphasis",
  "feat/obsidian-neutral-initial-viewport",
  "feat/obsidian-spawn-lifecycle",
  "feat/obsidian-text-fade",
  "feat/p2a-semantic-document-embedding",
  "feat/p2b-sparse-semantic-edges",
  "feat/p3-evaluation-harness",
  "feat/p3-taxonomy-partition-evaluation",
  "feat/p3a-taxonomy-freeze",
  "feat/p3b1-taxonomy-assignment",
  "feat/p3b2-ambiguity-adjudicator",
  "feat/reusable-spatial-core",
  "feat/search-category-context",
  "feat/semantic-label-lod",
  "feat/spatial-core-consumer-contract",
  "feat/standard-taxonomy-boundary-gates",
  "feat/standard-taxonomy-default",
  "feat/standard-taxonomy-generalization",
  "feat/standard-taxonomy-hosted-parity",
  "feat/standard-taxonomy-v1",
  "feat/standard-taxonomy-visible-hierarchy",
  "feat/57-dedicated-search-emphasis",
  "feat/57-search-facets-reasons-keyboard",
  "fix/remove-motion-label-fade",
  "refactor/spatial-core-browser-bridge",
  "research/semantic-label-lod-survey",
  "maintenance/branch-cleanup-once",
];

for (const branch of targets) {
  if (keep.has(branch)) {
    throw new Error(`Refusing to delete protected branch ${branch}`);
  }
}

const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "interactive-project-map-branch-cleanup",
};

async function deleteBranch(branch) {
  const ref = `heads/${branch}`;
  const url = `https://api.github.com/repos/${repository}/git/refs/${ref.split("/").map(encodeURIComponent).join("/")}`;
  const response = await fetch(url, { method: "DELETE", headers });
  if (response.status === 204) {
    console.log(`deleted ${branch}`);
    return "deleted";
  }
  if (response.status === 404) {
    console.log(`already absent ${branch}`);
    return "absent";
  }
  const body = await response.text();
  throw new Error(`failed to delete ${branch}: ${response.status} ${body.slice(0, 300)}`);
}

let deleted = 0;
let absent = 0;
for (const branch of targets.filter((branch) => branch !== "maintenance/branch-cleanup-once")) {
  const result = await deleteBranch(branch);
  if (result === "deleted") deleted += 1;
  else absent += 1;
}

console.log(`cleanup summary before self-delete: deleted=${deleted} absent=${absent}`);
await deleteBranch("maintenance/branch-cleanup-once");
