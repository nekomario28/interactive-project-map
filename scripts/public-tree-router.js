"use strict";

(() => {
  const allStyles = new Set(["radial", "galaxy", "obsidian", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"]);
  const dedicatedStyles = new Set(["radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"]);
  const styleSelect = document.getElementById("style");
  const params = new URL(location.href).searchParams;

  function styleUrl(style, username) {
    const route = dedicatedStyles.has(style) ? `../${style}/` : "../u/";
    const url = new URL(route, location.href);
    if (username) url.searchParams.set("username", username);
    url.searchParams.set("style", style);
    return url;
  }

  const requestedStyle = params.get("style");
  if (dedicatedStyles.has(requestedStyle)) {
    location.replace(styleUrl(requestedStyle, params.get("username")).toString());
    return;
  }

  if (styleSelect) {
    styleSelect.addEventListener("change", (event) => {
      const style = styleSelect.value;
      if (!allStyles.has(style) || !dedicatedStyles.has(style)) return;
      event.stopImmediatePropagation();
      location.assign(styleUrl(style, params.get("username")).toString());
    }, true);
  }
})();
