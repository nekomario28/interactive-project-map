"use strict";
/* global username, state, draw, updateDetails, ctx, worldToScreen, nodeRadius, nodeOpacity, detailsMeta */

(() => {
  const QUALITY_PARAM = "quality";
  const QUALITY_ENABLED_VALUE = "1";
  const DIMENSION_ORDER = Object.freeze([
    "understandability",
    "verification",
    "reproducibility",
    "maintainability",
    "integrity",
    "interoperability",
    "security-safety",
    "stewardship",
  ]);
  const TARGET_APPLICABILITY = new Set(["required", "recommended"]);
  const APPLICABILITY = new Set(["required", "recommended", "optional", "not-applicable", "unknown"]);
  const FINDINGS = new Set(["supports", "neutral", "weakens", "mixed", "unknown"]);
  const INSPECTED_EVIDENCE = new Set(["observed", "absent", "stale", "conflicting"]);
  const AVAILABLE_QUALITY = new Set(["observed", "partial"]);
  const COMPACT_FINDING_ORDER = Object.freeze(["supports", "neutral", "weakens", "mixed", "unknown"]);
  const SECTION_STATES = new Set(["observed", "partial", "not-collected", "not-applicable", "unknown"]);
  const REPOSITORY_KEY_RE = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?\/[a-z0-9._-]{1,100}$/;

  const query = new URL(location.href).searchParams;
  const requested = query.get(QUALITY_PARAM) === QUALITY_ENABLED_VALUE;
  const overlays = new Map();
  const runtime = {
    requested,
    state: requested ? "loading" : "disabled",
    assessmentUrl: null,
    available: 0,
    unavailable: 0,
    detached: 0,
    lastDrawnRings: 0,
    error: null,
  };

  function snapshot() {
    return {
      requested: runtime.requested,
      state: runtime.state,
      assessmentUrl: runtime.assessmentUrl,
      available: runtime.available,
      unavailable: runtime.unavailable,
      detached: runtime.detached,
      lastDrawnRings: runtime.lastDrawnRings,
      error: runtime.error,
      featureGate: "query-param",
      defaultAdditionalRequests: 0,
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

  function stringArray(value, label) {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item)) throw new Error(`${label} must be a string array`);
    return value;
  }

  function ratio(numerator, denominator) {
    return denominator === 0 ? null : numerator / denominator;
  }

  function cleanRepositoryKey(value) {
    const key = String(value || "").toLowerCase();
    if (!REPOSITORY_KEY_RE.test(key)) throw new Error("repositoryKey is invalid");
    return key;
  }

  function prettyDimension(id) {
    return id
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" / ");
  }

  function findingStyle(findingState) {
    const obsidian = state?.style === "obsidian";
    const palette = obsidian
      ? {
          supports: ["#67b7a7", []],
          neutral: ["#d7a75b", [2, 2]],
          weakens: ["#d9847b", [5, 2]],
          mixed: ["#c4b5fd", [5, 2, 1, 2]],
          unknown: ["#7f8898", [1, 3]],
        }
      : {
          supports: ["#57d17a", []],
          neutral: ["#f4b65f", [2, 2]],
          weakens: ["#ff8d85", [5, 2]],
          mixed: ["#b59aff", [5, 2, 1, 2]],
          unknown: ["#71809a", [1, 3]],
        };
    const [stroke, dash] = palette[findingState] || palette.unknown;
    return { stroke, dash };
  }

  function buildOverlay(repository) {
    const quality = object(repository.quality, "repository.quality");
    if (!SECTION_STATES.has(quality.state)) throw new Error("repository.quality.state is unsupported");
    if (!AVAILABLE_QUALITY.has(quality.state)) {
      if (quality.value != null) throw new Error("unavailable Quality section must not contain a value");
      return {
        overlayState: "unavailable",
        qualitySectionState: quality.state,
        overlay: null,
      };
    }

    const vector = object(quality.value, "repository.quality.value");
    if (vector.schemaVersion !== 1) throw new Error("Quality vector schemaVersion is unsupported");
    const context = object(repository.context, "repository.context");
    const artifactContext = object(context.artifacts, "repository.context.artifacts");
    if (!["observed", "partial"].includes(artifactContext.state)) throw new Error("Quality overlay requires resolved artifact context");
    const contextArtifacts = new Set(stringArray(artifactContext.values, "repository.context.artifacts.values"));
    const qualityArtifacts = stringArray(vector.artifacts, "repository.quality.value.artifacts");
    if (!qualityArtifacts.length) throw new Error("Quality vector must declare at least one artifact");
    for (const artifact of qualityArtifacts) {
      if (!contextArtifacts.has(artifact)) throw new Error(`Quality artifact ${artifact} is not present in repository context`);
    }

    const dimensions = object(vector.dimensions, "repository.quality.value.dimensions");
    const segments = [];
    const targetFindingCounts = { supports: 0, neutral: 0, weakens: 0, mixed: 0, unknown: 0 };
    let inspectedDimensions = 0;
    let directionalDimensions = 0;
    let targetDimensions = 0;

    for (let slot = 0; slot < DIMENSION_ORDER.length; slot += 1) {
      const id = DIMENSION_ORDER[slot];
      const dimension = object(dimensions[id], `repository.quality.value.dimensions.${id}`);
      if (!APPLICABILITY.has(dimension.applicability)) throw new Error(`unsupported applicability for ${id}`);
      if (!FINDINGS.has(dimension.findingState)) throw new Error(`unsupported findingState for ${id}`);
      const evidence = Array.isArray(dimension.evidence) ? dimension.evidence : [];
      const inspected = evidence.some((entry) => entry && typeof entry === "object" && INSPECTED_EVIDENCE.has(entry.state));
      const directional = dimension.findingState !== "unknown";
      const target = TARGET_APPLICABILITY.has(dimension.applicability);
      if (target) {
        targetDimensions += 1;
        targetFindingCounts[dimension.findingState] += 1;
        if (inspected) inspectedDimensions += 1;
        if (directional) directionalDimensions += 1;
      }
      segments.push({
        id,
        slot,
        applicability: dimension.applicability,
        findingState: dimension.findingState,
        target,
        inspected,
        directional,
      });
    }

    const extraDimensions = Object.keys(dimensions).filter((id) => !DIMENSION_ORDER.includes(id));
    if (extraDimensions.length) throw new Error(`unsupported Quality dimensions: ${extraDimensions.join(", ")}`);

    return {
      overlayState: "available",
      qualitySectionState: quality.state,
      overlay: {
        schemaVersion: 1,
        mode: "quality-evidence-overlay",
        segments,
        targetFindingCounts,
        compactDistribution: {
          mode: "target-finding-distribution",
          denominator: targetDimensions,
          findingOrder: [...COMPACT_FINDING_ORDER],
          segments: COMPACT_FINDING_ORDER.map((findingState) => ({
            findingState,
            count: targetFindingCounts[findingState],
            ratio: ratio(targetFindingCounts[findingState], targetDimensions),
          })),
          dimensionIdentityPreserved: false,
          requiresDetailForDimensionIdentity: true,
        },
        coverage: {
          targetDimensions,
          inspectedDimensions,
          directionalDimensions,
          inspectedCoverageRatio: ratio(inspectedDimensions, targetDimensions),
          directionalCoverageRatio: ratio(directionalDimensions, targetDimensions),
          label: `${directionalDimensions}/${targetDimensions} interpreted`,
        },
        visualContract: {
          nodeSizeEffect: "none",
          labelPriorityEffect: "none",
          impactHaloEffect: "none",
          productionRankingAllowed: false,
        },
      },
    };
  }

  function sanitizeAssessment(value) {
    const artifact = object(value, "assessment");
    if (artifact.schemaVersion !== 1) throw new Error("assessment schemaVersion is unsupported");
    if (artifact.contractId !== "ipm-repository-assessment-artifact-v1") throw new Error("assessment contractId is unsupported");
    if (String(artifact.owner || "").toLowerCase() !== String(username || "").toLowerCase()) throw new Error("assessment owner does not match viewer owner");
    if (artifact.assessmentPolicyId !== "ipm-repository-assessment-v1") throw new Error("assessment policy is unsupported");
    if (artifact.productionScoring !== false) throw new Error("assessment productionScoring must remain false");
    if (!Array.isArray(artifact.repositories) || artifact.repositories.length > 400) throw new Error("assessment repositories are invalid or too large");

    const result = new Map();
    const keys = new Set();
    for (const raw of artifact.repositories) {
      const repository = object(raw, "assessment repository");
      const identity = object(repository.identity, "assessment repository.identity");
      const repositoryKey = cleanRepositoryKey(identity.repositoryKey);
      if (keys.has(repositoryKey)) throw new Error(`duplicate assessment repositoryKey: ${repositoryKey}`);
      keys.add(repositoryKey);
      const graphNodeId = String(identity.graphNodeId || "").slice(0, 180);
      if (!graphNodeId.startsWith("repository:")) throw new Error("assessment graphNodeId is invalid");
      const item = buildOverlay(repository);
      result.set(graphNodeId, {
        repositoryKey,
        graphNodeId,
        ...item,
      });
    }
    return result;
  }

  function setRuntimeState(nextState, error = null) {
    runtime.state = nextState;
    runtime.error = error;
    document.body.dataset.qualityMode = nextState;
  }

  function drawCompactRing(node, item) {
    const compact = item.overlay?.compactDistribution;
    if (!compact || compact.denominator <= 0) return false;
    const point = worldToScreen(node.x, node.y);
    const baseRadius = Math.max(3.5, nodeRadius(node) * state.zoom);
    const radius = baseRadius + 7;
    const lineWidth = 2.4;
    let start = -Math.PI / 2;
    const opacity = typeof nodeOpacity === "function" ? Math.max(0.16, nodeOpacity(node)) : 1;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.lineCap = "butt";
    for (const segment of compact.segments) {
      if (!segment.count || !Number.isFinite(segment.ratio) || segment.ratio <= 0) continue;
      const sweep = Math.PI * 2 * segment.ratio;
      const end = start + sweep;
      const gap = Math.min(0.035, sweep * 0.12);
      const style = findingStyle(segment.findingState);
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = lineWidth;
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
    if (runtime.state !== "active" || !state.graph) {
      runtime.lastDrawnRings = 0;
      return;
    }
    let drawn = 0;
    for (const node of state.nodes) {
      if (node?.type !== "repository") continue;
      const item = overlays.get(node.id);
      if (item?.overlayState !== "available") continue;
      if (drawCompactRing(node, item)) drawn += 1;
    }
    runtime.lastDrawnRings = drawn;
  }

  const baseDraw = draw;
  draw = function qualityViewDraw() {
    baseDraw();
    drawQualityRings();
  };

  function appendDetailsRow(key, value) {
    const dt = document.createElement("dt");
    dt.textContent = key;
    const dd = document.createElement("dd");
    dd.textContent = value;
    detailsMeta.append(dt, dd);
  }

  function findingSummary(overlay) {
    return COMPACT_FINDING_ORDER
      .map((findingState) => [findingState, overlay.targetFindingCounts[findingState] || 0])
      .filter(([, count]) => count > 0)
      .map(([findingState, count]) => `${findingState} ${count}`)
      .join(" · ");
  }

  function dimensionSummary(overlay) {
    return overlay.segments
      .filter((segment) => segment.target)
      .map((segment) => `${prettyDimension(segment.id)}: ${segment.findingState}`)
      .join(" · ");
  }

  const baseUpdateDetails = updateDetails;
  updateDetails = function qualityViewUpdateDetails(node) {
    baseUpdateDetails(node);
    if (runtime.state !== "active" || node?.type !== "repository") return;
    const item = overlays.get(node.id);
    if (!item) return;
    if (item.overlayState !== "available") {
      appendDetailsRow("Quality evidence", item.qualitySectionState === "not-collected" ? "Not collected" : "Unavailable");
      detailsMeta.hidden = false;
      return;
    }
    appendDetailsRow("Quality evidence", item.overlay.coverage.label);
    appendDetailsRow("Quality findings", findingSummary(item.overlay));
    appendDetailsRow("Quality dimensions", dimensionSummary(item.overlay));
    detailsMeta.hidden = false;
  };

  async function loadAssessment() {
    if (typeof username !== "string" || !username) {
      setRuntimeState("unavailable", "viewer owner is unavailable");
      return;
    }
    const owner = encodeURIComponent(username);
    const assessmentUrl = `https://raw.githubusercontent.com/${owner}/${owner}/HEAD/project-map/assessment.json`;
    runtime.assessmentUrl = assessmentUrl;
    try {
      const response = await fetch(assessmentUrl, { cache: "no-cache" });
      if (!response.ok) {
        setRuntimeState("unavailable", `assessment.json returned ${response.status}`);
        draw();
        return;
      }
      const projection = sanitizeAssessment(await response.json());
      overlays.clear();
      for (const [graphNodeId, item] of projection) overlays.set(graphNodeId, item);
      runtime.available = [...projection.values()].filter((item) => item.overlayState === "available").length;
      runtime.unavailable = projection.size - runtime.available;
      runtime.detached = state.graph
        ? [...projection.keys()].filter((graphNodeId) => !state.graph.nodes.some((node) => node.id === graphNodeId)).length
        : 0;
      setRuntimeState("active");
      if (state.selected) updateDetails(state.selected);
      draw();
    } catch (error) {
      overlays.clear();
      runtime.available = 0;
      runtime.unavailable = 0;
      setRuntimeState("unavailable", error instanceof Error ? error.message : String(error));
      draw();
    }
  }

  loadAssessment();
})();
