import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { applyQualityView } from "../scripts/apply-quality-view.mjs";

test("Quality postprocess attaches transferable state and appends the query bootstrap exactly once", async () => {
  const root = await mkdtemp(join(tmpdir(), "ipm-quality-presentation-view-"));
  const siteDir = join(root, "site");
  const sourceDir = join(root, "scripts");
  try {
    await mkdir(join(siteDir, "u"), { recursive: true });
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(sourceDir, "public-quality-view.js"), '"use strict";\nwindow.__qualityPresentationFixture = true;\n');
    const baseViewState = await readFile(join(process.cwd(), "scripts", "public-view-state.js"), "utf8");
    await writeFile(join(siteDir, "view-state.js"), baseViewState);
    await writeFile(join(siteDir, "u", "index.html"), '<!doctype html><html><body><script src="../view-state.js" defer></script></body></html>');

    const first = await applyQualityView({ siteDir, sourceDir });
    assert.equal(first.injected, true);
    assert.equal(await readFile(join(siteDir, "quality-view.js"), "utf8"), '"use strict";\nwindow.__qualityPresentationFixture = true;\n');

    const transferable = await readFile(join(siteDir, "project-map-view-state.js"), "utf8");
    assert.match(transferable, /window\.ProjectMapTransferableState/);
    assert.doesNotMatch(transferable, /searchParams\.set\("render"/);

    const once = await readFile(join(siteDir, "view-state.js"), "utf8");
    assert.equal((once.match(/IPM_QUERY_GATED_QUALITY_PRESENTATION_V1/g) || []).length, 1);
    assert.equal((once.match(/IPM_RENDERER_NEUTRAL_TRANSFERABLE_STATE_V1/g) || []).length, 1);
    assert.match(once, /window\.ProjectMapTransferableState/);
    assert.match(once, /api\.applyToUrl/);
    assert.match(once, /searchParams\.get\("quality"\) === "1"/);
    assert.match(once, /script\.src = "\.\.\/quality-view\.js"/);
    assert.match(once, /state: "disabled"/);

    const htmlOnce = await readFile(join(siteDir, "u", "index.html"), "utf8");
    assert.match(htmlOnce, /project-map-view-state\.js" defer><\/script>\s*<script src="\.\.\/view-state\.js" defer>/);

    const second = await applyQualityView({ siteDir, sourceDir });
    assert.equal(second.injected, false);
    const twice = await readFile(join(siteDir, "view-state.js"), "utf8");
    assert.equal((twice.match(/IPM_QUERY_GATED_QUALITY_PRESENTATION_V1/g) || []).length, 1);
    assert.equal((twice.match(/IPM_RENDERER_NEUTRAL_TRANSFERABLE_STATE_V1/g) || []).length, 1);
    const htmlTwice = await readFile(join(siteDir, "u", "index.html"), "utf8");
    assert.equal((htmlTwice.match(/project-map-view-state\.js/g) || []).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
