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
  nodes: [],
  edges: [],
  byId: new Map(),
  query: "",
  selected: null,
  hovered: null,
  drag: null,
  panning: false,
  moved: false,
  down: { x: 0, y: 0 },
  last: { x: 0, y: 0 },
  pan: { x: 0, y: 0 },
  zoom: 1,
  pointers: new Map(),
  pinchDistance: 0,
  fitted: false,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeUsername(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!USERNAME_RE.test(normalized)) throw new Error("Invalid GitHub username");
  return normalized;
}

function cleanText(value, max) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function safeRepoUrl(value, name) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "github.com") return null;
    const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (parts.length < 2 || parts[0].toLowerCase() !== username || parts[1].toLowerCase() !== name.toLowerCase()) return null;
    return `https://github.com/${encodeURIComponent(username)}/${encodeURIComponent(name)}`;
  } catch {
    return null;
  }
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
    if (raw.type === "owner") {
      node.url = `https://github.com/${encodeURIComponent(username)}`;
    } else if (raw.type === "group") {
      node.repositoryCount = Number.isFinite(raw.repositoryCount) ? Math.max(0, Math.floor(raw.repositoryCount)) : 0;
    } else {
      if (!/^[A-Za-z0-9._-]{1,100}$/.test(label)) continue;
      const url = safeRepoUrl(raw.url, label);
      if (!url) continue;
      node = {
        ...node,
        url,
        description: cleanText(raw.description, 2000),
        language: typeof raw.language === "string" ? raw.language.slice(0, 100) : null,
        topics: Array.isArray(raw.topics) ? raw.topics.filter((item) => typeof item === "string").slice(0, 40).map((item) => item.slice(0, 80)) : [],
        stars: Number.isFinite(raw.stars) ? Math.max(0, Math.floor(raw.stars)) : 0,
        forks: Number.isFinite(raw.forks) ? Math.max(0, Math.floor(raw.forks)) : 0,
        fork: raw.fork === true,
        archived: raw.archived === true,
        updatedAt: cleanText(raw.updatedAt, 64),
        groupId: cleanText(raw.groupId, 120),
        groupLabel: cleanText(raw.groupLabel, 120),
      };
    }
    ids.add(id);
    nodes.push(node);
  }
  if (!nodes.some((node) => node.type === "owner")) nodes.unshift({ id: `user:${username}`, label: username, type: "owner", url: `https://github.com/${encodeURIComponent(username)}` });
  const edges = Array.isArray(value.edges)
    ? value.edges.filter((edge) => edge && typeof edge === "object" && ids.has(edge.source) && ids.has(edge.target)).slice(0, 1200).map((edge) => ({ source: edge.source, target: edge.target, type: cleanText(edge.type, 40) }))
    : [];
  return { owner: username, nodes, edges };
}

function nodeStatus(node) {
  if (node.type !== "repository") return node.type;
  if (node.archived) return "archived";
  return node.fork ? "fork" : "original";
}

function displayLabel(node) {
  const label = String(node.label || "");
  return label.length <= 30 ? label : `${label.slice(0, 29)}…`;
}

function estimateLabelWidth(node) {
  return clamp(18 + displayLabel(node).length * (node.type === "repository" ? 6.1 : 6.7), 48, 205);
}

function nodeRadius(node) {
  if (node.type === "owner") return 18;
  if (node.type === "group") return 8;
  return clamp(5.2 + Math.log2((node.stars || 0) + 1) * 1.25, 5.2, 11);
}

function groupMembers(group, repos) {
  const key = String(group.id).replace(/^group:/, "");
  return repos.filter((repo) => repo.groupId === key || group.id === `group:${repo.groupId}`);
}

