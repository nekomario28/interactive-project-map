function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
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

function fullSegmentPath(segment, cx, cy) {
  const slotSize = 360 / 8;
  const gap = 5;
  const start = -90 + segment.slot * slotSize + gap;
  const end = -90 + (segment.slot + 1) * slotSize - gap;
  return arcPath(cx, cy, 30, start, end);
}

function fullRing(overlay, cx, cy) {
  return overlay.segments.map((segment) => {
    const path = fullSegmentPath(segment, cx, cy);
    return `<path class="qseg qfull ${escapeXml(segment.token)}" data-dimension="${escapeXml(segment.id)}" data-target="${segment.target ? "true" : "false"}" d="${path}" />`;
  }).join("");
}

function compactRing(overlay, cx, cy) {
  const distribution = overlay.compactDistribution;
  if (!distribution || distribution.mode !== "target-finding-distribution" || !Array.isArray(distribution.segments)) {
    throw new Error("compact ring requires overlay.compactDistribution");
  }
  let cursor = -90;
  return distribution.segments.map((segment) => {
    if (!(segment.ratio > 0)) return "";
    const sweep = segment.ratio * 360;
    const gap = Math.min(4, sweep / 4);
    const start = cursor + gap / 2;
    const end = cursor + sweep - gap / 2;
    cursor += sweep;
    const finding = escapeXml(segment.findingState);
    const token = escapeXml(segment.token);
    if (sweep >= 359.99) {
      return `<circle class="qseg qcompact ${token}" data-finding="${finding}" cx="${cx}" cy="${cy}" r="30" />`;
    }
    const path = arcPath(cx, cy, 30, start, end);
    return `<path class="qseg qcompact ${token}" data-finding="${finding}" data-count="${segment.count}" d="${path}" />`;
  }).join("");
}

function renderRing(item, overlay, cx, cy, defaultRingMode) {
  const ringMode = item.ringMode ?? defaultRingMode;
  if (ringMode === "full") return { ringMode, svg: fullRing(overlay, cx, cy) };
  if (ringMode === "compact") return { ringMode, svg: compactRing(overlay, cx, cy) };
  throw new Error(`unsupported ringMode: ${ringMode}`);
}

export function renderQualityOverlayPrototypeSvg(itemsValue, options = {}) {
  if (!Array.isArray(itemsValue) || itemsValue.length === 0) throw new Error("items must be a non-empty array");
  const columns = Number.isInteger(options.columns) && options.columns > 0 ? options.columns : 3;
  const defaultRingMode = options.ringMode ?? "full";
  if (!new Set(["full", "compact"]).has(defaultRingMode)) throw new Error(`unsupported ringMode: ${defaultRingMode}`);
  const cardWidth = 280;
  const cardHeight = 155;
  const padding = 24;
  const legendHeight = 92;
  const rows = Math.ceil(itemsValue.length / columns);
  const width = padding * 2 + columns * cardWidth;
  const height = padding * 2 + rows * cardHeight + legendHeight;

  const cards = itemsValue.map((item, index) => {
    if (!item || typeof item !== "object" || !item.overlay) throw new Error(`items[${index}] must include overlay`);
    const overlay = item.overlay;
    if (overlay.schemaVersion !== 1 || !Array.isArray(overlay.segments) || overlay.segments.length !== 8) {
      throw new Error(`items[${index}].overlay must be a v1 eight-slot Quality overlay`);
    }
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = padding + col * cardWidth;
    const y = padding + row * cardHeight;
    const cx = x + 54;
    const cy = y + 61;
    const ring = renderRing(item, overlay, cx, cy, defaultRingMode);
    const label = escapeXml(item.label ?? `item-${index + 1}`);
    const artifact = escapeXml(item.artifact ?? "repository");
    const attention = escapeXml(overlay.attentionState);
    const coverage = escapeXml(overlay.coverage.label);

    return `<g class="quality-card" data-attention="${attention}" data-ring-mode="${ring.ringMode}">
      <rect class="card-bg" x="${x}" y="${y}" width="${cardWidth - 12}" height="${cardHeight - 12}" rx="16" />
      ${ring.svg}
      <circle class="repository-core" cx="${cx}" cy="${cy}" r="14" />
      <text class="repo-label" x="${x + 98}" y="${y + 49}">${label}</text>
      <text class="artifact-label" x="${x + 98}" y="${y + 70}">${artifact}</text>
      <text class="coverage-label" x="${x + 98}" y="${y + 94}">${coverage}</text>
      <text class="attention-label" x="${x + 98}" y="${y + 115}">${attention}</text>
    </g>`;
  }).join("\n");

  const legendY = padding + rows * cardHeight + 34;
  const legend = [
    ["quality-supports", "supports"],
    ["quality-weakens", "weakens"],
    ["quality-neutral", "neutral"],
    ["quality-mixed", "mixed"],
    ["quality-unknown", "unknown"],
    ["quality-optional", "optional(full)"],
    ["quality-not-applicable", "N/A gap(full)"],
  ].map(([token, text], index) => {
    const x = padding + index * 116;
    return `<g class="legend-item"><line class="legend-line ${token}" x1="${x}" y1="${legendY}" x2="${x + 22}" y2="${legendY}" /><text class="legend-text" x="${x + 29}" y="${legendY + 4}">${escapeXml(text)}</text></g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Repository Quality evidence ring prototype">
  <style>
    :root { color-scheme: dark; }
    .card-bg { fill: #101827; stroke: #25334a; stroke-width: 1; }
    .repository-core { fill: #dbeafe; stroke: #93c5fd; stroke-width: 2; }
    .qseg, .legend-line { fill: none; stroke-width: 5; stroke-linecap: round; }
    .quality-supports { stroke: #4ade80; }
    .quality-weakens { stroke: #fb7185; }
    .quality-neutral { stroke: #94a3b8; }
    .quality-mixed { stroke: #fbbf24; stroke-dasharray: 3 3; }
    .quality-unknown { stroke: #475569; stroke-dasharray: 2 4; }
    .quality-optional { stroke: #64748b; stroke-width: 2; opacity: .38; }
    .quality-not-applicable { stroke: transparent; }
    .quality-unresolved-applicability { stroke: #c084fc; stroke-dasharray: 2 3; }
    .repo-label { fill: #f8fafc; font: 600 14px system-ui, sans-serif; }
    .artifact-label, .coverage-label, .attention-label, .legend-text { fill: #94a3b8; font: 12px system-ui, sans-serif; }
    .coverage-label { fill: #cbd5e1; }
    .legend-line { stroke-width: 4; }
  </style>
  ${cards}
  <g class="quality-legend">${legend}</g>
</svg>`;
}
