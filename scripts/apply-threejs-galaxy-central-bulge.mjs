import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GALAXY_BULGE_HELPER = `function createGalaxyCentralBulge(THREE,seed,glowTexture){const count=innerWidth<720?96:192,clearRadius=10,outerRadius=44,positions=new Float32Array(count*3);for(let index=0;index<count;index+=1){const theta=TAU*hashUnit(seed+":bulge:theta:"+index),vertical=hashUnit(seed+":bulge:vertical:"+index)*2-1,radius=clearRadius+(outerRadius-clearRadius)*Math.pow(hashUnit(seed+":bulge:radius:"+index),1.35);positions[index*3]=Math.cos(theta)*radius;positions[index*3+1]=vertical*radius*.46;positions[index*3+2]=Math.sin(theta)*radius;}const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));const material=new THREE.PointsMaterial({color:0xffd8aa,size:innerWidth<720?1:1.22,transparent:true,opacity:.14,depthWrite:false,sizeAttenuation:true,blending:THREE.AdditiveBlending}),points=new THREE.Points(geometry,material);points.name="galaxy-bulge-stars";const glowMaterial=new THREE.SpriteMaterial({map:glowTexture,color:0xffcf91,transparent:true,opacity:.12,depthWrite:false,blending:THREE.AdditiveBlending}),glow=new THREE.Sprite(glowMaterial);glow.name="galaxy-bulge-glow";glow.scale.set(88,72,1);glow.position.set(0,1,0);const group=new THREE.Group();group.name="galaxy-central-bulge";group.userData.decorative=true;group.userData.semantic=false;group.userData.particleCount=count;group.userData.clearRadius=clearRadius;group.add(points,glow);return group;}`;

const RUNTIME_ANCHOR = "function createSceneRuntime(THREE,graph,username){";
const SCENE_ANCHOR = 'scene.add(farStars,midStars,nearStars,dust);dust.visible=threeStyle!=="wireframe";if(threeStyle==="galaxy"){dust.scale.setScalar(1.08);dust.material.opacity=.44;}';
const SCENE_WITH_BULGE = `${SCENE_ANCHOR}const galaxyBulge=threeStyle==="galaxy"?createGalaxyCentralBulge(THREE,username,glowTexture):null;if(galaxyBulge){scene.add(galaxyBulge);document.body.dataset.galaxyCentralStructure="bulge";}`;

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

export function patchThreejsGalaxyCentralBulgeRuntime(source) {
  let next = source;
  if (!next.includes("function createGalaxyCentralBulge(THREE,seed,glowTexture)")) {
    next = replaceRequired(next, RUNTIME_ANCHOR, `${GALAXY_BULGE_HELPER}\n${RUNTIME_ANCHOR}`, "Galaxy central-bulge helper insertion point");
  }
  next = replaceRequired(next, SCENE_ANCHOR, SCENE_WITH_BULGE, "Galaxy central-bulge scene insertion point");
  return next;
}

export async function applyThreejsGalaxyCentralBulge({ siteDir = join(process.cwd(), "site") } = {}) {
  const runtimePath = join(siteDir, "threejs-viewer.js");
  const source = await readFile(runtimePath, "utf8");
  const next = patchThreejsGalaxyCentralBulgeRuntime(source);
  if (next !== source) await writeFile(runtimePath, next);
  return { runtimePath, changed: next !== source };
}

async function main() {
  const result = await applyThreejsGalaxyCentralBulge();
  console.log(`Applied Three.js Galaxy central bulge${result.changed ? "" : " (already present)"}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
