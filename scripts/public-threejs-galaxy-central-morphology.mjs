import { composeThreejsGalaxyDiscHazeRuntime } from "./public-threejs-galaxy-disc-haze.mjs";

const RUNTIME_ANCHOR = "function createSceneRuntime(THREE,graph,username){";
const BASE_SCENE_ANCHOR = 'scene.add(farStars,midStars,nearStars,dust);';
const STYLED_SCENE_ANCHOR = 'scene.add(farStars,midStars,nearStars,dust);dust.visible=threeStyle!=="wireframe";if(threeStyle==="galaxy"){dust.scale.setScalar(1.08);dust.material.opacity=.44;}';

export const THREEJS_GALAXY_CENTRAL_MORPHOLOGY_HELPERS = `function softenGalaxyCentralDust(dust){const position=dust?.geometry?.getAttribute?.("position"),color=dust?.geometry?.getAttribute?.("color"),fadeStart=30,fadeEnd=64;if(!position||!color)return;for(let index=0;index<position.count;index+=1){const radius=Math.hypot(position.getX(index),position.getZ(index));if(radius>=fadeEnd)continue;const fade=Math.max(0,Math.min(1,(radius-fadeStart)/(fadeEnd-fadeStart)));color.setXYZ(index,color.getX(index)*fade,color.getY(index)*fade,color.getZ(index)*fade);}color.needsUpdate=true;}function createGalaxyCentralBulge(THREE,seed,glowTexture){const count=innerWidth<720?48:96,clearRadius=14,outerRadius=44,positions=new Float32Array(count*3);for(let index=0;index<count;index+=1){const theta=TAU*hashUnit(seed+":bulge:theta:"+index),vertical=hashUnit(seed+":bulge:vertical:"+index)*2-1,radius=clearRadius+(outerRadius-clearRadius)*Math.pow(hashUnit(seed+":bulge:radius:"+index),1.2);positions[index*3]=Math.cos(theta)*radius;positions[index*3+1]=vertical*radius*.42;positions[index*3+2]=Math.sin(theta)*radius;}const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));const material=new THREE.PointsMaterial({color:0xffd8aa,size:innerWidth<720?.9:1.08,transparent:true,opacity:.1,depthWrite:false,sizeAttenuation:true,blending:THREE.AdditiveBlending}),points=new THREE.Points(geometry,material);points.name="galaxy-bulge-stars";const glowMaterial=new THREE.SpriteMaterial({map:glowTexture,color:0xffcf91,transparent:true,opacity:.12,depthWrite:false,blending:THREE.AdditiveBlending}),glow=new THREE.Sprite(glowMaterial);glow.name="galaxy-bulge-glow";glow.scale.set(88,72,1);glow.position.set(0,1,0);const group=new THREE.Group();group.name="galaxy-central-bulge";group.userData.decorative=true;group.userData.semantic=false;group.userData.particleCount=count;group.userData.clearRadius=clearRadius;group.add(points,glow);return group;}`;

export const THREEJS_GALAXY_CENTRAL_MORPHOLOGY_SCENE = 'const galaxyCentralMorphology=document.body.dataset.mapStyle==="threejs-galaxy";if(galaxyCentralMorphology)softenGalaxyCentralDust(dust);const galaxyBulge=galaxyCentralMorphology?createGalaxyCentralBulge(THREE,username,glowTexture):null;if(galaxyBulge){scene.add(galaxyBulge);document.body.dataset.galaxyCentralStructure="bulge";}';

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

export function composeThreejsGalaxyCentralMorphologyRuntime(source) {
  let next = source;
  if (!next.includes("function createGalaxyCentralBulge(THREE,seed,glowTexture)")) {
    next = replaceRequired(
      next,
      RUNTIME_ANCHOR,
      `${THREEJS_GALAXY_CENTRAL_MORPHOLOGY_HELPERS}\n${RUNTIME_ANCHOR}`,
      "Three.js Galaxy canonical central-morphology helper insertion point",
    );
  }
  if (!next.includes(THREEJS_GALAXY_CENTRAL_MORPHOLOGY_SCENE)) {
    const sceneAnchor = next.includes(STYLED_SCENE_ANCHOR) ? STYLED_SCENE_ANCHOR : BASE_SCENE_ANCHOR;
    next = replaceRequired(
      next,
      sceneAnchor,
      `${sceneAnchor}${THREEJS_GALAXY_CENTRAL_MORPHOLOGY_SCENE}`,
      "Three.js Galaxy canonical central-morphology scene insertion point",
    );
  }
  return composeThreejsGalaxyDiscHazeRuntime(next);
}
