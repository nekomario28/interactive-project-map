const GALAXY_MOTION_HELPERS = `function createGalaxyMotionModel(graph,positions){const groups=graph.nodes.filter((node)=>node.type==="group"),repositories=graph.nodes.filter((node)=>node.type==="repository"),groupById=new Map(),groupByLabel=new Map();for(const group of groups){groupById.set(group.id,group);groupById.set(group.id.replace(/^group:/,""),group);groupByLabel.set(group.label,group);}const groupOrbits=[];for(const group of groups){const point=positions.get(group.id);if(!point)continue;const radius=Math.hypot(point.x,point.z),phase=Math.atan2(point.z,point.x),period=clamp(150+radius*.58,180,280);groupOrbits.push({nodeId:group.id,radius,phase,y:point.y,omega:TAU/period});}const repositoryOrbits=[];for(const repo of repositories){const point=positions.get(repo.id);if(!point)continue;if(repo.relation==="contributed"){const radius=Math.hypot(point.x,point.z),phase=Math.atan2(point.z,point.x),period=clamp(210+radius*.52,300,430);repositoryOrbits.push({kind:"galactic",nodeId:repo.id,radius,phase,y:point.y,omega:TAU/period});continue;}const group=groupById.get(repo.groupId)||groupByLabel.get(repo.groupLabel)||null,center=group?positions.get(group.id):null;if(center){const dx=point.x-center.x,dz=point.z-center.z,radius=Math.max(1,Math.hypot(dx,dz)),phase=Math.atan2(dz,dx),period=clamp(18*Math.pow(Math.max(radius,8)/12,1.5),24,88);repositoryOrbits.push({kind:"local",nodeId:repo.id,groupId:group.id,radius,phase,yOffset:point.y-center.y,omega:TAU/period});}else{const radius=Math.hypot(point.x,point.z),phase=Math.atan2(point.z,point.x),period=clamp(180+radius*.5,240,380);repositoryOrbits.push({kind:"galactic",nodeId:repo.id,radius,phase,y:point.y,omega:TAU/period});}}return {time:0,groups:groupOrbits,repositories:repositoryOrbits};}`;

const POSITION_STATE = 'const positions=threeStyle==="galaxy"?layoutGalaxyGraph(THREE,graph):layoutGraph(THREE,graph),nodeMeshes=new Map(),';
const POSITION_STATE_WITH_MOTION = 'const positions=threeStyle==="galaxy"?layoutGalaxyGraph(THREE,graph):layoutGraph(THREE,graph),galaxyMotion=threeStyle==="galaxy"?createGalaxyMotionModel(graph,positions):null,nodeMeshes=new Map(),';
const FILTER_ANCHOR = 'const filters=new Map(ui.statusButtons.map((button)=>[button.dataset.statusFilter,true]));let searchQuery="";';
const GALAXY_RUNTIME_MOTION = `function syncEdgePositions(){if(!edgeLines)return;const attribute=edgeLines.geometry.getAttribute("position");if(!attribute)return;let cursor=0;for(const edge of graph.edges){const source=nodeMeshes.get(edge.source),targetMesh=nodeMeshes.get(edge.target);if(!source||!targetMesh||!source.visible||!targetMesh.visible)continue;if(cursor+1>=attribute.count)break;attribute.setXYZ(cursor++,source.position.x,source.position.y,source.position.z);attribute.setXYZ(cursor++,targetMesh.position.x,targetMesh.position.y,targetMesh.position.z);}attribute.needsUpdate=true;}function advanceGalaxyMotion(delta){if(!galaxyMotion||delta<=0)return;galaxyMotion.time+=delta;for(const orbit of galaxyMotion.groups){const mesh=nodeMeshes.get(orbit.nodeId);if(!mesh)continue;const angle=orbit.phase+galaxyMotion.time*orbit.omega;mesh.position.set(Math.cos(angle)*orbit.radius,orbit.y,Math.sin(angle)*orbit.radius);}for(const orbit of galaxyMotion.repositories){const mesh=nodeMeshes.get(orbit.nodeId);if(!mesh)continue;const angle=orbit.phase+galaxyMotion.time*orbit.omega;if(orbit.kind==="local"){const center=nodeMeshes.get(orbit.groupId);if(!center)continue;mesh.position.set(center.position.x+Math.cos(angle)*orbit.radius,center.position.y+orbit.yOffset,center.position.z+Math.sin(angle)*orbit.radius);}else{mesh.position.set(Math.cos(angle)*orbit.radius,orbit.y,Math.sin(angle)*orbit.radius);}}}`;
const ANIMATE_ANCHOR = 'previousTime=now;setCameraFromOrbit(false);if(motionEnabled){farStars.rotation.y+=delta*.002;';
const ANIMATE_WITH_GALAXY = 'previousTime=now;setCameraFromOrbit(false);if(motionEnabled&&galaxyMotion){advanceGalaxyMotion(delta);syncEdgePositions();}if(motionEnabled){farStars.rotation.y+=delta*.002;';

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

export function patchThreejsGalaxyOrbits(source) {
  if (!source.includes("function layoutGalaxyGraph(THREE,graph)")) return source;
  let next = source;
  if (!next.includes("function createGalaxyMotionModel(graph,positions)")) {
    next = replaceRequired(
      next,
      "function createSceneRuntime(THREE,graph,username){",
      `${GALAXY_MOTION_HELPERS}\nfunction createSceneRuntime(THREE,graph,username){`,
      "Galaxy motion helper insertion point",
    );
  }
  next = replaceRequired(next, POSITION_STATE, POSITION_STATE_WITH_MOTION, "Galaxy motion state");
  if (!next.includes("function advanceGalaxyMotion(delta)")) {
    next = replaceRequired(next, FILTER_ANCHOR, `${GALAXY_RUNTIME_MOTION}${FILTER_ANCHOR}`, "Galaxy runtime motion insertion point");
  }
  next = replaceRequired(next, ANIMATE_ANCHOR, ANIMATE_WITH_GALAXY, "Galaxy animation hook");
  return next;
}
