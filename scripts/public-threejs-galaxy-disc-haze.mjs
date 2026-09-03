import { THREEJS_GALAXY_CENTRAL_MORPHOLOGY_SCENE } from "./public-threejs-galaxy-central-morphology.mjs";

const RUNTIME_ANCHOR = "function createSceneRuntime(THREE,graph,username){";
const CENTRAL_BULGE_ANCHOR = "const galaxyBulge=galaxyCentralMorphology?createGalaxyCentralBulge(THREE,username,glowTexture):null;";

export const THREEJS_GALAXY_DISC_HAZE_HELPERS = `function galaxyDiscSmooth(value){value=Math.max(0,Math.min(1,value));return value*value*(3-2*value);}function galaxyDiscNoise(seed,x,y){const x0=Math.floor(x),y0=Math.floor(y),fx=galaxyDiscSmooth(x-x0),fy=galaxyDiscSmooth(y-y0),sample=(ix,iy)=>hashUnit(seed+":disc:"+ix+":"+iy),a=sample(x0,y0),b=sample(x0+1,y0),c=sample(x0,y0+1),d=sample(x0+1,y0+1),top=a+(b-a)*fx,bottom=c+(d-c)*fx;return top+(bottom-top)*fy;}function createGalaxyDiscHaze(THREE,seed,armCount=4,pitch=0,referenceRadius=42){const size=128,canvas=document.createElement("canvas");canvas.width=size;canvas.height=size;const context=canvas.getContext("2d",{alpha:true});if(!context)return null;const image=context.createImageData(size,size),data=image.data;for(let py=0;py<size;py+=1){for(let px=0;px<size;px+=1){const u=(px+.5)/size,v=(py+.5)/size,nx=(u-.5)*2,nz=(v-.5)*2,radius=Math.hypot(nx,nz);if(radius>=1)continue;const center=galaxyDiscSmooth((radius-.12)/.1),edge=1-galaxyDiscSmooth((radius-.72)/.26),coarse=galaxyDiscNoise(seed,u*4.4,v*4.4),fine=galaxyDiscNoise(seed+":fine",u*8.2,v*8.2),cloud=.72*coarse+.28*fine,angle=Math.atan2(-nz,nx),visualRadius=radius*312,spiral=pitch>0?Math.log(Math.max(1,visualRadius/referenceRadius))/Math.tan(pitch):0,armWave=.5+.5*Math.cos((angle-spiral)*armCount),armMod=.79+.56*armWave*armWave,alpha=Math.round(255*.18*center*edge*(.38+.62*cloud)*armMod),warm=1-Math.min(1,radius),offset=(py*size+px)*4;data[offset]=Math.round(92+44*warm);data[offset+1]=Math.round(116+40*warm);data[offset+2]=Math.round(176+36*warm);data[offset+3]=alpha;}}context.putImageData(image,0,0);const texture=new THREE.CanvasTexture(canvas);texture.name="galaxy-disc-haze-texture";texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;const geometry=new THREE.CircleGeometry(312,96),material=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.46,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false}),mesh=new THREE.Mesh(geometry,material);mesh.name="galaxy-disc-haze";mesh.rotation.x=-Math.PI/2;mesh.position.y=-6;mesh.renderOrder=-2;mesh.raycast=()=>{};mesh.userData.decorative=true;mesh.userData.semantic=false;mesh.userData.textureModel="procedural-low-frequency-log-arm-haze";mesh.userData.textureSize=size;mesh.userData.centerClearFraction=.12;mesh.userData.armCount=armCount;mesh.userData.pitchAngleDeg=pitch*180/Math.PI;mesh.userData.referenceRadius=referenceRadius;return mesh;}`;

export const THREEJS_GALAXY_DISC_HAZE_SCENE = 'const galaxyDiscHaze=document.body.dataset.mapStyle==="threejs-galaxy"?createGalaxyDiscHaze(THREE,username,galaxyArmCount(graph),GALAXY_LOG_PITCH,42*dust.scale.x):null;if(galaxyDiscHaze){scene.add(galaxyDiscHaze);document.body.dataset.galaxyDiscTexture="procedural-haze-v2";}';

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

export function composeThreejsGalaxyDiscHazeRuntime(source) {
  let next = source;
  if (!next.includes("function createGalaxyDiscHaze(THREE,seed,armCount=4,pitch=0,referenceRadius=42)")) {
    next = replaceRequired(
      next,
      RUNTIME_ANCHOR,
      `${THREEJS_GALAXY_DISC_HAZE_HELPERS}\n${RUNTIME_ANCHOR}`,
      "Three.js Galaxy canonical disc-haze helper insertion point",
    );
  }
  if (!next.includes(THREEJS_GALAXY_DISC_HAZE_SCENE)) {
    const sceneWithHaze = THREEJS_GALAXY_CENTRAL_MORPHOLOGY_SCENE.replace(
      CENTRAL_BULGE_ANCHOR,
      `${THREEJS_GALAXY_DISC_HAZE_SCENE}${CENTRAL_BULGE_ANCHOR}`,
    );
    if (sceneWithHaze === THREEJS_GALAXY_CENTRAL_MORPHOLOGY_SCENE) {
      throw new Error("Could not locate Three.js Galaxy canonical bulge scene boundary");
    }
    next = replaceRequired(
      next,
      THREEJS_GALAXY_CENTRAL_MORPHOLOGY_SCENE,
      sceneWithHaze,
      "Three.js Galaxy canonical disc-haze scene insertion point",
    );
  }
  return next;
}
