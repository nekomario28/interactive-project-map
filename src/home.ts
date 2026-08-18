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
  const safeOrigin = esc(origin);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>GitHub Project Galaxy</title>
<meta name="description" content="Generate an interactive GitHub project galaxy and README embed from a username. No install, fork, Pages setup, or GitHub token required." />
<style>
:root{color-scheme:dark;background:#060912;color:#edf2ff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 50% -10%,#14223f 0,#080d18 34%,#060912 70%);min-height:100vh}.wrap{max-width:1040px;margin:0 auto;padding:64px 22px 100px}.eyebrow{color:#8fb8ff;font-size:.82rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.hero h1{font-size:clamp(2.5rem,8vw,5.6rem);line-height:.94;margin:12px 0 20px;letter-spacing:-.055em}.lead{font-size:clamp(1rem,2.2vw,1.22rem);line-height:1.65;color:#aab7cc;max-width:760px}.generator{margin-top:34px;padding:22px;border:1px solid #283650;border-radius:22px;background:#0b111ecc;box-shadow:0 24px 90px #0008;backdrop-filter:blur(16px)}form{display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:12px}.username{width:100%;border:1px solid #344561;border-radius:13px;background:#070c16;color:#f2f6ff;padding:14px 15px;font:inherit;outline:none}.username:focus{border-color:#74a7ff;box-shadow:0 0 0 3px #4f8cff22}.primary,.button{border:0;border-radius:13px;padding:13px 17px;font:inherit;font-weight:700;cursor:pointer}.primary{background:#dce9ff;color:#0a1220}.button{background:#151e2e;color:#dbe8ff;border:1px solid #30405a}.options{display:flex;flex-wrap:wrap;gap:10px 18px;margin-top:15px;color:#aab7cc;font-size:.9rem}.options label{display:flex;gap:7px;align-items:center}.options select,.options input[type=number]{background:#080e19;border:1px solid #2d3b53;border-radius:8px;color:#eaf1ff;padding:6px 8px}.options input[type=number]{width:76px}.status{min-height:22px;margin-top:14px;color:#91a1b8;font-size:.9rem}.status.error{color:#ff9f9f}.result{display:none;margin-top:28px}.result.visible{display:block}.preview{padding:16px;border:1px solid #26344d;border-radius:18px;background:#070b14}.preview img{display:block;width:100%;height:auto;border-radius:14px;background:#050811}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}.actions a{text-decoration:none}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:16px}.panel{padding:16px;border:1px solid #26344d;border-radius:16px;background:#09101c}.panel h2{font-size:.96rem;margin:0 0 10px}.panel p{color:#8f9db2;font-size:.84rem;line-height:1.5}.code{width:100%;min-height:122px;resize:vertical;background:#050912;border:1px solid #283750;border-radius:10px;color:#cbd8ee;padding:12px;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}.copyrow{display:flex;justify-content:flex-end;margin-top:9px}.features{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:26px}.feature{padding:18px;border:1px solid #202d42;border-radius:16px;background:#090f1a}.feature strong{display:block;margin-bottom:7px}.feature span{color:#8e9cb1;font-size:.9rem;line-height:1.5}.foot{margin-top:34px;color:#77869c;font-size:.86rem;line-height:1.6}.foot a{color:#9ec2ff}@media(max-width:700px){.wrap{padding-top:42px}form{grid-template-columns:1fr}.grid,.features{grid-template-columns:1fr}.generator{padding:16px}}
</style>
</head>
<body>
<main class="wrap">
<section class="hero">
<div class="eyebrow">Zero-setup GitHub profile visualizer</div>
<h1>Turn your repos<br>into a project galaxy.</h1>
<p class="lead">Enter a public GitHub username. Get an interactive map, an embeddable README SVG, and copy-ready markup. No fork, GitHub Pages setup, npm install, or personal access token required.</p>
</section>

<section class="generator" aria-labelledby="generator-title">
<h2 id="generator-title" style="margin-top:0">Generate your map</h2>
<form id="generator-form">
<input id="username" class="username" name="username" placeholder="GitHub username, e.g. octocat" autocomplete="off" spellcheck="false" required maxlength="39" pattern="[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?" aria-label="GitHub username" />
<button class="primary" type="submit">Generate project map</button>
</form>
<div class="options">
<label>Theme <select id="theme"><option value="dark">Dark</option><option value="light">Light</option></select></label>
<label>Max repos <input id="max-repos" type="number" min="1" max="300" value="100" /></label>
<label><input id="forks" type="checkbox" checked /> Include forks</label>
<label><input id="archived" type="checkbox" /> Include archived</label>
</div>
<div id="status" class="status">Public repository data only. The service never asks users for a GitHub token.</div>

<div id="result" class="result">
<div class="preview"><img id="preview" alt="Generated GitHub project galaxy preview" /></div>
<div class="actions">
<a id="open-map" class="button" target="_blank" rel="noopener">Open interactive map ↗</a>
<button class="button" type="button" data-copy="svg-url">Copy SVG URL</button>
<button class="button" type="button" data-copy="html-embed">Copy HTML embed</button>
</div>
<div class="grid">
<section class="panel"><h2>README HTML</h2><p>Paste this directly into a GitHub profile README.</p><textarea id="html-embed" class="code" readonly></textarea><div class="copyrow"><button class="button" type="button" data-copy="html-embed">Copy</button></div></section>
<section class="panel"><h2>Markdown</h2><p>A compact alternative for Markdown-only profiles.</p><textarea id="markdown-embed" class="code" readonly></textarea><div class="copyrow"><button class="button" type="button" data-copy="markdown-embed">Copy</button></div></section>
<section class="panel"><h2>SVG URL</h2><p>The image endpoint can be used anywhere that accepts a remote SVG image.</p><textarea id="svg-url" class="code" readonly></textarea><div class="copyrow"><button class="button" type="button" data-copy="svg-url">Copy</button></div></section>
<section class="panel"><h2>Graph JSON</h2><p>Use the normalized graph data with your own renderer.</p><textarea id="graph-url" class="code" readonly></textarea><div class="copyrow"><button class="button" type="button" data-copy="graph-url">Copy</button></div></section>
</div>
</div>
</section>

<section class="features">
<div class="feature"><strong>No per-user deployment</strong><span>One hosted Worker serves any valid public GitHub username.</span></div>
<div class="feature"><strong>Cached upstream data</strong><span>Repeated SVG and viewer requests reuse normalized graph data instead of repeatedly calling GitHub.</span></div>
<div class="feature"><strong>Self-host remains optional</strong><span>GitHub Pages generation remains available for users who want their own static copy.</span></div>
</section>
<p class="foot">Hosted endpoint base: <code>${safeOrigin}</code>. Public GitHub metadata is fetched server-side. For production hosting, configure <code>GITHUB_TOKEN</code> as a Worker secret to raise the upstream GitHub API quota.</p>
</main>
<script>
const serviceOrigin=${JSON.stringify(origin)};
const form=document.getElementById('generator-form');
const usernameInput=document.getElementById('username');
const themeInput=document.getElementById('theme');
const maxReposInput=document.getElementById('max-repos');
const forksInput=document.getElementById('forks');
const archivedInput=document.getElementById('archived');
const statusEl=document.getElementById('status');
const resultEl=document.getElementById('result');
const preview=document.getElementById('preview');
const openMap=document.getElementById('open-map');
const usernameRe=/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

function values(){
  const username=usernameInput.value.trim().toLowerCase();
  const theme=themeInput.value==='light'?'light':'dark';
  const maxRepos=Math.max(1,Math.min(300,Math.round(Number(maxReposInput.value)||100)));
  return {username,theme,maxRepos,forks:forksInput.checked,archived:archivedInput.checked};
}

function makeUrls(v){
  const graph=new URL('/api/graph',serviceOrigin);
  const svg=new URL('/api/galaxy.svg',serviceOrigin);
  for(const target of [graph,svg]){
    target.searchParams.set('username',v.username);
    target.searchParams.set('max_repos',String(v.maxRepos));
    target.searchParams.set('forks',String(v.forks));
    target.searchParams.set('archived',String(v.archived));
  }
  svg.searchParams.set('theme',v.theme);
  return {graph:graph.toString(),svg:svg.toString(),viewer:new URL('/u/'+encodeURIComponent(v.username),serviceOrigin).toString()};
}

function htmlAttributeUrl(value){return value.replaceAll('&','&amp;')}

function updateShareUrl(v){
  const share=new URL(location.href);
  share.search='';
  share.searchParams.set('username',v.username);
  share.searchParams.set('theme',v.theme);
  share.searchParams.set('max_repos',String(v.maxRepos));
  share.searchParams.set('forks',String(v.forks));
  share.searchParams.set('archived',String(v.archived));
  history.replaceState(null,'',share);
}

function generate(){
  const v=values();
  maxReposInput.value=String(v.maxRepos);
  if(!usernameRe.test(v.username)){
    statusEl.textContent='Enter a valid GitHub username.';
    statusEl.classList.add('error');
    resultEl.classList.remove('visible');
    return;
  }
  statusEl.textContent='Loading public repositories…';
  statusEl.classList.remove('error');
  const urls=makeUrls(v);
  preview.src=urls.svg;
  openMap.href=urls.viewer;
  document.getElementById('svg-url').value=urls.svg;
  document.getElementById('graph-url').value=urls.graph;
  document.getElementById('html-embed').value='<p align="center">\n  <a href="'+urls.viewer+'">\n    <img width="740" src="'+htmlAttributeUrl(urls.svg)+'" alt="'+v.username+' project galaxy" />\n  </a>\n</p>';
  document.getElementById('markdown-embed').value='[!['+v.username+' project galaxy]('+urls.svg+')]('+urls.viewer+')';
  resultEl.classList.add('visible');
  updateShareUrl(v);
}

form.addEventListener('submit',event=>{event.preventDefault();generate()});
preview.addEventListener('load',()=>{statusEl.textContent='Ready — copy the embed below or open the interactive map.';statusEl.classList.remove('error')});
preview.addEventListener('error',()=>{statusEl.textContent='Could not generate the map. Check the username or try again shortly.';statusEl.classList.add('error')});
for(const button of document.querySelectorAll('[data-copy]'))button.addEventListener('click',async()=>{
  const target=document.getElementById(button.dataset.copy);
  if(!target)return;
  try{await navigator.clipboard.writeText(target.value);const old=button.textContent;button.textContent='Copied';setTimeout(()=>button.textContent=old,1200)}catch{target.select();document.execCommand('copy')}
});

const initial=new URL(location.href).searchParams;
if(initial.has('username')){
  usernameInput.value=initial.get('username')||'';
  themeInput.value=initial.get('theme')==='light'?'light':'dark';
  maxReposInput.value=initial.get('max_repos')||'100';
  forksInput.checked=initial.get('forks')!=='false';
  archivedInput.checked=initial.get('archived')==='true';
  generate();
}
</script>
</body>
</html>`;
}
