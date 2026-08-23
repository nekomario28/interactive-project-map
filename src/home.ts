function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char] ?? char));
}

export function renderHome(origin: string, oneClickInstall = false): string {
  const safeOrigin = esc(origin);
  const oneClickAction = oneClickInstall ? '<a id="one-click-install" class="primary" href="#">Install with GitHub App</a>' : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>GitHub Project Galaxy</title>
<meta name="description" content="Preview a GitHub project galaxy, then install a distributed static map in your profile repository." />
<style>
:root{color-scheme:dark;background:#060912;color:#edf2ff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 50% -10%,#14223f 0,#080d18 34%,#060912 70%);min-height:100vh}.wrap{max-width:1040px;margin:0 auto;padding:64px 22px 100px}.eyebrow{color:#8fb8ff;font-size:.82rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase}h1{font-size:clamp(2.5rem,8vw,5.6rem);line-height:.94;margin:12px 0 20px;letter-spacing:-.055em}.lead{font-size:clamp(1rem,2.2vw,1.22rem);line-height:1.65;color:#aab7cc;max-width:800px}.generator{margin-top:34px;padding:22px;border:1px solid #283650;border-radius:22px;background:#0b111ecc;box-shadow:0 24px 90px #0008;backdrop-filter:blur(16px)}form{display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:12px}.username{width:100%;border:1px solid #344561;border-radius:13px;background:#070c16;color:#f2f6ff;padding:14px 15px;font:inherit;outline:none}.username:focus{border-color:#74a7ff;box-shadow:0 0 0 3px #4f8cff22}.primary,.button{border:0;border-radius:13px;padding:13px 17px;font:inherit;font-weight:700;cursor:pointer}.primary{background:#dce9ff;color:#0a1220}.button{background:#151e2e;color:#dbe8ff;border:1px solid #30405a}.options{display:flex;flex-wrap:wrap;gap:10px 18px;margin-top:15px;color:#aab7cc;font-size:.9rem}.options label{display:flex;gap:7px;align-items:center}.options select,.options input[type=number]{background:#080e19;border:1px solid #2d3b53;border-radius:8px;color:#eaf1ff;padding:6px 8px}.options input[type=number]{width:76px}.status{min-height:22px;margin-top:14px;color:#91a1b8;font-size:.9rem}.status.error{color:#ff9f9f}.result{display:none;margin-top:28px}.result.visible{display:block}.preview{padding:16px;border:1px solid #26344d;border-radius:18px;background:#070b14}.preview img{display:block;width:100%;height:auto;border-radius:14px;background:#050811}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}.actions a{text-decoration:none}.steps{display:grid;gap:14px;margin-top:18px}.panel{padding:17px;border:1px solid #26344d;border-radius:16px;background:#09101c}.panel h2{font-size:1rem;margin:0 0 7px}.panel p{color:#8f9db2;font-size:.86rem;line-height:1.55}.code{width:100%;min-height:118px;resize:vertical;background:#050912;border:1px solid #283750;border-radius:10px;color:#cbd8ee;padding:12px;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}.workflow{min-height:310px}.copyrow{display:flex;justify-content:flex-end;gap:8px;margin-top:9px}.features{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:26px}.feature{padding:18px;border:1px solid #202d42;border-radius:16px;background:#090f1a}.feature strong{display:block;margin-bottom:7px}.feature span{color:#8e9cb1;font-size:.9rem;line-height:1.5}.foot{margin-top:34px;color:#77869c;font-size:.86rem;line-height:1.6}.foot code{word-break:break-all}.badge{display:inline-block;padding:4px 8px;border-radius:999px;background:#13213a;color:#aecdff;font-size:.76rem;font-weight:700}@media(max-width:700px){.wrap{padding-top:42px}form,.features{grid-template-columns:1fr}.generator{padding:16px}}
</style>
</head>
<body>
<main class="wrap">
<section>
<div class="eyebrow">Distributed GitHub profile visualizer</div>
<h1>Preview centrally.<br>Publish from your repo.</h1>
<p class="lead">Try the map instantly, then let your own GitHub Actions workflow generate <code>galaxy.svg</code> and <code>graph.json</code>. Profile views use your static files instead of consuming a shared GitHub API quota.</p>
</section>

<section class="generator" aria-labelledby="generator-title">
<h2 id="generator-title" style="margin-top:0">Generate your map</h2>
<form id="generator-form">
<input id="username" class="username" name="username" placeholder="GitHub username, e.g. octocat" autocomplete="off" spellcheck="false" required maxlength="39" pattern="[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?" aria-label="GitHub username" />
<button class="primary" type="submit">Preview & install</button>
</form>
<div class="options">
<label>Theme <select id="theme"><option value="dark">Dark</option><option value="light">Light</option></select></label>
<label>Style <select id="map-style"><option value="radial">Radial</option><option value="galaxy-classic">Galaxy Classic</option><option value="galaxy-systems">Galaxy Systems</option><option value="galaxy-hybrid">Galaxy Hybrid</option><option value="obsidian">Obsidian-like</option><option value="tree">Tree</option><option value="treemap">Treemap</option><option value="timeline">Timeline</option><option value="cluster">Cluster / Bubble</option><option value="sunburst">Sunburst</option><option value="matrix">Matrix / Heatmap</option><option value="sankey">Sankey</option></select></label>
<label>Max repos <input id="max-repos" type="number" min="1" max="300" value="100" /></label>
<label><input id="forks" type="checkbox" checked /> Include forks</label>
<label><input id="archived" type="checkbox" /> Include archived</label>
<label title="Opt in to bounded public work in repositories owned by other people or organizations. This never means repository ownership."><input id="contributed" type="checkbox" /> Include Contributed</label>
</div>
<div id="status" class="status">Preview uses public repository data only. Contributed is off by default; when enabled, the installed map also includes bounded public work in repositories owned by others.</div>

<div id="result" class="result">
<div class="preview"><span class="badge">Hosted Galaxy preview</span><img id="preview" alt="Generated GitHub project galaxy preview" /></div>
<div class="actions"><a id="create-profile-repo" class="button" target="_blank" rel="noopener">0 · No profile repo? Create it ↗</a><a id="open-map" class="button" target="_blank" rel="noopener">Open your interactive map ↗</a>${oneClickAction}</div>
<div class="steps">
<section class="panel"><h2>1. Add this GitHub Actions workflow</h2><p>If <code>USERNAME/USERNAME</code> does not exist, use Step 0 and enable <strong>Add README</strong> on GitHub first. Then create <code>.github/workflows/project-map.yml</code> in that public profile repository. The selected style and Contributed opt-in are preserved in both the manual workflow and GitHub App flow. Contributed means work in repositories owned by other people or organizations, never repository ownership. The hosted image above remains a lightweight Galaxy preview; the installed static map uses the selected preset.</p><textarea id="workflow" class="code workflow" readonly></textarea><div class="copyrow"><button class="button" type="button" data-copy="workflow">Copy workflow</button></div></section>
<section class="panel"><h2>2. Add this to your profile README</h2><p>The image is served from your own repository. Clicking it opens the shared interactive viewer, which prefers your static graph and only falls back to the hosted GitHub API when no valid static graph exists.</p><textarea id="html-embed" class="code" readonly></textarea><div class="copyrow"><button class="button" type="button" data-copy="html-embed">Copy HTML</button><button class="button" type="button" data-copy="markdown-embed">Copy Markdown</button></div><textarea id="markdown-embed" class="code" readonly hidden></textarea></section>
<section class="panel"><h2>3. Static outputs</h2><p>These resolve through the profile repository's default branch.</p><textarea id="static-urls" class="code" readonly></textarea><div class="copyrow"><button class="button" type="button" data-copy="static-urls">Copy URLs</button></div></section>
</div>
</div>
</section>

<section class="features">
<div class="feature"><strong>No fork required</strong><span>Users install one workflow in their existing profile repository.</span></div>
<div class="feature"><strong>Distributed API usage</strong><span>GitHub metadata is fetched during each user's scheduled Action, not on every profile view.</span></div>
<div class="feature"><strong>Interactive stays shared</strong><span>One viewer UI can improve globally while each user's graph remains a static artifact they control.</span></div>
</section>
<p class="foot">Hosted endpoint base: <code>${safeOrigin}</code>. The hosted API remains available for previews and fallback. Fork/Pages self-hosting remains optional.</p>
</main>
<script>
const serviceOrigin=${JSON.stringify(origin)};
const styles=new Set(['radial','galaxy-classic','galaxy-systems','galaxy-hybrid','obsidian','tree','treemap','timeline','cluster','sunburst','matrix','sankey']);
const form=document.getElementById('generator-form');
const usernameInput=document.getElementById('username');
const themeInput=document.getElementById('theme');
const styleInput=document.getElementById('map-style');
const maxReposInput=document.getElementById('max-repos');
const forksInput=document.getElementById('forks');
const archivedInput=document.getElementById('archived');
const contributedInput=document.getElementById('contributed');
const statusEl=document.getElementById('status');
const resultEl=document.getElementById('result');
const preview=document.getElementById('preview');
const openMap=document.getElementById('open-map');
const createProfileRepo=document.getElementById('create-profile-repo');
const oneClickInstall=document.getElementById('one-click-install');
const usernameRe=/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

function styleValue(value){const normalized=String(value||'').trim().toLowerCase();return styles.has(normalized)?normalized:'radial'}
function values(){const username=usernameInput.value.trim().toLowerCase();const theme=themeInput.value==='light'?'light':'dark';const style=styleValue(styleInput.value);const maxRepos=Math.max(1,Math.min(300,Math.round(Number(maxReposInput.value)||100)));return{username,theme,style,maxRepos,forks:forksInput.checked,archived:archivedInput.checked,contributed:contributedInput.checked}}
function query(v){const p=new URLSearchParams();p.set('username',v.username);p.set('theme',v.theme);p.set('style',v.style);p.set('max_repos',String(v.maxRepos));p.set('forks',String(v.forks));p.set('archived',String(v.archived));p.set('contributed',String(v.contributed));return p}
function profileRepoUrl(username){const u=new URL('https://github.com/new');u.searchParams.set('name',username);u.searchParams.set('owner',username);u.searchParams.set('visibility','public');u.searchParams.set('description','GitHub profile for '+username);return u.toString()}
function urls(v){const p=query(v);const previewUrl=new URL('/api/galaxy.svg',serviceOrigin);previewUrl.search=p.toString();const installUrl=new URL('/api/install-workflow',serviceOrigin);installUrl.search=p.toString();const oneClickUrl=new URL('/api/install/start',serviceOrigin);oneClickUrl.search=p.toString();const raw='https://raw.githubusercontent.com/'+encodeURIComponent(v.username)+'/'+encodeURIComponent(v.username)+'/HEAD/project-map';const viewer=new URL('/u/'+encodeURIComponent(v.username),serviceOrigin);viewer.searchParams.set('style',v.style);viewer.searchParams.set('max_repos',String(v.maxRepos));viewer.searchParams.set('forks',String(v.forks));viewer.searchParams.set('archived',String(v.archived));return{preview:previewUrl.toString(),install:installUrl.toString(),oneClick:oneClickUrl.toString(),profile:profileRepoUrl(v.username),svg:raw+'/galaxy.svg',graph:raw+'/graph.json',viewer:viewer.toString()}}
function htmlUrl(value){return value.replaceAll('&','&amp;')}
function updateShare(v){const share=new URL(location.href);share.search=query(v).toString();history.replaceState(null,'',share)}

async function generate(){
  const v=values();maxReposInput.value=String(v.maxRepos);styleInput.value=v.style;
  if(!usernameRe.test(v.username)){statusEl.textContent='Enter a valid GitHub username.';statusEl.classList.add('error');resultEl.classList.remove('visible');return}
  statusEl.textContent='Loading hosted Galaxy preview and '+v.style+' install workflow…';statusEl.classList.remove('error');const u=urls(v);
  preview.src=u.preview;openMap.href=u.viewer;createProfileRepo.href=u.profile;if(oneClickInstall)oneClickInstall.href=u.oneClick;
  document.getElementById('html-embed').value='<p align="center">\n  <a href="'+htmlUrl(u.viewer)+'">\n    <img width="740" src="'+u.svg+'" alt="'+v.username+' project galaxy" />\n  </a>\n</p>';
  document.getElementById('markdown-embed').value='[!['+v.username+' project galaxy]('+u.svg+')]('+u.viewer+')';
  document.getElementById('static-urls').value='SVG: '+u.svg+'\nGraph: '+u.graph+'\nInteractive: '+u.viewer;
  document.getElementById('workflow').value='Loading workflow…';resultEl.classList.add('visible');updateShare(v);
  try{const response=await fetch(u.install);if(!response.ok)throw new Error('workflow '+response.status);document.getElementById('workflow').value=await response.text()}catch{document.getElementById('workflow').value='Could not load the workflow. Try again shortly.'}
}

form.addEventListener('submit',event=>{event.preventDefault();generate()});
preview.addEventListener('load',()=>{const v=values();statusEl.textContent='Hosted Galaxy preview ready. The installed static map will use '+styleValue(styleInput.value)+(v.contributed?' with Contributed enabled. The same choice is preserved by both install paths.':'. Contributed remains off by default.');statusEl.classList.remove('error')});
preview.addEventListener('error',()=>{statusEl.textContent='Could not generate the preview. Check the username or try again shortly.';statusEl.classList.add('error')});
for(const button of document.querySelectorAll('[data-copy]'))button.addEventListener('click',async()=>{const target=document.getElementById(button.dataset.copy);if(!target)return;try{await navigator.clipboard.writeText(target.value);const old=button.textContent;button.textContent='Copied';setTimeout(()=>button.textContent=old,1200)}catch{target.hidden=false;target.select();document.execCommand('copy')}});
const initial=new URL(location.href).searchParams;if(initial.has('username')){usernameInput.value=initial.get('username')||'';themeInput.value=initial.get('theme')==='light'?'light':'dark';styleInput.value=styleValue(initial.get('style'));maxReposInput.value=initial.get('max_repos')||'100';forksInput.checked=initial.get('forks')!=='false';archivedInput.checked=initial.get('archived')==='true';contributedInput.checked=initial.get('contributed')==='true';generate()}
</script>
</body>
</html>`;
}
