import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export function renderPagesHome() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="description" content="Generate a static GitHub project galaxy for your profile README and open it in an interactive map." />
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' https://raw.githubusercontent.com data:; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src https://raw.githubusercontent.com; base-uri 'none'; frame-ancestors 'none'" />
<title>GitHub Project Galaxy</title>
<style>
:root{color-scheme:dark;background:#060912;color:#edf2ff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% -10%,#14223f 0,#080d18 34%,#060912 70%)}.wrap{max-width:1040px;margin:0 auto;padding:62px 22px 96px}.eyebrow{color:#8fb8ff;font-size:.82rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase}h1{font-size:clamp(2.5rem,8vw,5.5rem);line-height:.94;margin:12px 0 20px;letter-spacing:-.055em}.lead{max-width:770px;color:#aab7cc;font-size:clamp(1rem,2.2vw,1.2rem);line-height:1.65}.generator{margin-top:32px;padding:22px;border:1px solid #283650;border-radius:22px;background:#0b111ecc;box-shadow:0 24px 90px #0008}.form{display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:12px}.username{width:100%;padding:14px 15px;border:1px solid #344561;border-radius:13px;background:#070c16;color:#f2f6ff;font:inherit;outline:none}.username:focus{border-color:#74a7ff;box-shadow:0 0 0 3px #4f8cff22}.primary,.button{border-radius:13px;padding:12px 16px;font:inherit;font-weight:700;cursor:pointer}.primary{border:0;background:#dce9ff;color:#0a1220}.button{border:1px solid #30405a;background:#151e2e;color:#dbe8ff}.options{display:flex;flex-wrap:wrap;gap:10px 18px;margin-top:15px;color:#aab7cc;font-size:.9rem}.options label{display:flex;gap:7px;align-items:center}.options select,.options input[type=number]{padding:6px 8px;border:1px solid #2d3b53;border-radius:8px;background:#080e19;color:#eaf1ff}.options input[type=number]{width:76px}.status{min-height:22px;margin-top:14px;color:#91a1b8;font-size:.9rem}.status.error{color:#ff9f9f}.result{display:none;margin-top:26px}.result.visible{display:block}.preview{padding:16px;border:1px solid #26344d;border-radius:18px;background:#070b14}.preview img{display:none;width:100%;height:auto;border-radius:14px;background:#050811}.preview img.ready{display:block}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}.actions a{text-decoration:none}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:16px}.panel{padding:16px;border:1px solid #26344d;border-radius:16px;background:#09101c}.panel h2{font-size:.96rem;margin:0 0 10px}.panel p{color:#8f9db2;font-size:.84rem;line-height:1.5}.code{width:100%;min-height:122px;resize:vertical;padding:12px;border:1px solid #283750;border-radius:10px;background:#050912;color:#cbd8ee;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}.workflow{min-height:380px}.copyrow{display:flex;justify-content:flex-end;margin-top:9px}.steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:26px}.step{padding:18px;border:1px solid #202d42;border-radius:16px;background:#090f1a}.step strong{display:block;margin-bottom:7px}.step span{color:#8e9cb1;font-size:.9rem;line-height:1.5}.foot{margin-top:34px;color:#77869c;font-size:.86rem;line-height:1.6}.foot a{color:#9ec2ff}@media(max-width:700px){.wrap{padding-top:42px}.form,.grid,.steps{grid-template-columns:1fr}.generator{padding:16px}}
</style>
</head>
<body>
<main class="wrap">
<section>
<div class="eyebrow">Static-first GitHub profile visualizer</div>
<h1>Turn your repos<br>into a project galaxy.</h1>
<p class="lead">Generate the map in your own GitHub profile repository. Your README serves a static SVG, and clicking it opens this shared GitHub Pages viewer. Normal profile and map views do not call the GitHub REST API.</p>
</section>
<section class="generator">
<h2 style="margin-top:0">Create your map</h2>
<form id="form" class="form">
<input id="username" class="username" placeholder="GitHub username, e.g. octocat" autocomplete="off" spellcheck="false" maxlength="39" required />
<button class="primary" type="submit">Generate setup</button>
</form>
<div class="options">
<label>Theme <select id="theme"><option value="dark">Dark</option><option value="light">Light</option></select></label>
<label>Max repos <input id="maxRepos" type="number" min="1" max="300" value="100" /></label>
<label><input id="forks" type="checkbox" checked /> Include forks</label>
<label><input id="archived" type="checkbox" /> Include archived</label>
</div>
<div id="status" class="status">No personal access token is required. The generated Action uses the profile repository's read-only GitHub token for metadata generation.</div>
<div id="result" class="result">
<div class="preview">
<div id="previewMessage">Run the generated workflow once; your static SVG preview will appear here afterward.</div>
<img id="preview" alt="Static project galaxy preview" />
</div>
<div class="actions">
<a id="openMap" class="button" target="_blank" rel="noopener">Open interactive map ↗</a>
<button class="button" type="button" data-copy="workflow">Copy workflow</button>
<button class="button" type="button" data-copy="readmeHtml">Copy README HTML</button>
</div>
<div class="grid">
<section class="panel"><h2>1. GitHub Actions workflow</h2><p>Create <code>.github/workflows/project-map.yml</code> inside <code>USERNAME/USERNAME</code>.</p><textarea id="workflow" class="code workflow" readonly></textarea><div class="copyrow"><button class="button" type="button" data-copy="workflow">Copy</button></div></section>
<section class="panel"><h2>2. README HTML</h2><p>The image is served from your repository and links to your personal interactive map.</p><textarea id="readmeHtml" class="code" readonly></textarea><div class="copyrow"><button class="button" type="button" data-copy="readmeHtml">Copy</button></div></section>
<section class="panel"><h2>Markdown</h2><p>Compact alternative to the HTML snippet.</p><textarea id="readmeMarkdown" class="code" readonly></textarea><div class="copyrow"><button class="button" type="button" data-copy="readmeMarkdown">Copy</button></div></section>
<section class="panel"><h2>Static data</h2><p>These files are generated and owned by your profile repository.</p><textarea id="staticUrls" class="code" readonly></textarea><div class="copyrow"><button class="button" type="button" data-copy="staticUrls">Copy</button></div></section>
</div>
</div>
</section>
<section class="steps">
<div class="step"><strong>1 · Copy workflow</strong><span>Add the generated workflow to your <code>USERNAME/USERNAME</code> profile repository.</span></div>
<div class="step"><strong>2 · Run once</strong><span>GitHub Actions creates <code>project-map/galaxy.svg</code> and <code>graph.json</code>, then commits only when data changes.</span></div>
<div class="step"><strong>3 · Add README embed</strong><span>Profile views load the static SVG directly. Clicking it opens the universal interactive viewer.</span></div>
</section>
<p class="foot">The interactive viewer is a static GitHub Pages application. It reads <code>USERNAME/USERNAME/HEAD/project-map/graph.json</code> directly from <code>raw.githubusercontent.com</code>; there is no shared GitHub REST API request in the normal viewing path.</p>
</main>
<script>
const USERNAME_RE=/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const CHECKOUT_SHA='3d3c42e5aac5ba805825da76410c181273ba90b1';
const UPLOAD_SHA='043fb46d1a93c77aae656e7c1c64a875d1fc6a0a';
const DOWNLOAD_SHA='3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c';
const form=document.getElementById('form');
const usernameInput=document.getElementById('username');
const themeInput=document.getElementById('theme');
const maxReposInput=document.getElementById('maxRepos');
const forksInput=document.getElementById('forks');
const archivedInput=document.getElementById('archived');
const statusEl=document.getElementById('status');
const resultEl=document.getElementById('result');
const preview=document.getElementById('preview');
const previewMessage=document.getElementById('previewMessage');
const openMap=document.getElementById('openMap');
function values(){const username=usernameInput.value.trim().toLowerCase();const maxRepos=Math.max(1,Math.min(300,Math.round(Number(maxReposInput.value)||100)));return{username,theme:themeInput.value==='light'?'light':'dark',maxRepos,forks:forksInput.checked,archived:archivedInput.checked}}
function urls(v){const owner=encodeURIComponent(v.username);const raw='https://raw.githubusercontent.com/'+owner+'/'+owner+'/HEAD/project-map';const viewer=new URL('u/',new URL('./',location.href));viewer.searchParams.set('username',v.username);return{svg:raw+'/galaxy.svg',graph:raw+'/graph.json',viewer:viewer.toString()}}
function workflowFor(v){return[
'name: Update project map','',
'on:','  workflow_dispatch:','  schedule:','    - cron: "37 3 * * *"','',
'permissions:','  contents: read','',
'jobs:','  generate:','    runs-on: ubuntu-latest','    permissions:','      contents: read','    steps:',
'      - name: Checkout profile repository','        uses: actions/checkout@'+CHECKOUT_SHA+' # v7.0.1','',
'      - name: Generate project map','        uses: nekomario28/interactive-project-map@v1','        with:',
'          github_token: \${{ github.token }}','          username: \${{ github.repository_owner }}','          theme: '+v.theme,'          max_repos: "'+v.maxRepos+'"','          forks: "'+v.forks+'"','          archived: "'+v.archived+'"','          output_dir: project-map','',
'      - name: Transfer generated files to publish job','        uses: actions/upload-artifact@'+UPLOAD_SHA+' # v7.0.1','        with:','          name: project-map-generated','          path: project-map','          if-no-files-found: error','          retention-days: 1','',
'  publish:','    needs: generate','    runs-on: ubuntu-latest','    permissions:','      actions: read','      contents: write','    steps:',
'      - name: Checkout profile repository','        uses: actions/checkout@'+CHECKOUT_SHA+' # v7.0.1','',
'      - name: Download generated files','        uses: actions/download-artifact@'+DOWNLOAD_SHA+' # v8.0.1','        with:','          name: project-map-generated','          path: project-map','',
'      - name: Commit only when the generated map changed','        shell: bash','        run: |','          set -euo pipefail','          git add -- project-map/galaxy.svg project-map/graph.json','          if git diff --cached --quiet; then','            echo "Project map is already up to date."','            exit 0','          fi','          git config user.name "github-actions[bot]"','          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"','          git commit -m "chore: update project map"','          git push',''
].join('\n')}
function generate(){const v=values();maxReposInput.value=String(v.maxRepos);if(!USERNAME_RE.test(v.username)){statusEl.textContent='Enter a valid GitHub username.';statusEl.classList.add('error');resultEl.classList.remove('visible');return}const u=urls(v);const workflow=workflowFor(v);const html='<p align="center">\n  <a href="'+u.viewer+'">\n    <img width="740" src="'+u.svg+'" alt="'+v.username+' project galaxy" />\n  </a>\n</p>';const md='[!['+v.username+' project galaxy]('+u.svg+')]('+u.viewer+')';document.getElementById('workflow').value=workflow;document.getElementById('readmeHtml').value=html;document.getElementById('readmeMarkdown').value=md;document.getElementById('staticUrls').value='SVG: '+u.svg+'\nGraph: '+u.graph+'\nInteractive: '+u.viewer;openMap.href=u.viewer;preview.classList.remove('ready');previewMessage.textContent='Checking for an existing generated SVG…';preview.src=u.svg;resultEl.classList.add('visible');statusEl.textContent='Setup generated. Add the workflow to '+v.username+'/'+v.username+' and run it once.';statusEl.classList.remove('error');const share=new URL(location.href);share.search='';share.searchParams.set('username',v.username);share.searchParams.set('theme',v.theme);share.searchParams.set('max_repos',String(v.maxRepos));share.searchParams.set('forks',String(v.forks));share.searchParams.set('archived',String(v.archived));history.replaceState(null,'',share)}
form.addEventListener('submit',e=>{e.preventDefault();generate()});
preview.addEventListener('load',()=>{preview.classList.add('ready');previewMessage.textContent='Existing static SVG found in the profile repository.'});
preview.addEventListener('error',()=>{preview.classList.remove('ready');previewMessage.textContent='No static SVG yet. Run the generated workflow once, then reload this page.'});
for(const button of document.querySelectorAll('[data-copy]'))button.addEventListener('click',async()=>{const target=document.getElementById(button.dataset.copy);if(!target)return;try{await navigator.clipboard.writeText(target.value);const old=button.textContent;button.textContent='Copied';setTimeout(()=>button.textContent=old,1200)}catch{target.select();document.execCommand('copy')}});
const initial=new URL(location.href).searchParams;if(initial.has('username')){usernameInput.value=initial.get('username')||'';themeInput.value=initial.get('theme')==='light'?'light':'dark';maxReposInput.value=initial.get('max_repos')||'100';forksInput.checked=initial.get('forks')!=='false';archivedInput.checked=initial.get('archived')==='true';generate()}
</script>
</body>
</html>`;
}

export function renderPagesViewer() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src https://raw.githubusercontent.com; base-uri 'none'; frame-ancestors 'none'" />
<title>Interactive Project Galaxy</title>
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050811;color:#eaf0ff;font-family:Inter,ui-sans-serif,system-ui,sans-serif}canvas{display:block;width:100vw;height:100vh;cursor:grab;touch-action:none}canvas.dragging{cursor:grabbing}.hud{position:fixed;top:18px;left:18px;z-index:2;padding:12px 14px;border:1px solid #263148;background:#080d18dd;backdrop-filter:blur(12px);border-radius:14px;max-width:min(480px,calc(100vw - 64px))}.hud h1{font-size:15px;margin:0}.hud p{font-size:12px;color:#9aa7bd;margin:5px 0 0;line-height:1.45}.tip{position:fixed;pointer-events:none;display:none;z-index:3;padding:8px 10px;background:#0c1322;border:1px solid #34415b;border-radius:9px;font-size:12px;max-width:280px}.back{position:fixed;right:18px;top:18px;z-index:2;color:#c8d7f2;text-decoration:none;background:#080d18dd;border:1px solid #263148;border-radius:12px;padding:9px 12px;font-size:12px}.error{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:5;width:min(520px,calc(100vw - 40px));display:none;padding:22px;border:1px solid #3b4d6c;border-radius:18px;background:#0b111ef2;box-shadow:0 24px 90px #0009}.error.visible{display:block}.error h2{margin-top:0}.error p{color:#aab7cc;line-height:1.6}.error a{color:#a9c9ff}
</style>
</head>
<body>
<div class="hud"><h1 id="title">Interactive Project Map</h1><p>Static profile graph · drag nodes · pan empty space · wheel or pinch to zoom · tap/click a project to open GitHub</p></div>
<a id="back" class="back" href="../">Generator</a>
<canvas id="galaxy" aria-label="Interactive project galaxy"></canvas><div id="tip" class="tip"></div>
<section id="error" class="error"><h2>Static project map not found</h2><p id="errorText"></p><a id="setup" href="../">Open the setup generator →</a></section>
<script>
const USERNAME_RE=/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
function normalizeUsername(value){const username=String(value||'').trim().toLowerCase();if(!USERNAME_RE.test(username))throw new Error('Invalid GitHub username');return username}
const query=new URL(location.href).searchParams;let username='';
const canvas=document.getElementById('galaxy');const ctx=canvas.getContext('2d');const tip=document.getElementById('tip');const errorBox=document.getElementById('error');const errorText=document.getElementById('errorText');const setup=document.getElementById('setup');
function showError(message){errorText.textContent=message;errorBox.classList.add('visible')}
try{username=normalizeUsername(query.get('username'));document.title=username+' · Project Galaxy';document.getElementById('title').textContent=username+' · Interactive Project Map';canvas.setAttribute('aria-label','Interactive project galaxy for '+username);const setupUrl=new URL('../',location.href);setupUrl.searchParams.set('username',username);setup.href=setupUrl.toString()}catch(error){showError(error.message)}
let graph=null,nodes=[],edges=[],drag=null,pan={x:0,y:0},zoom=1,last={x:0,y:0},down={x:0,y:0},panning=false,pinchDistance=0;const pointers=new Map();
function h(s){let x=2166136261;for(let i=0;i<s.length;i++){x^=s.charCodeAt(i);x=Math.imul(x,16777619)}return x>>>0}
function color(s){return'hsl('+(h(s)%360)+' 72% 66%)'}
function cleanText(value,max){return typeof value==='string'?value.slice(0,max):''}
function safeRepoUrl(value,name){if(typeof value!=='string')return null;try{const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='github.com')return null;const p=u.pathname.split('/').filter(Boolean).map(decodeURIComponent);if(p.length<2||p[0].toLowerCase()!==username||p[1].toLowerCase()!==name.toLowerCase())return null;return'https://github.com/'+encodeURIComponent(username)+'/'+encodeURIComponent(name)}catch{return null}}
function sanitizeGraph(value){if(!value||typeof value!=='object'||String(value.owner||'').toLowerCase()!==username||!Array.isArray(value.nodes)||value.nodes.length>520)return null;const safeNodes=[],ids=new Set();for(const raw of value.nodes){if(!raw||typeof raw!=='object'||!['owner','group','repository'].includes(raw.type))continue;const id=cleanText(raw.id,180),label=cleanText(raw.label,120);if(!id||!label||ids.has(id))continue;let node={id,label,type:raw.type};if(raw.type==='owner'){node.url='https://github.com/'+encodeURIComponent(username)}else if(raw.type==='group'){node.repositoryCount=Number.isFinite(raw.repositoryCount)?Math.max(0,Math.floor(raw.repositoryCount)):0}else{if(!/^[A-Za-z0-9._-]{1,100}$/.test(label))continue;const url=safeRepoUrl(raw.url,label);if(!url)continue;node={...node,url,description:cleanText(raw.description,2000),language:typeof raw.language==='string'?raw.language.slice(0,100):null,stars:Number.isFinite(raw.stars)?Math.max(0,Math.floor(raw.stars)):0,forks:Number.isFinite(raw.forks)?Math.max(0,Math.floor(raw.forks)):0,fork:raw.fork===true,archived:raw.archived===true,groupId:cleanText(raw.groupId,120),groupLabel:cleanText(raw.groupLabel,120)}}ids.add(id);safeNodes.push(node)}const safeEdges=Array.isArray(value.edges)?value.edges.filter(e=>e&&typeof e==='object'&&ids.has(e.source)&&ids.has(e.target)).slice(0,1200).map(e=>({source:e.source,target:e.target,type:cleanText(e.type,40)})):[];if(!safeNodes.some(n=>n.type==='owner'))safeNodes.unshift({id:'user:'+username,label:username,type:'owner',url:'https://github.com/'+encodeURIComponent(username)});return{owner:username,generatedAt:cleanText(value.generatedAt,64),repositoryCount:safeNodes.filter(n=>n.type==='repository').length,groupCount:safeNodes.filter(n=>n.type==='group').length,nodes:safeNodes,edges:safeEdges}}
function resize(){const d=devicePixelRatio||1;canvas.width=innerWidth*d;canvas.height=innerHeight*d;ctx.setTransform(d,0,0,d,0,0);if(graph)build(graph);draw()}
function build(g){graph=g;const groups=g.nodes.filter(n=>n.type==='group'),repos=g.nodes.filter(n=>n.type==='repository');nodes=[];const cx=innerWidth/2,cy=innerHeight/2,R=Math.min(innerWidth,innerHeight),owner=g.nodes.find(n=>n.type==='owner');if(owner)nodes.push({...owner,x:cx,y:cy,r:26});groups.forEach((group,i)=>{const a=-Math.PI/2+Math.PI*2*i/Math.max(groups.length,1);nodes.push({...group,x:cx+Math.cos(a)*R*.25,y:cy+Math.sin(a)*R*.25,r:8});const m=repos.filter(r=>r.groupId&&group.id==='group:'+r.groupId);m.forEach((repo,j)=>{const spread=Math.min(.8,.18+m.length*.035),off=m.length<2?0:(j/(m.length-1)-.5)*spread,jitter=((h(repo.id)%1000)/1000-.5)*.09,rr=R*(.35+((h(repo.id+':r')%1000)/1000-.5)*.07),aa=a+off+jitter;nodes.push({...repo,x:cx+Math.cos(aa)*rr,y:cy+Math.sin(aa)*rr,r:Math.min(12,5+Math.log2((repo.stars||0)+1)*1.5)})})});edges=g.edges}
function world(p){return{x:(p.x-pan.x)/zoom,y:(p.y-pan.y)/zoom}}
function hit(x,y){const w=world({x,y});for(let i=nodes.length-1;i>=0;i--){const n=nodes[i],r=Math.max(n.r,9/zoom);if((w.x-n.x)**2+(w.y-n.y)**2<=r*r)return n}return null}
function pointDistance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}function pointerPair(){const v=[...pointers.values()];return v.length>=2?[v[0],v[1]]:null}
function draw(){ctx.clearRect(0,0,innerWidth,innerHeight);ctx.fillStyle='#050811';ctx.fillRect(0,0,innerWidth,innerHeight);for(let i=0;i<100;i++){ctx.globalAlpha=.12+(h(username+':o:'+i)%40)/100;ctx.fillStyle='#c8d7f2';ctx.beginPath();ctx.arc(h(username+':x:'+i)%innerWidth,h(username+':y:'+i)%innerHeight,.4+(h(username+':r:'+i)%10)/10,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;if(!graph)return;const map=new Map(nodes.map(n=>[n.id,n]));ctx.save();ctx.translate(pan.x,pan.y);ctx.scale(zoom,zoom);ctx.strokeStyle='#344054';ctx.lineWidth=1/zoom;ctx.globalAlpha=.65;for(const e of edges){const a=map.get(e.source),b=map.get(e.target);if(!a||!b)continue;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}ctx.globalAlpha=1;for(const n of nodes){ctx.fillStyle=n.type==='owner'?color(n.label):color(n.language||n.groupLabel||n.label);ctx.globalAlpha=n.fork?.72:1;ctx.beginPath();ctx.arc(n.x,n.y,n.r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;if(n.type==='owner'){ctx.strokeStyle=color(n.label);ctx.globalAlpha=.25;ctx.lineWidth=2/zoom;ctx.beginPath();ctx.arc(n.x,n.y,n.r+8,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}if(zoom>.72||n.type!=='repository'){ctx.fillStyle=n.type==='group'?'#9aa7bd':'#eaf0ff';ctx.font=(n.type==='owner'?'700 15px':'11px')+' Inter,system-ui';ctx.textAlign='center';const text=n.label.length>26?n.label.slice(0,24)+'…':n.label;ctx.fillText(text,n.x,n.y+n.r+14)}}ctx.restore()}
function finishPointer(e,allowClick){const clicked=allowClick&&pointers.size===1&&pointers.has(e.pointerId)&&drag&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<7?drag:null;pointers.delete(e.pointerId);if(pointers.size<2)pinchDistance=0;drag=null;panning=false;canvas.classList.remove('dragging');if(clicked&&clicked.url)open(clicked.url,'_blank','noopener')}
canvas.addEventListener('wheel',e=>{e.preventDefault();const before=world({x:e.clientX,y:e.clientY}),factor=Math.exp(-e.deltaY*.001);zoom=Math.max(.35,Math.min(4,zoom*factor));pan.x=e.clientX-before.x*zoom;pan.y=e.clientY-before.y*zoom;draw()},{passive:false});
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});tip.style.display='none';if(pointers.size===2){const pair=pointerPair();drag=null;panning=false;pinchDistance=pair?pointDistance(pair[0],pair[1]):0;return}if(pointers.size!==1)return;last={x:e.clientX,y:e.clientY};down={...last};drag=hit(e.clientX,e.clientY);panning=!drag;canvas.classList.add('dragging')});
canvas.addEventListener('pointermove',e=>{if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const pair=pointerPair();if(pair){const distance=pointDistance(pair[0],pair[1]),midpoint={x:(pair[0].x+pair[1].x)/2,y:(pair[0].y+pair[1].y)/2};if(pinchDistance>0&&distance>0){const before=world(midpoint);zoom=Math.max(.35,Math.min(4,zoom*(distance/pinchDistance)));pan.x=midpoint.x-before.x*zoom;pan.y=midpoint.y-before.y*zoom}pinchDistance=distance;draw()}return}if(drag&&pointers.size===1){const w=world({x:e.clientX,y:e.clientY});drag.x=w.x;drag.y=w.y;draw()}else if(panning&&pointers.size===1){pan.x+=e.clientX-last.x;pan.y+=e.clientY-last.y;last={x:e.clientX,y:e.clientY};draw()}else if(pointers.size===0){const hover=hit(e.clientX,e.clientY);if(hover){tip.style.display='block';tip.style.left=e.clientX+14+'px';tip.style.top=e.clientY+14+'px';tip.textContent=hover.type==='repository'?hover.label+(hover.language?' · '+hover.language:'')+(hover.stars!=null?' · ★ '+hover.stars:''):hover.label}else tip.style.display='none'}});
canvas.addEventListener('pointerup',e=>finishPointer(e,true));canvas.addEventListener('pointercancel',e=>finishPointer(e,false));canvas.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))finishPointer(e,false)});addEventListener('resize',resize);resize();
if(username){const owner=encodeURIComponent(username);const graphUrl='https://raw.githubusercontent.com/'+owner+'/'+owner+'/HEAD/project-map/graph.json';fetch(graphUrl,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('graph.json returned '+r.status);return r.json()}).then(value=>{const clean=sanitizeGraph(value);if(!clean)throw new Error('graph.json failed validation');return clean}).then(build).then(draw).catch(error=>showError('Could not load '+username+'/'+username+'/project-map/graph.json. Run the setup workflow once, or regenerate it if the file is invalid. ('+error.message+')'))}
</script>
</body>
</html>`;
}

export async function buildPagesApp(outputDir = join(process.cwd(), "site")) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(join(outputDir, "u"), { recursive: true });
  await writeFile(join(outputDir, ".nojekyll"), "\n");
  await writeFile(join(outputDir, "index.html"), renderPagesHome());
  await writeFile(join(outputDir, "u", "index.html"), renderPagesViewer());
}

async function main() {
  const outputDir = join(process.cwd(), "site");
  await buildPagesApp(outputDir);
  console.log(`Built static GitHub Pages app into ${outputDir}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
