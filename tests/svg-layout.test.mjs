import assert from "node:assert/strict";
import test from "node:test";
import { renderGalaxySvg } from "../scripts/svg.mjs";
import { renderRadialTreeSvg } from "../scripts/radial-svg.mjs";
import { renderTreeSvg } from "../scripts/tree-svg.mjs";
import { renderTreemapSvg } from "../scripts/treemap-svg.mjs";
import { renderTimelineSvg } from "../scripts/timeline-svg.mjs";
import { renderClusterSvg } from "../scripts/cluster-svg.mjs";

function denseGraph() {
  const groups = Array.from({ length: 4 }, (_, index) => ({ id: `group:g${index}`, label: `Dense category ${index + 1}`, type: "group", repositoryCount: 7 }));
  const repositories = Array.from({ length: 28 }, (_, index) => {
    const groupIndex = index % groups.length;
    const createdAt = new Date(Date.UTC(2021 + Math.floor(index / 8), index % 12, 1 + (index % 20))).toISOString();
    return { id: `repository:long-project-name-${String(index + 1).padStart(2, "0")}`, label: `long-project-name-${String(index + 1).padStart(2, "0")}-with-readable-label`, type: "repository", url: `https://github.com/example/long-project-name-${index + 1}`, description: "dense layout test", language: index % 2 ? "TypeScript" : "Python", topics: [], stars: 30 - index, forks: index % 5, fork: index % 4 === 0, archived: index % 9 === 0, createdAt, updatedAt: "2026-08-18T00:00:00Z", groupId: `g${groupIndex}`, groupLabel: groups[groupIndex].label };
  });
  const nodes = [{ id: "user:example", label: "example", type: "owner", url: "https://github.com/example" }, ...groups, ...repositories];
  const edges = [];
  for (const group of groups) edges.push({ source: "user:example", target: group.id, type: "ownership" });
  for (const repo of repositories) edges.push({ source: `group:${repo.groupId}`, target: repo.id, type: "membership" });
  return { owner: "example", generatedAt: "2026-08-18T00:00:00Z", repositoryCount: repositories.length, groupCount: groups.length, nodes, edges };
}
function repositoryLabelBoxes(svg) {
  const boxes=[]; const pattern=/<text x="([\d.]+)" y="([\d.]+)" text-anchor="middle" fill="[^"]+" font-size="([\d.]+)"[^>]*>(long-project-name[^<]+)<\/text>/g;
  for(const match of svg.matchAll(pattern)){const x=Number(match[1]),y=Number(match[2]),fontSize=Number(match[3]),label=match[4],width=Math.min(190,12+label.length*fontSize*.58);boxes.push({label,left:x-width/2,right:x+width/2,top:y,bottom:y+fontSize+6});}return boxes;
}
function overlaps(a,b,padding=2){return!(a.right+padding<b.left||b.right+padding<a.left||a.bottom+padding<b.top||b.bottom+padding<a.top);}
const renderers={radial:(g)=>renderRadialTreeSvg(g,"dark",740,420),galaxy:(g)=>renderGalaxySvg(g,"dark",740,420,"galaxy"),obsidian:(g)=>renderGalaxySvg(g,"dark",740,420,"obsidian"),tree:(g)=>renderTreeSvg(g,"dark",740,420),timeline:(g)=>renderTimelineSvg(g,"dark",740,420),cluster:(g)=>renderClusterSvg(g,"dark",740,420)};
for(const[style,render]of Object.entries(renderers))test(`${style} SVG keeps dense repository labels readable`,()=>{const svg=render(denseGraph()),boxes=repositoryLabelBoxes(svg);assert.ok(boxes.length>=5,`${style} should retain several repository labels`);for(let first=0;first<boxes.length;first+=1)for(let second=first+1;second<boxes.length;second+=1)assert.equal(overlaps(boxes[first],boxes[second]),false,`${style} labels overlap: ${boxes[first].label} / ${boxes[second].label}`);assert.match(svg,/>Original<\/text>/);assert.match(svg,/>Fork<\/text>/);assert.match(svg,/>Archived<\/text>/);});
test("treemap SVG keeps dense repositories bounded in non-overlapping category tiles",()=>{const svg=renderTreemapSvg(denseGraph(),"dark",740,420);assert.match(svg,/aria-label="Treemap of example/);assert.match(svg,/Treemap · 28 projects/);assert.match(svg,/>Original<\/text>/);assert.match(svg,/>Fork<\/text>/);assert.match(svg,/>Archived<\/text>/);assert.doesNotMatch(svg,/NaN|Infinity|width="-/);assert.equal([...svg.matchAll(/<title>long-project-name-/g)].length,28);});
