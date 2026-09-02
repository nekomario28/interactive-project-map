import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL("../.github/workflows/deploy-pages.yml", import.meta.url);

test("Pages deployment watches shared runtime packages", async () => {
  const workflow = await readFile(workflowUrl, "utf8");

  assert.match(workflow, /^\s*- "packages\/\*\*"\s*$/m);
  assert.match(workflow, /^\s*- "scripts\/\*\*"\s*$/m);
});
