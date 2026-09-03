"use strict";
/* global canvas, state, searchInput, detailsMeta, drawRepoLabels, matches, ctx, clamp, hitTest, updateDetails, sanitizeGraph, rebuildLayout, buildObsidianLayout, drawEdges, worldToScreen, matchesQuery, nodeOpacity, draw */

(() => {
  const style = document.body.dataset.mapStyle;

  if (style === "sunburst" && typeof drawRepoLabels === "function") {
    drawRepoLabels = function readableRadialRepoLabels(colors, origin, outer, repoInner) {
      const labelRadius = repoInner + (outer - repoInner) * 0.53;
      for (const repo of state.segments) {
        const highlighted = repo === state.selected || repo === state.hovered;
        const span = Math.max(0.001, repo.end - repo.start);
        const mid = (repo.start + repo.end) / 2;
        const x = origin.x + Math.cos(mid) * labelRadius;
        const y = origin.y + Math.sin(mid) * labelRadius;
        const arcRoom = Math.max(5.8, labelRadius * span * 0.82);
        const radialRoom = Math.max(30, outer - repoInner - 10);
        const lengthFit = radialRoom / Math.max(1, repo.label.length * 0.56);
        const fontSize = clamp(Math.min(highlighted ? 11.8 : 10.4, arcRoom, Math.max(7.1, lengthFit)), 7.1, 12.2);
        const flipped = Math.cos(mid) < 0;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(flipped ? mid + Math.PI : mid);
        ctx.globalAlpha = matches(repo) ? (highlighted ? 1 : 0.96) : 0.12;
        ctx.font = `${highlighted ? 750 : 650} ${fontSize}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.lineWidth = highlighted ? 3.4 : 2.7;
        ctx.strokeStyle = colors.background;
        ctx.strokeText(repo.label, 0, 0);
        ctx.fillStyle = colors.text;
        ctx.fillText(repo.label, 0, 0);
        ctx.restore();
      }
    };
  }

  if (typeof canvas === "undefined" || typeof state === "undefined") return;

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function isGalaxyPresentationStyle(value) {
    return value === "galaxy" || String(value || "").startsWith("galaxy-");
  }

  function isExploratoryStyle(value) {
    return value === "obsidian" || isGalaxyPresentationStyle(value);
  }

  function cleanSearchString(value, max = 160) {
    return typeof value === "string" ? value.slice(0, max) : "";
  }

  // Preserve only the browser-safe taxonomy subset needed for search. The raw
  // graph stays immutable, and every viewer still owns its primary sanitizer.
  if (typeof sanitizeGraph === "function") {
    const baseSearchSanitizeGraph = sanitizeGraph;
    sanitizeGraph = function searchMetadataAwareSanitizeGraph(value) {
      const safe = baseSearchSanitizeGraph(value);
      if (!safe || !value || typeof value !== "object") return safe;

      const rawNodes = new Map(
        (Array.isArray(value.nodes) ? value.nodes : [])
          .filter((node) => node && typeof node === "object" && typeof node.id === "string")
          .slice(0, 520)
          .map((node) => [node.id, node]),
      );
      for (const node of Array.isArray(safe.nodes) ? safe.nodes : []) {
        if (node?.type !== "repository") continue;
        const raw = rawNodes.get(node.id);
        const facets = Array.isArray(raw?.taxonomyAssignment?.secondaryTags)
          ? raw.taxonomyAssignment.secondaryTags
              .filter((item) => typeof item === "string")
              .slice(0, 16)
              .map((item) => cleanSearchString(item, 120))
              .filter(Boolean)
          : [];
        if (facets.length) node.searchFacets = [...new Set(facets)];
      }

      const categories = (Array.isArray(value.taxonomy?.categories) ? value.taxonomy.categories : [])
        .filter((category) => category && typeof category === "object")
        .slice(0, 80)
        .map((category) => ({
          id: cleanSearchString(category.id, 120),
          label: cleanSearchString(category.label, 120),
          aliases: Array.isArray(category.aliases)
            ? category.aliases
                .filter((item) => typeof item === "string")
                .slice(0, 24)
                .map((item) => cleanSearchString(item, 120))
                .filter(Boolean)
            : [],
        }))
        .filter((category) => category.id && category.label);
      if (categories.length) safe.searchTaxonomy = { categories };
      return safe;
    };
  }

  // Shared search semantics for every interactive preset. The viewer-specific
  // geometry remains untouched; this layer only widens match context so a
  // direct repository hit carries its standard category with it, while a
  // direct category hit softly keeps its member repositories in context.
  let cachedSearchQuery = null;
  let cachedSearchGraph = null;
  let cachedSearchNodeCount = -1;
  let cachedSearchContext = null;

  function normalizedSearch(value) {
    return String(value || "").normalize("NFKC").toLocaleLowerCase("en-US").trim();
  }

  function groupNodeId(value) {
    const id = String(value || "");
    if (!id) return "";
    return id.startsWith("group:") ? id : `group:${id}`;
  }

  function searchText(values) {
    return values.filter(Boolean).join(" ").normalize("NFKC").toLocaleLowerCase("en-US");
  }

  function directMatchReasons(repo, query) {
    const reasons = [];
    const add = (reason) => { if (reason && !reasons.includes(reason)) reasons.push(reason); };
    if (searchText([repo.label]).includes(query)) add("repo name");
    if (searchText([repo.description]).includes(query)) add("description");
    if (searchText([repo.language]).includes(query) && repo.language) add(`language:${repo.language}`);
    for (const topic of Array.isArray(repo.topics) ? repo.topics : []) {
      const reason = `topic:${topic}`;
      if (searchText([topic, reason]).includes(query)) add(reason);
    }
    for (const facet of Array.isArray(repo.searchFacets) ? repo.searchFacets : []) {
      if (searchText([facet]).includes(query)) add(facet);
    }
    return reasons;
  }

  function categoryMatches(group, query, taxonomyById) {
    const id = String(group.id || "").replace(/^group:/, "");
    const category = taxonomyById.get(id);
    return searchText([group.label, id, ...(category?.aliases || [])]).includes(query);
  }

  function currentSearchContext() {
    const query = normalizedSearch(state.query);
    const graph = state.graph;
    const graphNodes = Array.isArray(graph?.nodes) ? graph.nodes : Array.isArray(state.nodes) ? state.nodes : [];
    if (cachedSearchContext
      && cachedSearchQuery === query
      && cachedSearchGraph === graph
      && cachedSearchNodeCount === graphNodes.length) return cachedSearchContext;

    const directRepositoryIds = new Set();
    const directCategoryIds = new Set();
    const contextCategoryIds = new Set();
    const categoryMemberIds = new Set();
    const matchReasons = new Map();
    const repositories = graphNodes.filter((node) => node?.type === "repository");
    const groups = graphNodes.filter((node) => node?.type === "group");
    const taxonomyById = new Map(
      (Array.isArray(graph?.searchTaxonomy?.categories) ? graph.searchTaxonomy.categories : [])
        .map((category) => [category.id, category]),
    );

    if (query) {
      for (const repo of repositories) {
        const reasons = directMatchReasons(repo, query);
        if (!reasons.length) continue;
        directRepositoryIds.add(repo.id);
        matchReasons.set(repo.id, reasons);
      }
      for (const group of groups) {
        if (!categoryMatches(group, query, taxonomyById)) continue;
        directCategoryIds.add(group.id);
        matchReasons.set(group.id, ["category"]);
      }

      for (const repo of repositories) {
        if (!directRepositoryIds.has(repo.id)) continue;
        const id = groupNodeId(repo.groupId);
        if (id) contextCategoryIds.add(id);
      }

      // Compatibility fallback for older graphs that have membership edges but
      // no repository.groupId field.
      for (const edge of Array.isArray(graph?.edges) ? graph.edges : []) {
        if (edge?.type !== "membership" || !directRepositoryIds.has(edge.target)) continue;
        if (typeof edge.source === "string" && edge.source.startsWith("group:")) contextCategoryIds.add(edge.source);
      }

      for (const id of directCategoryIds) contextCategoryIds.add(id);
      if (directCategoryIds.size) {
        for (const repo of repositories) {
          const id = groupNodeId(repo.groupId);
          if (id && directCategoryIds.has(id)) categoryMemberIds.add(repo.id);
        }
        for (const edge of Array.isArray(graph?.edges) ? graph.edges : []) {
          if (edge?.type === "membership" && directCategoryIds.has(edge.source)) categoryMemberIds.add(edge.target);
        }
      }
    }

    cachedSearchQuery = query;
    cachedSearchGraph = graph;
    cachedSearchNodeCount = graphNodes.length;
    cachedSearchContext = {
      query,
      directRepositoryIds,
      directCategoryIds,
      contextCategoryIds,
      categoryMemberIds,
      matchReasons,
    };
    return cachedSearchContext;
  }

  function searchLevel(node) {
    const context = currentSearchContext();
    if (!context.query || !node) return "all";
    if (node.type === "repository") {
      if (context.directRepositoryIds.has(node.id)) return "direct";
      if (context.categoryMemberIds.has(node.id)) return "category-member";
      return "none";
    }
    if (node.type === "group") {
      if (context.directCategoryIds.has(node.id)) return "direct-category";
      if (context.contextCategoryIds.has(node.id)) return "category-context";
    }
    return "none";
  }

  function searchContextMatches(node) {
    const level = searchLevel(node);
    return level !== "none";
  }

  function searchReasons(nodeOrId) {
    const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId?.id;
    return [...(currentSearchContext().matchReasons.get(id) || [])];
  }

  function directRepositoryNodes() {
    const context = currentSearchContext();
    const nodes = Array.isArray(state.nodes) ? state.nodes : Array.isArray(state.graph?.nodes) ? state.graph.nodes : [];
    return nodes.filter((node) => node?.type === "repository" && context.directRepositoryIds.has(node.id));
  }

  if (typeof matchesQuery === "function") {
    const baseMatchesQuery = matchesQuery;
    matchesQuery = function searchAwareMatchesQuery(node) {
      if (!state.query) return true;
      if (node && (node === state.selected || node === state.hovered)) return true;
      return searchContextMatches(node) || baseMatchesQuery(node);
    };
  }

  if (typeof matches === "function") {
    const baseMatches = matches;
    matches = function searchAwareMatches(node) {
      if (!state.query) return true;
      if (node && (node === state.selected || node === state.hovered)) return true;
      return searchContextMatches(node) || baseMatches(node);
    };
  }

  if (typeof nodeOpacity === "function") {
    const baseNodeOpacity = nodeOpacity;
    nodeOpacity = function searchAwareNodeOpacity(node) {
      const opacity = baseNodeOpacity(node);
      if (!state.query || !node || node === state.selected || node === state.hovered) return opacity;
      const level = searchLevel(node);
      if (level === "category-context") return Math.min(opacity, 0.76);
      if (level === "category-member") return Math.min(opacity, 0.72);
      return opacity;
    };
  }

  if (typeof updateDetails === "function") {
    const baseUpdateDetails = updateDetails;
    updateDetails = function searchAwareUpdateDetails(node) {
      baseUpdateDetails(node);
      if (!node || !state.query || typeof detailsMeta === "undefined" || !detailsMeta) return;
      const reasons = searchReasons(node);
      if (!reasons.length) return;
      const reasonText = `Match: ${reasons.join(" · ")}`;
      detailsMeta.textContent = detailsMeta.textContent ? `${detailsMeta.textContent} · ${reasonText}` : reasonText;
    };
  }

  function navigateDirectSearch(step) {
    const hits = directRepositoryNodes();
    if (!hits.length || typeof updateDetails !== "function") return null;
    const selectedId = state.selected?.id;
    const current = hits.findIndex((node) => node.id === selectedId);
    const next = current < 0
      ? (step > 0 ? 0 : hits.length - 1)
      : (current + step + hits.length) % hits.length;
    const target = hits[next];
    updateDetails(target);
    if (typeof draw === "function") draw();
    return target;
  }

  if (typeof searchInput !== "undefined" && searchInput) {
    searchInput.addEventListener("input", () => {
      if (state.selected && typeof updateDetails === "function") updateDetails(state.selected);
    });
    searchInput.addEventListener("keydown", (event) => {
      if (event.isComposing) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        navigateDirectSearch(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (event.key !== "Enter") return;
      const hits = directRepositoryNodes();
      if (!hits.length) return;
      event.preventDefault();
      const target = hits.find((node) => node.id === state.selected?.id) || hits[0];
      if (state.selected?.id !== target.id && typeof updateDetails === "function") updateDetails(target);
      if (target.url) window.open(target.url, "_blank", "noopener");
    });
  }

  window.ProjectMapSearchContext = {
    snapshot() {
      const context = currentSearchContext();
      return {
        query: context.query,
        directRepositoryIds: [...context.directRepositoryIds].sort(),
        directCategoryIds: [...context.directCategoryIds].sort(),
        contextCategoryIds: [...context.contextCategoryIds].sort(),
        categoryMemberIds: [...context.categoryMemberIds].sort(),
        matchReasons: Object.fromEntries([...context.matchReasons.entries()].sort(([a], [b]) => a.localeCompare(b))),
      };
    },
    level(nodeOrId) {
      const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId?.id;
      const nodes = Array.isArray(state.graph?.nodes) ? state.graph.nodes : Array.isArray(state.nodes) ? state.nodes : [];
      const node = typeof nodeOrId === "object" && nodeOrId ? nodeOrId : nodes.find((item) => item.id === id);
      return searchLevel(node);
    },
    matches(nodeOrId) {
      const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId?.id;
      const nodes = Array.isArray(state.graph?.nodes) ? state.graph.nodes : Array.isArray(state.nodes) ? state.nodes : [];
      const node = typeof nodeOrId === "object" && nodeOrId ? nodeOrId : nodes.find((item) => item.id === id);
      return searchContextMatches(node);
    },
    reasons(nodeOrId) {
      return searchReasons(nodeOrId);
    },
    directRepositories() {
      return directRepositoryNodes().map((node) => node.id);
    },
  };

  if (isExploratoryStyle(state.style)
    && typeof sanitizeGraph === "function"
    && typeof rebuildLayout === "function"
    && typeof drawEdges === "function"
    && typeof worldToScreen === "function") {
    const baseSanitizeGraph = sanitizeGraph;
    sanitizeGraph = function semanticAwareSanitizeGraph(value) {
      const safe = baseSanitizeGraph(value);
      if (!safe || !Array.isArray(value?.semanticEdges)) return safe;
      const repositoryIds = new Set(safe.nodes.filter((node) => node.type === "repository").map((node) => node.id));
      const spatialCore = window.ProjectMapSpatialCore;
      if (!spatialCore) throw new Error("Spatial Core runtime must load before semantic normalization");
      const semanticCandidates = [];
      for (const raw of value.semanticEdges.slice(0, 2400)) {
        if (!raw || typeof raw !== "object" || raw.type !== "semantic") continue;
        const source = typeof raw.source === "string" ? raw.source.slice(0, 220) : "";
        const target = typeof raw.target === "string" ? raw.target.slice(0, 220) : "";
        semanticCandidates.push({ source, target, score: Number(raw.score) });
      }
      const semanticEdges = spatialCore.normalizeWeightedEdges(semanticCandidates, repositoryIds, {
        maxInput: 2400,
        maxOutput: 1200,
        minScore: 0,
        type: "semantic",
      });
      if (semanticEdges.length) safe.semanticEdges = semanticEdges;
      return safe;
    };

    if (typeof buildObsidianLayout === "function") {
      const baseBuildObsidianLayout = buildObsidianLayout;
      buildObsidianLayout = function semanticAwareObsidianLayout(graph) {
        if (!Array.isArray(graph?.semanticEdges) || !graph.semanticEdges.length) return baseBuildObsidianLayout(graph);
        const semanticRelations = graph.semanticEdges.map((edge) => ({ source: edge.source, target: edge.target, type: "relation" }));
        return baseBuildObsidianLayout({ ...graph, edges: [...graph.edges, ...semanticRelations] });
      };
    }

    const baseRebuildLayout = rebuildLayout;
    rebuildLayout = function semanticAwareRebuildLayout(options) {
      baseRebuildLayout(options);
      if (Array.isArray(state.graph?.semanticEdges) && state.graph.semanticEdges.length) {
        state.edges = [...state.graph.edges, ...state.graph.semanticEdges];
        if (typeof draw === "function") draw();
      }
    };

    function installSemanticDrawLayer() {
      if (drawEdges?.semanticLayer === true) return;
      const baseDrawEdges = drawEdges;
      const semanticAwareDrawEdges = function semanticAwareDrawEdges(colors) {
        const allEdges = state.edges;
        const semanticEdges = Array.isArray(allEdges) ? allEdges.filter((edge) => edge.type === "semantic") : [];
        if (!semanticEdges.length) {
          baseDrawEdges(colors);
          return;
        }

        try {
          state.edges = allEdges.filter((edge) => edge.type !== "semantic");
          baseDrawEdges(colors);
        } finally {
          state.edges = allEdges;
        }

        const focus = state.selected || state.hovered;
        for (const edge of semanticEdges) {
          const a = state.byId.get(edge.source);
          const b = state.byId.get(edge.target);
          if (!a || !b) continue;
          const incident = Boolean(focus && (a === focus || b === focus));
          const score = Number.isFinite(edge.score) ? Math.max(0, Math.min(1, edge.score)) : 0;
          let opacity = state.style === "obsidian" ? 0.22 + score * 0.22 : 0.035 + score * 0.085;
          if (focus) opacity = incident ? (state.selected ? 0.94 : 0.62) : (state.selected ? 0.018 : 0.035);
          if (state.query && typeof matchesQuery === "function" && !(matchesQuery(a) || matchesQuery(b))) opacity *= 0.16;
          if (opacity <= 0.001) continue;
          const source = worldToScreen(a.x, a.y);
          const target = worldToScreen(b.x, b.y);
          ctx.save();
          ctx.globalAlpha = opacity;
          ctx.strokeStyle = colors.relation || colors.edge;
          ctx.lineWidth = incident && state.selected ? 2.4 : state.style === "obsidian" ? 1.35 : 1.15;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
          ctx.restore();
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      };
      semanticAwareDrawEdges.semanticLayer = true;
      drawEdges = semanticAwareDrawEdges;
    }

    if (document.readyState === "loading") {
      // Galaxy Systems/Hybrid install their structural edge policy on
      // DOMContentLoaded. Register later so semantic drawing wraps that final policy.
      window.addEventListener("DOMContentLoaded", installSemanticDrawLayer, { once: true });
    } else {
      installSemanticDrawLayer();
    }

    window.ProjectMapSemanticEdges = {
      count: () => Array.isArray(state.graph?.semanticEdges) ? state.graph.semanticEdges.length : 0,
      edges: () => Array.isArray(state.graph?.semanticEdges) ? state.graph.semanticEdges.map((edge) => ({ ...edge })) : [],
    };
  }

  const blankPointers = new Map();
  if (typeof hitTest === "function" && typeof updateDetails === "function") {
    canvas.addEventListener("pointerdown", (event) => {
      const point = canvasPoint(event);
      blankPointers.set(event.pointerId, {
        start: point,
        moved: false,
        blank: !hitTest(point.x, point.y),
      });
    }, true);

    canvas.addEventListener("pointermove", (event) => {
      const gesture = blankPointers.get(event.pointerId);
      if (!gesture || gesture.moved) return;
      const point = canvasPoint(event);
      if (Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y) >= 6) gesture.moved = true;
    }, true);

    canvas.addEventListener("pointerup", (event) => {
      const gesture = blankPointers.get(event.pointerId);
      blankPointers.delete(event.pointerId);
      if (!gesture || gesture.moved || !gesture.blank) return;
      const point = canvasPoint(event);
      if (!hitTest(point.x, point.y)) updateDetails(null);
    }, true);

    canvas.addEventListener("pointercancel", (event) => blankPointers.delete(event.pointerId), true);
    canvas.addEventListener("lostpointercapture", (event) => blankPointers.delete(event.pointerId), true);
  }

  canvas.addEventListener("pointermove", (event) => {
    if (!isGalaxyPresentationStyle(state.style) || state.pointers.size !== 1 || !state.drag || !state.pointers.has(event.pointerId)) return;
    const point = canvasPoint(event);
    state.pointers.set(event.pointerId, point);
    const distance = Math.hypot(point.x - state.down.x, point.y - state.down.y);
    if (distance < 6) {
      event.stopImmediatePropagation();
      return;
    }
    state.moved = true;
    state.drag = null;
    state.panning = true;
    state.last = state.down;
  }, true);
})();