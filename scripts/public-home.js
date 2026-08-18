const USERNAME_RE=/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const CHECKOUT_SHA='3d3c42e5aac5ba805825da76410c181273ba90b1';
const UPLOAD_SHA='043fb46d1a93c77aae656e7c1c64a875d1fc6a0a';
const DOWNLOAD_SHA='3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c';
const PROJECT_MAP_ACTION_REF='__PROJECT_MAP_ACTION_REF__';
const STYLE_VALUES=new Set(['radial','galaxy','obsidian','tree','treemap']);
const form=document.getElementById('form');
const usernameInput=document.getElementById('username');
const themeInput=document.getElementById('theme');
const styleInput=document.getElementById('mapStyle');
const maxReposInput=document.getElementById('maxRepos');
const forksInput=document.getElementById('forks');
const archivedInput=document.getElementById('archived');
const statusEl=document.getElementById('status');
const resultEl=document.getElementById('result');
const preview=document.getElementById('preview');
const previewMessage=document.getElementById('previewMessage');
const openMap=document.getElementById('openMap');
const presetCards=[...document.querySelectorAll('[data-style-preset]')];

function normalizeStyle(value){return STYLE_VALUES.has(value)?value:'radial';}
function syncPresetCards(style){for(const card of presetCards){const selected=card.dataset.stylePreset===style;card.classList.toggle('is-selected',selected);card.setAttribute('aria-pressed',String(selected));}}
function values(){const username=usernameInput.value.trim().toLowerCase();const maxRepos=Math.max(1,Math.min(300,Math.round(Number(maxReposInput.value)||100)));const style=normalizeStyle(styleInput?.value);return{username,theme:themeInput.value==='light'?'light':'dark',style,maxRepos,forks:forksInput.checked,archived:archivedInput.checked};}
function urls(v){
  const owner=encodeURIComponent(v.username);
  const raw='https://raw.githubusercontent.com/'+owner+'/'+owner+'/HEAD/project-map';
  const route=v.style==='tree'?'tree/':v.style==='radial'?'radial/':v.style==='treemap'?'treemap/':'u/';
  const viewer=new URL(route,new URL('./',location.href));
  viewer.searchParams.set('username',v.username);viewer.searchParams.set('style',v.style);
  return{svg:raw+'/galaxy.svg',graph:raw+'/graph.json',viewer:viewer.toString()};
}
function workflowFor(v){return[
  'name: Update project map','',
  'on:','  workflow_dispatch:','  schedule:','    - cron: "37 3 * * *"','',
  'permissions:','  contents: read','',
  'jobs:','  generate:','    runs-on: ubuntu-latest','    permissions:','      contents: read','    steps:',
  '      - name: Checkout profile repository','        uses: actions/checkout@'+CHECKOUT_SHA+' # v7.0.1','',
  '      - name: Generate project map','        uses: nekomario28/interactive-project-map@'+PROJECT_MAP_ACTION_REF,'        with:',
  '          github_token: ${{ github.token }}','          username: ${{ github.repository_owner }}','          theme: '+v.theme,'          style: '+v.style,'          max_repos: "'+v.maxRepos+'"','          forks: "'+v.forks+'"','          archived: "'+v.archived+'"','          output_dir: project-map','',
  '      - name: Transfer generated files to publish job','        uses: actions/upload-artifact@'+UPLOAD_SHA+' # v7.0.1','        with:','          name: project-map-generated','          path: project-map','          if-no-files-found: error','          retention-days: 1','',
  '  publish:','    needs: generate','    runs-on: ubuntu-latest','    permissions:','      actions: read','      contents: write','    steps:',
  '      - name: Checkout profile repository','        uses: actions/checkout@'+CHECKOUT_SHA+' # v7.0.1','',
  '      - name: Download generated files','        uses: actions/download-artifact@'+DOWNLOAD_SHA+' # v8.0.1','        with:','          name: project-map-generated','          path: project-map','',
  '      - name: Commit only when the generated map changed','        shell: bash','        run: |','          set -euo pipefail','          git add -- project-map/galaxy.svg project-map/graph.json','          if git diff --cached --quiet; then','            echo "Project map is already up to date."','            exit 0','          fi','          git config user.name "github-actions[bot]"','          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"','          git commit -m "chore: update project map"','          git push',''
].join('\n');}
function generate(){
  const v=values();maxReposInput.value=String(v.maxRepos);syncPresetCards(v.style);
  if(!USERNAME_RE.test(v.username)){statusEl.textContent='Enter a valid GitHub username.';statusEl.classList.add('error');resultEl.classList.remove('visible');return;}
  const u=urls(v);const workflow=workflowFor(v);
  const html='<p align="center">\n  <a href="'+u.viewer+'">\n    <img width="740" src="'+u.svg+'" alt="'+v.username+' project map" />\n  </a>\n</p>';
  const md='[!['+v.username+' project map]('+u.svg+')]('+u.viewer+')';
  document.getElementById('workflow').value=workflow;document.getElementById('readmeHtml').value=html;document.getElementById('readmeMarkdown').value=md;document.getElementById('staticUrls').value='SVG: '+u.svg+'\nGraph: '+u.graph+'\nInteractive: '+u.viewer;
  openMap.href=u.viewer;preview.classList.remove('ready');previewMessage.textContent='Checking for an existing generated SVG…';preview.src=u.svg;resultEl.classList.add('visible');statusEl.textContent='Setup generated. Add the workflow to '+v.username+'/'+v.username+' and run it once.';statusEl.classList.remove('error');
  const share=new URL(location.href);share.search='';share.searchParams.set('username',v.username);share.searchParams.set('theme',v.theme);share.searchParams.set('style',v.style);share.searchParams.set('max_repos',String(v.maxRepos));share.searchParams.set('forks',String(v.forks));share.searchParams.set('archived',String(v.archived));history.replaceState(null,'',share);
}
for(const card of presetCards){card.addEventListener('click',()=>{const style=normalizeStyle(card.dataset.stylePreset);if(styleInput)styleInput.value=style;syncPresetCards(style);});}
if(styleInput)styleInput.addEventListener('change',()=>syncPresetCards(normalizeStyle(styleInput.value)));
form.addEventListener('submit',event=>{event.preventDefault();generate();});
preview.addEventListener('load',()=>{preview.classList.add('ready');previewMessage.textContent='Existing static SVG found in the profile repository.';});
preview.addEventListener('error',()=>{preview.classList.remove('ready');previewMessage.textContent='No static SVG yet. Run the generated workflow once, then reload this page.';});
for(const button of document.querySelectorAll('[data-copy]')){button.addEventListener('click',async()=>{const target=document.getElementById(button.dataset.copy);if(!target)return;try{await navigator.clipboard.writeText(target.value);const old=button.textContent;button.textContent='Copied';setTimeout(()=>button.textContent=old,1200);}catch{target.select();document.execCommand('copy');}});}
const initial=new URL(location.href).searchParams;
if(initial.has('username')){usernameInput.value=initial.get('username')||'';themeInput.value=initial.get('theme')==='light'?'light':'dark';if(styleInput)styleInput.value=normalizeStyle(initial.get('style'));maxReposInput.value=initial.get('max_repos')||'100';forksInput.checked=initial.get('forks')!=='false';archivedInput.checked=initial.get('archived')==='true';syncPresetCards(normalizeStyle(styleInput?.value));generate();}else{syncPresetCards(normalizeStyle(styleInput?.value));}
