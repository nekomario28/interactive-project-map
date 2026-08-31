import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GALAXY_MOTION_HELPERS = `function galaxyArmCount(graph){const count=Math.max(1,graph.nodes.filter((node)=>node.type==="group").length);return count<=4?2:count<=8?3:4;}function createGalaxyMotionModel(THREE,graph,positions,nodeMeshes){const groups=graph.nodes.filter((node)=>node.type==="group"),repositories=graph.nodes.filter((node)=>node.type==="repository"),groupById=new Map(),groupByLabel=new Map();for(const group of groups){groupById.set(group.id,group);groupById.set(String(group.id).replace(/^group:/,""),group);groupByLabel.set(group.label,group);}const grouped=new Map(groups.map((group)=>[group.id,[]])),assigned=new Set();for(const repo of repositories){if(repo.relation==="contributed")continue;const group=groupById.get(repo.groupId)||groupByLabel.get(repo.groupLabel);if(group){grouped.get(group.id).push(repo);assigned.add(repo.id);}}const rotationPeriod=(radius)=>clamp(radius*16,1200,4200),rotateXZ=(source,angle,target)=>{const cos=Math.cos(angle),sin=Math.sin(angle);target.set(source.x*cos+source.z*sin,source.y,-source.x*sin+source.z*cos);return target;},systems=[];for(const group of groups){const mesh=nodeMeshes.get(group.id),base=positions.get(group.id);if(!mesh||!base)continue;const radius=Math.hypot(base.x,base.z),members=[];for(const repo of grouped.get(group.id)||[]){const repoMesh=nodeMeshes.get(repo.id),repoBase=positions.get(repo.id);if(!repoMesh||!repoBase)continue;const local=repoBase.clone().sub(base),localRadius=Math.hypot(local.x,local.z),ring=Math.max(0,Math.floor(Math.max(0,localRadius-12)/7));members.push({id:repo.id,mesh:repoMesh,base:local,period:480+ring*220+hashUnit(repo.id+":galaxy-motion-period")*120,verticalAmplitude:Math.min(1.4,localRadius*.06),verticalPhase:hashUnit(repo.id+":galaxy-motion-y")*TAU});}systems.push({id:group.id,mesh,base:base.clone(),radius,period:rotationPeriod(radius),members});}const makeGalacticOrbit=(repo)=>{const mesh=nodeMeshes.get(repo.id),base=positions.get(repo.id);if(!mesh||!base)return null;const radius=Math.hypot(base.x,base.z);return{id:repo.id,mesh,base:base.clone(),radius,period:rotationPeriod(radius)};},loose=repositories.filter((repo)=>repo.relation!=="contributed"&&!assigned.has(repo.id)).map(makeGalacticOrbit).filter(Boolean),external=repositories.filter((repo)=>repo.relation==="contributed").map(makeGalacticOrbit).filter(Boolean),tempCenter=new THREE.Vector3(),tempLocal=new THREE.Vector3();let elapsed=0;function step(delta){if(delta<=0)return false;elapsed+=delta;for(const system of systems){const globalAngle=TAU*elapsed/system.period;rotateXZ(system.base,globalAngle,tempCenter);system.mesh.position.copy(tempCenter);for(const member of system.members){const localAngle=TAU*elapsed/member.period;rotateXZ(member.base,globalAngle+localAngle,tempLocal);member.mesh.position.set(tempCenter.x+tempLocal.x,tempCenter.y+member.base.y+(Math.sin(localAngle+member.verticalPhase)-Math.sin(member.verticalPhase))*member.verticalAmplitude,tempCenter.z+tempLocal.z);}}for(const orbit of [...loose,...external]){const angle=TAU*elapsed/orbit.period;rotateXZ(orbit.base,angle,orbit.mesh.position);}return systems.length+loose.length+external.length>0;}function snapshot(){const read=(item)=>({id:item.id,radius:item.radius,period:item.period,x:item.mesh.position.x,y:item.mesh.position.y,z:item.mesh.position.z});return{model:"flat-curve-inspired",direction:"co-rotating",armCount:galaxyArmCount(graph),edgePolicy:"structural-only",elapsed,systems:systems.map((system)=>({...read(system),repositories:system.members.map((member)=>({id:member.id,period:member.period,x:member.mesh.position.x,y:member.mesh.position.y,z:member.mesh.position.z}))})),loose:loose.map(read),external:external.map(read)};}return{step,snapshot};}`;

