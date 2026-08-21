"use strict";
(() => {
  const select = document.getElementById("style");
  const currentUrl = new URL(location.href);
  const query = currentUrl.searchParams;
  const dedicated = new Set(["radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"]);
  const all = new Set(["radial", "galaxy-classic", "galaxy-systems", "galaxy-hybrid", "obsidian", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"]);
  function normalize(style) { return style === "galaxy" ? "galaxy-systems" : style; }
  function currentStyle() { const match = location.pathname.match(/\/(radial|tree|treemap|timeline|cluster|sunburst|matrix|sankey)\/?$/); return match ? match[1] : null; }
  function styleUrl(style) {
    const normalized = normalize(style);
    const route = dedicated.has(normalized) ? `../${normalized}/` : "../u/";
    const url = new URL(route, location.href);
    for (const [key, value] of currentUrl.searchParams) {
      if (key === "style" || key === "username") continue;
      url.searchParams.append(key, value);
    }
    const username = query.get("username");
    if (username) url.searchParams.set("username", username);
    url.searchParams.set("style", normalized);
    return url;
  }
  const requested = normalize(query.get("style"));
  if (all.has(requested) && requested !== currentStyle()) { location.replace(styleUrl(requested).toString()); return; }
  if (select) select.addEventListener("change", (event) => { const style = normalize(select.value); if (style === currentStyle() || !all.has(style)) return; event.stopImmediatePropagation(); location.assign(styleUrl(style).toString()); }, true);
})();
