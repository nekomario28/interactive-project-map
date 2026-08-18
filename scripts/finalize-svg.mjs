export function finalizeSvgForTheme(svg, theme) {
  if (theme !== "light") return svg;
  return svg.replace(
    /(paint-order="stroke"[^>]*?stroke-width=")([0-9.]+)(")/gu,
    (_match, before, _width, after) => `${before}0.65${after}`,
  );
}
