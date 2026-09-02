"use strict";

const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const STYLE_VALUES = new Set(["galaxy-classic", "galaxy-systems", "galaxy-hybrid", "obsidian"]);
function normalizeGraphStyle(value) { return value === "galaxy" ? "galaxy-systems" : STYLE_VALUES.has(value) ? value : "galaxy-systems"; }
const TAU = Math.PI * 2;

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
let initialStyle = normalizeGraphStyle(query.get("style"));

const state = {
  graph: null,
  nodes: [],
  edges: [],
  byId: new Map(),
  style: initialStyle,
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

function hash(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
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
  const safeNodes = [];
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
    safeNodes.push(node);
  }
  const safeEdges = Array.isArray(value.edges)
    ? value.edges
        .filter((edge) => edge && typeof edge === "object" && ids.has(edge.source) && ids.has(edge.target))
        .slice(0, 1200)
        .map((edge) => ({ source: edge.source, target: edge.target, type: cleanText(edge.type, 40) }))
    : [];
  if (!safeNodes.some((node) => node.type === "owner")) {
    safeNodes.unshift({ id: `user:${username}`, label: username, type: "owner", url: `https://github.com/${encodeURIComponent(username)}` });
  }
  return {
    owner: username,
    generatedAt: cleanText(value.generatedAt, 64),
    repositoryCount: safeNodes.filter((node) => node.type === "repository").length,
    groupCount: safeNodes.filter((node) => node.type === "group").length,
    nodes: safeNodes,
    edges: safeEdges,
  };
}

function palette() {
  if (state.style === "obsidian") {
    return {
      background: "#1e1e1e",
      background2: "#181818",
      edge: "#5a5a60",
      relation: "#d7a75b",
      text: "#dcddde",
      muted: "#9a9a9f",
      owner: "#c4b5fd",
      group: "#8b7cf6",
      original: "#a89df7",
      fork: "#67b7a7",
      archived: "#b97a7a",
      selection: "#ffffff",
    };
  }
  return {
    background: "#050811",
    background2: "#090f1b",
    edge: "#3a4962",
    relation: "#f4b65f",
    text: "#eaf0ff",
    muted: "#97a6bc",
    owner: "#64d2ff",
    group: "#6aa7ff",
    original: "#57d17a",
    fork: "#b59aff",
    archived: "#d9847b",
    selection: "#ffffff",
  };
}

function nodeStatus(node) {
  if (node.type !== "repository") return node.type;
  if (node.archived) return "archived";
  return node.fork ? "fork" : "original";
}

function nodeColor(node, colors) {
  const statusName = nodeStatus(node);
  return colors[statusName] || colors.original;
}

function displayLabel(node) {
  const label = String(node.label || "");
  return label.length <= 30 ? label : `${label.slice(0, 29)}…`;
}

function estimateLabelWidth(node) {
  const multiplier = node.type === "repository" ? 6.2 : 6.8;
  return clamp(18 + displayLabel(node).length * multiplier, 52, 205);
}

function nodeRadius(node) {
  if (node.type === "owner") return state.style !== "obsidian" ? 24 : 18;
  if (node.type === "group") return state.style !== "obsidian" ? 8 : 12;
  return clamp(5.5 + Math.log2((node.stars || 0) + 1) * 1.35, 5.5, 12);
}

function collisionRadius(node) {
  return Math.max(nodeRadius(node) + 16, Math.min(82, estimateLabelWidth(node) * 0.34 + 18));
}

function groupMembers(group, repos) {
  const key = String(group.id).replace(/^group:/, "");
  return repos.filter((repo) => repo.groupId === key || group.id === `group:${repo.groupId}`);
}

