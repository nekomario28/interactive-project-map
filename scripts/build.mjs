import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildGraph } from "./graph.mjs";
import { fetchPublicRepos } from "./github.mjs";
import { renderGalaxySvg } from "./svg.mjs";

const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const root = process.cwd();
const out = join(root, "site");
const esc = (value) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));

function boundedInt(value, fallback, min, max) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function booleanConfig(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function viewerHtml(username) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(username)} · Project Galaxy</title>
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050811;color:#eaf0ff;font-family:Inter,ui-sans-serif,system-ui,sans-serif}canvas{display:block;width:100vw;height:100vh;cursor:grab;touch-action:none}canvas.dragging{cursor:grabbing}.hud{position:fixed;top:18px;left:18px;z-index:2;padding:12px 14px;border:1px solid #263148;background:#080d18cc;backdrop-filter:blur(12px);border-radius:14px;max-width:min(420px,calc(100vw - 64px))}.hud h1{font-size:15px;margin:0}.hud p{font-size:12px;color:#9aa7bd;margin:5px 0 0}.tip{position:fixed;pointer-events:none;display:none;z-index:3;padding:8px 10px;background:#0c1322;border:1px solid #34415b;border-radius:9px;font-size:12px;max-width:280px}.back{position:fixed;right:18px;top:18px;z-index:2;color:#c8d7f2;text-decoration:none;background:#080d18cc;border:1px solid #263148;border-radius:12px;padding:9px 12px;font-size:12px}
</style>
</head>
<body>
<div class="hud"><h1>${esc(username)} · Interactive Project Map</h1><p>Drag nodes · pan empty space · wheel or pinch to zoom · tap/click a project to open GitHub</p></div>
<a class="back" href="../../">Home</a>
<canvas id="galaxy" aria-label="Interactive project galaxy for ${esc(username)}"></canvas><div id="tip" class="tip"></div>
<script>
const username=${JSON.stringify(username)};
const graphUrl='../../api/users/'+encodeURIComponent(username)+'/graph.json';
const canvas=document.getElementById('galaxy');
const ctx=canvas.getContext('2d');
const tip=document.getElementById('tip');
let graph=null,nodes=[],edges=[],drag=null,pan={x:0,y:0},zoom=1,last={x:0,y:0},down={x:0,y:0},panning=false,pinchDistance=0;
const pointers=new Map();
function h(s){let x=2166136261;for(let i=0;i<s.length;i++){x^=s.charCodeAt(i);x=Math.imul(x,16777619)}return x>>>0}
function color(s){return'hsl('+(h(s)%360)+' 72% 66%)'}
function resize(){const d=devicePixelRatio||1;canvas.width=innerWidth*d;canvas.height=innerHeight*d;ctx.setTransform(d,0,0,d,0,0);if(graph)build(graph);draw()}
function build(g){graph=g;const groups=g.nodes.filter(n=>n.type==='group'),repos=g.nodes.filter(n=>n.type==='repository');nodes=[];const cx=innerWidth/2,cy=innerHeight/2,R=Math.min(innerWidth,innerHeight),owner=g.nodes.find(n=>n.type==='owner');if(owner)nodes.push({...owner,x:cx,y:cy,r:26});groups.forEach((group,i)=>{const a=-Math.PI/2+Math.PI*2*i/Math.max(groups.length,1);nodes.push({...group,x:cx+Math.cos(a)*R*.25,y:cy+Math.sin(a)*R*.25,r:8});const m=repos.filter(r=>r.groupId&&group.id==='group:'+r.groupId);m.forEach((repo,j)=>{const spread=Math.min(.8,.18+m.length*.035),off=m.length<2?0:(j/(m.length-1)-.5)*spread,jitter=((h(repo.id)%1000)/1000-.5)*.09,rr=R*(.35+((h(repo.id+':r')%1000)/1000-.5)*.07),aa=a+off+jitter;nodes.push({...repo,x:cx+Math.cos(aa)*rr,y:cy+Math.sin(aa)*rr,r:Math.min(12,5+Math.log2((repo.stars||0)+1)*1.5)})})});edges=g.edges}
function world(p){return{x:(p.x-pan.x)/zoom,y:(p.y-pan.y)/zoom}}
function hit(x,y){const w=world({x,y});for(let i=nodes.length-1;i>=0;i--){const n=nodes[i],r=Math.max(n.r,9/zoom);if((w.x-n.x)**2+(w.y-n.y)**2<=r*r)return n}return null}
function pointDistance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function pointerPair(){const values=[...pointers.values()];return values.length>=2?[values[0],values[1]]:null}
function draw(){ctx.clearRect(0,0,innerWidth,innerHeight);ctx.fillStyle='#050811';ctx.fillRect(0,0,innerWidth,innerHeight);for(let i=0;i<100;i++){ctx.globalAlpha=.12+(h(username+':o:'+i)%40)/100;ctx.fillStyle='#c8d7f2';ctx.beginPath();ctx.arc(h(username+':x:'+i)%innerWidth,h(username+':y:'+i)%innerHeight,.4+(h(username+':r:'+i)%10)/10,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;if(!graph)return;const map=new Map(nodes.map(n=>[n.id,n]));ctx.save();ctx.translate(pan.x,pan.y);ctx.scale(zoom,zoom);ctx.strokeStyle='#344054';ctx.lineWidth=1/zoom;ctx.globalAlpha=.65;for(const e of edges){const a=map.get(e.source),b=map.get(e.target);if(!a||!b)continue;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}ctx.globalAlpha=1;for(const n of nodes){ctx.fillStyle=n.type==='owner'?color(n.label):color(n.language||n.groupLabel||n.label);ctx.globalAlpha=n.fork?.72:1;ctx.beginPath();ctx.arc(n.x,n.y,n.r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;if(n.type==='owner'){ctx.strokeStyle=color(n.label);ctx.globalAlpha=.25;ctx.lineWidth=2/zoom;ctx.beginPath();ctx.arc(n.x,n.y,n.r+8,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}if(zoom>.72||n.type!=='repository'){ctx.fillStyle=n.type==='group'?'#9aa7bd':'#eaf0ff';ctx.font=(n.type==='owner'?'700 15px':'11px')+' Inter,system-ui';ctx.textAlign='center';const txt=n.label.length>26?n.label.slice(0,24)+'…':n.label;ctx.fillText(txt,n.x,n.y+n.r+14)}}ctx.restore()}
function finishPointer(e,allowClick){const clicked=allowClick&&pointers.size===1&&pointers.has(e.pointerId)&&drag&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<7?drag:null;pointers.delete(e.pointerId);if(pointers.size<2)pinchDistance=0;drag=null;panning=false;canvas.classList.remove('dragging');if(clicked&&clicked.url)open(clicked.url,'_blank','noopener')}
canvas.addEventListener('wheel',e=>{e.preventDefault();const before=world({x:e.clientX,y:e.clientY}),factor=Math.exp(-e.deltaY*.001);zoom=Math.max(.35,Math.min(4,zoom*factor));pan.x=e.clientX-before.x*zoom;pan.y=e.clientY-before.y*zoom;draw()},{passive:false});
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});tip.style.display='none';if(pointers.size===2){const pair=pointerPair();drag=null;panning=false;pinchDistance=pair?pointDistance(pair[0],pair[1]):0;return}if(pointers.size!==1)return;last={x:e.clientX,y:e.clientY};down={...last};drag=hit(e.clientX,e.clientY);panning=!drag;canvas.classList.add('dragging')});
canvas.addEventListener('pointermove',e=>{if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const pair=pointerPair();if(pair){const distance=pointDistance(pair[0],pair[1]),midpoint={x:(pair[0].x+pair[1].x)/2,y:(pair[0].y+pair[1].y)/2};if(pinchDistance>0&&distance>0){const before=world(midpoint);zoom=Math.max(.35,Math.min(4,zoom*(distance/pinchDistance)));pan.x=midpoint.x-before.x*zoom;pan.y=midpoint.y-before.y*zoom}pinchDistance=distance;draw()}return}if(drag&&pointers.size===1){const w=world({x:e.clientX,y:e.clientY});drag.x=w.x;drag.y=w.y;draw()}else if(panning&&pointers.size===1){pan.x+=e.clientX-last.x;pan.y+=e.clientY-last.y;last={x:e.clientX,y:e.clientY};draw()}else if(pointers.size===0){const hover=hit(e.clientX,e.clientY);if(hover){tip.style.display='block';tip.style.left=e.clientX+14+'px';tip.style.top=e.clientY+14+'px';tip.textContent=hover.type==='repository'?hover.label+(hover.language?' · '+hover.language:'')+(hover.stars!=null?' · ★ '+hover.stars:''):hover.label}else tip.style.display='none'}});
canvas.addEventListener('pointerup',e=>finishPointer(e,true));
canvas.addEventListener('pointercancel',e=>finishPointer(e,false));
canvas.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))finishPointer(e,false)});
addEventListener('resize',resize);resize();
fetch(graphUrl,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('graph.json '+r.status);return r.json()}).then(build).then(draw).catch(err=>{tip.style.display='block';tip.style.left='18px';tip.style.top='90px';tip.textContent=err.message});
</script>
</body>
</html>`;
}

function homeHtml(usernames) {
  const cards = usernames.map((username) => `<article class="card"><h2>${esc(username)}</h2><a href="./u/${encodeURIComponent(username)}/"><img src="./api/users/${encodeURIComponent(username)}/galaxy-dark.svg" alt="${esc(username)} project galaxy"></a><p><a href="./u/${encodeURIComponent(username)}/">Open interactive map ↗</a></p><code>api/users/${esc(username)}/graph.json</code></article>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GitHub Project Galaxy</title><style>:root{color-scheme:dark;background:#070a12;color:#edf2ff;font-family:Inter,ui-sans-serif,system-ui,sans-serif}body{margin:0}.wrap{max-width:980px;margin:auto;padding:52px 20px 80px}h1{font-size:clamp(2rem,6vw,4.5rem);margin:.2em 0}.lead{color:#a9b5c9}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px;margin-top:30px}.card{padding:18px;border:1px solid #263148;border-radius:18px;background:#0d1220}.card img{width:100%;border-radius:12px;border:1px solid #263148}a{color:#9ac2ff}code{color:#c9d4e8;word-break:break-all}</style></head><body><main class="wrap"><h1>GitHub Project Galaxy</h1><p class="lead">Static graph JSON, README SVG and interactive maps generated by GitHub Actions and hosted on GitHub Pages.</p><div class="grid">${cards}</div></main></body></html>`;
}

