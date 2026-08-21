import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = new URL("../.github/workflows/generate-project-map.yml", import.meta.url);

test("reusable generator is read-only and keeps external execution pinned", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  assert.match(workflow, /\bon:\s*\n\s+workflow_call:/);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(workflow, /contents: write/);
  assert.match(workflow, /uses: actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /uses: actions\/upload-artifact@[0-9a-f]{40}/);
  assert.match(workflow, /uses: nekomario28\/interactive-project-map@[0-9a-f]{40}/);
  assert.match(workflow, /username: \$\{\{ github\.repository_owner \}\}/);
  assert.match(workflow, /name: project-map-generated/);
});
