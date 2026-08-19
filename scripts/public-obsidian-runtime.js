"use strict";
/* global state, canvas, hash, clamp, hitTest, screenToWorld, updateDetails, draw, subtitle, detailsDescription, buildObsidianLayout */

(() => {
  // Rebuild Obsidian from the original profile-map behavior boundary:
  // one global force system with four concepts only: center, repel, link, distance.
  // Node types affect appearance, not their physical anchoring or force law.
  const settings = {
    center: 0.0026,
    repel: 9200,
    link: 0.022,
    linkDistance: 138,
    damping: 0.855,
    cooling: 0.986,
  };

  const runtime = {
    nodesRef: null,
    edges: [],
    alpha: 0,
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

  function deterministicScatter(raw, index, count) {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const jitter = (hash(String(raw.id)) % 1000) / 1000;
    const angle = index * golden + jitter * 0.7;
    const radius = 42 + Math.sqrt((index + 1) / Math.max(1, count)) * 265;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  }

  function linkedEdges(graph, nodes) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    return graph.edges
      .map((edge) => ({ ...edge, sourceNode: byId.get(edge.source), targetNode: byId.get(edge.target) }))
      .filter((edge) => edge.sourceNode && edge.targetNode);
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
    // every edge equally, matching the original Obsidian-like baseline.
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

  buildObsidianLayout = function originalObsidianForceLayout(graph) {
    const rawNodes = graph.nodes;
    const nodes = rawNodes.map((raw, index) => {
      const position = deterministicScatter(raw, index, rawNodes.length);
      return { ...raw, x: position.x, y: position.y, vx: 0, vy: 0 };
    });
    const edges = linkedEdges(graph, nodes);
    let alpha = 1;
    for (let stepIndex = 0; stepIndex < 120; stepIndex += 1) {
      applyForceStep(nodes, edges, alpha);
      alpha *= settings.cooling;
    }
    for (const node of nodes) {
      node.vx = 0;
      node.vy = 0;
    }
    return nodes;
  };

  function ensureRuntime() {
    if (state.style !== "obsidian" || !state.graph || !state.nodes.length) return false;
    if (runtime.nodesRef === state.nodes) return true;
    runtime.nodesRef = state.nodes;
    runtime.edges = linkedEdges({ edges: state.edges }, state.nodes);
    runtime.alpha = 0;
    runtime.dragging = null;
    runtime.panning = false;
    runtime.pointerStart = null;
    runtime.lastPointer = null;
    runtime.pointers.clear();
    runtime.pinchDistance = 0;
    runtime.pinchMidpoint = null;
    runtime.pinchConsumed = false;
    for (const node of state.nodes) {
      node.vx = 0;
      node.vy = 0;
    }
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

  window.addEventListener("DOMContentLoaded", () => {
    function frame() {
      if (state.style === "obsidian") {
        if (subtitle) subtitle.textContent = "Obsidian Graph-like · global center / repel / link physics · settled at rest";
        if (!state.selected && detailsDescription) {
          detailsDescription.textContent = "Obsidian-style force graph: every node follows the same center, repel, link and distance forces. Dragging reheats the whole graph; release lets it settle naturally from the dropped position.";
        }
        if (step()) draw();
      } else {
        runtime.nodesRef = null;
        runtime.edges = [];
        runtime.alpha = 0;
        clearGesture();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }, { once: true });
})();
