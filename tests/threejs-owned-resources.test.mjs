import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../scripts/public-threejs-viewer.js", import.meta.url), "utf8");
const begin = source.indexOf("function disposeOwnedSceneResources(scene, extraResources=[])");
const end = source.indexOf("function layoutGraph(THREE,graph)", begin);
assert.ok(begin >= 0 && end > begin, "shared scene disposal helper must exist");
const helper = source.slice(begin, end);

function resource(extra = {}) {
  return {
    ...extra,
    calls: 0,
    dispose() { this.calls += 1; },
  };
}

function dispose(scene, extra = []) {
  runInNewContext(`${helper}\ndisposeOwnedSceneResources(scene, extraResources);`, { scene, extraResources: extra });
}

test("disposes nested star, halo, ring, nebula, shared geometry and texture exactly once", () => {
  const geometry = resource({ isBufferGeometry: true });
  const ringGeometry = resource({ isBufferGeometry: true });
  const sharedGlow = resource({ isTexture: true });
  const nebula = resource({ isTexture: true });
  const materialA = resource({ isMaterial: true, map: sharedGlow });
  const materialB = resource({ isMaterial: true, map: sharedGlow });
  const ringMaterial = resource({ isMaterial: true });
  const nebulaMaterial = resource({ isMaterial: true, map: nebula });
  const owner = { geometry, material: materialA, children: [
    { geometry: ringGeometry, material: ringMaterial, children: [] },
    { material: materialB, children: [] },
  ] };
  const stars = { geometry, material: materialB, children: [] };
  const cloud = { material: nebulaMaterial, children: [] };
  const scene = { children: [owner, stars, cloud] };
  dispose(scene, [geometry, sharedGlow]);
  for (const value of [geometry, ringGeometry, sharedGlow, nebula, materialA, materialB, ringMaterial, nebulaMaterial]) {
    assert.equal(value.calls, 1);
  }
});

test("shader uniform textures, material arrays and detached extras release without duplicates", () => {
  const uniformMap = resource({ isTexture: true });
  const material = resource({ isMaterial: true, uniforms: { map: { value: uniformMap } } });
  const detached = resource({ isBufferGeometry: true });
  const node = { geometry: detached, material: [material, material], children: [] };
  const scene = { traverse(callback) { callback(node); callback(node); } };
  dispose(scene, [detached, material, uniformMap]);
  assert.equal(uniformMap.calls, 1);
  assert.equal(material.calls, 1);
  assert.equal(detached.calls, 1);
});

test("normal and exceptional disposal share an idempotent owned cleanup path", () => {
  assert.match(source, /return \{dispose:disposeRuntime\};/);
  assert.match(source, /catch\(error\)\s*\{\s*disposeRuntime\(\);\s*throw error;/);
  assert.match(source, /if\(cleaned\)return;cleaned=true;/);
  assert.match(source, /removeListeners\(\);disposeOwnedSceneResources\(scene,ownedResources\)/);
  assert.doesNotMatch(source, /glowTexture\.dispose\(\)/);
});
