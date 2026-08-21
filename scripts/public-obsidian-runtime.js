"use strict";
/* global state, canvas, hash, clamp, hitTest, screenToWorld, updateDetails, draw, subtitle, detailsDescription, buildObsidianLayout */

(() => {
  // Obsidian-like runtime: one global force system with four user-facing
  // concepts only: center, repel, link, and distance. Node types affect
  // appearance, not physical anchoring or force law.
  const settings = {
    center: 0.0026,
    repel: 9200,
    link: 0.022,
    linkDistance: 138,
    damping: 0.855,
    cooling: 0.986,
  };
  const SPAWN_ALPHA = 0.6;

  const runtime = {
    nodesRef: null,
    edges: [],
    alpha: 0,
    pendingSpawnAlpha: 0,
    spawnCount: 0,
    dragging: null,
    panning: false,
    pointerStart: null,
    lastPointer: null,
    pointers: new Map(),
    pinchDistance: 0,
    pinchMidpoint: null,
    pinchConsumed: false,
  };

  function physicsRadius(node) {
    if (node.type === "owner") return 19;
    if (node.type === "group") return 15;
    return 9 + Math.min(3, Number(node.stars || 0));
  }

  function linkedEdges(graph, nodes) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    return graph.edges
      .map((edge) => ({ ...edge, sourceNode: byId.get(edge.source), targetNode: byId.get(edge.target) }))
      .filter((edge) => edge.sourceNode && edge.targetNode);
  }

  function compactSpawnPoint(node, index, count) {
    // Obsidian's worker has been observed creating unseen nodes at one origin.
    // That detail causes violent first frames and makes moving nodes difficult
    // to click. Graph Spawn demonstrates that supplying initial positions is a
    // supported way to retain Obsidian's own live force lifecycle without that
    // initialization defect. Keep the seed deterministic and scale its area
    // roughly with node count so future repository growth does not collapse
    // initial screen-space density.
    const safeCount = Math.max(1, count);
    const golden = Math.PI * (3 - Math.sqrt(5));
    const jitter = (hash(`${node.id}:obsidian-spawn`) % 1000) / 1000;
    const angle = index * golden + jitter * 0.55;
    const radialSpan = clamp(60 * Math.sqrt(safeCount), 120, 520);
    const radius = 36 + Math.sqrt((index + 1) / safeCount) * radialSpan;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  }

  function applyForceStep(nodes, edges, alpha, dragging = null) {
    if (alpha < 0.001 || !nodes.length) return;

    for (let first = 0; first < nodes.length; first += 1) {
      const a = nodes[first];
      for (let second = first + 1; second < nodes.length; second += 1) {
        const b = nodes[second];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < 1) {
          const angle = (hash(`${a.id}:${b.id}:obsidian-force`) % 6283) / 1000;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distanceSquared = 1;
        }
        const distance = Math.sqrt(distanceSquared);
        const minimum = physicsRadius(a) + physicsRadius(b) + 18;
        const effectiveSquared = Math.max(distanceSquared, minimum * minimum * 0.28);
        const force = settings.repel * alpha / effectiveSquared;
        const fx = dx / distance * force;
        const fy = dy / distance * force;
        if (a !== dragging) {
          a.vx -= fx;
          a.vy -= fy;
        }
        if (b !== dragging) {
          b.vx += fx;
          b.vy += fy;
        }
      }
    }

    // Structural and relation edges are drawn differently, but physics treats
    // every edge equally, matching the Obsidian-style global force baseline.
    for (const edge of edges) {
      const a = edge.sourceNode;
      const b = edge.targetNode;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const amount = (distance - settings.linkDistance) * settings.link * alpha;
      const fx = dx / distance * amount;
      const fy = dy / distance * amount;
      if (a !== dragging) {
        a.vx += fx;
        a.vy += fy;
      }
      if (b !== dragging) {
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // No owner/category anchors: every node gets the same center law.
    for (const node of nodes) {
      if (node === dragging) {
        node.vx = 0;
        node.vy = 0;
        continue;
      }
      node.vx += -node.x * settings.center * alpha;
      node.vy += -node.y * settings.center * alpha;
      node.vx *= settings.damping;
      node.vy *= settings.damping;
      node.x += node.vx;
      node.y += node.vy;
    }
  }

  buildObsidianLayout = function liveObsidianForceSpawn(graph) {
    const count = graph.nodes.length;
    const nodes = graph.nodes.map((raw, index) => {
      const point = compactSpawnPoint(raw, index, count);
      return { ...raw, x: point.x, y: point.y, vx: 0, vy: 0 };
    });
    // Preserve a real live spawn instead of hiding convergence in a synchronous
    // pre-settle. 0.6 is also the alpha used by Graph Spawn when handing seeded
    // positions back to Obsidian's own worker.
    runtime.pendingSpawnAlpha = SPAWN_ALPHA;
    return nodes;
  };

  function ensureRuntime() {
    if (state.style !== "obsidian" || !state.graph || !state.nodes.length) return false;
    if (runtime.nodesRef === state.nodes) return true;
    runtime.nodesRef = state.nodes;
    runtime.edges = linkedEdges({ edges: state.edges }, state.nodes);
    runtime.alpha = Math.max(0, runtime.pendingSpawnAlpha);
    runtime.pendingSpawnAlpha = 0;
    runtime.spawnCount += 1;
    runtime.dragging = null;
    runtime.panning = false;
    runtime.pointerStart = null;
    runtime.lastPointer = null;
    runtime.pointers.clear();
    runtime.pinchDistance = 0;
    runtime.pinchMidpoint = null;
    runtime.pinchConsumed = false;
    return true;
  }

  function reheat(value = 0.55) {
    runtime.alpha = Math.max(runtime.alpha, value);
  }

  function step() {
    if (!ensureRuntime()) return false;
    if (runtime.alpha < 0.001 && !runtime.dragging) {
      runtime.alpha = 0;
      for (const node of state.nodes) {
        node.vx = 0;
        node.vy = 0;
      }
      return false;
    }
    applyForceStep(state.nodes, runtime.edges, Math.max(runtime.alpha, runtime.dragging ? 0.55 : 0), runtime.dragging);
    runtime.alpha *= runtime.dragging ? 0.992 : settings.cooling;
    return true;
  }

  function phase() {
    if (runtime.dragging) return "dragging";
    return runtime.alpha >= 0.001 ? "settling" : "settled";
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function pointerPair() {
    const values = [...runtime.pointers.values()];
    return values.length >= 2 ? [values[0], values[1]] : null;
  }

  function pairState() {
    const pair = pointerPair();
    if (!pair) return null;
    return {
      distance: Math.max(1, Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y)),
      midpoint: { x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 },
    };
  }

  function clearGesture() {
    runtime.dragging = null;
    runtime.panning = false;
    runtime.pointerStart = null;
    runtime.lastPointer = null;
    canvas.classList.remove("dragging");
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (state.style !== "obsidian") return;
    const point = canvasPoint(event);
    runtime.pointers.set(event.pointerId, point);
    canvas.setPointerCapture(event.pointerId);

    if (runtime.pointers.size >= 2) {
      const pair = pairState();
      runtime.pinchConsumed = true;
      runtime.dragging = null;
      runtime.panning = false;
      runtime.pinchDistance = pair?.distance || 1;
      runtime.pinchMidpoint = pair?.midpoint || null;
    } else {
      runtime.pointerStart = point;
      runtime.lastPointer = point;
      runtime.dragging = hitTest(point.x, point.y);
      runtime.panning = !runtime.dragging;
      if (runtime.dragging) {
        runtime.dragging.vx = 0;
        runtime.dragging.vy = 0;
        state.hovered = runtime.dragging;
      }
      canvas.classList.add("dragging");
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true, passive: false });

  canvas.addEventListener("pointermove", (event) => {
    if (state.style !== "obsidian" || !runtime.pointers.has(event.pointerId)) return;
    const point = canvasPoint(event);
    runtime.pointers.set(event.pointerId, point);

    if (runtime.pointers.size >= 2) {
      const pair = pairState();
      if (pair && runtime.pinchMidpoint) {
        const before = screenToWorld(runtime.pinchMidpoint.x, runtime.pinchMidpoint.y);
        state.zoom = clamp(state.zoom * (pair.distance / Math.max(1, runtime.pinchDistance)), 0.04, 4.5);
        const size = canvas.getBoundingClientRect();
        const afterX = size.width / 2 + state.pan.x + before.x * state.zoom;
        const afterY = size.height / 2 + state.pan.y + before.y * state.zoom;
        state.pan.x += pair.midpoint.x - afterX;
        state.pan.y += pair.midpoint.y - afterY;
      }
      runtime.pinchDistance = pair?.distance || 1;
      runtime.pinchMidpoint = pair?.midpoint || null;
      draw();
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    if (runtime.dragging) {
      const world = screenToWorld(point.x, point.y);
      runtime.dragging.x = world.x;
      runtime.dragging.y = world.y;
      runtime.dragging.vx = 0;
      runtime.dragging.vy = 0;
      reheat(0.55);
    } else if (runtime.panning && runtime.lastPointer) {
      state.pan.x += point.x - runtime.lastPointer.x;
      state.pan.y += point.y - runtime.lastPointer.y;
    }
    runtime.lastPointer = point;
    draw();
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true, passive: false });

  function finishPointer(event, cancelled = false) {
    if (state.style !== "obsidian" || !runtime.pointers.has(event.pointerId)) return;
    const point = canvasPoint(event);
    const wasPinch = runtime.pinchConsumed || runtime.pointers.size >= 2;
    runtime.pointers.delete(event.pointerId);

    if (runtime.pointers.size >= 2) {
      const pair = pairState();
      runtime.pinchDistance = pair?.distance || 1;
      runtime.pinchMidpoint = pair?.midpoint || null;
    } else if (wasPinch) {
      runtime.pinchDistance = 0;
      runtime.pinchMidpoint = null;
      clearGesture();
      if (runtime.pointers.size === 0) runtime.pinchConsumed = false;
    } else {
      const moved = runtime.pointerStart ? Math.hypot(point.x - runtime.pointerStart.x, point.y - runtime.pointerStart.y) : 99;
      const dragged = runtime.dragging;
      if (dragged) {
        dragged.vx = 0;
        dragged.vy = 0;
        reheat(0.55);
      }
      clearGesture();
      if (!cancelled && moved < 6) updateDetails(hitTest(point.x, point.y));
    }

    event.preventDefault();
    event.stopImmediatePropagation();
  }

  canvas.addEventListener("pointerup", (event) => finishPointer(event, false), { capture: true, passive: false });
  canvas.addEventListener("pointercancel", (event) => finishPointer(event, true), { capture: true, passive: false });
  canvas.addEventListener("lostpointercapture", (event) => {
    if (runtime.pointers.has(event.pointerId)) finishPointer(event, true);
  }, { capture: true });

  window.ProjectMapObsidianRuntime = Object.freeze({
    snapshot() {
      return {
        active: state.style === "obsidian" && runtime.nodesRef === state.nodes,
        phase: phase(),
        alpha: runtime.alpha,
        spawnCount: runtime.spawnCount,
        nodeCount: state.style === "obsidian" ? state.nodes.length : 0,
        edgeCount: state.style === "obsidian" ? runtime.edges.length : 0,
        draggingId: runtime.dragging?.id || null,
        panning: runtime.panning,
      };
    },
  });

  window.addEventListener("DOMContentLoaded", () => {
    function frame() {
      if (state.style === "obsidian") {
        const currentPhase = phase();
        if (subtitle) subtitle.textContent = `Obsidian Graph-like · global center / repel / link physics · ${currentPhase === "settled" ? "settled" : "live settling"}`;
        if (!state.selected && detailsDescription) {
          detailsDescription.textContent = "Obsidian-style force graph: nodes start from a deterministic compact seed and settle under one global center, repel, link and distance system. Dragging reheats the whole graph; release lets it settle naturally from the dropped position.";
        }
        if (step()) draw();
      } else {
        runtime.nodesRef = null;
        runtime.edges = [];
        runtime.alpha = 0;
        runtime.pendingSpawnAlpha = 0;
        clearGesture();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }, { once: true });
})();
