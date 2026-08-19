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

function cleanText(value, max) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

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
    if (url.protocol !== "https:" || url.hostname !== "github.com" || parts.length < 2) return null;
    if (parts[0].toLowerCase() !== username || parts[1].toLowerCase() !== name.toLowerCase()) return null;
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
        groupId: cleanText(raw.groupId, 120),
        groupLabel: cleanText(raw.groupLabel, 120),
      };
    }
    ids.add(id);
    nodes.push(node);
  }
  if (!nodes.some((node) => node.type === "owner")) {
    nodes.unshift({ id: `user:${username}`, label: username, type: "owner", url: `https://github.com/${encodeURIComponent(username)}` });
  }
  const edges = Array.isArray(value.edges)
    ? value.edges.filter((edge) => edge && typeof edge === "object" && ids.has(edge.source) && ids.has(edge.target)).slice(0, 1200).map((edge) => ({ source: edge.source, target: edge.target, type: cleanText(edge.type, 40) }))
    : [];
  return { owner: username, nodes, edges };
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

function nodeStatus(node) {
  if (node.type !== "repository") return node.type;
  if (node.archived) return "archived";
  return node.fork ? "fork" : "original";
}

function groupMembers(group, repos) {
  const key = String(group.id).replace(/^group:/, "");
  return repos.filter((repo) => repo.groupId === key || group.id === `group:${repo.groupId}`);
}

function buildTreeLayout(graph) {
  const owner = graph.nodes.find((node) => node.type === "owner");
  const groups = graph.nodes.filter((node) => node.type === "group");
  const repos = graph.nodes.filter((node) => node.type === "repository");
  const bundles = groups.map((group) => ({
    group,
    members: groupMembers(group, repos).sort((a, b) => (b.stars || 0) - (a.stars || 0) || a.label.localeCompare(b.label)),
  }));
  const assigned = new Set(bundles.flatMap((bundle) => bundle.members.map((repo) => repo.id)));
  const unassigned = repos.filter((repo) => !assigned.has(repo.id));
  if (unassigned.length) bundles.push({ group: { id: "group:other", label: "Other", type: "group", repositoryCount: unassigned.length }, members: unassigned });

  const groupGap = 72;
  const repoGap = 22;
  const bundleWidths = bundles.map((bundle) => Math.max(
    140,
    bundle.members.reduce((sum, repo) => sum + clamp(estimateLabelWidth(repo) + 28, 94, 224), 0) + repoGap * Math.max(0, bundle.members.length - 1),
  ));
  const totalWidth = bundleWidths.reduce((sum, width) => sum + width, 0) + groupGap * Math.max(0, bundles.length - 1);
  const result = [];
  if (owner) result.push({ ...owner, x: 0, y: -250, depth: 0 });
  let cursor = -totalWidth / 2;

  bundles.forEach((bundle, bundleIndex) => {
    const width = bundleWidths[bundleIndex];
    const left = cursor;
    const right = cursor + width;
    let repoCursor = left;
    const memberPoints = [];
    for (const repo of bundle.members) {
      const slot = clamp(estimateLabelWidth(repo) + 28, 94, 224);
      memberPoints.push({ repo, x: repoCursor + slot / 2 });
      repoCursor += slot + repoGap;
    }
    const center = memberPoints.length ? (memberPoints[0].x + memberPoints[memberPoints.length - 1].x) / 2 : (left + right) / 2;
    result.push({ ...bundle.group, x: center, y: -78, depth: 1, left, right });
    for (const item of memberPoints) result.push({ ...item.repo, x: item.x, y: 112, depth: 2, parentId: bundle.group.id });
    cursor = right + groupGap;
  });
  return result;
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
    minY = Math.min(minY, node.y - 42);
    maxY = Math.max(maxY, node.y + 58);
  }
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  state.zoom = clamp(Math.min((size.width * 0.9) / width, (size.height * 0.8) / height), 0.14, 2.5);
  state.pan.x = -((minX + maxX) / 2) * state.zoom;
  state.pan.y = -((minY + maxY) / 2) * state.zoom;
}

function palette() {
  return { background: "#080b12", edge: "#48576f", relation: "#f4b65f", text: "#e8edf7", muted: "#98a5b9", owner: "#64d2ff", group: "#6aa7ff", original: "#57d17a", fork: "#b59aff", archived: "#d9847b", selection: "#ffffff" };
}

