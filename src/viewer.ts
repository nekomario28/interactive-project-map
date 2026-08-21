import { renderViewer as renderBaseViewer } from "./html.ts";

const FETCH_NEEDLE = "fetch('/api/graph?username='+encodeURIComponent(username)+'&max_repos=100')";
const FETCH_REPLACEMENT = `fetch((()=>{const pageParams=new URL(location.href).searchParams;const graphUrl=new URL('/api/graph',location.origin);graphUrl.searchParams.set('username',username);graphUrl.searchParams.set('static','1');for(const key of ['max_repos','forks','archived'])if(pageParams.has(key))graphUrl.searchParams.set(key,pageParams.get(key));if(!graphUrl.searchParams.has('max_repos'))graphUrl.searchParams.set('max_repos','100');return graphUrl.toString()})())`;
const BACK_LINK_NEEDLE = '<a class="back" href="/">API docs</a>';
const INSTALL_NOTICE = '<div id="install-result" role="status" hidden style="position:fixed;left:50%;top:18px;z-index:4;max-width:min(560px,calc(100vw - 240px));transform:translateX(-50%);padding:9px 12px;border:1px solid #345071;border-radius:11px;background:#0b1625ee;color:#dce9ff;font-size:12px;box-shadow:0 8px 28px #0007"></div>';
const TIP_NEEDLE = "const tip=document.getElementById('tip');";
const INSTALL_SCRIPT = `const tip=document.getElementById('tip');\nconst installResult=document.getElementById('install-result');\nconst installOutcome=new URL(location.href).searchParams.get('install');\nconst installMessages={created:'Project Map installed · initial generation started.',updated:'Project Map integration updated · regeneration started.',unchanged:'Project Map is already current · regeneration started.'};\nif(installMessages[installOutcome]){installResult.textContent=installMessages[installOutcome];installResult.hidden=false;const cleanUrl=new URL(location.href);cleanUrl.searchParams.delete('install');history.replaceState(null,'',cleanUrl);}`;

export function renderViewer(username: string): string {
  const html = renderBaseViewer(username);
  for (const needle of [FETCH_NEEDLE, BACK_LINK_NEEDLE, TIP_NEEDLE]) {
    if (!html.includes(needle)) throw new Error(`Viewer integration point changed: ${needle}`);
  }
  return html
    .replace(BACK_LINK_NEEDLE, `${INSTALL_NOTICE}\n${BACK_LINK_NEEDLE}`)
    .replace(TIP_NEEDLE, INSTALL_SCRIPT)
    .replace(FETCH_NEEDLE, FETCH_REPLACEMENT);
}
