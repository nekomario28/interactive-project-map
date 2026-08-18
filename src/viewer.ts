import { renderViewer as renderBaseViewer } from "./html.ts";

const FETCH_NEEDLE = "fetch('/api/graph?username='+encodeURIComponent(username)+'&max_repos=100')";
const FETCH_REPLACEMENT = `fetch((()=>{const pageParams=new URL(location.href).searchParams;const graphUrl=new URL('/api/graph',location.origin);graphUrl.searchParams.set('username',username);graphUrl.searchParams.set('static','1');for(const key of ['max_repos','forks','archived'])if(pageParams.has(key))graphUrl.searchParams.set(key,pageParams.get(key));if(!graphUrl.searchParams.has('max_repos'))graphUrl.searchParams.set('max_repos','100');return graphUrl.toString()})())`;

export function renderViewer(username: string): string {
  const html = renderBaseViewer(username);
  if (!html.includes(FETCH_NEEDLE)) {
    throw new Error("Viewer graph fetch integration point changed");
  }
  return html.replace(FETCH_NEEDLE, FETCH_REPLACEMENT);
}
