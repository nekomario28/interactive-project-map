import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const runtimePath = new URL("../scripts/public-obsidian-runtime.js", import.meta.url);

test("Obsidian repository sizing is connectivity-derived and isolated from stars", async () => {
  const source = await readFile(runtimePath, "utf8");
  assert.match(source, /const baseNodeRadius = nodeRadius;/);
  assert.match(source, /const repositoryDegrees = new Map\(\);/);
  assert.match(source, /function indexRepositoryDegrees\(graph\)/);
  assert.match(source, /neighbors = new Map/);
  assert.match(source, /adjacent\.size/);
  assert.match(source, /function repositoryVisualRadius\(node\)/);
  assert.match(source, /Math\.log2\(repositoryDegree\(node\) \+ 1\) \* 1\.65/);
  assert.match(source, /nodeRadius = function obsidianDegreeNodeRadius/);
  assert.match(source, /return repositoryVisualRadius\(node\) \+ 3\.5;/);
  assert.match(source, /indexRepositoryDegrees\(graph\);/);
  assert.match(source, /repositoryDegrees: Object\.fromEntries/);

  const physicsStart = source.indexOf("function physicsRadius");
  const physicsEnd = source.indexOf("function linkedEdges", physicsStart);
  assert.ok(physicsStart >= 0 && physicsEnd > physicsStart);
  assert.doesNotMatch(source.slice(physicsStart, physicsEnd), /stars/);
  assert.doesNotMatch(source, /repositoryVisualRadius\([^)]*stars/);

  assert.doesNotThrow(() => new Function(source));
});
