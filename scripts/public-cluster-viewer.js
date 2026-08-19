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
  clusters: [],
  nodes: [],
  query: "",
  selected: null,
  hovered: null,
  pan: { x: 0, y: 0 },
  zoom: 1,
  pointers: new Map(),
  down: { x: 0, y: 0 },
  last: { x: 0, y: 0 },
  moved: false,
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
    if (url.protocol !== "https:" || url.hostname !== "github.com" || parts.length < 2) return null;
    if (parts[0].toLowerCase() !== username || parts[1].toLowerCase() !== name.toLowerCase()) return null;
    return `https://github.com/${encodeURIComponent(username)}/${encodeURIComponent(name)}`;
  } catch { return null; }
}
function sanitizeGraph(value) {
  if (!value || typeof value !== "object" || String(value.owner || "").toLowerCase() !== username || !Array.isArray(value.nodes) || value.nodes.length > 520) return null;
  const nodes = [];
  for (const raw of value.nodes) {
    if (!raw || typeof raw !== "object" || !["group", "repository"].includes(raw.type)) continue;
    const id = cleanText(raw.id, 180);
    const label = cleanText(raw.label, 120);
    if (!id || !label) continue;
    if (raw.type === "group") {
      nodes.push({ id, label, type: "group", repositoryCount: Number.isFinite(raw.repositoryCount) ? Math.max(0, Math.floor(raw.repositoryCount)) : 0 });
      continue;
    }
    if (!/^[A-Za-z0-9._-]{1,100}$/.test(label)) continue;
    const url = safeRepoUrl(raw.url, label);
    if (!url) continue;
    nodes.push({
      id, label, type: "repository", url,
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
    });
  }
  return { owner: username, nodes };
}
function statusOf(repo) { return repo.archived ? "archived" : repo.fork ? "fork" : "original"; }
function groupMembers(group, repos) {
  const key = String(group.id).replace(/^group:/, "");
  return repos.filter((repo) => repo.groupId === key || group.id === `group:${repo.groupId}`);
}
function nodeRadius(repo) { return clamp(5 + Math.log2((repo.stars || 0) + 1) * 1.25, 5, 12); }
function buildLayout(graph) {
  const groups = graph.nodes.filter((node) => node.type === "group");
  const repos = graph.nodes.filter((node) => node.type === "repository");
  const clusters = [];
  const nodes = [];
  const orbitX = 360;
  const orbitY = 205;
  groups.forEach((group, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(1, groups.length);
    const cx = groups.length === 1 ? 0 : Math.cos(angle) * orbitX;
    const cy = groups.length === 1 ? 0 : Math.sin(angle) * orbitY;
    const members = groupMembers(group, repos).sort((a, b) => (b.stars || 0) - (a.stars || 0) || a.label.localeCompare(b.label));
    const radius = clamp(58 + Math.sqrt(Math.max(1, members.length)) * 17, 70, 155);
    clusters.push({ ...group, cx, cy, radius });
    const golden = Math.PI * (3 - Math.sqrt(5));
    members.forEach((repo, repoIndex) => {
      const fraction = Math.sqrt((repoIndex + 0.7) / Math.max(1, members.length + 0.4));
      const localRadius = Math.max(0, radius - 22) * fraction;
      const localAngle = repoIndex * golden;
      nodes.push({ ...repo, x: cx + Math.cos(localAngle) * localRadius, y: cy + Math.sin(localAngle) * localRadius, radius: nodeRadius(repo) });
    });
  });
  return { clusters, nodes };
}
function palette() {
  return { background: "#070a12", text: "#e8edf7", muted: "#9aa7bd", cluster: "#6aa7ff", original: "#57d17a", fork: "#b59aff", archived: "#d9847b", selection: "#ffffff" };
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
  const size = canvasSize();
  state.zoom = clamp(Math.min((size.width * 0.86) / 1000, (size.height * 0.76) / 600), 0.2, 2.6);
  state.pan.x = 0;
  state.pan.y = 0;
}
function matches(repo) {
  if (!state.query) return true;
  return [repo.label, repo.description, repo.language, repo.groupLabel, ...(repo.topics || [])].filter(Boolean).join(" ").toLowerCase().includes(state.query);
}
function boxesOverlap(a, b, padding = 4) {
  return !(a.right + padding < b.left || b.right + padding < a.left || a.bottom + padding < b.top || b.bottom + padding < a.top);
}
function draw() {
  const size = canvasSize();
  const colors = palette();
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, size.width, size.height);
  if (!state.graph) return;

  for (const cluster of state.clusters) {
    const center = worldToScreen(cluster.cx, cluster.cy);
    const radius = cluster.radius * state.zoom;
    ctx.fillStyle = "rgba(106,167,255,.055)";
    ctx.strokeStyle = "rgba(106,167,255,.55)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colors.muted;
    ctx.font = `650 ${clamp(11 * Math.sqrt(state.zoom), 9, 14)}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(cluster.label, center.x, center.y - radius - 7, Math.max(60, radius * 2));
  }

  const occupied = [];
  for (const repo of state.nodes) {
    const point = worldToScreen(repo.x, repo.y);
    const selected = repo === state.selected || repo === state.hovered;
    const radius = Math.max(3.5, repo.radius * state.zoom * (selected ? 1.15 : 1));
    const opacity = matches(repo) ? (repo.archived ? 0.70 : repo.fork ? 0.82 : 0.96) : 0.10;
    ctx.globalAlpha = opacity;
    ctx.fillStyle = colors[statusOf(repo)];
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    if (repo.archived) {
      ctx.strokeStyle = colors.archived;
      ctx.setLineDash([3, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (selected) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colors.selection;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    if ((repo.stars > 0 || selected || state.zoom > 0.7) && matches(repo)) {
      const label = repo.label.length > 22 ? `${repo.label.slice(0, 21)}…` : repo.label;
      const width = Math.min(150, 10 + label.length * 5.5);
      const box = { left: point.x - width / 2, right: point.x + width / 2, top: point.y + radius + 4, bottom: point.y + radius + 18 };
      if (selected || !occupied.some((other) => boxesOverlap(box, other))) {
        if (!selected) occupied.push(box);
        ctx.globalAlpha = 1;
        ctx.fillStyle = colors.text;
        ctx.font = '9px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(label, point.x, box.top + 1);
      }
    }
  }
  ctx.globalAlpha = 1;
}
function resize() {
  const size = canvasSize();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(size.width * dpr);
  canvas.height = Math.round(size.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}
function hitTest(screenX, screenY) {
  const point = screenToWorld(screenX, screenY);
  for (let index = state.nodes.length - 1; index >= 0; index -= 1) {
    const node = state.nodes[index];
    const radius = Math.max(node.radius, 10 / state.zoom);
    if ((point.x - node.x) ** 2 + (point.y - node.y) ** 2 <= radius ** 2) return node;
  }
  return null;
}
function updateDetails(repo) {
  state.selected = repo;
  details.classList.toggle("has-selection", Boolean(repo));
  if (!repo) {
    detailsTitle.textContent = "Cluster / Bubble";
    detailsDescription.textContent = "Categories form large bubbles; repositories are packed inside their category cluster.";
    detailsMeta.hidden = true;
    detailsLink.hidden = true;
    draw();
    return;
  }
  detailsTitle.textContent = repo.label;
  detailsDescription.textContent = repo.description || "No description provided.";
  const rows = [["Kind", repo.archived ? "Archived" : repo.fork ? "Fork" : "Original"]];
  if (repo.language) rows.push(["Language", repo.language]);
  rows.push(["Stars", String(repo.stars || 0)], ["Forks", String(repo.forks || 0)]);
  if (repo.groupLabel) rows.push(["Category", repo.groupLabel]);
  if (repo.updatedAt) rows.push(["Updated", repo.updatedAt.slice(0, 10)]);
  detailsMeta.replaceChildren();
  for (const [key, value] of rows) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = key;
    dd.textContent = value;
    detailsMeta.append(dt, dd);
  }
  detailsMeta.hidden = false;
  detailsLink.href = repo.url;
  detailsLink.hidden = false;
  detailsLink.textContent = "Open repository ↗";
  draw();
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
  state.down = point;
  state.last = point;
  state.moved = false;
  tip.hidden = true;
  if (state.pointers.size === 2) {
    const pair = pointerPair();
    state.pinchDistance = pair ? pointDistance(pair[0], pair[1]) : 0;
  }
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
      state.zoom = clamp(state.zoom * (distance / state.pinchDistance), 0.18, 5);
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
    if (state.moved) {
      state.pan.x += point.x - state.last.x;
      state.pan.y += point.y - state.last.y;
      state.last = point;
      draw();
    }
    return;
  }
  const hover = hitTest(point.x, point.y);
  state.hovered = hover;
  if (hover) {
    tip.hidden = false;
    tip.style.left = `${point.x + 14}px`;
    tip.style.top = `${point.y + 14}px`;
    tip.textContent = `${hover.label} · ${hover.groupLabel || "Other"} · ${statusOf(hover)}`;
  } else tip.hidden = true;
  draw();
});
function finishPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const clicked = state.pointers.size === 1 && state.pointers.has(event.pointerId) && !state.moved ? hitTest(event.clientX - rect.left, event.clientY - rect.top) : null;
  state.pointers.delete(event.pointerId);
  if (state.pointers.size < 2) state.pinchDistance = 0;
  if (clicked) updateDetails(clicked);
}
canvas.addEventListener("pointerup", finishPointer);
canvas.addEventListener("pointercancel", finishPointer);
canvas.addEventListener("dblclick", (event) => {
  const rect = canvas.getBoundingClientRect();
  const repo = hitTest(event.clientX - rect.left, event.clientY - rect.top);
  if (repo?.url) window.open(repo.url, "_blank", "noopener");
});
canvas.addEventListener("keydown", (event) => {
  if (event.key === "0") { event.preventDefault(); fitView(); draw(); }
  else if (["+", "=", "-"].includes(event.key)) { event.preventDefault(); state.zoom = clamp(state.zoom * (event.key === "-" ? 1 / 1.16 : 1.16), 0.18, 5); draw(); }
  else if (event.key === "Enter" && state.selected?.url) { event.preventDefault(); window.open(state.selected.url, "_blank", "noopener"); }
  else if (event.key === "Escape") updateDetails(null);
});
searchInput.addEventListener("input", () => { state.query = searchInput.value.trim().toLowerCase(); draw(); });
fitButton.addEventListener("click", () => { fitView(); draw(); });
resetButton.addEventListener("click", () => { searchInput.value = ""; state.query = ""; updateDetails(null); fitView(); draw(); });
detailsClose.addEventListener("click", () => { updateDetails(null); canvas.focus({ preventScroll: true }); });
window.addEventListener("resize", resize);
window.visualViewport?.addEventListener("resize", resize, { passive: true });
function showError(message) { status.hidden = true; errorText.textContent = message; errorBox.classList.add("visible"); }
try {
  username = normalizeUsername(query.get("username"));
  document.title = `${username} · Cluster Project Map`;
  title.textContent = `${username} · Interactive Project Map`;
  subtitle.textContent = "Cluster / Bubble · category concentration and repository density";
  canvas.setAttribute("aria-label", `Interactive cluster project map for ${username}`);
  const setupUrl = new URL("../", location.href);
  setupUrl.searchParams.set("username", username);
  setupUrl.searchParams.set("style", "cluster");
  setup.href = setupUrl.toString();
} catch (error) { showError(error.message); }
document.body.dataset.mapStyle = "cluster";
styleSelect.value = "cluster";
resize();
if (username) {
  const owner = encodeURIComponent(username);
  fetch(`https://raw.githubusercontent.com/${owner}/${owner}/HEAD/project-map/graph.json`, { cache: "no-cache" })
    .then((response) => { if (!response.ok) throw new Error(`graph.json returned ${response.status}`); return response.json(); })
    .then((value) => {
      const graph = sanitizeGraph(value);
      if (!graph) throw new Error("graph.json failed validation");
      state.graph = graph;
      const layout = buildLayout(graph);
      state.clusters = layout.clusters;
      state.nodes = layout.nodes;
      status.hidden = true;
      fitView();
      updateDetails(null);
      resize();
    })
    .catch((error) => showError(`Could not load ${username}/${username}/project-map/graph.json. Run the setup workflow once, or regenerate it if the file is invalid. (${error.message})`));
}
