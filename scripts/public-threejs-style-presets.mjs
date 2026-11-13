const STYLE_HELPERS = `const THREE_STYLE_IDS=new Set(["cosmic","galaxy","aurora","wireframe"]);const THREE_STYLE_THEMES={cosmic:{background:0x02040b,fog:0x030610,fogDensity:.00072,hemiSky:0x91aaff,hemiGround:0x080510,hemiIntensity:1.15,center:0x8fb8ff,centerIntensity:520,centerDistance:880,centerDecay:1.35,rim:0xb36cff,rimIntensity:280,rimDistance:820,rimDecay:1.45,nebulaHues:[218,258,302,188],nebulaOpacityScale:.88},galaxy:{background:0x01030a,fog:0x020511,fogDensity:.00058,hemiSky:0xa8c5ff,hemiGround:0x090614,hemiIntensity:1.2,center:0xffe4b8,centerIntensity:580,centerDistance:960,centerDecay:1.32,rim:0xc278ff,rimIntensity:310,rimDistance:880,rimDecay:1.42,nebulaHues:[220,258,315,190],nebulaOpacityScale:.84},aurora:{background:0x00100f,fog:0x04211f,fogDensity:.00068,hemiSky:0x80ffd9,hemiGround:0x03120f,hemiIntensity:1.18,center:0x59ffd0,centerIntensity:540,centerDistance:880,centerDecay:1.34,rim:0x9b7bff,rimIntensity:290,rimDistance:820,rimDecay:1.45,nebulaHues:[164,188,272,128],nebulaOpacityScale:.85},wireframe:{background:0x050608,fog:0x090a0d,fogDensity:.00055,hemiSky:0xe9f5ff,hemiGround:0x050607,hemiIntensity:.85,center:0xbfeeff,centerIntensity:440,centerDistance:820,centerDecay:1.38,rim:0x68dfff,rimIntensity:240,rimDistance:760,rimDecay:1.48,nebulaHues:[198,218,248,178],nebulaOpacityScale:.20}};function currentThreeStyle(){const value=new URL(location.href).searchParams.get("style3d");return THREE_STYLE_IDS.has(value)?value:"galaxy";}function threeStyleLabel(value){return value==="galaxy"?"Galaxy":value==="aurora"?"Aurora":value==="wireframe"?"Wireframe":"Cosmic";}`;
const GALAXY_LAYOUT_HELPERS = `function layoutGalaxyGraph(THREE,graph){const owner=graph.nodes.find((node)=>node.type==="owner"),groups=graph.nodes.filter((node)=>node.type==="group"),repositories=graph.nodes.filter((node)=>node.type==="repository"),positions=new Map();if(owner)positions.set(owner.id,new THREE.Vector3(0,0,0));const ownedRepos=repositories.filter((node)=>node.relation!=="contributed"),grouped=new Map(groups.map((group)=>[group.id,[]]));for(const repo of ownedRepos){let group=groups.find((candidate)=>candidate.id===repo.groupId||candidate.id==="group:"+repo.groupId);if(!group&&repo.groupLabel)group=groups.find((candidate)=>candidate.label===repo.groupLabel);if(group)grouped.get(group.id).push(repo);}for(const members of grouped.values())members.sort((a,b)=>String(a.id).localeCompare(String(b.id)));const orderedGroups=groups.slice().sort((a,b)=>(grouped.get(b.id)?.length||0)-(grouped.get(a.id)?.length||0)||String(a.id).localeCompare(String(b.id))),count=Math.max(1,orderedGroups.length),armCount=count<=3?1:count<=8?2:3,tierCount=Math.max(1,Math.ceil(count/armCount)),baseRadius=58,maxGroupRadius=clamp(96+count*5,118,172),tierGap=tierCount>1?(maxGroupRadius-baseRadius)/(tierCount-1):0;let outerOwnedRadius=baseRadius;orderedGroups.forEach((group,index)=>{const arm=index%armCount,tier=Math.floor(index/armCount),angle=-Math.PI/2+arm*TAU/armCount+tier*.62+(hashUnit(group.id+":galaxy-angle")-.5)*.1,radius=baseRadius+tier*tierGap,y=(hashUnit(group.id+":galaxy-y")-.5)*14,center=new THREE.Vector3(Math.cos(angle)*radius,y,Math.sin(angle)*radius);positions.set(group.id,center);outerOwnedRadius=Math.max(outerOwnedRadius,radius+32);const members=grouped.get(group.id)||[];members.forEach((repo,memberIndex)=>{const ring=Math.floor(memberIndex/8),slot=memberIndex%8,ringCount=Math.min(8,members.length-ring*8),localAngle=TAU*slot/Math.max(1,ringCount)+hashUnit(repo.id+":galaxy-phase")*.16,localRadius=12+ring*7+hashUnit(repo.id+":galaxy-radius")*4,thickness=(hashUnit(repo.id+":galaxy-thickness")-.5)*(10+ring*2.6);positions.set(repo.id,new THREE.Vector3(center.x+Math.cos(localAngle)*localRadius,center.y+thickness,center.z+Math.sin(localAngle)*localRadius));outerOwnedRadius=Math.max(outerOwnedRadius,radius+localRadius+12);});});const ungrouped=ownedRepos.filter((repo)=>!positions.has(repo.id)).sort((a,b)=>String(a.id).localeCompare(String(b.id)));ungrouped.forEach((repo,index)=>{const arm=index%armCount,t=(index+.5)/Math.max(1,ungrouped.length),radius=outerOwnedRadius+10+t*24+(hashUnit(repo.id+":galaxy-loose-r")-.5)*12,spiral=typeof galaxyLogAngle==="function"?galaxyLogAngle(radius,baseRadius):t*1.2,angle=-Math.PI/2+arm*TAU/armCount+spiral+(hashUnit(repo.id+":galaxy-loose")-.5)*.42;positions.set(repo.id,new THREE.Vector3(Math.cos(angle)*radius,(hashUnit(repo.id+":galaxy-loose-y")-.5)*24,Math.sin(angle)*radius));});if(ungrouped.length)outerOwnedRadius+=26;const contributed=repositories.filter((node)=>node.relation==="contributed").sort((a,b)=>String(a.id).localeCompare(String(b.id))),externalBase=Math.max(142,outerOwnedRadius+14),extClusters=new Map();for(const repo of contributed){const key=repo.externalOwner||String(repo.label||"").split("/")[0]||repo.id;if(!extClusters.has(key))extClusters.set(key,[]);extClusters.get(key).push(repo);}const orderedClusters=[...extClusters.entries()].sort((a,b)=>b[1].length-a[1].length||String(a[0]).localeCompare(String(b[0])));orderedClusters.forEach(([ownerKey,members],clusterIndex)=>{const arm=clusterIndex%armCount,clusterT=(clusterIndex+.28*hashUnit(ownerKey+":ext-t"))/Math.max(1,orderedClusters.length),clusterRadius=externalBase+clusterT*74+(hashUnit(ownerKey+":ext-r")-.5)*26,spiralAngle=typeof galaxyLogAngle==="function"?galaxyLogAngle(clusterRadius,baseRadius):clusterT*1.45,clusterAngle=-Math.PI/2+arm*TAU/armCount+spiralAngle+(hashUnit(ownerKey+":ext-a")-.5)*.54,hubX=Math.cos(clusterAngle)*clusterRadius,hubZ=Math.sin(clusterAngle)*clusterRadius,hubY=(hashUnit(ownerKey+":ext-hub-y")-.5)*8;members.forEach((repo,memberIndex)=>{const isSingle=members.length===1,localRadius=isSingle?(hashUnit(repo.id+":galaxy-external-r")-.5)*14:6+Math.sqrt(memberIndex)*6.5+hashUnit(repo.id+":galaxy-external-r")*4.5,localAngle=isSingle?clusterAngle+(hashUnit(repo.id+":galaxy-external")-.5)*.22:memberIndex*2.39996+hashUnit(repo.id+":galaxy-external")*TAU,rx=isSingle?Math.cos(localAngle)*(clusterRadius+localRadius):hubX+Math.cos(localAngle)*localRadius,rz=isSingle?Math.sin(localAngle)*(clusterRadius+localRadius):hubZ+Math.sin(localAngle)*localRadius;positions.set(repo.id,new THREE.Vector3(rx,hubY+(hashUnit(repo.id+":galaxy-external-y")-.5)*34,rz));});});return positions;}`;
const RENDER_CONTROL = '<button id="renderDensityToggle" type="button" data-render-density="auto" title="Adjust WebGL backing-store density without changing repository Quality evidence.">Render Auto</button>\n      ';
const RENDER_SELECTOR = 'quality: document.getElementById("renderDensityToggle"),\n  ';
const RENDER_STATE = 'selectedMesh=null,quality=(["auto","high","low"].includes(new URL(location.href).searchParams.get("render"))?new URL(location.href).searchParams.get("render"):"auto"),motionEnabled=';
const FIXED_RENDER_STATE = 'selectedMesh=null,motionEnabled=';
const RENDER_RESIZE = 'function resize(){const rect=ui.canvas.getBoundingClientRect(),width=Math.max(1,rect.width),height=Math.max(1,rect.height);camera.aspect=width/height;camera.updateProjectionMatrix();const mobile=width<720,autoRatio=mobile?1:Math.min(devicePixelRatio||1,1.45),ratio=quality==="high"?Math.min(devicePixelRatio||1,mobile?1.25:1.8):quality==="low"?.85:autoRatio;renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);}';
const FIXED_RENDER_RESIZE = 'function resize(){const rect=ui.canvas.getBoundingClientRect(),width=Math.max(1,rect.width),height=Math.max(1,rect.height);camera.aspect=width/height;camera.updateProjectionMatrix();const mobile=width<720,ratio=mobile?1:Math.min(devicePixelRatio||1,1.45);renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);}';
const RENDER_SETTER = 'function setQuality(next){quality=next;ui.quality.dataset.renderDensity=next;ui.quality.textContent=`Render ${next[0].toUpperCase()}${next.slice(1)}`;const url=new URL(location.href);if(next==="auto")url.searchParams.delete("render");else url.searchParams.set("render",next);history.replaceState(null,"",url);resize();}';
const RENDER_LISTENER = 'ui.quality.addEventListener("click",()=>setQuality(quality==="auto"?"high":quality==="high"?"low":"auto"));';
const INITIAL_RENDER = 'rebuildEdges();applyVisibility();fitScene(true);setQuality(quality);ui.motion.setAttribute("aria-pressed",String(motionEnabled));';
const FIXED_INITIAL_RENDER = 'rebuildEdges();applyVisibility();fitScene(true);resize();ui.motion.setAttribute("aria-pressed",String(motionEnabled));';
const BASE_POSITIONS = 'const positions=layoutGraph(THREE,graph),';
const GALAXY_POSITIONS = 'const positions=threeStyle==="galaxy"?layoutGalaxyGraph(THREE,graph):layoutGraph(THREE,graph),';
const BASE_FIT_DISTANCE = 'function fitScene(immediate=false){desiredTarget.set(0,0,0);desiredDistance=graph.nodes.some((node)=>node.relation==="contributed")?330:255;';
const GALAXY_FIT_DISTANCE = 'function fitScene(immediate=false){desiredTarget.set(0,0,0);desiredDistance=threeStyle==="galaxy"?(graph.nodes.some((node)=>node.relation==="contributed")?400:340):(graph.nodes.some((node)=>node.relation==="contributed")?330:255);';
const BASE_CAMERA_ORBIT = 'let yaw=.68,pitch=.34,distance=250,desiredDistance=distance,';
const GALAXY_CAMERA_ORBIT = 'let yaw=.68,pitch=threeStyle==="galaxy"?.66:.34,distance=250,desiredDistance=distance,';
const BASE_RESET_VIEW = 'function resetView(){yaw=.68;pitch=.34;fitScene(false);clearSelection();}';
const GALAXY_RESET_VIEW = 'function resetView(){yaw=.68;pitch=threeStyle==="galaxy"?.66:.34;fitScene(false);clearSelection();}';

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