function buildTreeLayout(graph) {
  const owner = graph.nodes.find((node) => node.type === "owner");
  const groups = graph.nodes.filter((node) => node.type === "group");
  const repos = graph.nodes.filter((node) => node.type === "repository");
  const bundles = groups.map((group) => ({ group, members: groupMembers(group, repos).sort((a, b) => (b.stars || 0) - (a.stars || 0) || a.label.localeCompare(b.label)) }));
  const assigned = new Set(bundles.flatMap((bundle) => bundle.members.map((repo) => repo.id)));
  const unassigned = repos.filter((repo) => !assigned.has(repo.id));
  if (unassigned.length) bundles.push({ group: { id: "group:other", label: "Other", type: "group", repositoryCount: unassigned.length }, members: unassigned });
  const result = [];
  if (owner) result.push({ ...owner, x: 0, y: -260, depth: 0 });
  const totalWeight = Math.max(1, bundles.reduce((sum, bundle) => sum + Math.max(1, bundle.members.length), 0));
  let cursor = -520;
  const totalWidth = 1040;
  const gap = bundles.length > 1 ? 26 : 0;
  const available = totalWidth - gap * Math.max(0, bundles.length - 1);
  for (const bundle of bundles) {
    const segmentWidth = available * Math.max(1, bundle.members.length) / totalWeight;
    const left = cursor;
    const right = cursor + segmentWidth;
    const center = (left + right) / 2;
    result.push({ ...bundle.group, x: center, y: -90, depth: 1, left, right });
    const widest = Math.max(...bundle.members.slice(0, 30).map(estimateLabelWidth), 72);
    const columns = Math.max(1, Math.floor(Math.max(70, segmentWidth) / clamp(widest + 28, 86, 190)));
    bundle.members.forEach((repo, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const countInRow = Math.min(columns, bundle.members.length - row * columns);
      const x = countInRow <= 1 ? center : left + segmentWidth * ((col + 1) / (countInRow + 1));
      result.push({ ...repo, x, y: 95 + row * 88, depth: 2, parentId: bundle.group.id });
    });
    cursor = right + gap;
  }
  return result;
}

function rebuildLayout() {
  if (!state.graph) return;
  state.nodes = buildTreeLayout(state.graph);
  state.byId = new Map(state.nodes.map((node) => [node.id, node]));
  state.edges = state.graph.edges;
  state.selected = state.selected ? state.byId.get(state.selected.id) || null : null;
  document.body.dataset.mapStyle = "tree";
  styleSelect.value = "tree";
  subtitle.textContent = "Tree view · Owner → Category → Repository · search, select, drag, pan and zoom";
  fitView();
  draw();
}

function canvasSize() {
  const rect = canvas.getBoundingClientRect();
  return { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
}

function worldToScreen(x, y) {
  const size = canvasSize();
  return { x: size.width / 2 + state.pan.x + x * state.zoom, y: size.height / 2 + state.pan.y + y * state.zoom };
}

function screenToWorld(x, y) {
  const size = canvasSize();
  return { x: (x - size.width / 2 - state.pan.x) / state.zoom, y: (y - size.height / 2 - state.pan.y) / state.zoom };
}

function fitView() {
  if (!state.nodes.length) return;
  const size = canvasSize();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of state.nodes) {
    const halfWidth = estimateLabelWidth(node) / 2 + 28;
    minX = Math.min(minX, node.x - halfWidth);
    maxX = Math.max(maxX, node.x + halfWidth);
    minY = Math.min(minY, node.y - 34);
    maxY = Math.max(maxY, node.y + 48);
  }
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  state.zoom = clamp(Math.min((size.width * 0.88) / width, (size.height * 0.80) / height), 0.18, 2.4);
  state.pan.x = -((minX + maxX) / 2) * state.zoom;
  state.pan.y = -((minY + maxY) / 2) * state.zoom;
}

function palette() {
  return { background: "#080b12", panel: "#0e1420", edge: "#48576f", relation: "#f4b65f", text: "#e8edf7", muted: "#98a5b9", owner: "#64d2ff", group: "#6aa7ff", original: "#57d17a", fork: "#b59aff", archived: "#d9847b", selection: "#ffffff" };
}

function nodeColor(node, colors) {
  return colors[nodeStatus(node)] || colors.original;
}

function matchesQuery(node) {
  if (!state.query) return true;
  return [node.label, node.description, node.language, node.groupLabel, ...(node.topics || [])].filter(Boolean).join(" ").toLowerCase().includes(state.query);
}

function connectedToSelected(node) {
  if (!state.selected || node === state.selected) return true;
  return state.edges.some((edge) => (edge.source === state.selected.id && edge.target === node.id) || (edge.target === state.selected.id && edge.source === node.id));
}

function drawElbow(a, b, colors, opacity = 0.46) {
  const source = worldToScreen(a.x, a.y);
  const target = worldToScreen(b.x, b.y);
  const midY = source.y + (target.y - source.y) * 0.48;
  ctx.strokeStyle = colors.edge;
  ctx.globalAlpha = opacity;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(source.x, source.y);
  ctx.lineTo(source.x, midY);
  ctx.lineTo(target.x, midY);
  ctx.lineTo(target.x, target.y);
  ctx.stroke();
}

