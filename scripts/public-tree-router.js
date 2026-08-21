"use strict";

(() => {
  const visibleStyles = new Set(["radial", "galaxy-classic", "galaxy-systems", "galaxy-hybrid", "obsidian", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"]);
  const dedicatedStyles = new Set(["radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"]);
  const styleSelect = document.getElementById("style");
  const currentUrl = new URL(location.href);
  const params = currentUrl.searchParams;

  function normalize(style) {
    if (style === "galaxy") return "galaxy-systems";
    return visibleStyles.has(style) ? style : "galaxy-systems";
  }

  function styleUrl(style, username) {
    const normalized = normalize(style);
    const route = dedicatedStyles.has(normalized) ? `../${normalized}/` : "../u/";
    const url = new URL(route, location.href);
    for (const [key, value] of currentUrl.searchParams) {
      if (key === "style" || key === "username") continue;
      url.searchParams.append(key, value);
    }
    if (username) url.searchParams.set("username", username);
    url.searchParams.set("style", normalized);
    return url;
  }

  const rawRequested = params.get("style");
  const requested = normalize(rawRequested);
  if (rawRequested === "galaxy" || dedicatedStyles.has(requested)) {
    location.replace(styleUrl(requested, params.get("username")).toString());
    return;
  }

  if (styleSelect) {
    styleSelect.addEventListener("change", (event) => {
      const style = normalize(styleSelect.value);
      if (!visibleStyles.has(style) || style === requested) return;
      event.stopImmediatePropagation();
      location.assign(styleUrl(style, params.get("username")).toString());
    }, true);
  }
})();
