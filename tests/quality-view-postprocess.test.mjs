import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { applyQualityView } from "../scripts/apply-quality-view.mjs";

test("Quality postprocess copies runtime and appends the query bootstrap exactly once", async () => {
  const root = await mkdtemp(join(tmpdir(), "ipm-quality-presentation-view-"));
  const siteDir = join(root, "site");
  const sourceDir = join(root, "scripts");
  try {
    await mkdir(siteDir, { recursive: true });
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(sourceDir, "public-quality-view.js"), '"use strict";\nwindow.__qualityPresentationFixture = true;\n');
    await writeFile(join(siteDir, "view-state.js"), '"use strict";\nwindow.__existingViewState = true;\n');

    const first = await applyQualityView({ siteDir, sourceDir });
    assert.equal(first.injected, true);
    assert.equal(await readFile(join(siteDir, "quality-view.js"), "utf8"), '"use strict";\nwindow.__qualityPresentationFixture = true;\n');
    const once = await readFile(join(siteDir, "view-state.js"), "utf8");
    assert.equal((once.match(/IPM_QUERY_GATED_QUALITY_PRESENTATION_V1/g) || []).length, 1);
    assert.match(once, /searchParams\.get\("quality"\) === "1"/);
    assert.match(once, /script\.src = "\.\.\/quality-view\.js"/);
    assert.match(once, /state: "disabled"/);

    const second = await applyQualityView({ siteDir, sourceDir });
    assert.equal(second.injected, false);
    const twice = await readFile(join(siteDir, "view-state.js"), "utf8");
    assert.equal((twice.match(/IPM_QUERY_GATED_QUALITY_PRESENTATION_V1/g) || []).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
