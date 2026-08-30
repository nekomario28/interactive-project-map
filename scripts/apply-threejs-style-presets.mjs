import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const STYLE_HELPERS = `const THREE_STYLE_IDS=new Set(["cosmic","aurora","wireframe"]);const THREE_STYLE_THEMES={cosmic:{background:0x02040b,fog:0x030610,fogDensity:.00225,hemiSky:0x91aaff,hemiGround:0x080510,hemiIntensity:1.35,center:0x8fb8ff,centerIntensity:680,centerDistance:520,centerDecay:1.7,rim:0xb36cff,rimIntensity:340,rimDistance:480,rimDecay:2,nebulaHues:[218,258,302,188],nebulaOpacityScale:1},aurora:{background:0x00100f,fog:0x04211f,fogDensity:.0021,hemiSky:0x80ffd9,hemiGround:0x03120f,hemiIntensity:1.5,center:0x59ffd0,centerIntensity:720,centerDistance:540,centerDecay:1.6,rim:0x9b7bff,rimIntensity:380,rimDistance:500,rimDecay:1.9,nebulaHues:[164,188,272,128],nebulaOpacityScale:.9},wireframe:{background:0x050608,fog:0x090a0d,fogDensity:.00155,hemiSky:0xe9f5ff,hemiGround:0x050607,hemiIntensity:.72,center:0xbfeeff,centerIntensity:430,centerDistance:480,centerDecay:1.8,rim:0x68dfff,rimIntensity:220,rimDistance:430,rimDecay:2,nebulaHues:[198,218,248,178],nebulaOpacityScale:.16}};function currentThreeStyle(){const value=new URL(location.href).searchParams.get("style3d");return THREE_STYLE_IDS.has(value)?value:"cosmic";}function threeStyleLabel(value){return value==="aurora"?"Aurora":value==="wireframe"?"Wireframe":"Cosmic";}`;

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

export function patchThreejsStyleRuntime(source) {
  let next = source;
  if (!next.includes("const THREE_STYLE_IDS=new Set")) {
    next = replaceRequired(next, "const TAU = Math.PI * 2;", `const TAU = Math.PI * 2;\n${STYLE_HELPERS}`, "Three.js style helper insertion point");
  }

  next = replaceRequired(
    next,
    "function createSceneRuntime(THREE,graph,username){",
    "function createSceneRuntime(THREE,graph,username){const threeStyle=currentThreeStyle(),threeTheme=THREE_STYLE_THEMES[threeStyle];document.body.dataset.mapStyle=`threejs-${threeStyle}`;",
    "Three.js scene style initialization",
  );
  next = replaceRequired(
    next,
    "const scene=new THREE.Scene();scene.background=new THREE.Color(0x02040b);scene.fog=new THREE.FogExp2(0x030610,.00225);",
    "const scene=new THREE.Scene();scene.background=new THREE.Color(threeTheme.background);scene.fog=new THREE.FogExp2(threeTheme.fog,threeTheme.fogDensity);",
    "Three.js scene background theme",
  );
  next = replaceRequired(
    next,
    "const root=new THREE.Group();scene.add(root);scene.add(new THREE.HemisphereLight(0x91aaff,0x080510,1.35));const centerLight=new THREE.PointLight(0x8fb8ff,680,520,1.7);centerLight.position.set(0,18,0);scene.add(centerLight);const rimLight=new THREE.PointLight(0xb36cff,340,480,2);rimLight.position.set(-120,80,120);scene.add(rimLight);",
    "const root=new THREE.Group();scene.add(root);scene.add(new THREE.HemisphereLight(threeTheme.hemiSky,threeTheme.hemiGround,threeTheme.hemiIntensity));const centerLight=new THREE.PointLight(threeTheme.center,threeTheme.centerIntensity,threeTheme.centerDistance,threeTheme.centerDecay);centerLight.position.set(0,18,0);scene.add(centerLight);const rimLight=new THREE.PointLight(threeTheme.rim,threeTheme.rimIntensity,threeTheme.rimDistance,threeTheme.rimDecay);rimLight.position.set(-120,80,120);scene.add(rimLight);",
    "Three.js light theme",
  );
  next = replaceRequired(
    next,
    "const nebulae=[];[218,258,302,188].forEach((hue,index)=>{const material=new THREE.SpriteMaterial({map:makeNebulaTexture(THREE,hue),transparent:true,opacity:.64-index*.08,depthWrite:false,blending:THREE.AdditiveBlending})",
    "const nebulae=[];threeTheme.nebulaHues.forEach((hue,index)=>{const material=new THREE.SpriteMaterial({map:makeNebulaTexture(THREE,hue),transparent:true,opacity:(.64-index*.08)*threeTheme.nebulaOpacityScale,depthWrite:false,blending:THREE.AdditiveBlending})",
    "Three.js nebula theme",
  );
  next = replaceRequired(
    next,
    "scene.add(farStars,midStars,nearStars,dust);",
    "scene.add(farStars,midStars,nearStars,dust);dust.visible=threeStyle!==\"wireframe\";",
    "Three.js wireframe dust policy",
  );
  next = replaceRequired(
    next,
    "metalness:node.type===\"repository\"?.12:.28,transparent:node.archived===true",
    "metalness:node.type===\"repository\"?.12:.28,wireframe:threeStyle===\"wireframe\",transparent:node.archived===true",
    "Three.js wireframe material policy",
  );
  next = replaceRequired(
    next,
    "renderer:\"threejs-cosmic\",experimental:true",
    "renderer:`threejs-${currentThreeStyle()}`,style:currentThreeStyle(),experimental:true",
    "Three.js renderer snapshot style",
  );
  next = replaceRequired(
    next,
    "document.title=`${username} · Three.js Cosmic Lab`;",
    "document.title=`${username} · Three.js ${threeStyleLabel(currentThreeStyle())} Lab`;",
    "Three.js style-aware document title",
  );
  return next;
}

export async function applyThreejsStylePresets({ siteDir = join(process.cwd(), "site") } = {}) {
  const runtimePath = join(siteDir, "threejs-viewer.js");
  const source = await readFile(runtimePath, "utf8");
  const next = patchThreejsStyleRuntime(source);
  if (next !== source) await writeFile(runtimePath, next);
  return { runtimePath, changed: next !== source };
}

async function main() {
  const result = await applyThreejsStylePresets();
  console.log(`Applied Three.js style presets${result.changed ? "" : " (already present)"}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
