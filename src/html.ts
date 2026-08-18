function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char] ?? char));
}

export function renderHome(origin: string): string {
  const sample = `${origin}/api/galaxy.svg?username=syun88&theme=dark`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>GitHub Project Galaxy API</title>
<style>
:root{color-scheme:dark;background:#070a12;color:#edf2ff;font-family:Inter,ui-sans-serif,system-ui,sans-serif}body{margin:0}.wrap{max-width:920px;margin:0 auto;padding:64px 22px 96px}h1{font-size:clamp(2.2rem,7vw,4.8rem);line-height:.98;margin:0 0 18px}.lead{font-size:1.12rem;color:#a9b5c9;max-width:720px}.card{margin-top:30px;padding:22px;border:1px solid #263148;border-radius:18px;background:#0d1220}code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}pre{overflow:auto;padding:16px;background:#070a12;border-radius:12px;color:#c9d4e8}a{color:#9ac2ff}.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));margin-top:28px}.pill{padding:18px;border:1px solid #263148;border-radius:16px;background:#0b101c}.muted{color:#8492aa;font-size:.92rem}img{max-width:100%;border-radius:14px;border:1px solid #263148}
</style>
</head>
<body><main class="wrap">
<h1>GitHub Project<br/>Galaxy API</h1>
<p class="lead">Turn any GitHub user's public repositories into an embeddable SVG galaxy, structured graph JSON, and an interactive map.</p>
<div class="grid">
<div class="pill"><strong>SVG</strong><p class="muted">README-friendly image endpoint.</p><code>/api/galaxy.svg?username=...</code></div>
<div class="pill"><strong>JSON</strong><p class="muted">Nodes and edges for your own renderer.</p><code>/api/graph?username=...</code></div>
<div class="pill"><strong>Interactive</strong><p class="muted">Pan, zoom, drag and open repositories.</p><code>/u/&lt;username&gt;</code></div>
</div>
<section class="card"><h2>Preview</h2><img src="${sample}" alt="Galaxy preview"/></section>
<section class="card"><h2>README embed</h2><pre>&lt;p align="center"&gt;
  &lt;a href="${origin}/u/YOUR_USERNAME"&gt;
    &lt;img width="740" src="${origin}/api/galaxy.svg?username=YOUR_USERNAME&amp;theme=dark" /&gt;
  &lt;/a&gt;
&lt;/p&gt;</pre></section>
</main></body></html>`;
}

export function renderViewer(username: string): string {
  const safeUsername = esc(username);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${safeUsername} · Project Galaxy</title>
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050811;color:#eaf0ff;font-family:Inter,ui-sans-serif,system-ui,sans-serif}canvas{display:block;width:100vw;height:100vh;cursor:grab}canvas.dragging{cursor:grabbing}.hud{position:fixed;top:18px;left:18px;z-index:2;padding:12px 14px;border:1px solid #263148;background:#080d18cc;backdrop-filter:blur(12px);border-radius:14px;max-width:min(420px,calc(100vw - 64px))}.hud h1{font-size:15px;margin:0}.hud p{font-size:12px;color:#9aa7bd;margin:5px 0 0}.tip{position:fixed;pointer-events:none;display:none;z-index:3;padding:8px 10px;background:#0c1322;border:1px solid #34415b;border-radius:9px;font-size:12px;max-width:280px}.back{position:fixed;right:18px;top:18px;z-index:2;color:#c8d7f2;text-decoration:none;background:#080d18cc;border:1px solid #263148;border-radius:12px;padding:9px 12px;font-size:12px}
</style>
</head>
<body>
<div class="hud"><h1>${safeUsername} · Interactive Project Map</h1><p>Drag nodes · pan empty space · scroll to zoom · click a project to open GitHub</p></div>
<a class="back" href="/">API docs</a>
<canvas id="galaxy"></canvas><div id="tip" class="tip"></div>
<script>
const username=${JSON.stringify(username)};
const canvas=document.getElementById('galaxy'); const ctx=canvas.getContext('2d'); const tip=document.getElementById('tip');
let graph=null,nodes=[],edges=[],hover=null,drag=null,pan={x:0,y:0},zoom=1,last={x:0,y:0},panning=false;
function h(s){let x=2166136261;for(let i=0;i<s.length;i++){x^=s.charCodeAt(i);x=Math.imul(x,16777619)}return x>>>0}
function color(s){return 'hsl('+(h(s)%360)+' 72% 66%)'}
function resize(){const d=devicePixelRatio||1;canvas.width=innerWidth*d;canvas.height=innerHeight*d;ctx.setTransform(d,0,0,d,0,0);draw()}
function build(g){graph=g;const groups=g.nodes.filter(n=>n.type==='group');const repos=g.nodes.filter(n=>n.type==='repository');nodes=[];const cx=innerWidth/2,cy=innerHeight/2,R=Math.min(innerWidth,innerHeight);const owner=g.nodes.find(n=>n.type==='owner');if(owner)nodes.push({...owner,x:cx,y:cy,r:26});groups.forEach((group,i)=>{const a=-Math.PI/2+Math.PI*2*i/Math.max(groups.length,1);nodes.push({...group,x:cx+Math.cos(a)*R*.25,y:cy+Math.sin(a)*R*.25,r:8});const m=repos.filter(r=>r.groupId&&group.id==='group:'+r.groupId);m.forEach((repo,j)=>{const spread=Math.min(.8,.18+m.length*.035);const off=m.length<2?0:(j/(m.length-1)-.5)*spread;const jitter=((h(repo.id)%1000)/1000-.5)*.09;const rr=R*(.35+((h(repo.id+':r')%1000)/1000-.5)*.07);const aa=a+off+jitter;nodes.push({...repo,x:cx+Math.cos(aa)*rr,y:cy+Math.sin(aa)*rr,r:Math.min(12,5+Math.log2((repo.stars||0)+1)*1.5)})})});edges=g.edges}
function world(p){return{x:(p.x-pan.x)/zoom,y:(p.y-pan.y)/zoom}}
function screen(n){return{x:n.x*zoom+pan.x,y:n.y*zoom+pan.y}}
function hit(x,y){const w=world({x,y});for(let i=nodes.length-1;i>=0;i--){const n=nodes[i],r=Math.max(n.r,9)/zoom;if((w.x-n.x)**2+(w.y-n.y)**2<=r*r)return n}return null}
function draw(){if(!ctx)return;ctx.clearRect(0,0,innerWidth,innerHeight);ctx.fillStyle='#050811';ctx.fillRect(0,0,innerWidth,innerHeight);for(let i=0;i<100;i++){ctx.globalAlpha=.12+(h(username+':o:'+i)%40)/100;ctx.fillStyle='#c8d7f2';ctx.beginPath();ctx.arc(h(username+':x:'+i)%innerWidth,h(username+':y:'+i)%innerHeight,.4+(h(username+':r:'+i)%10)/10,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;if(!graph)return;const map=new Map(nodes.map(n=>[n.id,n]));ctx.save();ctx.translate(pan.x,pan.y);ctx.scale(zoom,zoom);ctx.strokeStyle='#344054';ctx.lineWidth=1/zoom;ctx.globalAlpha=.65;for(const e of edges){const a=map.get(e.source),b=map.get(e.target);if(!a||!b)continue;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}ctx.globalAlpha=1;for(const n of nodes){ctx.fillStyle=n.type==='owner'?color(n.label):color(n.language||n.groupLabel||n.label);ctx.globalAlpha=n.fork?.72:1;ctx.beginPath();ctx.arc(n.x,n.y,n.r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;if(n.type==='owner'){ctx.strokeStyle=color(n.label);ctx.globalAlpha=.25;ctx.lineWidth=2/zoom;ctx.beginPath();ctx.arc(n.x,n.y,n.r+8,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}if(zoom>.72||n.type!=='repository'){ctx.fillStyle=n.type==='group'?'#9aa7bd':'#eaf0ff';ctx.font=(n.type==='owner'?'700 15px':'11px')+' Inter,system-ui';ctx.textAlign='center';const txt=n.label.length>26?n.label.slice(0,24)+'…':n.label;ctx.fillText(txt,n.x,n.y+n.r+14)}}ctx.restore()}
canvas.addEventListener('wheel',e=>{e.preventDefault();const before=world({x:e.clientX,y:e.clientY});const factor=Math.exp(-e.deltaY*.001);zoom=Math.max(.35,Math.min(4,zoom*factor));pan.x=e.clientX-before.x*zoom;pan.y=e.clientY-before.y*zoom;draw()},{passive:false});
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);last={x:e.clientX,y:e.clientY};drag=hit(e.clientX,e.clientY);panning=!drag;canvas.classList.add('dragging')});
canvas.addEventListener('pointermove',e=>{if(drag){const w=world({x:e.clientX,y:e.clientY});drag.x=w.x;drag.y=w.y;draw()}else if(panning){pan.x+=e.clientX-last.x;pan.y+=e.clientY-last.y;last={x:e.clientX,y:e.clientY};draw()}else{hover=hit(e.clientX,e.clientY);if(hover){tip.style.display='block';tip.style.left=(e.clientX+14)+'px';tip.style.top=(e.clientY+14)+'px';tip.textContent=hover.type==='repository'?(hover.label+(hover.language?' · '+hover.language:'')+(hover.stars!=null?' · ★ '+hover.stars:'')):hover.label}else tip.style.display='none'}});
canvas.addEventListener('pointerup',e=>{const clicked=drag&&Math.hypot(e.clientX-last.x,e.clientY-last.y)<7?drag:null;if(clicked&&clicked.url)open(clicked.url,'_blank','noopener');drag=null;panning=false;canvas.classList.remove('dragging')});
addEventListener('resize',resize);resize();
fetch('/api/graph?username='+encodeURIComponent(username)+'&max_repos=100').then(r=>{if(!r.ok)throw new Error('API '+r.status);return r.json()}).then(build).then(draw).catch(err=>{tip.style.display='block';tip.style.left='18px';tip.style.top='90px';tip.textContent=err.message});
</script>
</body></html>`;
}