function buildGalaxyLayout(graph) {
  const ownerRaw = graph.nodes.find((node) => node.type === "owner");
  const groups = graph.nodes.filter((node) => node.type === "group");
  const repos = graph.nodes.filter((node) => node.type === "repository");
  const result = [];
  if (ownerRaw) result.push({ ...ownerRaw, x: 0, y: 0 });
  const count = Math.max(1, groups.length);
  const sector = TAU / count;
  const usableSector = Math.min(1.15, sector * 0.72);

  groups.forEach((group, groupIndex) => {
    const base = -Math.PI / 2 + sector * groupIndex;
    result.push({ ...group, x: Math.cos(base) * 172, y: Math.sin(base) * 172 });
    const members = groupMembers(group, repos).sort((a, b) => (b.stars || 0) - (a.stars || 0) || a.label.localeCompare(b.label));
    let cursor = 0;
    let lane = 0;
    while (cursor < members.length) {
      const radius = 285 + lane * 92;
      const remaining = members.slice(cursor);
      const widest = Math.max(...remaining.slice(0, 12).map(estimateLabelWidth), 70);
      const minimumGap = clamp((widest + 34) / radius, 0.14, 0.5);
      const capacity = Math.max(1, Math.floor(usableSector / minimumGap));
      const take = Math.min(capacity, members.length - cursor);
      for (let index = 0; index < take; index += 1) {
        const repo = members[cursor + index];
        const local = take <= 1 ? 0 : (index / (take - 1) - 0.5) * usableSector;
        const spiral = lane * 0.055;
        const jitter = ((hash(`${repo.id}:phase`) % 1000) / 1000 - 0.5) * Math.min(0.035, minimumGap * 0.15);
        const angle = base + local + spiral + jitter;
        result.push({ ...repo, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
      }
      cursor += take;
      lane += 1;
    }
  });

  const assigned = new Set(result.map((node) => node.id));
  const unassigned = repos.filter((repo) => !assigned.has(repo.id));
  unassigned.forEach((repo, index) => {
    const angle = (index / Math.max(1, unassigned.length)) * TAU;
    const radius = 300 + (index % 3) * 88;
    result.push({ ...repo, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  });
  return result;
}

function buildObsidianLayout(graph) {
  const rawNodes = graph.nodes;
  const result = rawNodes.map((raw, index) => {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const jitter = (hash(raw.id) % 1000) / 1000;
    const angle = index * golden + jitter * 0.55;
    const radius = 45 + Math.sqrt((index + 1) / Math.max(1, rawNodes.length)) * 430;
    return { ...raw, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, vx: 0, vy: 0 };
  });
  const byId = new Map(result.map((node) => [node.id, node]));
  const links = graph.edges.map((edge) => ({ ...edge, sourceNode: byId.get(edge.source), targetNode: byId.get(edge.target) })).filter((edge) => edge.sourceNode && edge.targetNode);

  for (let step = 0; step < 110; step += 1) {
    const alpha = 1 - step / 110;
    for (let first = 0; first < result.length; first += 1) {
      const a = result[first];
      for (let second = first + 1; second < result.length; second += 1) {
        const b = result[second];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          const angle = (hash(`${a.id}:${b.id}`) % 6283) / 1000;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          d2 = 1;
        }
        const distance = Math.sqrt(d2);
        const minimum = collisionRadius(a) + collisionRadius(b) + 10;
        const effective = Math.max(d2, minimum * minimum * 0.38);
        const force = (13500 * alpha) / effective;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
        if (distance < minimum) {
          const push = (minimum - distance) * 0.018 * alpha;
          a.vx -= (dx / distance) * push;
          a.vy -= (dy / distance) * push;
          b.vx += (dx / distance) * push;
          b.vy += (dy / distance) * push;
        }
      }
    }
    for (const link of links) {
      const a = link.sourceNode;
      const b = link.targetNode;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const target = link.type === "ownership" ? 190 : 142;
      const amount = (distance - target) * 0.012 * alpha;
      const fx = (dx / distance) * amount;
      const fy = (dy / distance) * amount;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
    for (const node of result) {
      node.vx += -node.x * 0.0013 * alpha;
      node.vy += -node.y * 0.0013 * alpha;
      node.vx *= 0.83;
      node.vy *= 0.83;
      node.x += node.vx;
      node.y += node.vy;
    }
  }
  return result;
}

function rebuildLayout({ fit = true } = {}) {
  if (!state.graph) return;
  state.nodes = state.style === "obsidian" ? buildObsidianLayout(state.graph) : buildGalaxyLayout(state.graph);
  state.byId = new Map(state.nodes.map((node) => [node.id, node]));
  state.edges = state.graph.edges;
  state.selected = state.selected ? state.byId.get(state.selected.id) || null : null;
  document.body.dataset.mapStyle = state.style;
  styleSelect.value = state.style;
  subtitle.textContent = state.style === "obsidian"
    ? "Obsidian-like force graph · search, select, drag, pan and zoom"
    : "Galaxy view · label-aware orbital spacing · search, select, drag, pan and zoom";
  if (fit && state.style === "obsidian") {
    // Native Obsidian opens the graph around its centered spawn at a neutral
    // camera scale instead of continuously fitting current graph bounds. Keep
    // the explicit Fit command available, but do not hide the live bloom on open.
    state.zoom = 1;
    state.pan.x = 0;
    state.pan.y = 0;
    state.fitted = true;
  } else if (fit) {
    fitView();
  }
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
    const halfWidth = estimateLabelWidth(node) / 2 + 22;
    const halfHeight = nodeRadius(node) + 32;
    minX = Math.min(minX, node.x - halfWidth);
    maxX = Math.max(maxX, node.x + halfWidth);
    minY = Math.min(minY, node.y - halfHeight);
    maxY = Math.max(maxY, node.y + halfHeight);
  }
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  state.zoom = clamp(Math.min((size.width * 0.84) / width, (size.height * 0.78) / height), 0.04, 2.2);
  state.pan.x = -((minX + maxX) / 2) * state.zoom;
  state.pan.y = -((minY + maxY) / 2) * state.zoom;
  draw();
}

function matchesQuery(node) {
  if (!state.query) return true;
  const text = [node.label, node.description, node.language, node.groupLabel, ...(node.topics || [])].filter(Boolean).join(" ").toLowerCase();
  return text.includes(state.query);
}

function connectedToSelected(node) {
  if (!state.selected || node === state.selected) return true;
  return state.edges.some((edge) =>
    (edge.source === state.selected.id && edge.target === node.id) || (edge.target === state.selected.id && edge.source === node.id));
}

function nodeOpacity(node) {
  let opacity = 1;
  if (state.query && !matchesQuery(node)) opacity *= 0.12;
  if (state.selected && !connectedToSelected(node)) opacity *= 0.22;
  if (node.archived) opacity *= 0.72;
  return opacity;
}

function drawBackground(colors, width, height) {
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);
  if (state.style === "obsidian") {
    const gradient = ctx.createRadialGradient(width * 0.5, height * 0.45, 0, width * 0.5, height * 0.45, Math.max(width, height) * 0.7);
    gradient.addColorStop(0, "rgba(124,110,246,.07)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  for (let i = 0; i < 130; i += 1) {
    ctx.globalAlpha = 0.10 + (hash(`${username}:star:o:${i}`) % 42) / 100;
    ctx.fillStyle = "#d7e4ff";
    ctx.beginPath();
    ctx.arc(hash(`${username}:star:x:${i}`) % width, hash(`${username}:star:y:${i}`) % height, 0.35 + (hash(`${username}:star:r:${i}`) % 11) / 10, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawEdges(colors) {
  for (const edge of state.edges) {
    const a = state.byId.get(edge.source);
    const b = state.byId.get(edge.target);
    if (!a || !b) continue;
    const source = worldToScreen(a.x, a.y);
    const target = worldToScreen(b.x, b.y);
    let opacity = edge.type === "relation" ? 0.72 : state.style === "obsidian" ? 0.28 : 0.46;
    if (state.query && !(matchesQuery(a) || matchesQuery(b))) opacity *= 0.15;
    if (state.selected && a !== state.selected && b !== state.selected) opacity *= 0.16;
    ctx.strokeStyle = edge.type === "relation" ? colors.relation : colors.edge;
    ctx.globalAlpha = opacity;
    ctx.lineWidth = edge.type === "relation" ? 1.6 : 1;
    ctx.setLineDash(edge.type === "relation" ? [5, 4] : []);
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

function boxesOverlap(a, b, padding = 3) {
  return !(a.right + padding < b.left || b.right + padding < a.left || a.bottom + padding < b.top || b.bottom + padding < a.top);
}

function labelBox(node, point, radius, fontSize) {
  const text = displayLabel(node);
  const width = clamp(text.length * fontSize * 0.58 + 10, 38, 215);
  const height = fontSize + 8;
  const top = point.y + radius + 7;
  return { left: point.x - width / 2, right: point.x + width / 2, top, bottom: top + height, width, height, text };
}

function drawNodesAndLabels(colors) {
  const candidates = [];
  for (const node of state.nodes) {
    const point = worldToScreen(node.x, node.y);
    const highlighted = node === state.selected || node === state.hovered;
    const radius = Math.max(3.5, nodeRadius(node) * state.zoom * (highlighted ? 1.13 : 1));
    const opacity = nodeOpacity(node);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = nodeColor(node, colors);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, TAU);
    ctx.fill();

    if (node.type === "repository" && node.archived) {
      ctx.strokeStyle = colors.archived;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 4, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (highlighted) {
      ctx.globalAlpha = Math.max(opacity, 0.72);
      ctx.strokeStyle = colors.selection;
      ctx.lineWidth = node === state.selected ? 2 : 1.2;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 5, 0, TAU);
      ctx.stroke();
    }
    const always = node.type !== "repository" || highlighted;
    const threshold = state.style === "obsidian" ? 0.58 : 0.46;
    if (always || state.zoom >= threshold) {
      const fontSize = clamp((node.type === "owner" ? 14 : node.type === "group" ? 12 : 11) * Math.sqrt(state.zoom), 9, 15);
      candidates.push({ node, point, radius, fontSize, opacity, priority: highlighted ? 100 : node.type === "owner" ? 90 : node.type === "group" ? 80 : (node.stars || 0) + (node.fork ? -1 : 1) });
    }
  }
  ctx.globalAlpha = 1;

  candidates.sort((a, b) => b.priority - a.priority || a.node.label.localeCompare(b.node.label));
  const occupied = [];
  for (const candidate of candidates) {
    const box = labelBox(candidate.node, candidate.point, candidate.radius, candidate.fontSize);
    const forced = candidate.node === state.selected || candidate.node === state.hovered || candidate.node.type === "owner";
    if (!forced && occupied.some((other) => boxesOverlap(box, other, state.style === "obsidian" ? 4 : 6))) continue;
    occupied.push(box);
    ctx.globalAlpha = Math.max(candidate.opacity, forced ? 0.82 : 0);
    ctx.font = `${candidate.node.type === "owner" ? 700 : candidate.node.type === "group" ? 600 : 500} ${candidate.fontSize}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineWidth = state.style !== "obsidian" ? 3 : 2;
    ctx.strokeStyle = colors.background;
    ctx.strokeText(box.text, candidate.point.x, box.top + 2);
    ctx.fillStyle = candidate.node.type === "group" ? colors.muted : colors.text;
    ctx.fillText(box.text, candidate.point.x, box.top + 2);
  }
  ctx.globalAlpha = 1;
}

function draw() {
  const size = canvasSize();
  const colors = palette();
  ctx.clearRect(0, 0, size.width, size.height);
  drawBackground(colors, size.width, size.height);
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
  } else {
    draw();
  }
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
    detailsTitle.textContent = "Project map";
    detailsDescription.textContent = state.style === "obsidian"
      ? "Obsidian-like force layout. Search, select, drag nodes, pan empty space, and zoom."
      : "Galaxy layout with label-aware orbital spacing. Search, select, drag nodes, pan empty space, and zoom.";
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

function pointerPair() {
  const values = [...state.pointers.values()];
  return values.length >= 2 ? [values[0], values[1]] : null;
}

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const before = screenToWorld(event.offsetX, event.offsetY);
  const factor = Math.exp(-event.deltaY * 0.0012);
  state.zoom = clamp(state.zoom * factor, 0.04, 4.5);
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
  if (state.pointers.size !== 1) return;
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
      state.zoom = clamp(state.zoom * (distance / state.pinchDistance), 0.04, 4.5);
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
  } else if (["+", "=", "-"].includes(event.key)) {
    event.preventDefault();
    state.zoom = clamp(state.zoom * (event.key === "-" ? 1 / 1.16 : 1.16), 0.04, 4.5);
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
  state.style = normalizeGraphStyle(styleSelect.value);
  const url = new URL(location.href);
  url.searchParams.set("style", state.style);
  history.replaceState(null, "", url);
  updateDetails(null);
  rebuildLayout({ fit: true });
});
fitButton.addEventListener("click", fitView);
resetButton.addEventListener("click", () => {
  searchInput.value = "";
  state.query = "";
  updateDetails(null);
  rebuildLayout({ fit: true });
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
  document.title = `${username} · Interactive Project Map`;
  title.textContent = `${username} · Interactive Project Map`;
  canvas.setAttribute("aria-label", `Interactive project graph for ${username}`);
  const setupUrl = new URL("../", location.href);
  setupUrl.searchParams.set("username", username);
  setup.href = setupUrl.toString();
} catch (error) {
  showError(error.message);
}

document.body.dataset.mapStyle = state.style;
styleSelect.value = state.style;
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
      rebuildLayout({ fit: true });
      updateDetails(null);
    })
    .catch((error) => showError(`Could not load ${username}/${username}/project-map/graph.json. Run the setup workflow once, or regenerate it if the file is invalid. (${error.message})`));
}
