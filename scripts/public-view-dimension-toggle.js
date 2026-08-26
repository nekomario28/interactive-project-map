"use strict";

(() => {
  const TWO_D_STYLES = new Set([
    "radial",
    "galaxy-classic",
    "galaxy-systems",
    "galaxy-hybrid",
    "obsidian",
    "tree",
    "treemap",
    "timeline",
    "cluster",
    "sunburst",
    "matrix",
    "sankey",
  ]);
  const TRANSFERABLE_KEYS = ["username", "q", "status", "motion", "activity", "focus", "depth", "quality"];

  function safe2DStyle(value) {
    return TWO_D_STYLES.has(value) ? value : "galaxy-systems";
  }

  function current2DStyle() {
    const params = new URL(location.href).searchParams;
    return safe2DStyle(params.get("style") || document.body.dataset.mapStyle);
  }

  function copyTransferableFallback(source, target) {
    for (const key of TRANSFERABLE_KEYS) {
      const value = source.searchParams.get(key);
      if (value === null || value === "") target.searchParams.delete(key);
      else target.searchParams.set(key, value);
    }
    return target;
  }

  function transferTo(target) {
    const api = window.ProjectMapTransferableState;
    if (api?.transfer) return api.transfer(location.href, target);
    return copyTransferableFallback(new URL(location.href), target);
  }

  function threeUrl() {
    const url = transferTo(new URL("../three/", location.href));
    url.searchParams.delete("style");
    url.searchParams.set("style2d", current2DStyle());
    return url;
  }

  function twoDUrl() {
    const source = new URL(location.href);
    const style = safe2DStyle(source.searchParams.get("style2d"));
    const url = transferTo(new URL("../u/", location.href));
    url.searchParams.set("style", style);
    url.searchParams.delete("style2d");
    url.searchParams.delete("render");
    return url;
  }

  function syncLinks() {
    const three = document.getElementById("view3D");
    if (three) three.href = threeUrl().toString();
    const two = document.getElementById("twoDLink");
    if (two) two.href = twoDUrl().toString();
  }

  function init() {
    syncLinks();
    document.addEventListener("click", (event) => {
      if (event.target.closest?.("#view3D, #twoDLink")) syncLinks();
      else setTimeout(syncLinks, 0);
    }, true);
    document.addEventListener("input", () => setTimeout(syncLinks, 0), true);
    document.addEventListener("change", () => setTimeout(syncLinks, 0), true);
    window.addEventListener("popstate", syncLinks);

    window.ProjectMapViewDimension = Object.freeze({
      version: 1,
      current: () => document.body.dataset.viewDimension || null,
      current2DStyle,
      threeUrl: () => threeUrl().toString(),
      twoDUrl: () => twoDUrl().toString(),
      snapshot() {
        return {
          dimension: document.body.dataset.viewDimension || null,
          twoDStyle: current2DStyle(),
          twoDUrl: twoDUrl().toString(),
          threeDUrl: threeUrl().toString(),
        };
      },
    });
  }

  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
