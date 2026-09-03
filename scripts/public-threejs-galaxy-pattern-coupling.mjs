const CURRENT_DISC_TEXTURE_SIGNATURE = "function createGalaxyDiscHaze(THREE,seed,armCount=4,pitch=0,referenceRadius=42){";
const CURRENT_BULGE_SIGNATURE = "function createGalaxyCentralBulge(THREE,seed,glowTexture){";
const CANONICAL_HAZE_SCENE = 'const galaxyDiscHaze=document.body.dataset.mapStyle==="threejs-galaxy"?createGalaxyDiscHaze(THREE,username,galaxyArmCount(graph),GALAXY_LOG_PITCH,42*dust.scale.x):null;if(galaxyDiscHaze){scene.add(galaxyDiscHaze);document.body.dataset.galaxyDiscTexture="procedural-haze-v2";}';
const LEGACY_DISC_TEXTURE_SIGNATURES = [
  "function createGalaxyDiscHaze(THREE,seed){",
  "function createGalaxyDiscHaze(THREE,seed,armCount=4,pitch=0){",
];
const GALAXY_PATTERN_ANIMATE = 'dust.rotation.y+=delta*(threeStyle==="galaxy"?TAU/GALAXY_PATTERN_PERIOD:.0035);';
const GALAXY_PATTERN_ANIMATE_WITH_HAZE = 'const galaxyPatternDelta=delta*(threeStyle==="galaxy"?TAU/GALAXY_PATTERN_PERIOD:.0035);dust.rotation.y+=galaxyPatternDelta;if(threeStyle==="galaxy"&&galaxyDiscHaze)galaxyDiscHaze.rotation.z+=galaxyPatternDelta;';
const GALAXY_MOTION_SNAPSHOT = 'window.ProjectMapThreejsGalaxyMotion=Object.freeze({snapshot:()=>({...galaxyMotion.snapshot(),persistentEdgeObjects:edgeLines?1:0})});';
const GALAXY_MOTION_SNAPSHOT_WITH_HAZE = 'window.ProjectMapThreejsGalaxyMotion=Object.freeze({snapshot:()=>({...galaxyMotion.snapshot(),persistentEdgeObjects:edgeLines?1:0,discHazePatternFrame:galaxyDiscHaze?"co-rotating-arm-pattern":"none",dustPatternRotationY:dust.rotation.y,hazePatternRotationY:galaxyDiscHaze?galaxyDiscHaze.rotation.z:null,dustPatternReferenceRadius:42*dust.scale.x,hazePatternReferenceRadius:galaxyDiscHaze?galaxyDiscHaze.userData.referenceRadius:null})});';
const CANONICAL_GALAXY_PRESENTATION_MARKERS = [
  "function softenGalaxyCentralDust(dust){",
  CURRENT_BULGE_SIGNATURE,
  'const galaxyCentralMorphology=document.body.dataset.mapStyle==="threejs-galaxy";',
  "if(galaxyCentralMorphology)softenGalaxyCentralDust(dust);",
  CURRENT_DISC_TEXTURE_SIGNATURE,
  CANONICAL_HAZE_SCENE,
];
const CURRENT_PATTERN_COUPLING_MARKERS = [
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
  if (!CANONICAL_GALAXY_PRESENTATION_MARKERS.every((marker) => source.includes(marker))) {
    throw new Error("Canonical Galaxy central morphology or disc haze is missing; rebuild from fresh canonical source");
  }
  const currentCount = CURRENT_PATTERN_COUPLING_MARKERS.filter((marker) => source.includes(marker)).length;
  if (currentCount !== 0 && currentCount !== CURRENT_PATTERN_COUPLING_MARKERS.length) {
    throw new Error("Partial Galaxy haze pattern-coupling intermediate is unsupported; rebuild from fresh canonical source");
  }
}

export function composeThreejsGalaxyPatternCouplingRuntime(source) {
  assertCurrentMorphologyInput(source);
  let next = source;
  next = replaceRequired(next, GALAXY_PATTERN_ANIMATE, GALAXY_PATTERN_ANIMATE_WITH_HAZE, "Galaxy haze/pattern phase-locked animation");
  next = replaceRequired(next, GALAXY_MOTION_SNAPSHOT, GALAXY_MOTION_SNAPSHOT_WITH_HAZE, "Galaxy haze motion evidence snapshot");
  return next;
}
