"use strict";

const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const canvas = document.getElementById("galaxy");
const ctx = canvas.getContext("2d");
const title = document.getElementById("title");
const subtitle = document.getElementById("subtitle");
const searchInput = document.getElementById("search");
const styleSelect = document.getElementById("style");
const fitButton = document.getElementById("fit");
const resetButton = document.getElementById("reset");
const details = document.getElementById("details");
const detailsTitle = document.getElementById("detailsTitle");
const detailsDescription = document.getElementById("detailsDescription");
const detailsMeta = document.getElementById("detailsMeta");
const detailsLink = document.getElementById("detailsLink");
const detailsClose = document.getElementById("detailsClose");
const tip = document.getElementById("tip");
const errorBox = document.getElementById("error");
const errorText = document.getElementById("errorText");
const setup = document.getElementById("setup");
const status = document.getElementById("status");
const query = new URL(location.href).searchParams;
let username = "";

const state = {
  graph: null,
  groups: [],
  repos: [],
  query: "",
  selected: null,
  hovered: null,
  pan: { x: 0, y: 0 },
  zoom: 1,
  panning: false,
  moved: false,
  last: { x: 0, y: 0 },
  down: { x: 0, y: 0 },
  pointers: new Map(),
  pinchDistance: 0,
};

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function cleanText(value, max) { return typeof value === "string" ? value.slice(0, max) : ""; }
function normalizeUsername(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!USERNAME_RE.test(normalized)) throw new Error("Invalid GitHub username");
  return normalized;
}
function safeRepoUrl(value, name) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (url.protocol !== "https:" || url.hostname !== "github.com" || parts.length < 2 || parts[0].toLowerCase() !== username || parts[1].toLowerCase() !== name.toLowerCase()) return null;
    return `https://github.com/${encodeURIComponent(username)}/${encodeURIComponent(name)}`;
  } catch { return null; }
}
function sanitizeGraph(value) {
  if (!value || typeof value !== "object" || String(value.owner || "").toLowerCase() !== username || !Array.isArray(value.nodes) || value.nodes.length > 520) return null;
  const nodes = [];
  const ids = new Set();
  for (const raw of value.nodes) {
    if (!raw || typeof raw !== "object" || !["owner", "group", "repository"].includes(raw.type)) continue;
    const id = cleanText(raw.id, 180);
    const label = cleanText(raw.label, 120);
    if (!id || !label || ids.has(id)) continue;
    let node = { id, label, type: raw.type };
    if (raw.type === "owner") node.url = `https://github.com/${encodeURIComponent(username)}`;
    else if (raw.type === "group") node.repositoryCount = Number.isFinite(raw.repositoryCount) ? Math.max(0, Math.floor(raw.repositoryCount)) : 0;
    else {
      if (!/^[A-Za-z0-9._-]{1,100}$/.test(label)) continue;
      const url = safeRepoUrl(raw.url, label);
      if (!url) continue;
      node = { ...node, url, description: cleanText(raw.description, 2000), language: typeof raw.language === "string" ? raw.language.slice(0, 100) : null, topics: Array.isArray(raw.topics) ? raw.topics.filter((item) => typeof item === "string").slice(0, 40).map((item) => item.slice(0, 80)) : [], stars: Number.isFinite(raw.stars) ? Math.max(0, Math.floor(raw.stars)) : 0, forks: Number.isFinite(raw.forks) ? Math.max(0, Math.floor(raw.forks)) : 0, fork: raw.fork === true, archived: raw.archived === true, updatedAt: cleanText(raw.updatedAt, 64), groupId: cleanText(raw.groupId, 120), groupLabel: cleanText(raw.groupLabel, 120) };
    }
    ids.add(id);
    nodes.push(node);
  }
  return { owner: username, nodes };
}
function statusOf(repo) { return repo.archived ? "archived" : repo.fork ? "fork" : "original"; }
function repoWeight(repo) { return 1 + Math.log2((repo.stars || 0) + 1) * 0.35; }
function groupMembers(group, repos) {
  const key = String(group.id).replace(/^group:/, "");
  return repos.filter((repo) => repo.groupId === key || group.id === `group:${repo.groupId}`);
}
function slice(items, rect, horizontal) {
  const total = Math.max(1e-9, items.reduce((sum, item) => sum + item.weight, 0));
  let cursor = horizontal ? rect.x : rect.y;
  return items.map((item, index) => {
    const fraction = item.weight / total;
    const size = (horizontal ? rect.width : rect.height) * fraction;
    const last = index === items.length - 1;
    const box = horizontal
      ? { x: cursor, y: rect.y, width: last ? rect.x + rect.width - cursor : size, height: rect.height }
      : { x: rect.x, y: cursor, width: rect.width, height: last ? rect.y + rect.height - cursor : size };
    cursor += size;
    return { ...item, box };
  });
}
function buildLayout(graph) {
  const groups = graph.nodes.filter((node) => node.type === "group");
  const repos = graph.nodes.filter((node) => node.type === "repository");
  const bundles = groups.map((group) => {
    const members = groupMembers(group, repos).sort((a, b) => repoWeight(b) - repoWeight(a) || a.label.localeCompare(b.label));
    return { group, members, weight: members.reduce((sum, repo) => sum + repoWeight(repo), 0) || 1 };
  }).filter((bundle) => bundle.members.length);
  const assigned = new Set(bundles.flatMap((bundle) => bundle.members.map((repo) => repo.id)));
  const other = repos.filter((repo) => !assigned.has(repo.id));
  if (other.length) bundles.push({ group: { id: "group:other", label: "Other", type: "group" }, members: other, weight: other.reduce((sum, repo) => sum + repoWeight(repo), 0) });
  const groupsOut = [];
  const reposOut = [];
  const groupBoxes = slice(bundles, { x: -500, y: -300, width: 1000, height: 600 }, true);
  for (const bundle of groupBoxes) {
    const box = bundle.box;
    groupsOut.push({ ...bundle.group, box });
    const inner = { x: box.x + 5, y: box.y + 34, width: Math.max(0, box.width - 10), height: Math.max(0, box.height - 39) };
    if (inner.width < 10 || inner.height < 10) continue;
    const items = slice(bundle.members.map((repo) => ({ repo, weight: repoWeight(repo) })), inner, inner.width < inner.height);
    for (const item of items) reposOut.push({ ...item.repo, box: item.box, parentId: bundle.group.id });
  }
  return { groups: groupsOut, repos: reposOut };
}
function palette() { return { background: "#070a12", panel: "#0e1624", text: "#e8edf7", muted: "#9aa7bd", group: "#6aa7ff", original: "#57d17a", fork: "#b59aff", archived: "#d9847b", selected: "#ffffff" }; }
function canvasSize() { const rect = canvas.getBoundingClientRect(); return { width: Math.max(1, rect.width), height: Math.max(1, rect.height) }; }
function worldToScreen(x, y) { const size = canvasSize(); return { x: size.width / 2 + state.pan.x + x * state.zoom, y: size.height / 2 + state.pan.y + y * state.zoom }; }
function screenToWorld(x, y) { const size = canvasSize(); return { x: (x - size.width / 2 - state.pan.x) / state.zoom, y: (y - size.height / 2 - state.pan.y) / state.zoom }; }
function screenBox(box) { const p = worldToScreen(box.x, box.y); return { x: p.x, y: p.y, width: box.width * state.zoom, height: box.height * state.zoom }; }
function fitView() {
  const size = canvasSize();
  state.zoom = clamp(Math.min((size.width * 0.92) / 1000, (size.height * 0.80) / 600), 0.2, 2.5);
  state.pan.x = 0;
  state.pan.y = 0;
}
function matches(repo) {
  if (!state.query) return true;
  return [repo.label, repo.description, repo.language, repo.groupLabel, ...(repo.topics || [])].filter(Boolean).join(" ").toLowerCase().includes(state.query);
}
function draw() {
  const size = canvasSize();
  const colors = palette();
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, size.width, size.height);
  for (const group of state.groups) {
    const b = screenBox(group.box);
    if (b.width < 2 || b.height < 2) continue;
    ctx.fillStyle = colors.panel;
    ctx.strokeStyle = colors.group;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.width, b.height, Math.min(10, 8 * state.zoom));
    ctx.fill();
    ctx.stroke();
    if (b.width >= 70 && b.height >= 32) {
      ctx.fillStyle = colors.text;
      ctx.font = `700 ${clamp(12 * Math.sqrt(state.zoom), 9, 14)}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(group.label.slice(0, 28), b.x + 8, b.y + 8, Math.max(20, b.width - 16));
    }
  }
  for (const repo of state.repos) {
    const b = screenBox(repo.box);
    if (b.width < 1 || b.height < 1) continue;
    const selected = repo === state.selected || repo === state.hovered;
    const opacity = matches(repo) ? (repo.archived ? 0.64 : repo.fork ? 0.78 : 0.90) : 0.10;
    ctx.globalAlpha = opacity;
    ctx.fillStyle = colors[statusOf(repo)];
    ctx.fillRect(b.x + 1, b.y + 1, Math.max(0, b.width - 2), Math.max(0, b.height - 2));
    if (repo.archived) {
      ctx.strokeStyle = colors.archived;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(b.x + 2, b.y + 2, Math.max(0, b.width - 4), Math.max(0, b.height - 4));
      ctx.setLineDash([]);
    }
    if (selected) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colors.selected;
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, Math.max(0, b.width - 2), Math.max(0, b.height - 2));
    }
    if (b.width >= 58 && b.height >= 26 && state.zoom >= 0.42) {
      ctx.globalAlpha = Math.max(opacity, selected ? 0.9 : 0);
      ctx.fillStyle = colors.background;
      ctx.font = `650 ${clamp(10 * Math.sqrt(state.zoom), 8, 12)}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(repo.label, b.x + 6, b.y + 6, Math.max(10, b.width - 12));
    }
    ctx.globalAlpha = 1;
  }
}
function resize() {
  const size = canvasSize();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(size.width * dpr);
  canvas.height = Math.round(size.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state.graph && state.zoom === 1 && state.pan.x === 0 && state.pan.y === 0) fitView();
  draw();
}
function hitTest(x, y) {
  const p = screenToWorld(x, y);
  for (let index = state.repos.length - 1; index >= 0; index -= 1) {
    const repo = state.repos[index];
    const b = repo.box;
    if (p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height) return repo;
  }
  return null;
}
function updateDetails(repo) {
  state.selected = repo;
  details.classList.toggle("has-selection", Boolean(repo));
  if (!repo) {
    detailsTitle.textContent = "Project treemap";
    detailsDescription.textContent = "Category area contains repository tiles; larger starred projects receive a little more area.";
    detailsMeta.hidden = true;
    detailsLink.hidden = true;
    draw();
    return;
  }
  detailsTitle.textContent = repo.label;
  detailsDescription.textContent = repo.description || "No description provided.";
  const rows = [["Kind", repo.archived ? "Archived" : repo.fork ? "Fork" : "Original"], ["Stars", String(repo.stars || 0)], ["Forks", String(repo.forks || 0)]];
  if (repo.language) rows.splice(1, 0, ["Language", repo.language]);
  if (repo.groupLabel) rows.push(["Category", repo.groupLabel]);
  if (repo.updatedAt) rows.push(["Updated", repo.updatedAt.slice(0, 10)]);
  detailsMeta.replaceChildren();
  for (const [key, value] of rows) {
    const dt = document.createElement("dt"); dt.textContent = key;
    const dd = document.createElement("dd"); dd.textContent = value;
    detailsMeta.append(dt, dd);
  }
  detailsMeta.hidden = false;
  detailsLink.href = repo.url;
  detailsLink.textContent = "Open repository ↗";
  detailsLink.hidden = false;
  draw();
}
function navigate(style) {
  let path = "../u/";
  if (style === "radial") path = "../radial/";
  else if (style === "tree") path = "../tree/";
  else if (style === "treemap") return;
  const url = new URL(path, location.href);
  url.searchParams.set("username", username);
  url.searchParams.set("style", style);
  location.assign(url.toString());
}
function pointDistance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function pointerPair() { const values = [...state.pointers.values()]; return values.length >= 2 ? [values[0], values[1]] : null; }
canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const before = screenToWorld(event.offsetX, event.offsetY);
  state.zoom = clamp(state.zoom * Math.exp(-event.deltaY * 0.0012), 0.18, 5);
  const after = worldToScreen(before.x, before.y);
  state.pan.x += event.offsetX - after.x;
  state.pan.y += event.offsetY - after.y;
  draw();
}, { passive: false });
canvas.addEventListener("pointerdown", (event) => {
  canvas.setPointerCapture(event.pointerId);
  const rect = canvas.getBoundingClientRect();
  const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  state.pointers.set(event.pointerId, point);
  state.down = point; state.last = point; state.moved = false; state.panning = true; tip.hidden = true;
  if (state.pointers.size === 2) { const pair = pointerPair(); state.pinchDistance = pair ? pointDistance(pair[0], pair[1]) : 0; }
});
canvas.addEventListener("pointermove", (event) => {
  const rect = canvas.getBoundingClientRect();
  const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  if (state.pointers.has(event.pointerId)) state.pointers.set(event.pointerId, point);
  if (state.pointers.size === 2) {
    const pair = pointerPair(); if (!pair) return;
    const distance = pointDistance(pair[0], pair[1]);
    const midpoint = { x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 };
    if (state.pinchDistance > 0 && distance > 0) {
      const before = screenToWorld(midpoint.x, midpoint.y);
      state.zoom = clamp(state.zoom * (distance / state.pinchDistance), 0.18, 5);
      const after = worldToScreen(before.x, before.y);
      state.pan.x += midpoint.x - after.x; state.pan.y += midpoint.y - after.y;
    }
    state.pinchDistance = distance; draw(); return;
  }
  if (state.pointers.size === 1) {
    if (Math.hypot(point.x - state.down.x, point.y - state.down.y) >= 6) state.moved = true;
    if (state.moved) { state.pan.x += point.x - state.last.x; state.pan.y += point.y - state.last.y; state.last = point; draw(); }
    return;
  }
  const hover = hitTest(point.x, point.y);
  state.hovered = hover;
  if (hover) { tip.hidden = false; tip.style.left = `${point.x + 14}px`; tip.style.top = `${point.y + 14}px`; tip.textContent = `${hover.label} · ${hover.groupLabel || "Other"} · ${statusOf(hover)}`; }
  else tip.hidden = true;
  draw();
});
function finishPointer(event) {
  const wasSingle = state.pointers.size === 1 && state.pointers.has(event.pointerId);
  const rect = canvas.getBoundingClientRect();
  const clicked = wasSingle && !state.moved ? hitTest(event.clientX - rect.left, event.clientY - rect.top) : null;
  state.pointers.delete(event.pointerId); state.panning = false; if (state.pointers.size < 2) state.pinchDistance = 0;
  if (clicked) updateDetails(clicked);
}
canvas.addEventListener("pointerup", finishPointer);
canvas.addEventListener("pointercancel", finishPointer);
canvas.addEventListener("dblclick", (event) => { const rect = canvas.getBoundingClientRect(); const repo = hitTest(event.clientX - rect.left, event.clientY - rect.top); if (repo?.url) window.open(repo.url, "_blank", "noopener"); });
canvas.addEventListener("keydown", (event) => {
  if (event.key === "0") { event.preventDefault(); fitView(); draw(); }
  else if (["+", "=", "-"].includes(event.key)) { event.preventDefault(); state.zoom = clamp(state.zoom * (event.key === "-" ? 1 / 1.16 : 1.16), 0.18, 5); draw(); }
  else if (event.key === "Enter" && state.selected?.url) { event.preventDefault(); window.open(state.selected.url, "_blank", "noopener"); }
  else if (event.key === "Escape") updateDetails(null);
});
searchInput.addEventListener("input", () => { state.query = searchInput.value.trim().toLowerCase(); draw(); });
styleSelect.addEventListener("change", () => navigate(styleSelect.value));
fitButton.addEventListener("click", () => { fitView(); draw(); });
resetButton.addEventListener("click", () => { searchInput.value = ""; state.query = ""; updateDetails(null); fitView(); draw(); });
detailsClose.addEventListener("click", () => { updateDetails(null); canvas.focus({ preventScroll: true }); });
window.addEventListener("resize", resize);
window.visualViewport?.addEventListener("resize", resize, { passive: true });
function showError(message) { status.hidden = true; errorText.textContent = message; errorBox.classList.add("visible"); }
try {
  username = normalizeUsername(query.get("username"));
  document.title = `${username} · Project Treemap`;
  title.textContent = `${username} · Interactive Project Map`;
  subtitle.textContent = "Treemap · Category area → Repository tiles · search, select, pan and zoom";
  canvas.setAttribute("aria-label", `Interactive project treemap for ${username}`);
  const setupUrl = new URL("../", location.href); setupUrl.searchParams.set("username", username); setupUrl.searchParams.set("style", "treemap"); setup.href = setupUrl.toString();
} catch (error) { showError(error.message); }
document.body.dataset.mapStyle = "treemap";
styleSelect.value = "treemap";
resize();
if (username) {
  const owner = encodeURIComponent(username);
  fetch(`https://raw.githubusercontent.com/${owner}/${owner}/HEAD/project-map/graph.json`, { cache: "no-cache" })
    .then((response) => { if (!response.ok) throw new Error(`graph.json returned ${response.status}`); return response.json(); })
    .then((value) => {
      const graph = sanitizeGraph(value); if (!graph) throw new Error("graph.json failed validation");
      state.graph = graph;
      const layout = buildLayout(graph); state.groups = layout.groups; state.repos = layout.repos;
      status.hidden = true; fitView(); updateDetails(null); resize();
    })
    .catch((error) => showError(`Could not load ${username}/${username}/project-map/graph.json. Run the setup workflow once, or regenerate it if the file is invalid. (${error.message})`));
}
