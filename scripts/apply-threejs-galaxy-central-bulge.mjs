import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GALAXY_DISC_TEXTURE_HELPER = `function galaxyDiscSmooth(value){value=Math.max(0,Math.min(1,value));return value*value*(3-2*value);}function galaxyDiscNoise(seed,x,y){const x0=Math.floor(x),y0=Math.floor(y),fx=galaxyDiscSmooth(x-x0),fy=galaxyDiscSmooth(y-y0),sample=(ix,iy)=>hashUnit(seed+":disc:"+ix+":"+iy),a=sample(x0,y0),b=sample(x0+1,y0),c=sample(x0,y0+1),d=sample(x0+1,y0+1),top=a+(b-a)*fx,bottom=c+(d-c)*fx;return top+(bottom-top)*fy;}function createGalaxyDiscHaze(THREE,seed,armCount=4,pitch=0,referenceRadius=42){const size=128,canvas=document.createElement("canvas");canvas.width=size;canvas.height=size;const context=canvas.getContext("2d",{alpha:true});if(!context)return null;const image=context.createImageData(size,size),data=image.data;for(let py=0;py<size;py+=1){for(let px=0;px<size;px+=1){const u=(px+.5)/size,v=(py+.5)/size,nx=(u-.5)*2,nz=(v-.5)*2,radius=Math.hypot(nx,nz);if(radius>=1)continue;const center=galaxyDiscSmooth((radius-.12)/.1),edge=1-galaxyDiscSmooth((radius-.72)/.26),coarse=galaxyDiscNoise(seed,u*4.4,v*4.4),fine=galaxyDiscNoise(seed+":fine",u*8.2,v*8.2),cloud=.72*coarse+.28*fine,angle=Math.atan2(-nz,nx),visualRadius=radius*312,spiral=pitch>0?Math.log(Math.max(1,visualRadius/referenceRadius))/Math.tan(pitch):0,armWave=.5+.5*Math.cos((angle-spiral)*armCount),armMod=.79+.56*armWave*armWave,alpha=Math.round(255*.18*center*edge*(.38+.62*cloud)*armMod),warm=1-Math.min(1,radius),offset=(py*size+px)*4;data[offset]=Math.round(92+44*warm);data[offset+1]=Math.round(116+40*warm);data[offset+2]=Math.round(176+36*warm);data[offset+3]=alpha;}}context.putImageData(image,0,0);const texture=new THREE.CanvasTexture(canvas);texture.name="galaxy-disc-haze-texture";texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;const geometry=new THREE.CircleGeometry(312,96),material=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.46,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false}),mesh=new THREE.Mesh(geometry,material);mesh.name="galaxy-disc-haze";mesh.rotation.x=-Math.PI/2;mesh.position.y=-6;mesh.renderOrder=-2;mesh.raycast=()=>{};mesh.userData.decorative=true;mesh.userData.semantic=false;mesh.userData.textureModel="procedural-low-frequency-log-arm-haze";mesh.userData.textureSize=size;mesh.userData.centerClearFraction=.12;mesh.userData.armCount=armCount;mesh.userData.pitchAngleDeg=pitch*180/Math.PI;mesh.userData.referenceRadius=referenceRadius;return mesh;}`;

const GALAXY_BULGE_HELPER = `function softenGalaxyCentralDust(dust){const position=dust?.geometry?.getAttribute?.("position"),color=dust?.geometry?.getAttribute?.("color"),fadeStart=30,fadeEnd=64;if(!position||!color)return;for(let index=0;index<position.count;index+=1){const radius=Math.hypot(position.getX(index),position.getZ(index));if(radius>=fadeEnd)continue;const fade=Math.max(0,Math.min(1,(radius-fadeStart)/(fadeEnd-fadeStart)));color.setXYZ(index,color.getX(index)*fade,color.getY(index)*fade,color.getZ(index)*fade);}color.needsUpdate=true;}function createGalaxyCentralBulge(THREE,seed,glowTexture){const count=innerWidth<720?48:96,clearRadius=14,outerRadius=44,positions=new Float32Array(count*3);for(let index=0;index<count;index+=1){const theta=TAU*hashUnit(seed+":bulge:theta:"+index),vertical=hashUnit(seed+":bulge:vertical:"+index)*2-1,radius=clearRadius+(outerRadius-clearRadius)*Math.pow(hashUnit(seed+":bulge:radius:"+index),1.2);positions[index*3]=Math.cos(theta)*radius;positions[index*3+1]=vertical*radius*.42;positions[index*3+2]=Math.sin(theta)*radius;}const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));const material=new THREE.PointsMaterial({color:0xffd8aa,size:innerWidth<720?.9:1.08,transparent:true,opacity:.1,depthWrite:false,sizeAttenuation:true,blending:THREE.AdditiveBlending}),points=new THREE.Points(geometry,material);points.name="galaxy-bulge-stars";const glowMaterial=new THREE.SpriteMaterial({map:glowTexture,color:0xffcf91,transparent:true,opacity:.12,depthWrite:false,blending:THREE.AdditiveBlending}),glow=new THREE.Sprite(glowMaterial);glow.name="galaxy-bulge-glow";glow.scale.set(88,72,1);glow.position.set(0,1,0);const group=new THREE.Group();group.name="galaxy-central-bulge";group.userData.decorative=true;group.userData.semantic=false;group.userData.particleCount=count;group.userData.clearRadius=clearRadius;group.add(points,glow);return group;}`;

