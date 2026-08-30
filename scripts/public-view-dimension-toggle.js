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
  const THREE_D_STYLES = new Set(["cosmic", "aurora", "wireframe"]);
  const TRANSFERABLE_KEYS = ["username", "q", "status", "motion", "activity", "focus", "depth", "quality"];

  function valid2DStyle(value) {
    return TWO_D_STYLES.has(value) ? value : null;
  }

  function valid3DStyle(value) {
    return THREE_D_STYLES.has(value) ? value : null;
  }

  function current2DStyle() {
    const params = new URL(location.href).searchParams;
    return valid2DStyle(params.get("style"))
      || valid2DStyle(params.get("style2d"))
      || valid2DStyle(document.body.dataset.mapStyle)
      || "galaxy-systems";
  }

  function current3DStyle() {
    const params = new URL(location.href).searchParams;
    const datasetStyle = String(document.body.dataset.mapStyle || "").replace(/^threejs-/, "");
    return valid3DStyle(params.get("style3d")) || valid3DStyle(datasetStyle) || "cosmic";
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
    const style = valid2DStyle(source.searchParams.get("style2d")) || valid2DStyle(source.searchParams.get("style"));
    const url = transferTo(new URL("../u/", location.href));
    if (style) url.searchParams.set("style", style);
    else url.searchParams.delete("style");
    url.searchParams.delete("style2d");
    url.searchParams.delete("style3d");
    url.searchParams.delete("render");
    return url;
  }

  function syncLinks() {
    const three = document.getElementById("view3D");
    if (three) {
      const href = threeUrl().toString();
      if (three.href !== href) three.href = href;
    }

    const source = new URL(location.href);
    const two = document.getElementById("twoDLink");
    if (two && valid2DStyle(source.searchParams.get("style2d"))) {
      const href = twoDUrl().toString();
      if (two.href !== href) two.href = href;
    }
  }

  function initThreeStyle() {
    const select = document.getElementById("threeStyle");
    if (!select) return;
    select.value = current3DStyle();
    select.addEventListener("change", () => {
      const style = valid3DStyle(select.value) || "cosmic";
      const url = new URL(location.href);
      if (style === "cosmic") url.searchParams.delete("style3d");
      else url.searchParams.set("style3d", style);
      location.assign(url.toString());
    });
  }

  function init() {
    syncLinks();
    initThreeStyle();
    document.addEventListener("click", (event) => {
      if (event.target.closest?.("#view3D, #twoDLink")) syncLinks();
      else setTimeout(syncLinks, 0);
    }, true);
    document.addEventListener("input", () => setTimeout(syncLinks, 0), true);
    document.addEventListener("change", () => setTimeout(syncLinks, 0), true);
    window.addEventListener("popstate", syncLinks);

    const source = new URL(location.href);
    const twoDLink = document.getElementById("twoDLink");
    if (twoDLink && valid2DStyle(source.searchParams.get("style2d")) && typeof MutationObserver === "function") {
      new MutationObserver(syncLinks).observe(twoDLink, { attributes: true, attributeFilter: ["href"] });
    }

    window.ProjectMapViewDimension = Object.freeze({
      version: 2,
      current: () => document.body.dataset.viewDimension || null,
      current2DStyle,
      current3DStyle,
      threeUrl: () => threeUrl().toString(),
      twoDUrl: () => twoDUrl().toString(),
      snapshot() {
        return {
          dimension: document.body.dataset.viewDimension || null,
          twoDStyle: current2DStyle(),
          threeDStyle: current3DStyle(),
          twoDUrl: twoDUrl().toString(),
          threeDUrl: threeUrl().toString(),
        };
      },
    });
  }

  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