function removeRequired(source, fragment) {
  if (!source.includes(fragment)) return source;
  return source.replace(fragment, "");
}

export function composeThreejsStyleRuntime(source) {
  let next = source;
  if (!next.includes("const THREE_STYLE_IDS=new Set")) {
    next = replaceRequired(next, "const TAU = Math.PI * 2;", `const TAU = Math.PI * 2;\n${STYLE_HELPERS}`, "Three.js style helper insertion point");
  }
  if (!next.includes("function layoutGalaxyGraph(THREE,graph)")) {
    next = replaceRequired(next, "function createSceneRuntime(THREE,graph,username){", `${GALAXY_LAYOUT_HELPERS}\nfunction createSceneRuntime(THREE,graph,username){`, "Three.js Galaxy layout insertion point");
  }

  next = replaceRequired(
    next,
    "function createSceneRuntime(THREE,graph,username){",
    "function createSceneRuntime(THREE,graph,username){const threeStyle=currentThreeStyle(),threeTheme=THREE_STYLE_THEMES[threeStyle];document.body.dataset.mapStyle=`threejs-${threeStyle}`;const canonicalUrl=new URL(location.href);if(canonicalUrl.searchParams.has(\"render\")){canonicalUrl.searchParams.delete(\"render\");history.replaceState(null,\"\",canonicalUrl);}",
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
    "const nebulae=[];threeTheme.nebulaHues.forEach((hue,index)=>{const material=new THREE.SpriteMaterial({map:makeNebulaTexture(THREE,hue),transparent:true,opacity:(.64-index*.08)*threeTheme.nebulaOpacityScale,depthWrite:false,fog:false,blending:THREE.AdditiveBlending})",
    "Three.js nebula theme",
  );
  next = replaceRequired(
    next,
    "scene.add(farStars,midStars,nearStars,dust);",
    "scene.add(farStars,midStars,nearStars,dust);dust.visible=threeStyle!==\"wireframe\";if(threeStyle===\"galaxy\"){dust.scale.setScalar(1.08);dust.material.opacity=.44;}",
    "Three.js wireframe and Galaxy dust policy",
  );
  next = replaceRequired(next, BASE_POSITIONS, GALAXY_POSITIONS, "Three.js Galaxy layout selection");
  next = replaceRequired(next, BASE_FIT_DISTANCE, GALAXY_FIT_DISTANCE, "Three.js Galaxy fit distance");
  next = replaceRequired(next, BASE_CAMERA_ORBIT, GALAXY_CAMERA_ORBIT, "Three.js Galaxy initial camera pitch");
  next = replaceRequired(next, BASE_RESET_VIEW, GALAXY_RESET_VIEW, "Three.js Galaxy reset camera pitch");
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

  next = removeRequired(next, RENDER_SELECTOR);
  next = replaceRequired(next, RENDER_STATE, FIXED_RENDER_STATE, "Three.js render-density URL state");
  next = replaceRequired(next, RENDER_RESIZE, FIXED_RENDER_RESIZE, "Three.js automatic render-density policy");
  next = removeRequired(next, RENDER_SETTER);
  next = removeRequired(next, RENDER_LISTENER);
  next = replaceRequired(next, INITIAL_RENDER, FIXED_INITIAL_RENDER, "Three.js fixed render-density initialization");
  return next;
}

export function composeThreejsStylePage(html) {
  return html.includes(RENDER_CONTROL) ? html.replace(RENDER_CONTROL, "") : html;
}