const GALAXY_LAYOUT_ARM_COUNT = "armCount=count<=3?1:count<=8?2:3,";
const ASTRONOMY_LAYOUT_ARM_COUNT = "armCount=count<=4?2:count<=8?3:4,";
const GALAXY_GROUP_THICKNESS = 'y=(hashUnit(group.id+":galaxy-y")-.5)*14,';
const ASTRONOMY_GROUP_THICKNESS = 'y=(hashUnit(group.id+":galaxy-y")-.5)*6,';
const GALAXY_REPO_THICKNESS = 'thickness=(hashUnit(repo.id+":galaxy-thickness")-.5)*(10+ring*2.6);';
const ASTRONOMY_REPO_THICKNESS = 'thickness=(hashUnit(repo.id+":galaxy-thickness")-.5)*(5+ring*1.4);';
const GALAXY_LOOSE_THICKNESS = '(hashUnit(repo.id+":galaxy-loose-y")-.5)*24';
const ASTRONOMY_LOOSE_THICKNESS = '(hashUnit(repo.id+":galaxy-loose-y")-.5)*10';
const GALAXY_EXTERNAL_THICKNESS = '(hashUnit(repo.id+":galaxy-external-y")-.5)*34';
const ASTRONOMY_EXTERNAL_THICKNESS = '(hashUnit(repo.id+":galaxy-external-y")-.5)*14';
const DUST_FUNCTION = "function createSpiralDust(THREE,seed){";
const DUST_FUNCTION_WITH_ARMS = "function createSpiralDust(THREE,seed,armCount=4,winding=2.1){armCount=clamp(Math.floor(armCount)||4,1,4);";
const DUST_ARM = "const arm=index%4,";
const DUST_ARM_DYNAMIC = "const arm=index%armCount,";
const DUST_ANGLE = "angle=arm*TAU/4+t*TAU*2.1+jitter*.008;";
const DUST_ANGLE_DYNAMIC = "angle=arm*TAU/armCount+t*TAU*winding+jitter*.008;";
const DUST_CALL = "dust=createSpiralDust(THREE,username);";
const DUST_CALL_GALAXY = "dust=createSpiralDust(THREE,username,threeStyle===\"galaxy\"?galaxyArmCount(graph):4,threeStyle===\"galaxy\"?1.35:2.1);";
const MOTION_INIT_ANCHOR = "let edgeLines=null;const edgeMaterial=";
const MOTION_INIT = "const galaxyMotion=threeStyle===\"galaxy\"?createGalaxyMotionModel(THREE,graph,positions,nodeMeshes):null;if(galaxyMotion)window.ProjectMapThreejsGalaxyMotion=Object.freeze({snapshot:()=>galaxyMotion.snapshot()});let edgeLines=null;const edgeMaterial=";
const EDGE_MATERIAL = "const edgeMaterial=new THREE.LineBasicMaterial({color:0x607399,transparent:true,opacity:.25,blending:THREE.AdditiveBlending});";
const GALAXY_EDGE_MATERIAL = "const edgeMaterial=new THREE.LineBasicMaterial({color:0x607399,transparent:true,opacity:threeStyle===\"galaxy\"?.11:.25,blending:THREE.AdditiveBlending});";
const EDGE_LOOP_START = "for(const edge of graph.edges){const source=nodeMeshes.get(edge.source),targetMesh=nodeMeshes.get(edge.target);";
const GALAXY_EDGE_LOOP_START = "for(const edge of graph.edges){if(threeStyle===\"galaxy\"&&edge.type===\"contribution\")continue;const source=nodeMeshes.get(edge.source),targetMesh=nodeMeshes.get(edge.target);";
const EDGE_END = "edgeLines.renderOrder=-1;root.add(edgeLines);}";
const EDGE_SYNC = "edgeLines.renderOrder=-1;root.add(edgeLines);}function syncDynamicEdges(){if(!edgeLines)return;const attribute=edgeLines.geometry.getAttribute(\"position\");if(!attribute)return;let cursor=0;for(const edge of graph.edges){if(threeStyle===\"galaxy\"&&edge.type===\"contribution\")continue;const source=nodeMeshes.get(edge.source),targetMesh=nodeMeshes.get(edge.target);if(!source||!targetMesh||!source.visible||!targetMesh.visible)continue;attribute.setXYZ(cursor++,source.position.x,source.position.y,source.position.z);attribute.setXYZ(cursor++,targetMesh.position.x,targetMesh.position.y,targetMesh.position.z);}attribute.needsUpdate=true;}";
const ANIMATE_DUST = "dust.rotation.y+=delta*.0035;";
const ANIMATE_DUST_GALAXY = "dust.rotation.y+=delta*(threeStyle===\"galaxy\"?.0011:.0035);";
const NEBULA_ANIMATE_END = "nebulae.forEach((sprite,index)=>{sprite.material.rotation+=delta*(index%2?-.004:.003);});}";
const NEBULA_ANIMATE_WITH_GALAXY = "nebulae.forEach((sprite,index)=>{sprite.material.rotation+=delta*(index%2?-.004:.003);});if(galaxyMotion&&galaxyMotion.step(delta)){syncDynamicEdges();if(selectedMesh)desiredTarget.copy(selectedMesh.position);}}";

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

