export const REPOSITORY_QUALITY_PRESENTATION_THEMES = Object.freeze({
  dark: Object.freeze({
    colorScheme: "dark",
    page: "#070a12",
    card: "#101827",
    cardStroke: "#25334a",
    core: "#dbeafe",
    coreStroke: "#93c5fd",
    supports: "#4ade80",
    weakens: "#fb7185",
    neutral: "#94a3b8",
    mixed: "#fbbf24",
    unknown: "#cbd5e1",
    optional: "#94a3b8",
    unresolved: "#c084fc",
    unavailable: "#64748b",
    heading: "#f8fafc",
    label: "#f8fafc",
    meta: "#94a3b8",
    coverage: "#cbd5e1",
  }),
  light: Object.freeze({
    colorScheme: "light",
    page: "#f8fafc",
    card: "#ffffff",
    cardStroke: "#cbd5e1",
    core: "#e0f2fe",
    coreStroke: "#0369a1",
    supports: "#166534",
    weakens: "#b91c1c",
    neutral: "#475569",
    mixed: "#92400e",
    unknown: "#64748b",
    optional: "#64748b",
    unresolved: "#7e22ce",
    unavailable: "#64748b",
    heading: "#0f172a",
    label: "#0f172a",
    meta: "#475569",
    coverage: "#334155",
  }),
});

const TOKEN_PATTERN = Object.freeze({
  "quality-supports": "supports-solid",
  "quality-weakens": "weakens-long-dash",
  "quality-neutral": "neutral-dot",
  "quality-mixed": "mixed-dash-dot",
  "quality-unknown": "unknown-sparse-dot",
  "quality-optional": "optional-dash",
  "quality-not-applicable": "not-applicable",
  "quality-unresolved-applicability": "unresolved-dash-dot",
});

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

function tokenPattern(token) {
  return TOKEN_PATTERN[token] ?? "unknown-pattern";
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
    const token = escapeXml(segment.token);
    return `<path class="qseg qdetail ${token}" data-dimension="${escapeXml(segment.id)}" data-pattern="${escapeXml(tokenPattern(segment.token))}" d="${arcPath(cx, cy, 28, start, end)}" />`;
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
    const pattern = escapeXml(tokenPattern(segment.token));
    if (sweep >= 359.99) {
      return `<circle class="qseg qcompact ${token}" data-finding="${finding}" data-pattern="${pattern}" cx="${cx}" cy="${cy}" r="28" />`;
    }
    return `<path class="qseg qcompact ${token}" data-finding="${finding}" data-pattern="${pattern}" data-count="${segment.count}" d="${arcPath(cx, cy, 28, start, end)}" />`;
  }).join("");
}

function unavailableRing(view, cx, cy) {
  if (view.mode !== "unavailable") throw new Error("unavailable Quality presentation requires unavailable view");
  return `<circle class="quality-unavailable-ring" data-reason="${escapeXml(view.reason)}" data-pattern="unavailable-sparse-dash" cx="${cx}" cy="${cy}" r="28" />`;
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

function themeStyle(theme) {
  return `
    :root { color-scheme: ${theme.colorScheme}; }
    .card-bg { fill: ${theme.card}; stroke: ${theme.cardStroke}; stroke-width: 1; }
    .repository-core { fill: ${theme.core}; stroke: ${theme.coreStroke}; stroke-width: 2; }
    .qseg { fill: none; stroke-width: 5; stroke-linecap: round; }
    .quality-supports { stroke: ${theme.supports}; }
    .quality-weakens { stroke: ${theme.weakens}; stroke-dasharray: 8 3; }
    .quality-neutral { stroke: ${theme.neutral}; stroke-dasharray: 2 3; }
    .quality-mixed { stroke: ${theme.mixed}; stroke-dasharray: 8 2 2 2; }
    .quality-unknown { stroke: ${theme.unknown}; stroke-dasharray: 1 4; }
    .quality-optional { stroke: ${theme.optional}; stroke-width: 2; stroke-dasharray: 5 4; opacity: .72; }
    .quality-not-applicable { stroke: transparent; }
    .quality-unresolved-applicability { stroke: ${theme.unresolved}; stroke-dasharray: 7 2 1 2; }
    .quality-unavailable-ring { fill: none; stroke: ${theme.unavailable}; stroke-width: 3; stroke-dasharray: 2 6; opacity: .82; }
    .repo-label { fill: ${theme.label}; font: 600 13px system-ui, sans-serif; }
    .artifact-label, .coverage-label, .summary { fill: ${theme.meta}; font: 12px system-ui, sans-serif; }
    .coverage-label { fill: ${theme.coverage}; }
    .heading { fill: ${theme.heading}; font: 700 18px system-ui, sans-serif; }
  `;
}

export function renderRepositoryQualityPresentationPrototypeSvg(modelValue, options = {}) {
  if (!modelValue || typeof modelValue !== "object" || Array.isArray(modelValue)) throw new Error("presentation model must be an object");
  if (modelValue.presentationId !== "ipm-repository-quality-presentation-v1") throw new Error("unsupported Quality presentation model");
  if (!Array.isArray(modelValue.repositories) || modelValue.repositories.length === 0) throw new Error("presentation repositories must be a non-empty array");

  const viewName = options.view ?? "compact";
  if (!new Set(["compact", "detail"]).has(viewName)) throw new Error(`unsupported Quality presentation view: ${viewName}`);
  const themeName = options.theme ?? "dark";
  const theme = REPOSITORY_QUALITY_PRESENTATION_THEMES[themeName];
  if (!theme) throw new Error(`unsupported Quality presentation theme: ${String(themeName)}`);
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

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(title)}" data-theme="${themeName}" style="background:${theme.page}">
  <title>${escapeXml(title)}</title>
  <style>${themeStyle(theme)}
  </style>
  <text class="heading" x="${padding}" y="${padding + 18}">Repository Quality · experimental ${viewName}</text>
  <text class="summary" x="${padding}" y="${padding + 42}">${available} available · ${unavailable} unavailable · Structure remains default</text>
  ${cards}
</svg>`;
}