function matchesQuery(node) {
  if (!state.query) return true;
  return [node.label, node.description, node.language, node.groupLabel, ...(node.topics || [])].filter(Boolean).join(" ").toLowerCase().includes(state.query);
}

function connectedToSelected(node) {
  if (!state.selected || node === state.selected) return true;
  return state.edges.some((edge) => (edge.source === state.selected.id && edge.target === node.id) || (edge.target === state.selected.id && edge.source === node.id));
}

function strokeSegment(a, b, color, opacity = 0.5, width = 1) {
  ctx.strokeStyle = color;
  ctx.globalAlpha = opacity;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function drawEdges(colors) {
  const owner = state.nodes.find((node) => node.type === "owner");
  const groups = state.nodes.filter((node) => node.type === "group");
  if (owner && groups.length) {
    const ownerPoint = worldToScreen(owner.x, owner.y);
    const groupPoints = groups.map((node) => ({ node, point: worldToScreen(node.x, node.y) }));
    const branchY = ownerPoint.y + (groupPoints[0].point.y - ownerPoint.y) * 0.48;
    strokeSegment(ownerPoint, { x: ownerPoint.x, y: branchY }, colors.edge, 0.62);
    strokeSegment({ x: Math.min(...groupPoints.map((item) => item.point.x)), y: branchY }, { x: Math.max(...groupPoints.map((item) => item.point.x)), y: branchY }, colors.edge, 0.62);
    for (const item of groupPoints) strokeSegment({ x: item.point.x, y: branchY }, item.point, colors.edge, 0.62);
  }

  for (const group of groups) {
    const members = state.nodes.filter((node) => node.type === "repository" && node.parentId === group.id);
    if (!members.length) continue;
    const groupPoint = worldToScreen(group.x, group.y);
    const memberPoints = members.map((node) => worldToScreen(node.x, node.y));
    const busY = groupPoint.y + (memberPoints[0].y - groupPoint.y) * 0.5;
    strokeSegment(groupPoint, { x: groupPoint.x, y: busY }, colors.edge, 0.5);
    strokeSegment({ x: Math.min(...memberPoints.map((point) => point.x)), y: busY }, { x: Math.max(...memberPoints.map((point) => point.x)), y: busY }, colors.edge, 0.5);
    for (const point of memberPoints) strokeSegment({ x: point.x, y: busY }, point, colors.edge, 0.5);
  }

  for (const edge of state.edges) {
    if (edge.type !== "relation") continue;
    const a = state.byId.get(edge.source);
    const b = state.byId.get(edge.target);
    if (!a || !b) continue;
    ctx.setLineDash([5, 4]);
    strokeSegment(worldToScreen(a.x, a.y), worldToScreen(b.x, b.y), colors.relation, 0.72, 1.5);
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
}

function drawNodesAndLabels(colors) {
  const compactPortfolio = (state.graph?.nodes.filter((node) => node.type === "repository").length || 0) <= 36;
  const occupied = [];
  let repositoryIndex = 0;
  for (const node of state.nodes) {
    const point = worldToScreen(node.x, node.y);
    const highlighted = node === state.selected || node === state.hovered;
    const radius = Math.max(3.5, nodeRadius(node) * state.zoom * (highlighted ? 1.14 : 1));
    let opacity = node.archived ? 0.72 : 1;
    if (state.query && !matchesQuery(node)) opacity *= 0.12;
    if (state.selected && !connectedToSelected(node)) opacity *= 0.2;
    ctx.globalAlpha = opacity;
    ctx.fillStyle = colors[nodeStatus(node)] || colors.original;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (node.type === "repository" && node.archived) {
      ctx.strokeStyle = colors.archived;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (highlighted) {
      ctx.strokeStyle = colors.selection;
      ctx.lineWidth = node === state.selected ? 2 : 1.2;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    const fontSize = clamp((node.type === "owner" ? 14 : node.type === "group" ? 12 : 10.5) * Math.sqrt(state.zoom), 8.5, 15);
    const text = displayLabel(node);
    const width = clamp(text.length * fontSize * 0.58 + 10, 38, 215);
    const above = node.type === "repository" && repositoryIndex++ % 2 === 1;
    const top = above ? point.y - radius - fontSize - 10 : point.y + radius + 7;
    const box = { left: point.x - width / 2, right: point.x + width / 2, top, bottom: top + fontSize + 6 };
    const forced = node.type !== "repository" || highlighted || compactPortfolio;
    if (!forced && occupied.some((other) => !(box.right + 3 < other.left || other.right + 3 < box.left || box.bottom + 3 < other.top || other.bottom + 3 < box.top))) continue;
    occupied.push(box);
    ctx.globalAlpha = Math.max(opacity, highlighted ? 0.85 : 0);
    ctx.font = `${node.type === "owner" ? 700 : node.type === "group" ? 600 : 500} ${fontSize}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineWidth = 3;
    ctx.strokeStyle = colors.background;
    ctx.strokeText(text, point.x, top);
    ctx.fillStyle = node.type === "group" ? colors.muted : colors.text;
    ctx.fillText(text, point.x, top);
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

function rebuildLayout() {
  if (!state.graph) return;
  state.nodes = buildTreeLayout(state.graph);
  state.byId = new Map(state.nodes.map((node) => [node.id, node]));
  state.edges = state.graph.edges;
  state.selected = state.selected ? state.byId.get(state.selected.id) || null : null;
  document.body.dataset.mapStyle = "tree";
  styleSelect.value = "tree";
  subtitle.textContent = "Tree · Owner → Category → repositories on one parallel level";
  fitView();
  draw();
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

function hitTest(x, y) {
  const world = screenToWorld(x, y);
  for (let index = state.nodes.length - 1; index >= 0; index -= 1) {
    const node = state.nodes[index];
    const radius = Math.max(nodeRadius(node), 10 / state.zoom);
    if ((world.x - node.x) ** 2 + (world.y - node.y) ** 2 <= radius * radius) return node;
  }
  return null;
}

function updateDetails(node) {
  state.selected = node;
  details.classList.toggle("has-selection", Boolean(node));
  if (!node) {
    detailsTitle.textContent = "Tree";
    detailsDescription.textContent = "Owner → Category → Repository. Every repository child stays on one parallel level.";
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
    rows.push(["Stars", String(node.stars || 0)], ["Forks", String(node.forks || 0)]);
    if (node.groupLabel) rows.push(["Category", node.groupLabel]);
  }
  detailsMeta.replaceChildren();
  for (const [key, value] of rows) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = key;
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
  state.zoom = clamp(state.zoom * Math.exp(-event.deltaY * 0.0012), 0.14, 5);
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
      state.zoom = clamp(state.zoom * (distance / state.pinchDistance), 0.14, 5);
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
  const hovered = hitTest(point.x, point.y);
  state.hovered = hovered;
  canvas.classList.toggle("over-node", Boolean(hovered));
  if (hovered) {
    tip.hidden = false;
    tip.style.left = `${point.x + 14}px`;
    tip.style.top = `${point.y + 14}px`;
    tip.textContent = hovered.label;
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
    state.zoom = clamp(state.zoom * (event.key === "-" ? 1 / 1.16 : 1.16), 0.14, 5);
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
detailsClose.addEventListener("click", () => updateDetails(null));
window.addEventListener("resize", resize);
window.visualViewport?.addEventListener("resize", resize, { passive: true });

function showError(message) {
  status.hidden = true;
  errorText.textContent = message;
  errorBox.classList.add("visible");
}

try {
  username = normalizeUsername(query.get("username"));
  document.title = `${username} · Tree`;
  title.textContent = `${username} · Interactive Project Map`;
  subtitle.textContent = "Tree · Owner → Category → repositories on one parallel level";
  canvas.setAttribute("aria-label", `Interactive tree for ${username}`);
  const setupUrl = new URL("../", location.href);
  setupUrl.searchParams.set("username", username);
  setupUrl.searchParams.set("style", "tree");
  setup.href = setupUrl.toString();
} catch (error) {
  showError(error.message);
}

document.body.dataset.mapStyle = "tree";
styleSelect.value = "tree";
resize();
if (username) {
  const owner = encodeURIComponent(username);
  fetch(`https://raw.githubusercontent.com/${owner}/${owner}/HEAD/project-map/graph.json`, { cache: "no-cache" })
    .then((response) => {
      if (!response.ok) throw new Error(`graph.json returned ${response.status}`);
      return response.json();
    })
    .then((value) => {
      const graph = sanitizeGraph(value);
      if (!graph) throw new Error("graph.json failed validation");
      state.graph = graph;
      status.hidden = true;
      rebuildLayout();
      updateDetails(null);
      resize();
    })
    .catch((error) => showError(`Could not load ${username}/${username}/project-map/graph.json. (${error.message})`));
}
