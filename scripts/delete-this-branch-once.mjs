const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const prNumber = process.env.PR_NUMBER;
const branch = "docs/security-policy";
if (!repository || !token || !prNumber) throw new Error("cleanup environment is incomplete");
const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "interactive-project-map-self-cleanup",
};
const close = await fetch(`https://api.github.com/repos/${repository}/pulls/${encodeURIComponent(prNumber)}`, {
  method: "PATCH",
  headers,
  body: JSON.stringify({ state: "closed" }),
});
if (!close.ok) throw new Error(`failed to close cleanup PR: ${close.status} ${(await close.text()).slice(0, 300)}`);
const ref = `heads/${branch}`.split("/").map(encodeURIComponent).join("/");
const removed = await fetch(`https://api.github.com/repos/${repository}/git/refs/${ref}`, { method: "DELETE", headers });
if (removed.status !== 204) throw new Error(`failed to delete ${branch}: ${removed.status} ${(await removed.text()).slice(0, 300)}`);
console.log(`closed cleanup PR #${prNumber} and deleted ${branch}`);