const config = JSON.parse(await readFile(join(root, "config", "project-map.json"), "utf8"));
if (!Array.isArray(config.usernames) || config.usernames.some((value) => typeof value !== "string")) {
  throw new Error("config.project-map.json: usernames must be an array of strings");
}

const repositoryOwner = (process.env.GITHUB_REPOSITORY_OWNER ?? "").trim();
const usernames = [...new Set(config.usernames.map((value) => value.trim()).map((value) => value === "@owner" ? repositoryOwner : value).filter(Boolean))];
if (!usernames.length) throw new Error("No username resolved. Set config/project-map.json or GITHUB_REPOSITORY_OWNER.");
for (const username of usernames) if (!USERNAME_RE.test(username)) throw new Error(`Invalid GitHub username: ${username}`);

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await writeFile(join(out, ".nojekyll"), "\n");

const maxRepos = boundedInt(config.maxRepos, 100, 1, 300);
const includeForks = booleanConfig(config.includeForks, true);
const includeArchived = booleanConfig(config.includeArchived, false);
const width = boundedInt(config.width, 740, 420, 1600);
const height = boundedInt(config.height, 420, 260, 1000);

for (const username of usernames) {
  console.log(`Generating project map for ${username}...`);
  const repos = await fetchPublicRepos(username, process.env.GITHUB_TOKEN, maxRepos);
  const graph = buildGraph(username, repos, includeForks, includeArchived);
  const apiDir = join(out, "api", "users", username);
  const viewerDir = join(out, "u", username);
  await mkdir(apiDir, { recursive: true });
  await mkdir(viewerDir, { recursive: true });
  await writeFile(join(apiDir, "graph.json"), JSON.stringify(graph, null, 2) + "\n");
  await writeFile(join(apiDir, "galaxy-dark.svg"), renderGalaxySvg(graph, "dark", width, height));
  await writeFile(join(apiDir, "galaxy-light.svg"), renderGalaxySvg(graph, "light", width, height));
  await writeFile(join(viewerDir, "index.html"), viewerHtml(username));
}

await writeFile(join(out, "index.html"), homeHtml(usernames));
console.log(`Built ${usernames.length} user(s) into ${out}`);
