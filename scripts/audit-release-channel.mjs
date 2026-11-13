import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PROJECT_MAP_ACTION_REF } from "../src/action-ref.ts";

const REPO = "nekomario28/interactive-project-map";
const SHA_RE = /^[a-f0-9]{40}$/;
const API = `https://api.github.com/repos/${REPO}`;

export function innerActionSha(workflow) {
  const pins = [...String(workflow).matchAll(/uses:\s+nekomario28\/interactive-project-map@([a-f0-9]{40})/g)];
  if (pins.length !== 1) throw new Error("Reusable workflow must pin exactly one immutable Project Map Action");
  return pins[0][1];
}

async function githubJson(path, { fetchImpl = fetch, token } = {}) {
  const response = await fetchImpl(`${API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`Release audit GitHub API returned HTTP ${response.status} for ${path}`);
  return response.json();
}

export async function readStableBranch({ fetchImpl = fetch, token } = {}) {
  const branch = await githubJson("/branches/v1", { fetchImpl, token });
  const commit = branch?.commit?.sha;
  if (!SHA_RE.test(commit ?? "")) throw new Error("Stable v1 branch does not have a valid commit SHA");
  const content = await githubJson(`/contents/.github/workflows/generate-project-map.yml?ref=${commit}`, { fetchImpl, token });
  if (content.encoding !== "base64" || typeof content.content !== "string")
    throw new Error("Stable v1 reusable workflow could not be read");
  const workflow = Buffer.from(content.content.replace(/\s/g, ""), "base64").toString("utf8");
  return { ref: "refs/heads/v1", commit, innerAction: innerActionSha(workflow) };
}

export function releaseAuditReport({ stable, candidateWorkflow, candidateCommit, advertisedAction = PROJECT_MAP_ACTION_REF }) {
  const innerAction = innerActionSha(candidateWorkflow);
  if (advertisedAction !== innerAction) throw new Error("Main reusable Action and advertised installer candidate diverged");
  if (candidateCommit != null && !SHA_RE.test(candidateCommit)) throw new Error("Candidate commit must be a 40-character SHA");
  return {
    schemaVersion: 1,
    stable,
    candidate: { commit: candidateCommit ?? null, innerAction },
    releaseDiffers: stable.commit !== candidateCommit || stable.innerAction !== innerAction,
    promotionVerified: stable.commit === candidateCommit && stable.innerAction === innerAction,
    notes: "v1 is an independently versioned branch; main candidate features are not evidence of stable availability.",
  };
}

export async function auditRelease({ fetchImpl = fetch, token, candidateCommit = null } = {}) {
  const candidateWorkflow = await readFile(new URL("../.github/workflows/generate-project-map.yml", import.meta.url), "utf8");
  const stable = await readStableBranch({ fetchImpl, token });
  return releaseAuditReport({ stable, candidateWorkflow, candidateCommit });
}

async function main() {
  const requireCurrent = process.argv.includes("--require-current");
  const outputFlag = process.argv.indexOf("--output");
  const output = outputFlag >= 0 ? process.argv[outputFlag + 1] : null;
  if (outputFlag >= 0 && !output) throw new Error("--output requires a file path");
  const report = await auditRelease({ token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN, candidateCommit: process.env.GITHUB_SHA || null });
  if (output) {
    const path = resolve(output);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(report, null, 2) + "\n");
  }
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (requireCurrent) assert.equal(report.promotionVerified, true, "Stable v1 branch has not been promoted to this exact candidate");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
