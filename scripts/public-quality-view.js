"use strict";
/* global username, state, draw, updateDetails, ctx, worldToScreen, nodeRadius, nodeOpacity, detailsMeta */

(() => {
  const query = new URL(location.href).searchParams;
  const requested = query.get("quality") === "1";
  const FINDING_ORDER = Object.freeze(["supports", "neutral", "weakens", "mixed", "unknown"]);
  const FINDINGS = new Set(FINDING_ORDER);
  const overlays = new Map();
  let pendingPresentation = null;

  const runtime = {
    requested,
    state: requested ? "loading" : "disabled",
    presentationUrl: null,
    available: 0,
    unavailable: 0,
    lastDrawnRings: 0,
    error: null,
  };

  function snapshot() {
    return {
      ...runtime,
      featureGate: "query-param",
      defaultAdditionalRequests: 0,
      semanticSource: "renderer-neutral-presentation",
      geometryAuthority: "overlay-only",
      productionRankingAllowed: false,
    };
  }

  window.ProjectMapQualityView = Object.freeze({ snapshot });
  document.body.dataset.qualityMode = runtime.state;
  if (!requested) return;

  function object(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
    return value;
  }

  function unit(value, label) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be in [0,1]`);
    return value;
  }

  function sanitizeFrozenEvidenceFreshness(value, label) {
    if (value == null) return null;
    const freshness = object(value, label);
    const snapshotDate = typeof freshness.snapshotDate === "string" ? freshness.snapshotDate : "";
    if (freshness.state !== "frozen-snapshot" || freshness.automaticRefresh !== false || !/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate)) {
      throw new Error(`${label} must describe a non-auto-refreshed frozen snapshot`);
    }
    const parsed = new Date(`${snapshotDate}T00:00:00Z`);
    if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== snapshotDate) {
      throw new Error(`${label}.snapshotDate is invalid`);
    }
    return { state: "frozen-snapshot", snapshotDate, automaticRefresh: false };
  }

  function setState(next, error = null) {
    runtime.state = next;
    runtime.error = error;
    document.body.dataset.qualityMode = next;
  }

  function validateVisualPolicy(value) {
    const policy = object(value, "repository.visualPolicy");
    if (policy.repositoryCore !== "inherit-structure-renderer") throw new Error("Quality presentation cannot replace repository core geometry");
    for (const key of ["placementEffect", "nodeSizeEffect", "labelPriorityEffect", "impactHaloEffect"]) {
      if (policy[key] !== "none") throw new Error(`Quality presentation ${key} must remain none`);
    }
  }

  function sanitizeCoverage(value, label) {
    const coverage = object(value, label);
    const targetDimensions = Number(coverage.targetDimensions);
    const interpreted = Number(coverage.directionalDimensions);
    if (!Number.isSafeInteger(targetDimensions) || targetDimensions < 0 || targetDimensions > 8) throw new Error(`${label}.targetDimensions is invalid`);
    if (!Number.isSafeInteger(interpreted) || interpreted < 0 || interpreted > targetDimensions) throw new Error(`${label}.directionalDimensions is invalid`);
    const text = typeof coverage.label === "string" ? coverage.label.slice(0, 80) : `${interpreted}/${targetDimensions} interpreted`;
    return { targetDimensions, directionalDimensions: interpreted, label: text };
  }

  function sanitizeCompact(value) {
    const compact = object(value, "repository.views.compact");
    if (compact.mode !== "target-finding-distribution") throw new Error("compact Quality view mode is unsupported");
    if (compact.dimensionIdentityPreserved !== false || compact.requiresDetailForDimensionIdentity !== true) {
      throw new Error("compact Quality view identity contract is invalid");
    }
    const denominator = Number(compact.denominator);
    if (!Number.isSafeInteger(denominator) || denominator < 0 || denominator > 8) throw new Error("compact Quality denominator is invalid");
    if (!Array.isArray(compact.segments)) throw new Error("compact Quality segments must be an array");
    const seen = new Set();
    const segments = compact.segments.map((raw, index) => {
      const segment = object(raw, `compact segment ${index}`);
      const findingState = String(segment.findingState || "");
      if (!FINDINGS.has(findingState) || seen.has(findingState)) throw new Error("compact Quality finding states are invalid or duplicated");
      seen.add(findingState);
      const count = Number(segment.count);
      if (!Number.isSafeInteger(count) || count < 0 || count > denominator) throw new Error("compact Quality segment count is invalid");
      const ratio = unit(Number(segment.ratio), "compact Quality segment ratio");
      if (denominator === 0) {
        if (count !== 0 || ratio !== 0) throw new Error("compact Quality zero-denominator distribution must be empty");
      } else if (Math.abs(ratio - count / denominator) > 1e-6) {
        throw new Error("compact Quality segment ratio does not match count/denominator");
      }
      return { findingState, count, ratio };
    });
    if (segments.length !== FINDING_ORDER.length || FINDING_ORDER.some((id) => !seen.has(id))) throw new Error("compact Quality finding distribution is incomplete");
    const countTotal = segments.reduce((sum, segment) => sum + segment.count, 0);
    if (countTotal !== denominator) throw new Error("compact Quality segment counts do not match denominator");
    const ratioTotal = segments.reduce((sum, segment) => sum + segment.ratio, 0);
    if ((denominator === 0 && ratioTotal !== 0) || (denominator > 0 && Math.abs(ratioTotal - 1) > 1e-6)) {
      throw new Error("compact Quality segment ratios do not match denominator");
    }
    return {
      mode: compact.mode,
      denominator,
      segments,
      coverage: sanitizeCoverage(compact.coverage, "repository.views.compact.coverage"),
      attentionState: typeof compact.attentionState === "string" ? compact.attentionState.slice(0, 80) : "",
    };
  }

  function sanitizeDetail(value) {
    const detail = object(value, "repository.views.detail");
    if (detail.mode !== "full-fixed-dimension-ring" || detail.dimensionIdentityPreserved !== true) throw new Error("detail Quality view mode is unsupported");
    if (!Array.isArray(detail.segments) || detail.segments.length !== 8) throw new Error("detail Quality view must expose eight dimension slots");
    const ids = new Set();
    const segments = detail.segments.map((raw, index) => {
      const segment = object(raw, `detail segment ${index}`);
      const id = typeof segment.id === "string" ? segment.id.slice(0, 80) : "";
      const findingState = typeof segment.findingState === "string" ? segment.findingState : "";
      if (!id || ids.has(id) || !FINDINGS.has(findingState)) throw new Error("detail Quality segment is invalid");
      ids.add(id);
      return {
        id,
        slot: Number.isSafeInteger(segment.slot) ? segment.slot : index,
        target: segment.target === true,
        findingState,
        token: typeof segment.token === "string" ? segment.token.slice(0, 80) : `quality-${findingState}`,
      };
    });
    return {
      mode: detail.mode,
      segments,
      coverage: sanitizeCoverage(detail.coverage, "repository.views.detail.coverage"),
      attentionState: typeof detail.attentionState === "string" ? detail.attentionState.slice(0, 80) : "",
    };
  }

  function unavailable(reason) {
    return {
      overlayState: "unavailable",
      unavailableReason: typeof reason === "string" && reason ? reason.slice(0, 80) : "not-collected",
      views: null,
    };
  }

  function sanitizeRepository(raw, index) {
    const entry = object(raw, `presentation.repositories[${index}]`);
    const graphNodeId = typeof entry.graphNodeId === "string" ? entry.graphNodeId.slice(0, 180) : "";
    const repositoryKey = typeof entry.repositoryKey === "string" ? entry.repositoryKey.toLowerCase().slice(0, 160) : "";
    if (!graphNodeId.startsWith("repository:") || !repositoryKey.includes("/")) throw new Error("presentation repository identity is invalid");
    validateVisualPolicy(entry.visualPolicy);

    if (entry.overlayState !== "available") {
      const compact = object(entry.views?.compact, "unavailable compact view");
      const detail = object(entry.views?.detail, "unavailable detail view");
      if (compact.mode !== "unavailable" || detail.mode !== "unavailable" || compact.token !== "quality-unavailable" || detail.token !== "quality-unavailable") {
        throw new Error("unavailable Quality presentation token is invalid");
      }
      return { graphNodeId, repositoryKey, ...unavailable(entry.unavailableReason) };
    }

    return {
      graphNodeId,
      repositoryKey,
      overlayState: "available",
      unavailableReason: null,
      evidenceFreshness: sanitizeFrozenEvidenceFreshness(entry.evidenceFreshness, `presentation.repositories[${index}].evidenceFreshness`),
      views: {
        compact: sanitizeCompact(entry.views?.compact),
        detail: sanitizeDetail(entry.views?.detail),
      },
    };
  }

  function sanitizePresentation(value) {
    const model = object(value, "Quality presentation");
    if (model.schemaVersion !== 1 || model.presentationId !== "ipm-repository-quality-presentation-v1") throw new Error("Quality presentation root contract is unsupported");
    if (model.status !== "experimental-non-default") throw new Error("Quality presentation must remain experimental-non-default");
    const source = object(model.source, "Quality presentation source");
    if (String(source.graphOwner || "").toLowerCase() !== String(username || "").toLowerCase()) throw new Error("Quality presentation owner does not match viewer owner");
    const graphGeneratedAt = typeof source.graphGeneratedAt === "string" && source.graphGeneratedAt ? source.graphGeneratedAt : null;
    const modePolicy = object(model.modePolicy, "Quality presentation modePolicy");
    if (modePolicy.defaultProductModeRemains !== "structure" || modePolicy.qualityMode !== "experimental-non-default") throw new Error("Quality presentation mode policy is unsupported");
    if (modePolicy.qualityChangesNodeSize !== false || modePolicy.qualityChangesPlacement !== false || modePolicy.qualityChangesLabelPriority !== false || modePolicy.qualityChangesImpactHalo !== false) {
      throw new Error("Quality presentation exceeds its visual authority");
    }
    if (!Array.isArray(model.repositories) || model.repositories.length > 400) throw new Error("Quality presentation repositories are invalid or too large");
    const repositories = new Map();
    for (let index = 0; index < model.repositories.length; index += 1) {
      const entry = sanitizeRepository(model.repositories[index], index);
      if (repositories.has(entry.graphNodeId)) throw new Error(`duplicate presentation graphNodeId: ${entry.graphNodeId}`);
      repositories.set(entry.graphNodeId, entry);
    }
    return { graphGeneratedAt, repositories };
  }

  function graphRepositoryIds() {
    if (!state.graph) return null;
    return new Set((state.graph.nodes || []).filter((node) => node?.type === "repository").map((node) => node.id));
  }

  function activateIfReady() {
    if (!pendingPresentation || runtime.state !== "loading") return false;
    const graphIds = graphRepositoryIds();
    if (!graphIds) return false;
    const graphGeneratedAt = typeof state.graph.generatedAt === "string" && state.graph.generatedAt ? state.graph.generatedAt : null;
    if (!graphGeneratedAt || !pendingPresentation.graphGeneratedAt || graphGeneratedAt !== pendingPresentation.graphGeneratedAt) {
      throw new Error("Quality presentation graphGeneratedAt does not match the loaded graph");
    }
    const repositories = pendingPresentation.repositories;
    if (graphIds.size !== repositories.size) throw new Error(`Quality presentation join mismatch: graph=${graphIds.size} presentation=${repositories.size}`);
    for (const id of graphIds) if (!repositories.has(id)) throw new Error(`Quality presentation missing graph repository: ${id}`);
    for (const id of repositories.keys()) if (!graphIds.has(id)) throw new Error(`Quality presentation contains orphan repository: ${id}`);
    overlays.clear();
    for (const [id, entry] of repositories) overlays.set(id, entry);
    runtime.available = [...overlays.values()].filter((entry) => entry.overlayState === "available").length;
    runtime.unavailable = overlays.size - runtime.available;
    pendingPresentation = null;
    setState("active");
    return true;
  }

  function ringStyle(findingState) {
    const obsidian = state?.style === "obsidian";
    const colors = obsidian
      ? { supports: "#67b7a7", neutral: "#d7a75b", weakens: "#d9847b", mixed: "#c4b5fd", unknown: "#7f8898" }
      : { supports: "#57d17a", neutral: "#f4b65f", weakens: "#ff8d85", mixed: "#b59aff", unknown: "#71809a" };
    const dashes = { supports: [], neutral: [2, 2], weakens: [5, 2], mixed: [5, 2, 1, 2], unknown: [1, 3] };
    return { color: colors[findingState] || colors.unknown, dash: dashes[findingState] || dashes.unknown };
  }

  function drawCompactRing(node, entry) {
    const compact = entry.views?.compact;
    if (!compact || compact.denominator <= 0) return false;
    const point = worldToScreen(node.x, node.y);
    const baseRadius = Math.max(3.5, nodeRadius(node) * state.zoom);
    const radius = baseRadius + 7;
    let start = -Math.PI / 2;
    const opacity = typeof nodeOpacity === "function" ? Math.max(0.16, nodeOpacity(node)) : 1;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "butt";
    for (const segment of compact.segments) {
      if (segment.ratio <= 0) continue;
      const end = start + Math.PI * 2 * segment.ratio;
      const gap = Math.min(0.035, (end - start) * 0.12);
      const style = ringStyle(segment.findingState);
      ctx.strokeStyle = style.color;
      ctx.setLineDash(style.dash);
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, start + gap, end - gap);
      ctx.stroke();
      start = end;
    }
    ctx.restore();
    return true;
  }

  function drawQualityRings() {
    if (runtime.state !== "active") {
      runtime.lastDrawnRings = 0;
      return;
    }
    let count = 0;
    for (const node of state.nodes || []) {
      if (node?.type !== "repository") continue;
      const entry = overlays.get(node.id);
      if (entry?.overlayState === "available" && drawCompactRing(node, entry)) count += 1;
    }
    runtime.lastDrawnRings = count;
  }

  const baseDraw = draw;
  draw = function qualityPresentationDraw() {
    baseDraw();
    if (runtime.state === "loading" && pendingPresentation) {
      try {
        activateIfReady();
      } catch (error) {
        overlays.clear();
        pendingPresentation = null;
        setState("unavailable", error instanceof Error ? error.message : String(error));
      }
    }
    drawQualityRings();
  };

  function appendDetail(key, value) {
    const dt = document.createElement("dt");
    dt.textContent = key;
    const dd = document.createElement("dd");
    dd.textContent = value;
    detailsMeta.append(dt, dd);
  }

  function findingSummary(compact) {
    return compact.segments
      .filter((segment) => segment.count > 0)
      .map((segment) => `${segment.findingState} ${segment.count}`)
      .join(" · ");
  }

  function dimensionSummary(detail) {
    return detail.segments
      .filter((segment) => segment.target)
      .map((segment) => `${segment.id}: ${segment.findingState}`)
      .join(" · ");
  }

  const baseUpdateDetails = updateDetails;
  updateDetails = function qualityPresentationUpdateDetails(node) {
    baseUpdateDetails(node);
    if (runtime.state !== "active" || node?.type !== "repository") return;
    const entry = overlays.get(node.id);
    if (!entry) return;
    if (entry.overlayState !== "available") {
      appendDetail("Quality evidence", entry.unavailableReason === "not-collected" ? "Not collected" : "Unavailable");
      detailsMeta.hidden = false;
      return;
    }
    appendDetail("Quality evidence", entry.views.detail.coverage.label);
    if (entry.evidenceFreshness) {
      appendDetail("Quality evidence snapshot", `${entry.evidenceFreshness.snapshotDate} · frozen · not automatically refreshed`);
    }
    appendDetail("Quality findings", findingSummary(entry.views.compact));
    appendDetail("Quality dimensions", dimensionSummary(entry.views.detail));
    detailsMeta.hidden = false;
  };

  async function loadPresentation() {
    if (typeof username !== "string" || !username) {
      setState("unavailable", "viewer owner is unavailable");
      return;
    }
    const owner = encodeURIComponent(username);
    const url = `https://raw.githubusercontent.com/${owner}/${owner}/HEAD/project-map/quality-presentation.json`;
    runtime.presentationUrl = url;
    try {
      const response = await fetch(url, { cache: "no-cache" });
      if (!response.ok) {
        setState("unavailable", `quality-presentation.json returned ${response.status}`);
        draw();
        return;
      }
      pendingPresentation = sanitizePresentation(await response.json());
      if (activateIfReady()) draw();
    } catch (error) {
      overlays.clear();
      pendingPresentation = null;
      setState("unavailable", error instanceof Error ? error.message : String(error));
      draw();
    }
  }

  loadPresentation();
})();
