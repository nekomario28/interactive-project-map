import assert from "node:assert/strict";
import test from "node:test";
import { patchThreejsRepositoryInstancing } from "../scripts/apply-threejs-repository-instancing.mjs";

const fixture = `function createSceneRuntime(THREE,graph,username){const threeStyle=currentThreeStyle();
mesh.position.copy(position);if(node.type==="repository")x();
  }
  let edgeLines=null;
rebuildEdges();const totalRepositories=graph.nodes.filter((node)=>node.type==="repository").length;
showDetails(node);appendSearchMatchReason(node);updateFocusControls();emitThreejsNavigatorChange();}
desiredTarget.set(0,0,0);updateFocusControls();emitThreejsNavigatorChange();}
const pulse=motionEnabled?1+Math.sin(pulseTime*.8+mesh.userData.phase)*(node.type==="repository"?.025:.018):1;
edgeMaterial.dispose();for(const geometry of Object.values(geometries))geometry.dispose();`;

test("large repository scenes batch body rendering while preserving proxy meshes", () => {
  const patched = patchThreejsRepositoryInstancing(fixture);
  assert.match(patched, /largeRepositoryScene=.*length>240/);
  assert.match(patched, /mesh\.material\.visible=false/);
  assert.match(patched, /new THREE\.InstancedMesh/);
  assert.match(patched, /createRepositoryBatch\(repositoryItems\.filter/);
  assert.match(patched, /syncRepositoryBatches\(\);const totalRepositories/);
  assert.match(patched, /showDetails\(node\);appendSearchMatchReason\(node\);updateFocusControls\(\);syncRepositoryBatches\(\);emitThreejsNavigatorChange\(\)/);
  assert.match(patched, /desiredTarget\.set\(0,0,0\);updateFocusControls\(\);syncRepositoryBatches\(\);emitThreejsNavigatorChange\(\)/);
  assert.match(patched, /largeRepositoryScene&&node\.type==="repository"\?1:/);
  assert.equal(patchThreejsRepositoryInstancing(patched), patched);
});

test("repository instancing fails closed when generated runtime shape changes", () => {
  assert.throws(() => patchThreejsRepositoryInstancing("function createSceneRuntime(){}"), /Could not locate Three\.js scene startup/);
});
