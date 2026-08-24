function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function displayLabel(value) {
  const label = String(value ?? "");
  return label.length <= 23 ? label : `${label.slice(0, 22)}…`;
}

function polar(cx, cy, radius, degrees) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function arcPath(cx, cy, radius, startDegrees, endDegrees) {
  const start = polar(cx, cy, radius, startDegrees);
  const end = polar(cx, cy, radius, endDegrees);
  const largeArc = endDegrees - startDegrees > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function detailRing(view, cx, cy) {
  if (view.mode !== "full-fixed-dimension-ring" || !Array.isArray(view.segments) || view.segments.length !== 8) {
    throw new Error("detail Quality presentation requires eight fixed-dimension segments");
  }
  const slotSize = 360 / 8;
  const gap = 5;
  return view.segments.map((segment) => {
    const start = -90 + segment.slot * slotSize + gap;
    const end = -90 + (segment.slot + 1) * slotSize - gap;
    return `<path class="qseg qdetail ${escapeXml(segment.token)}" data-dimension="${escapeXml(segment.id)}" d="${arcPath(cx, cy, 28, start, end)}" />`;
  }).join("");
}

function compactRing(view, cx, cy) {
  if (view.mode !== "target-finding-distribution" || !Array.isArray(view.segments)) {
    throw new Error("compact Quality presentation requires target-finding-distribution segments");
  }
  let cursor = -90;
  return view.segments.map((segment) => {
    if (!(segment.ratio > 0)) return "";
    const sweep = segment.ratio * 360;
    const gap = Math.min(4, sweep / 4);
    const start = cursor + gap / 2;
    const end = cursor + sweep - gap / 2;
    cursor += sweep;
    const token = escapeXml(segment.token);
    const finding = escapeXml(segment.findingState);
    if (sweep >= 359.99) {
      return `<circle class="qseg qcompact ${token}" data-finding="${finding}" cx="${cx}" cy="${cy}" r="28" />`;
    }
    return `<path class="qseg qcompact ${token}" data-finding="${finding}" data-count="${segment.count}" d="${arcPath(cx, cy, 28, start, end)}" />`;
  }).join("");
}

function unavailableRing(view, cx, cy) {
  if (view.mode !== "unavailable") throw new Error("unavailable Quality presentation requires unavailable view");
  return `<circle class="quality-unavailable-ring" data-reason="${escapeXml(view.reason)}" cx="${cx}" cy="${cy}" r="28" />`;
}

function artifactLabel(entry) {
  const artifacts = entry.context?.artifacts;
  if (!artifacts || artifacts.state === "unknown" || !Array.isArray(artifacts.values) || artifacts.values.length === 0) return "artifact unknown";
  return artifacts.values.join(" + ");
}

function cardRing(entry, viewName, cx, cy) {
  const view = entry.views?.[viewName];
  if (!view) throw new Error(`${entry.repositoryKey} is missing ${viewName} Quality view`);
  if (view.mode === "unavailable") return unavailableRing(view, cx, cy);
  if (viewName === "detail") return detailRing(view, cx, cy);
  if (viewName === "compact") return compactRing(view, cx, cy);
  throw new Error(`unsupported Quality presentation view: ${viewName}`);
}

export function renderRepositoryQualityPresentationPrototypeSvg(modelValue, options = {}) {
  if (!modelValue || typeof modelValue !== "object" || Array.isArray(modelValue)) throw new Error("presentation model must be an object");
  if (modelValue.presentationId !== "ipm-repository-quality-presentation-v1") throw new Error("unsupported Quality presentation model");
  if (!Array.isArray(modelValue.repositories) || modelValue.repositories.length === 0) throw new Error("presentation repositories must be a non-empty array");

  const viewName = options.view ?? "compact";
  if (!new Set(["compact", "detail"]).has(viewName)) throw new Error(`unsupported Quality presentation view: ${viewName}`);
  const columns = Number.isInteger(options.columns) && options.columns > 0 ? options.columns : 3;
  const cardWidth = 278;
  const cardHeight = 126;
  const padding = 24;
  const headerHeight = 70;
  const rows = Math.ceil(modelValue.repositories.length / columns);
  const width = padding * 2 + columns * cardWidth;
  const height = padding * 2 + headerHeight + rows * cardHeight;

  const cards = modelValue.repositories.map((entry, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = padding + col * cardWidth;
    const y = padding + headerHeight + row * cardHeight;
    const cx = x + 47;
    const cy = y + 50;
    const ring = cardRing(entry, viewName, cx, cy);
    const available = entry.overlayState === "available";
    const coverage = available ? entry.views[viewName].coverage?.label ?? "Quality evidence" : "Quality not collected";
    const fullLabel = String(entry.label ?? entry.repositoryKey);
    const label = escapeXml(displayLabel(fullLabel));
    const key = escapeXml(entry.repositoryKey);
    const artifact = escapeXml(artifactLabel(entry));

    return `<g class="quality-card" data-repository-key="${key}" data-quality-state="${available ? "available" : "unavailable"}" data-view="${viewName}">
      <title>${escapeXml(fullLabel)}</title>
      <rect class="card-bg" x="${x}" y="${y}" width="${cardWidth - 12}" height="${cardHeight - 12}" rx="15" />
      ${ring}
      <circle class="repository-core" cx="${cx}" cy="${cy}" r="14" />
      <text class="repo-label" x="${x + 88}" y="${y + 39}">${label}</text>
      <text class="artifact-label" x="${x + 88}" y="${y + 60}">${artifact}</text>
      <text class="coverage-label" x="${x + 88}" y="${y + 83}">${escapeXml(coverage)}</text>
    </g>`;
  }).join("\n");

  const available = modelValue.diagnostics?.available ?? modelValue.repositories.filter((entry) => entry.overlayState === "available").length;
  const unavailable = modelValue.diagnostics?.unavailable ?? modelValue.repositories.length - available;
  const title = `Experimental repository Quality — ${available} available / ${unavailable} unavailable`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(title)}">
  <title>${escapeXml(title)}</title>
  <style>
    :root { color-scheme: dark; }
    .card-bg { fill: #101827; stroke: #25334a; stroke-width: 1; }
    .repository-core { fill: #dbeafe; stroke: #93c5fd; stroke-width: 2; }
    .qseg { fill: none; stroke-width: 5; stroke-linecap: round; }
    .quality-supports { stroke: #4ade80; }
    .quality-weakens { stroke: #fb7185; }
    .quality-neutral { stroke: #94a3b8; }
    .quality-mixed { stroke: #fbbf24; stroke-dasharray: 3 3; }
    .quality-unknown { stroke: #475569; stroke-dasharray: 2 4; }
    .quality-optional { stroke: #64748b; stroke-width: 2; opacity: .38; }
    .quality-not-applicable { stroke: transparent; }
    .quality-unresolved-applicability { stroke: #c084fc; stroke-dasharray: 2 3; }
    .quality-unavailable-ring { fill: none; stroke: #475569; stroke-width: 3; stroke-dasharray: 2 6; opacity: .72; }
    .repo-label { fill: #f8fafc; font: 600 13px system-ui, sans-serif; }
    .artifact-label, .coverage-label, .summary { fill: #94a3b8; font: 12px system-ui, sans-serif; }
    .coverage-label { fill: #cbd5e1; }
    .heading { fill: #f8fafc; font: 700 18px system-ui, sans-serif; }
  </style>
  <text class="heading" x="${padding}" y="${padding + 18}">Repository Quality · experimental ${viewName}</text>
  <text class="summary" x="${padding}" y="${padding + 42}">${available} available · ${unavailable} unavailable · Structure remains default</text>
  ${cards}
</svg>`;
}