const RUNTIME_ANCHOR = "function createSceneRuntime(THREE,graph,username){";
const SCENE_ANCHOR = 'scene.add(farStars,midStars,nearStars,dust);dust.visible=threeStyle!=="wireframe";if(threeStyle==="galaxy"){dust.scale.setScalar(1.08);dust.material.opacity=.44;}';
const SCENE_WITH_MORPHOLOGY = `${SCENE_ANCHOR}if(threeStyle==="galaxy")softenGalaxyCentralDust(dust);const galaxyDiscHaze=threeStyle==="galaxy"?createGalaxyDiscHaze(THREE,username,galaxyArmCount(graph),GALAXY_LOG_PITCH,42*dust.scale.x):null;if(galaxyDiscHaze){scene.add(galaxyDiscHaze);document.body.dataset.galaxyDiscTexture="procedural-haze-v2";}const galaxyBulge=threeStyle==="galaxy"?createGalaxyCentralBulge(THREE,username,glowTexture):null;if(galaxyBulge){scene.add(galaxyBulge);document.body.dataset.galaxyCentralStructure="bulge";}`;
const CURRENT_DISC_TEXTURE_SIGNATURE = "function createGalaxyDiscHaze(THREE,seed,armCount=4,pitch=0,referenceRadius=42){";
const CURRENT_BULGE_SIGNATURE = "function createGalaxyCentralBulge(THREE,seed,glowTexture){";
const LEGACY_DISC_TEXTURE_SIGNATURES = [
  "function createGalaxyDiscHaze(THREE,seed){",
  "function createGalaxyDiscHaze(THREE,seed,armCount=4,pitch=0){",
];
const GALAXY_PATTERN_ANIMATE = 'dust.rotation.y+=delta*(threeStyle==="galaxy"?TAU/GALAXY_PATTERN_PERIOD:.0035);';
const GALAXY_PATTERN_ANIMATE_WITH_HAZE = 'const galaxyPatternDelta=delta*(threeStyle==="galaxy"?TAU/GALAXY_PATTERN_PERIOD:.0035);dust.rotation.y+=galaxyPatternDelta;if(threeStyle==="galaxy"&&galaxyDiscHaze)galaxyDiscHaze.rotation.z+=galaxyPatternDelta;';
const GALAXY_MOTION_SNAPSHOT = 'window.ProjectMapThreejsGalaxyMotion=Object.freeze({snapshot:()=>({...galaxyMotion.snapshot(),persistentEdgeObjects:edgeLines?1:0})});';
const GALAXY_MOTION_SNAPSHOT_WITH_HAZE = 'window.ProjectMapThreejsGalaxyMotion=Object.freeze({snapshot:()=>({...galaxyMotion.snapshot(),persistentEdgeObjects:edgeLines?1:0,discHazePatternFrame:galaxyDiscHaze?"co-rotating-arm-pattern":"none",dustPatternRotationY:dust.rotation.y,hazePatternRotationY:galaxyDiscHaze?galaxyDiscHaze.rotation.z:null,dustPatternReferenceRadius:42*dust.scale.x,hazePatternReferenceRadius:galaxyDiscHaze?galaxyDiscHaze.userData.referenceRadius:null})});';
const CURRENT_MORPHOLOGY_MARKERS = [
  CURRENT_DISC_TEXTURE_SIGNATURE,
  CURRENT_BULGE_SIGNATURE,
  SCENE_WITH_MORPHOLOGY,
  GALAXY_PATTERN_ANIMATE_WITH_HAZE,
  GALAXY_MOTION_SNAPSHOT_WITH_HAZE,
];

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

function assertCurrentMorphologyInput(source) {
  for (const signature of LEGACY_DISC_TEXTURE_SIGNATURES) {
    if (source.includes(signature)) {
      throw new Error("Legacy Galaxy morphology intermediate is unsupported; rebuild from fresh canonical source");
    }
  }
  const currentCount = CURRENT_MORPHOLOGY_MARKERS.filter((marker) => source.includes(marker)).length;
  if (currentCount !== 0 && currentCount !== CURRENT_MORPHOLOGY_MARKERS.length) {
    throw new Error("Partial Galaxy morphology intermediate is unsupported; rebuild from fresh canonical source");
  }
}

export function patchThreejsGalaxyCentralBulgeRuntime(source) {
  assertCurrentMorphologyInput(source);
  let next = source;
  if (!next.includes(CURRENT_DISC_TEXTURE_SIGNATURE)) {
    next = replaceRequired(next, RUNTIME_ANCHOR, `${GALAXY_DISC_TEXTURE_HELPER}\n${RUNTIME_ANCHOR}`, "Galaxy procedural disc-texture helper insertion point");
  }
  if (!next.includes(CURRENT_BULGE_SIGNATURE)) {
    next = replaceRequired(next, RUNTIME_ANCHOR, `${GALAXY_BULGE_HELPER}\n${RUNTIME_ANCHOR}`, "Galaxy central-bulge helper insertion point");
  }
  next = replaceRequired(next, SCENE_ANCHOR, SCENE_WITH_MORPHOLOGY, "Galaxy current central morphology scene insertion point");
  next = replaceRequired(next, GALAXY_PATTERN_ANIMATE, GALAXY_PATTERN_ANIMATE_WITH_HAZE, "Galaxy haze/pattern phase-locked animation");
  next = replaceRequired(next, GALAXY_MOTION_SNAPSHOT, GALAXY_MOTION_SNAPSHOT_WITH_HAZE, "Galaxy haze motion evidence snapshot");
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
  console.log(`Applied Three.js Galaxy central morphology${result.changed ? "" : " (already present)"}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
