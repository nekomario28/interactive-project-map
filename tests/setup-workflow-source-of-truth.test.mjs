import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildPublicPages } from "../scripts/build-public-pages.mjs";
import { postprocessPublicPages } from "../scripts/postprocess-public-pages.mjs";

test("published setup workflow has one production source of truth", async (t) => {
  const outputDir = await mkdtemp(join(tmpdir(), "project-map-pages-"));
  t.after(async () => rm(outputDir, { recursive: true, force: true }));

  await buildPublicPages(outputDir);
  await postprocessPublicPages(outputDir);

  const home = await readFile(join(outputDir, "index.html"), "utf8");
  const app = await readFile(join(outputDir, "app.js"), "utf8");

  // pages-app.mjs is only the HTML shell in the published build. Its legacy
  // inline setup implementation must never survive externalization.
  assert.doesNotMatch(home, /nekomario28\/interactive-project-map@v1/);
  assert.doesNotMatch(home, /function workflowFor\(/);

  // scripts/public-home.js is the canonical production setup implementation.
  assert.match(app, /function workflowFor\(/);
  assert.match(app, /generate-project-map\.yml@'\+generatorRef/);
  assert.match(app, /PROJECT_MAP_REUSABLE_REF='v1'/);

  // Do not regress to the old direct composite-action caller workflow.
  assert.doesNotMatch(app, /uses: nekomario28\/interactive-project-map@v1/);
  assert.match(app, /uses: nekomario28\/interactive-project-map\/\.github\/workflows\/generate-project-map\.yml@/);
});
