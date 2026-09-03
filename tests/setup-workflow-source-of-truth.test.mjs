import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildPublicPages } from "../scripts/build-public-pages.mjs";
import { postprocessPublicPages } from "../scripts/postprocess-public-pages.mjs";
import { PROJECT_MAP_ACTION_REF } from "../src/action-ref.ts";

test("published setup workflow has one production source of truth", async (t) => {
  const outputDir = await mkdtemp(join(tmpdir(), "project-map-pages-"));
  t.after(async () => rm(outputDir, { recursive: true, force: true }));

  const pagesAppSource = await readFile(new URL("../scripts/pages-app.mjs", import.meta.url), "utf8");
  const canonicalSetupSource = await readFile(new URL("../scripts/public-home.js", import.meta.url), "utf8");

  // pages-app.mjs is now a shell source only. It must not retain a second
  // workflow serializer that the build later strips or replaces.
  assert.match(pagesAppSource, /<script src="\.\/app\.js" defer><\/script>/);
  assert.doesNotMatch(pagesAppSource, /function workflowFor\(/);
  assert.doesNotMatch(pagesAppSource, /nekomario28\/interactive-project-map@v1/);
  assert.doesNotMatch(pagesAppSource, /actions\/upload-artifact@/);

  // scripts/public-home.js is the canonical production setup implementation.
  assert.match(canonicalSetupSource, /function workflowFor\(/);
  assert.match(canonicalSetupSource, /generate-project-map\.yml@'\+generatorRef/);
  assert.match(canonicalSetupSource, /PROJECT_MAP_REUSABLE_REF='v1'/);

  await buildPublicPages(outputDir);
  const appBeforePostprocess = await readFile(join(outputDir, "app.js"), "utf8");
  assert.match(appBeforePostprocess, new RegExp(PROJECT_MAP_ACTION_REF));
  assert.doesNotMatch(appBeforePostprocess, /30c33c76008b282de8990333c879ae8c1da853d7/);

  await postprocessPublicPages(outputDir);

  const home = await readFile(join(outputDir, "index.html"), "utf8");
  const app = await readFile(join(outputDir, "app.js"), "utf8");

  // Postprocessing may still tune other emitted runtime files, but setup app.js
  // must already carry the reviewed release and remain byte-identical.
  assert.equal(app, appBeforePostprocess);

  assert.match(home, /<script src="\.\/app\.js" defer><\/script>/);
  assert.doesNotMatch(home, /nekomario28\/interactive-project-map@v1/);
  assert.doesNotMatch(home, /function workflowFor\(/);

  assert.match(app, /function workflowFor\(/);
  assert.match(app, /generate-project-map\.yml@'\+generatorRef/);
  assert.match(app, /PROJECT_MAP_REUSABLE_REF='v1'/);

  // Do not regress to the old direct composite-action caller workflow.
  assert.doesNotMatch(app, /uses: nekomario28\/interactive-project-map@v1/);
  assert.match(app, /uses: nekomario28\/interactive-project-map\/\.github\/workflows\/generate-project-map\.yml@/);
});
