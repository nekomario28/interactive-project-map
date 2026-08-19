function fitGalaxyGraphToViewport(svg) {
  if (!svg.includes('aria-label="Galaxy-style map')) return svg;

  const root = svg.match(/<svg[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"[^>]*\bviewBox="0 0 ([\d.]+) ([\d.]+)"/u);
  if (!root) return svg;
  const width = Number(root[3] || root[1]);
  const height = Number(root[4] || root[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return svg;

  const coordinates = [];
  const linePattern = /<line\b[^>]*\bx1="(-?[\d.]+)"\s+y1="(-?[\d.]+)"\s+x2="(-?[\d.]+)"\s+y2="(-?[\d.]+)"/gu;
  for (const match of svg.matchAll(linePattern)) {
    coordinates.push([Number(match[1]), Number(match[2])], [Number(match[3]), Number(match[4])]);
  }
  if (!coordinates.length || coordinates.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) return svg;

  const xs = coordinates.map(([x]) => x);
  const ys = coordinates.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const sourceWidth = Math.max(1, maxX - minX);
  const sourceHeight = Math.max(1, maxY - minY);
  const marginX = 24;
  const marginTop = 20;
  const marginBottom = 38;
  const targetWidth = Math.max(1, width - marginX * 2);
  const targetHeight = Math.max(1, height - marginTop - marginBottom);
  const scale = Math.min(1, targetWidth / sourceWidth, targetHeight / sourceHeight);
  if (scale >= 0.999) return svg;

  const targetCenterX = width / 2;
  const targetCenterY = marginTop + targetHeight / 2;
  const sourceCenterX = (minX + maxX) / 2;
  const sourceCenterY = (minY + maxY) / 2;
  const translateX = targetCenterX - sourceCenterX * scale;
  const translateY = targetCenterY - sourceCenterY * scale;

  const topLevelGroups = [...svg.matchAll(/\n  <g>/gu)].map((match) => match.index);
  if (topLevelGroups.length < 3) return svg;
  const graphStart = topLevelGroups[0];
  const legendStart = topLevelGroups[topLevelGroups.length - 1];
  if (graphStart == null || legendStart == null || legendStart <= graphStart) return svg;

  const transform = `translate(${translateX.toFixed(4)} ${translateY.toFixed(4)}) scale(${scale.toFixed(6)})`;
  return `${svg.slice(0, graphStart)}\n  <g data-galaxy-fit="true" transform="${transform}">${svg.slice(graphStart + 1, legendStart)}\n  </g>${svg.slice(legendStart)}`;
}

export function finalizeSvgForTheme(svg, theme) {
  const fitted = fitGalaxyGraphToViewport(svg);
  if (theme !== "light") return fitted;
  return fitted.replace(
    /(paint-order="stroke"[^>]*?stroke-width=")([0-9.]+)(")/gu,
    (_match, before, _width, after) => `${before}0.65${after}`,
  );
}
