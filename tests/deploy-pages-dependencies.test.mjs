import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL("../.github/workflows/deploy-pages.yml", import.meta.url);

test("Pages only triggers after the exact main push Verify run, never direct push or manual dispatch", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const trigger = workflow.split("\npermissions:")[0];
  assert.match(trigger, /workflow_run:\s*\n\s*workflows: \["Verify"\]/);
  assert.match(trigger, /types: \[completed\]/);
  assert.match(trigger, /branches: \[main\]/);
  assert.doesNotMatch(trigger, /\n\s*push:/);
  assert.doesNotMatch(trigger, /\n\s*workflow_dispatch:/);
  for (const condition of [
    "github.event.workflow_run.conclusion == 'success'",
    "github.event.workflow_run.event == 'push'",
    "github.event.workflow_run.head_branch == 'main'",
    "github.event.workflow_run.head_repository.full_name == github.repository",
  ]) assert.ok(workflow.includes(condition), "Missing safe release condition: " + condition);
});

test("Pages builds the verified immutable SHA and checks freshness before and after build", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  assert.match(workflow, /ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.equal((workflow.match(/gh api "repos\/\$\{GITHUB_REPOSITORY\}\/branches\/main" --jq '\.commit\.sha'/g) || []).length, 2);
  assert.equal((workflow.match(/\[\[ "\$current" == "\$VERIFIED_SHA" \]\]/g) || []).length, 2);
  assert.match(workflow, /needs\.build\.outputs\.deployable == 'true'/);
  assert.match(workflow, /steps\.freshness\.outputs\.current == 'true'/);
  assert.match(workflow, /run: npm run check:pages && npm test/);
  assert.match(workflow, /run: npm run build:pages/);
  assert.match(workflow, /pages: write/);
  assert.match(workflow, /id-token: write/);
});
