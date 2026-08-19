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
  segments: [],
  groups: [],
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
  for (const raw of value.nodes) {
    if (!raw || typeof raw !== "object" || !["group", "repository"].includes(raw.type)) continue;
    const id = cleanText(raw.id, 180);
    const label = cleanText(raw.label, 120);
    if (!id || !label) continue;
    if (raw.type === "group") {
      nodes.push({ id, label, type: "group" });
      continue;
    }
    if (!/^[A-Za-z0-9._-]{1,100}$/.test(label)) continue;
    const url = safeRepoUrl(raw.url, label);
    if (!url) continue;
    nodes.push({
      id,
      label,
      type: "repository",
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
    });
  }
  return { owner: username, nodes };
}

function statusOf(repo) {
  return repo.archived ? "archived" : repo.fork ? "fork" : "original";
}

function groupMembers(group, repos) {
  const key = String(group.id).replace(/^group:/, "");
  return repos.filter((repo) => repo.groupId === key || group.id === `group:${repo.groupId}`);
}

function buildLayout(graph) {
  const groups = graph.nodes.filter((node) => node.type === "group");
  const repos = graph.nodes.filter((node) => node.type === "repository");
  const bundles = groups.map((group) => ({ group, members: groupMembers(group, repos) })).filter((bundle) => bundle.members.length);
  const total = Math.max(1, bundles.reduce((sum, bundle) => sum + bundle.members.length, 0));
  let cursor = -Math.PI / 2;
  const segments = [];
  const groupSegments = [];
  for (const bundle of bundles) {
    const span = Math.PI * 2 * bundle.members.length / total;
    const start = cursor;
    const end = cursor + span;
    groupSegments.push({ group: bundle.group, start, end, count: bundle.members.length });
    const repoSpan = span / bundle.members.length;
    bundle.members.forEach((repo, index) => segments.push({ ...repo, start: start + index * repoSpan, end: start + (index + 1) * repoSpan }));
    cursor = end;
  }
  return { segments, groups: groupSegments };
}

function palette() {
  return { background: "#070a12", text: "#e8edf7", muted: "#9aa7bd", group: "#6aa7ff", owner: "#64d2ff", original: "#57d17a", fork: "#b59aff", archived: "#d9847b", selection: "#ffffff" };
}