export function patchThreejsGalaxyMotionRuntime(source) {
  let next = source;
  if (!next.includes("function createGalaxyMotionModel(THREE,graph,positions,nodeMeshes)")) {
    next = replaceRequired(next, "function createSceneRuntime(THREE,graph,username){", `${GALAXY_MOTION_HELPERS}\nfunction createSceneRuntime(THREE,graph,username){`, "Galaxy motion helper insertion point");
  }
  next = replaceRequired(next, GALAXY_LAYOUT_ARM_COUNT, ASTRONOMY_LAYOUT_ARM_COUNT, "Galaxy 2-4 arm layout model");
  next = replaceRequired(next, GALAXY_GROUP_THICKNESS, ASTRONOMY_GROUP_THICKNESS, "Galaxy group disc thickness");
  next = replaceRequired(next, GALAXY_REPO_THICKNESS, ASTRONOMY_REPO_THICKNESS, "Galaxy repository disc thickness");
  next = replaceRequired(next, GALAXY_LOOSE_THICKNESS, ASTRONOMY_LOOSE_THICKNESS, "Galaxy loose-repository disc thickness");
  next = replaceRequired(next, GALAXY_EXTERNAL_THICKNESS, ASTRONOMY_EXTERNAL_THICKNESS, "Galaxy external-lane disc thickness");
  next = replaceRequired(next, DUST_FUNCTION, DUST_FUNCTION_WITH_ARMS, "spiral dust arm-count function");
  next = replaceRequired(next, DUST_ARM, DUST_ARM_DYNAMIC, "spiral dust dynamic arm index");
  next = replaceRequired(next, DUST_ANGLE, DUST_ANGLE_DYNAMIC, "spiral dust winding model");
  next = replaceRequired(next, DUST_CALL, DUST_CALL_GALAXY, "Galaxy spiral dust call");
  next = replaceRequired(next, MOTION_INIT_ANCHOR, MOTION_INIT, "Galaxy motion runtime initialization");
  next = replaceRequired(next, EDGE_MATERIAL, GALAXY_EDGE_MATERIAL, "Galaxy edge opacity policy");
  next = replaceRequired(next, EDGE_LOOP_START, GALAXY_EDGE_LOOP_START, "Galaxy persistent contribution-edge suppression");
  next = replaceRequired(next, EDGE_END, EDGE_SYNC, "dynamic edge synchronization");
  next = replaceRequired(next, ANIMATE_DUST, ANIMATE_DUST_GALAXY, "Galaxy pattern speed");
  next = replaceRequired(next, NEBULA_ANIMATE_END, NEBULA_ANIMATE_WITH_GALAXY, "Galaxy node motion animation");
  return next;
}

export async function applyThreejsGalaxyMotion({ siteDir = join(process.cwd(), "site") } = {}) {
  const runtimePath = join(siteDir, "threejs-viewer.js");
  const source = await readFile(runtimePath, "utf8");
  const next = patchThreejsGalaxyMotionRuntime(source);
  if (next !== source) await writeFile(runtimePath, next);
  return { runtimePath, changed: next !== source };
}

async function main() {
  const result = await applyThreejsGalaxyMotion();
  console.log(`Applied Three.js Galaxy motion${result.changed ? "" : " (already present)"}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
