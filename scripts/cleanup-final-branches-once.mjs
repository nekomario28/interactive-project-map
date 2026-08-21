const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const prNumber = process.env.PR_NUMBER;

if (!repository || !token || !prNumber) throw new Error("cleanup environment is incomplete");

const targets = [
  "chore/reproducible-npm-ci",
  "ci/ros-gz-919-hosted",
  "ci/ros-gz-919-hosted-run",
  "fix/pin-installer-action-ref",
];
const self = "maintenance/final-branch-cleanup";

const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "interactive-project-map-final-branch-cleanup",
};

async function deleteBranch(branch) {
  if (branch === "main") throw new Error("refusing to delete main");
  const ref = `heads/${branch}`.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`https://api.github.com/repos/${repository}/git/refs/${ref}`, { method: "DELETE", headers });
  if (response.status === 204) return console.log(`deleted ${branch}`);
  if (response.status === 404) return console.log(`already absent ${branch}`);
  throw new Error(`failed to delete ${branch}: ${response.status} ${(await response.text()).slice(0, 300)}`);
}

for (const branch of targets) await deleteBranch(branch);

const close = await fetch(`https://api.github.com/repos/${repository}/pulls/${encodeURIComponent(prNumber)}`, {
  method: "PATCH",
  headers,
  body: JSON.stringify({ state: "closed" }),
});
if (!close.ok) throw new Error(`failed to close cleanup PR: ${close.status} ${(await close.text()).slice(0, 300)}`);
console.log(`closed cleanup PR #${prNumber}`);

await deleteBranch(self);
