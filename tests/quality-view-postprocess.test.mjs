import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { applyQualityView } from "../scripts/apply-quality-view.mjs";

test("Quality viewer postprocess copies runtime and injects graph viewer exactly once", async () => {
  const root = await mkdtemp(join(tmpdir(), "ipm-quality-view-"));
  const siteDir = join(root, "site");
  const sourceDir = join(root, "scripts");
  try {
    await mkdir(join(siteDir, "u"), { recursive: true });
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(sourceDir, "public-quality-view.js"), '"use strict";\nwindow.__qualityFixture = true;\n');
    await writeFile(join(siteDir, "u", "index.html"), "<!doctype html><html><body><script src=\"../viewer.js\" defer></script></body></html>\n");

    const first = await applyQualityView({ siteDir, sourceDir });
    assert.equal(first.injected, true);
    assert.equal(await readFile(join(siteDir, "quality-view.js"), "utf8"), '"use strict";\nwindow.__qualityFixture = true;\n');

    const once = await readFile(join(siteDir, "u", "index.html"), "utf8");
    assert.equal((once.match(/quality-view\.js/g) || []).length, 1);
    assert.match(once, /<script src="\.\.\/quality-view\.js" defer><\/script>/);

    const second = await applyQualityView({ siteDir, sourceDir });
    assert.equal(second.injected, false);
    const twice = await readFile(join(siteDir, "u", "index.html"), "utf8");
    assert.equal((twice.match(/quality-view\.js/g) || []).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
