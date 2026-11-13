import test from "node:test";
import assert from "node:assert/strict";
import { renderGalaxySystemsSvg } from "../scripts/galaxy-svg-systems.mjs";

function representativeCrowdedGraph() {
  const categories = ["Developer Tools", "Web Frontend", "Machine Learning", "Cloud Infra", "Systems Core", "Open Data"];
  const groups = categories.map((label, index) => ({
    id: `group:g${index}`,
    label,
    type: "group",
    repositoryCount: 3,
  }));
  const owned = Array.from({ length: 18 }, (_, index) => ({
    id: `repository:owned-${index}`,
    label: index % 3 === 0 ? `interactive-project-map-extension-v${index}` : `project-${index}`,
    type: "repository",
    url: `https://github.com/nekomario28/${index % 3 === 0 ? `interactive-project-map-extension-v${index}` : `project-${index}`}`,
    stars: 30 - index,
    forks: 0,
    fork: false,
    archived: false,
    groupId: `g${index % groups.length}`,
    groupLabel: groups[index % groups.length].label,
  }));
  const contributed = Array.from({ length: 12 }, (_, index) => ({
    id: `repository:org-${index}/very-long-contributed-repo-name-${index}`,
    label: `org-${index}/very-long-contributed-repo-name-${index}`,
    type: "repository",
    relation: "contributed",
    repositoryOwner: `org-${index}`,
    repositoryName: `very-long-contributed-repo-name-${index}`,
    url: `https://github.com/org-${index}/very-long-contributed-repo-name-${index}`,
    stars: 500 - index * 20,
    forks: 0,
    fork: false,
    archived: false,
    contribution: { commits: 3, pullRequests: 1, mergedPullRequests: 1 },
  }));
  return {
    owner: "nekomario28",
    repositoryCount: owned.length,
    groupCount: groups.length,
    contributedRepositoryCount: contributed.length,
    nodes: [
      {
        id: "user:nekomario28",
        label: "nekomario28",
        type: "owner",
        url: "https://github.com/nekomario28",
        profileStats: {
          ownedStars: 120,
          followers: 40,
          originalRepositories: 18,
          contributedRepositories: 12,
          mergedPullRequests: 15,
          commits: 60,
          limitedRepositories: false,
          limitedContributions: false,
        },
      },
      ...groups,
      ...owned,
      ...contributed,
    ],
    edges: [],
  };
}

function measurePlacedLabels(svg, width, height) {
  const boxes = [];
  const stack = [{ tx: 0, ty: 0, sx: 1, sy: 1 }];
  for (const match of svg.matchAll(/<g\b([^>]*)>|<\/g>|<text\b([^>]*)>([^<]*)<\/text>/g)) {
    if (match[0] === "</g>") {
      stack.pop();
      continue;
    }
    const top = stack.at(-1);
    if (match[1] !== undefined) {
      const tr = (match[1].match(/transform="([^"]*)"/) || [])[1] || "";
      let { tx, ty, sx, sy } = top;
      for (const op of tr.matchAll(/(translate|scale)\(([^)]+)\)/g)) {
        const nums = op[2].trim().split(/[\s,]+/).map(Number);
        if (op[1] === "translate") {
          tx += nums[0] * sx;
          ty += (nums[1] || 0) * sy;
        } else {
          sx *= nums[0];
          sy *= nums[1] ?? nums[0];
        }
      }
      stack.push({ tx, ty, sx, sy });
      continue;
    }
    const attrs = match[2];
    const text = match[3];
    const x = Number((attrs.match(/\bx="([^"]+)"/) || [])[1] || 0);
    const y = Number((attrs.match(/\by="([^"]+)"/) || [])[1] || 0);
    const fs = Number((attrs.match(/font-size="([^"]+)"/) || [])[1] || 10);
    const anchor = (attrs.match(/text-anchor="([^"]+)"/) || [])[1] || "start";
    if (y >= height - 22) continue;
    const wx = top.tx + x * top.sx;
    const wy = top.ty + y * top.sy;
    const sfs = fs * top.sy;
    const w = text.length * sfs * 0.58;
    const left = anchor === "middle" ? wx - w / 2 : anchor === "end" ? wx - w : wx;
    boxes.push({ text, left, right: left + w, top: wy - sfs * 0.85, bottom: wy + sfs * 0.25 });
  }
  let overlaps = 0;
  let clipped = 0;
  for (let i = 0; i < boxes.length; i += 1) {
    if (boxes[i].left < 0 || boxes[i].right > width || boxes[i].top < 0 || boxes[i].bottom > height) clipped += 1;
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      if (!(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top)) overlaps += 1;
    }
  }
  return { count: boxes.length, overlaps, clipped };
}

test("Galaxy Systems keeps Rail and Halo labels collision-free and unclipped across 740px, 390px and 320px", () => {
  const graph = representativeCrowdedGraph();
  for (const layout of ["rail", "halo"]) {
    for (const theme of ["dark", "light"]) {
      for (const [width, height] of [[740, 420], [390, 260], [320, 240]]) {
        const svg = renderGalaxySystemsSvg(graph, theme, width, height, undefined, { contributedLayout: layout });
        const stats = measurePlacedLabels(svg, width, height);
        assert.equal(stats.overlaps, 0, `${layout}/${theme} at ${width}x${height} had ${stats.overlaps} overlapping labels`);
        assert.equal(stats.clipped, 0, `${layout}/${theme} at ${width}x${height} had ${stats.clipped} clipped labels`);
        assert.ok(stats.count >= 10, `${layout}/${theme} at ${width}x${height} kept too few labels: ${stats.count}`);
        assert.match(svg, />nekomario28<\/text>/, "owner label must remain highest priority");
      }
    }
  }
});

test("Galaxy Systems bounds visible labels at narrow widths while preserving full title and URL metadata", () => {
  const graph = representativeCrowdedGraph();
  const desktopHalo = renderGalaxySystemsSvg(graph, "dark", 740, 420, undefined, { contributedLayout: "halo" });
  const mobileHalo = renderGalaxySystemsSvg(graph, "dark", 320, 240, undefined, { contributedLayout: "halo" });
  const desktopCount = measurePlacedLabels(desktopHalo, 740, 420).count;
  const mobileCount = measurePlacedLabels(mobileHalo, 320, 240).count;
  assert.ok(mobileCount < desktopCount, `expected bounded labels at 320px (${mobileCount}) vs 740px (${desktopCount})`);

  for (const layout of ["rail", "halo"]) {
    const narrow = renderGalaxySystemsSvg(graph, "dark", 320, 240, undefined, { contributedLayout: layout });
    assert.match(narrow, /<title>org-0\/very-long-contributed-repo-name-0<\/title>/);
    assert.match(narrow, /data-repo-url="https:\/\/github\.com\/org-0\/very-long-contributed-repo-name-0"/);
    assert.match(narrow, /<title>interactive-project-map-extension-v0<\/title>/);
  }
});