function canvasSize() {
  const rect = canvas.getBoundingClientRect();
  return { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
}

function center() {
  const size = canvasSize();
  return { x: size.width / 2 + state.pan.x, y: size.height / 2 + state.pan.y };
}

function fitView() {
  const size = canvasSize();
  state.zoom = clamp(Math.min((size.width * 0.86) / 500, (size.height * 0.78) / 500), 0.22, 2.8);
  state.pan.x = 0;
  state.pan.y = 0;
}

function matches(repo) {
  if (!state.query) return true;
  return [repo.label, repo.description, repo.language, repo.groupLabel, ...(repo.topics || [])].filter(Boolean).join(" ").toLowerCase().includes(state.query);
}

function normAngle(angle) {
  let value = angle;
  while (value < 0) value += Math.PI * 2;
  while (value >= Math.PI * 2) value -= Math.PI * 2;
  return value;
}

function angleIn(angle, start, end) {
  const a = normAngle(angle);
  const s = normAngle(start);
  const e = normAngle(end);
  return s <= e ? a >= s && a <= e : a >= s || a <= e;
}

function shortLabel(label, max) {
  return label.length <= max ? label : `${label.slice(0, Math.max(1, max - 1))}…`;
}

function drawGroupLabels(colors, origin, outer, size) {
  const sides = { left: [], right: [] };
  for (const group of state.groups) {
    const mid = (group.start + group.end) / 2;
    const side = Math.cos(mid) >= 0 ? "right" : "left";
    sides[side].push({
      group,
      mid,
      arcX: origin.x + Math.cos(mid) * (outer + 2),
      arcY: origin.y + Math.sin(mid) * (outer + 2),
      idealY: origin.y + Math.sin(mid) * (outer + 36),
    });
  }
  ctx.font = `650 ${clamp(10 * Math.sqrt(state.zoom), 8.5, 12)}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
  ctx.textBaseline = "middle";
  for (const [side, items] of Object.entries(sides)) {
    items.sort((a, b) => a.idealY - b.idealY);
    let cursor = 24;
    for (const item of items) {
      const y = clamp(Math.max(cursor, item.idealY), 24, size.height - 42);
      cursor = y + 16;
      const right = side === "right";
      const x = right ? Math.min(size.width - 16, origin.x + outer + 45) : Math.max(16, origin.x - outer - 45);
      const elbow = right ? x - 8 : x + 8;
      const label = shortLabel(item.group.group.label, 20);
      ctx.strokeStyle = colors.group;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(item.arcX, item.arcY);
      ctx.lineTo(elbow, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = colors.muted;
      ctx.textAlign = right ? "left" : "right";
      ctx.fillText(`${label} · ${item.group.count}`, x, y);
    }
  }
}

function drawRepoLabels(colors, origin, outer, repoInner) {
  const total = state.segments.length;
  const labelRadius = repoInner + (outer - repoInner) * 0.58;
  for (const repo of state.segments) {
    const highlighted = repo === state.selected || repo === state.hovered;
    const span = repo.end - repo.start;
    if (!highlighted && total > 36 && span < 0.17) continue;
    const mid = (repo.start + repo.end) / 2;
    const x = origin.x + Math.cos(mid) * labelRadius;
    const y = origin.y + Math.sin(mid) * labelRadius;
    const maxChars = highlighted ? 30 : total <= 18 ? 18 : total <= 36 ? 13 : 10;
    const text = shortLabel(repo.label, Math.max(6, maxChars));
    const fontSize = clamp((highlighted ? 10.6 : 9.2) * Math.sqrt(state.zoom), 7.8, 12.5);
    const angle = mid + Math.PI / 2;
    const flipped = Math.cos(mid) < 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(flipped ? angle + Math.PI : angle);
    ctx.globalAlpha = matches(repo) ? (highlighted ? 1 : 0.94) : 0.12;
    ctx.font = `${highlighted ? 700 : 600} ${fontSize}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = colors.background;
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = colors.text;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
}

function draw() {
  const size = canvasSize();
  const colors = palette();
  const origin = center();
  const outer = 170 * state.zoom;
  const ownerRadius = 36 * state.zoom;
  const groupInner = 49 * state.zoom;
  const groupOuter = 96 * state.zoom;
  const repoInner = 102 * state.zoom;
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, size.width, size.height);
  if (!state.graph) return;

  for (const group of state.groups) {
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, groupOuter, group.start, group.end);
    ctx.arc(origin.x, origin.y, groupInner, group.end, group.start, true);
    ctx.closePath();
    ctx.fillStyle = "rgba(106,167,255,.16)";
    ctx.fill();
    ctx.strokeStyle = "rgba(106,167,255,.66)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  for (const repo of state.segments) {
    const highlighted = repo === state.selected || repo === state.hovered;
    const opacity = matches(repo) ? (repo.archived ? 0.70 : repo.fork ? 0.82 : 0.94) : 0.08;
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, outer, repo.start + 0.005, repo.end - 0.005);
    ctx.arc(origin.x, origin.y, repoInner, repo.end - 0.005, repo.start + 0.005, true);
    ctx.closePath();
    ctx.fillStyle = colors[statusOf(repo)];
    ctx.fill();
    if (repo.archived) {
      ctx.strokeStyle = colors.archived;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (highlighted) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colors.selection;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
  drawRepoLabels(colors, origin, outer, repoInner);
  drawGroupLabels(colors, origin, outer, size);
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, ownerRadius, 0, Math.PI * 2);
  ctx.fillStyle = colors.owner;
  ctx.fill();
  ctx.fillStyle = colors.background;
  ctx.font = `750 ${clamp(12 * Math.sqrt(state.zoom), 9, 15)}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(username, origin.x, origin.y, ownerRadius * 1.7);
}

function resize() {
  const size = canvasSize();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(size.width * dpr);
  canvas.height = Math.round(size.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function hitTest(x, y) {
  const origin = center();
  const dx = x - origin.x;
  const dy = y - origin.y;
  const radius = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const outer = 170 * state.zoom;
  const inner = 102 * state.zoom;
  if (radius < inner || radius > outer) return null;
  for (const repo of state.segments) if (angleIn(angle, repo.start, repo.end)) return repo;
  return null;
}

function updateDetails(repo) {
  state.selected = repo;
  details.classList.toggle("has-selection", Boolean(repo));
  if (!repo) {
    detailsTitle.textContent = "Sunburst";
    detailsDescription.textContent = "Owner → Category → Repository rings. Repository names remain visible on the outer ring for normal portfolio sizes.";
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

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointerPair() {
  const values = [...state.pointers.values()];
  return values.length >= 2 ? [values[0], values[1]] : null;
}

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  state.zoom = clamp(state.zoom * Math.exp(-event.deltaY * 0.0012), 0.18, 5);
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
    if (state.pinchDistance > 0 && distance > 0) state.zoom = clamp(state.zoom * (distance / state.pinchDistance), 0.18, 5);
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
  const hovered = hitTest(point.x, point.y);
  state.hovered = hovered;
  if (hovered) {
    tip.hidden = false;
    tip.style.left = `${point.x + 14}px`;
    tip.style.top = `${point.y + 14}px`;
    tip.textContent = `${hovered.label} · ${hovered.groupLabel || "Other"} · ${statusOf(hovered)}`;
  } else {
    tip.hidden = true;
  }
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
  if (event.key === "0") {
    event.preventDefault();
    fitView();
    draw();
  } else if (["+", "=", "-"].includes(event.key)) {
    event.preventDefault();
    state.zoom = clamp(state.zoom * (event.key === "-" ? 1 / 1.16 : 1.16), 0.18, 5);
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
  fitView();
  draw();
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
  document.title = `${username} · Sunburst`;
  title.textContent = `${username} · Interactive Project Map`;
  subtitle.textContent = "Sunburst · repository names on outer ring · exterior category labels";
  canvas.setAttribute("aria-label", `Interactive sunburst for ${username}`);
  const setupUrl = new URL("../", location.href);
  setupUrl.searchParams.set("username", username);
  setupUrl.searchParams.set("style", "sunburst");
  setup.href = setupUrl.toString();
} catch (error) {
  showError(error.message);
}

document.body.dataset.mapStyle = "sunburst";
styleSelect.value = "sunburst";
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
      const layout = buildLayout(graph);
      state.segments = layout.segments;
      state.groups = layout.groups;
      status.hidden = true;
      fitView();
      updateDetails(null);
      resize();
    })
    .catch((error) => showError(`Could not load ${username}/${username}/project-map/graph.json. (${error.message})`));
}
