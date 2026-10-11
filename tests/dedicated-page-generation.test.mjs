import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Script } from "node:vm";
import test from "node:test";
import { buildPublicPages } from "../scripts/build-public-pages.mjs";

const ROUTES = ["radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"];

test("dedicated pages ship status controls and their runtime without post-build attachment", async () => {
  const root = await mkdtemp(join(tmpdir(), "ipm-dedicated-generation-"));
  try {
    await buildPublicPages(root);
    for (const route of ROUTES) {
      const html = await readFile(join(root, route, "index.html"), "utf8");
      const statuses = [...html.matchAll(/data-status-filter="([^"]+)" aria-pressed="true"/g)].map((match) => match[1]);
      assert.deepEqual(statuses, ["original", "fork", "archived", "contributed"], route);
      assert.equal([...html.matchAll(/id="resultCount"/g)].length, 1, route);
      const sources = [...html.matchAll(/<script src="\.\.\/([^"]+)" defer><\/script>/g)].map((match) => match[1]);
      assert.equal(sources.filter((source) => source === "dedicated-view-state.js").length, 1, route);
      assert.equal(sources.filter((source) => source === "dedicated-graph.js").length, 1, route);
      assert.ok(sources.indexOf("dedicated-graph.js") < sources.indexOf(`${route}-viewer.js`), `${route} must load graph admission before its renderer`);
      assert.ok(sources.indexOf("dedicated-view-state.js") < sources.indexOf(`${route}-viewer.js`), `${route} must project status before graph loading`);
      for (const source of sources) new Script(await readFile(join(root, source), "utf8"), { filename: source });
    }
    assert.equal(
      await readFile(join(root, "dedicated-view-state.js"), "utf8"),
      await readFile(new URL("../scripts/public-dedicated-view-state.js", import.meta.url), "utf8"),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