function drawEdges(colors) {
  const owner = state.nodes.find((node) => node.type === "owner");
  const groups = state.nodes.filter((node) => node.type === "group");
  if (owner) for (const group of groups) drawElbow(owner, group, colors, 0.62);
  for (const node of state.nodes) {
    if (node.type !== "repository" || !node.parentId) continue;
    const group = state.byId.get(node.parentId);
    if (group) drawElbow(group, node, colors, 0.42);
  }
  for (const edge of state.edges) {
    if (edge.type !== "relation") continue;
    const a = state.byId.get(edge.source);
    const b = state.byId.get(edge.target);
    if (!a || !b) continue;
    const source = worldToScreen(a.x, a.y);
    const target = worldToScreen(b.x, b.y);
    ctx.strokeStyle = colors.relation;
    ctx.globalAlpha = 0.68;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
}

function boxesOverlap(a, b, padding = 3) {
  return !(a.right + padding < b.left || b.right + padding < a.left || a.bottom + padding < b.top || b.bottom + padding < a.top);
}

function drawNodesAndLabels(colors) {
  const candidates = [];
  for (const node of state.nodes) {
    const point = worldToScreen(node.x, node.y);
    const highlighted = node === state.selected || node === state.hovered;
    const radius = Math.max(3.5, nodeRadius(node) * state.zoom * (highlighted ? 1.14 : 1));
    let opacity = node.archived ? 0.72 : 1;
    if (state.query && !matchesQuery(node)) opacity *= 0.12;
    if (state.selected && !connectedToSelected(node)) opacity *= 0.22;
    ctx.globalAlpha = opacity;
    ctx.fillStyle = nodeColor(node, colors);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    if (node.type === "repository" && node.archived) {
      ctx.strokeStyle = colors.archived;
      ctx.lineWidth = 1.3;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (highlighted) {
      ctx.globalAlpha = Math.max(opacity, 0.76);
      ctx.strokeStyle = colors.selection;
      ctx.lineWidth = node === state.selected ? 2 : 1.2;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (node.type !== "repository" || highlighted || state.zoom >= 0.48) {
      const fontSize = clamp((node.type === "owner" ? 14 : node.type === "group" ? 12 : 11) * Math.sqrt(state.zoom), 9, 15);
      candidates.push({ node, point, radius, fontSize, opacity, priority: highlighted ? 100 : node.type === "owner" ? 90 : node.type === "group" ? 80 : (node.stars || 0) + (node.fork ? -1 : 1) });
    }
  }
  ctx.globalAlpha = 1;
  candidates.sort((a, b) => b.priority - a.priority || a.node.label.localeCompare(b.node.label));
  const occupied = [];
  for (const candidate of candidates) {
    const text = displayLabel(candidate.node);
    const width = clamp(text.length * candidate.fontSize * 0.58 + 10, 38, 215);
    const top = candidate.point.y + candidate.radius + 7;
    const box = { left: candidate.point.x - width / 2, right: candidate.point.x + width / 2, top, bottom: top + candidate.fontSize + 8 };
    const forced = candidate.node === state.selected || candidate.node === state.hovered || candidate.node.type === "owner";
    if (!forced && occupied.some((other) => boxesOverlap(box, other, 4))) continue;
    occupied.push(box);
    ctx.globalAlpha = Math.max(candidate.opacity, forced ? 0.84 : 0);
    ctx.font = `${candidate.node.type === "owner" ? 700 : candidate.node.type === "group" ? 600 : 500} ${candidate.fontSize}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = colors.background;
    ctx.strokeText(text, candidate.point.x, top + 2);
    ctx.fillStyle = candidate.node.type === "group" ? colors.muted : colors.text;
    ctx.fillText(text, candidate.point.x, top + 2);
  }
  ctx.globalAlpha = 1;
}

function draw() {
  const size = canvasSize();
  const colors = palette();
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, size.width, size.height);
  if (!state.graph) return;
  drawEdges(colors);
  drawNodesAndLabels(colors);
}

function resize() {
  const size = canvasSize();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(size.width * dpr);
  canvas.height = Math.round(size.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state.graph && !state.fitted) {
    state.fitted = true;
    fitView();
  }
  draw();
}

function hitTest(screenX, screenY) {
  const world = screenToWorld(screenX, screenY);
  for (let i = state.nodes.length - 1; i >= 0; i -= 1) {
    const node = state.nodes[i];
    const radius = Math.max(nodeRadius(node), 10 / state.zoom);
    if ((world.x - node.x) ** 2 + (world.y - node.y) ** 2 <= radius * radius) return node;
  }
  return null;
}

function updateDetails(node) {
  state.selected = node;
  details.classList.toggle("has-selection", Boolean(node));
  if (!node) {
    detailsTitle.textContent = "Project tree";
    detailsDescription.textContent = "Hierarchy view: Owner → Category → Repository. Search, select, drag nodes, pan empty space, and zoom.";
    detailsMeta.hidden = true;
    detailsLink.hidden = true;
    draw();
    return;
  }
  detailsTitle.textContent = node.label;
  detailsDescription.textContent = node.description || (node.type === "group" ? `${node.repositoryCount || 0} repositories` : node.type === "owner" ? `GitHub profile @${username}` : "No description provided.");
  const rows = [];
  if (node.type === "repository") {
    rows.push(["Kind", node.archived ? "Archived" : node.fork ? "Fork" : "Original"]);
    if (node.language) rows.push(["Language", node.language]);
    rows.push(["Stars", String(node.stars || 0)]);
    rows.push(["Forks", String(node.forks || 0)]);
    if (node.groupLabel) rows.push(["Category", node.groupLabel]);
    if (node.updatedAt) rows.push(["Updated", node.updatedAt.slice(0, 10)]);
  }
  detailsMeta.replaceChildren();
  for (const [key, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = key;
    const dd = document.createElement("dd");
    dd.textContent = value;
    detailsMeta.append(dt, dd);
  }
  detailsMeta.hidden = rows.length === 0;
  if (node.url) {
    detailsLink.href = node.url;
    detailsLink.hidden = false;
    detailsLink.textContent = node.type === "repository" ? "Open repository ↗" : "Open on GitHub ↗";
  } else {
    detailsLink.hidden = true;
  }
  draw();
}

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointerPair() {
  const values = [...state.pointers.values()];
  return values.length >= 2 ? [values[0], values[1]] : null;
}

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const before = screenToWorld(event.offsetX, event.offsetY);
  state.zoom = clamp(state.zoom * Math.exp(-event.deltaY * 0.0012), 0.16, 4.5);
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
  state.down = point;
  state.last = point;
  state.moved = false;
  tip.hidden = true;
  if (state.pointers.size === 2) {
    const pair = pointerPair();
    state.drag = null;
    state.panning = false;
    state.pinchDistance = pair ? pointDistance(pair[0], pair[1]) : 0;
    return;
  }
  state.drag = hitTest(point.x, point.y);
  state.panning = !state.drag;
  canvas.classList.add("dragging");
});

canvas.addEventListener("pointermove", (event) => {
  const rect = canvas.getBoundingClientRect();
  const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  if (state.pointers.has(event.pointerId)) state.pointers.set(event.pointerId, point);
  if (state.pointers.size === 2) {
    const pair = pointerPair();
    if (!pair) return;
    const distance = pointDistance(pair[0], pair[1]);
    const midpoint = { x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 };
    if (state.pinchDistance > 0 && distance > 0) {
      const before = screenToWorld(midpoint.x, midpoint.y);
      state.zoom = clamp(state.zoom * (distance / state.pinchDistance), 0.16, 4.5);
      const after = worldToScreen(before.x, before.y);
      state.pan.x += midpoint.x - after.x;
      state.pan.y += midpoint.y - after.y;
    }
    state.pinchDistance = distance;
    draw();
    return;
  }
  if (state.pointers.size === 1) {
    if (Math.hypot(point.x - state.down.x, point.y - state.down.y) >= 6) state.moved = true;
    if (state.drag) {
      const world = screenToWorld(point.x, point.y);
      state.drag.x = world.x;
      state.drag.y = world.y;
      draw();
    } else if (state.panning) {
      state.pan.x += point.x - state.last.x;
      state.pan.y += point.y - state.last.y;
      state.last = point;
      draw();
    }
    return;
  }
  const hover = hitTest(point.x, point.y);
  state.hovered = hover;
  canvas.classList.toggle("over-node", Boolean(hover));
  if (hover) {
    tip.hidden = false;
    tip.style.left = `${point.x + 14}px`;
    tip.style.top = `${point.y + 14}px`;
    tip.textContent = hover.type === "repository" ? `${hover.label}${hover.language ? ` · ${hover.language}` : ""} · ${nodeStatus(hover)}` : hover.label;
  } else {
    tip.hidden = true;
  }
  draw();
});

function finishPointer(event, cancelled = false) {
  const wasSingle = state.pointers.size === 1 && state.pointers.has(event.pointerId);
  const clicked = !cancelled && wasSingle && !state.moved ? state.drag : null;
  state.pointers.delete(event.pointerId);
  if (state.pointers.size < 2) state.pinchDistance = 0;
  state.drag = null;
  state.panning = false;
  canvas.classList.remove("dragging");
  if (clicked) updateDetails(clicked);
}

canvas.addEventListener("pointerup", (event) => finishPointer(event));
canvas.addEventListener("pointercancel", (event) => finishPointer(event, true));
canvas.addEventListener("lostpointercapture", (event) => {
  if (state.pointers.has(event.pointerId)) finishPointer(event, true);
});
canvas.addEventListener("dblclick", (event) => {
  const rect = canvas.getBoundingClientRect();
  const node = hitTest(event.clientX - rect.left, event.clientY - rect.top);
  if (node?.url) window.open(node.url, "_blank", "noopener");
});
canvas.addEventListener("keydown", (event) => {
  if (event.key === "0") {
    event.preventDefault();
    fitView();
    draw();
  } else if (["+", "=", "-"].includes(event.key)) {
    event.preventDefault();
    state.zoom = clamp(state.zoom * (event.key === "-" ? 1 / 1.16 : 1.16), 0.16, 4.5);
    draw();
  } else if (event.key === "Enter" && state.selected?.url) {
    event.preventDefault();
    window.open(state.selected.url, "_blank", "noopener");
  } else if (event.key === "Escape") {
    updateDetails(null);
  }
});

searchInput.addEventListener("input", () => {
  state.query = searchInput.value.trim().toLowerCase();
  draw();
});
styleSelect.addEventListener("change", () => {
  if (styleSelect.value === "tree") return;
  const url = new URL("../u/", location.href);
  url.searchParams.set("username", username);
  url.searchParams.set("style", styleSelect.value === "obsidian" ? "obsidian" : "galaxy");
  location.assign(url.toString());
});
fitButton.addEventListener("click", () => {
  fitView();
  draw();
});
resetButton.addEventListener("click", () => {
  searchInput.value = "";
  state.query = "";
  updateDetails(null);
  rebuildLayout();
});
detailsClose.addEventListener("click", () => {
  updateDetails(null);
  canvas.focus({ preventScroll: true });
});
window.addEventListener("resize", resize);
window.visualViewport?.addEventListener("resize", resize, { passive: true });

function showError(message) {
  status.hidden = true;
  errorText.textContent = message;
  errorBox.classList.add("visible");
}

try {
  username = normalizeUsername(query.get("username"));
  document.title = `${username} · Project Tree`;
  title.textContent = `${username} · Interactive Project Map`;
  canvas.setAttribute("aria-label", `Interactive project tree for ${username}`);
  const setupUrl = new URL("../", location.href);
  setupUrl.searchParams.set("username", username);
  setupUrl.searchParams.set("style", "tree");
  setup.href = setupUrl.toString();
} catch (error) {
  showError(error.message);
}

document.body.dataset.mapStyle = "tree";
styleSelect.value = "tree";
subtitle.textContent = "Tree view · Owner → Category → Repository";
resize();

if (username) {
  const owner = encodeURIComponent(username);
  const graphUrl = `https://raw.githubusercontent.com/${owner}/${owner}/HEAD/project-map/graph.json`;
  fetch(graphUrl, { cache: "no-cache" })
    .then((response) => {
      if (!response.ok) throw new Error(`graph.json returned ${response.status}`);
      return response.json();
    })
    .then((value) => {
      const clean = sanitizeGraph(value);
      if (!clean) throw new Error("graph.json failed validation");
      state.graph = clean;
      status.hidden = true;
      rebuildLayout();
      updateDetails(null);
    })
    .catch((error) => showError(`Could not load ${username}/${username}/project-map/graph.json. Run the setup workflow once, or regenerate it if the file is invalid. (${error.message})`));
}
