"use strict";

const styleSelectRouter = document.getElementById("style");
const styleQuery = new URL(location.href).searchParams;
const DEDICATED = new Set(["tree", "radial", "treemap"]);

function dedicatedViewerUrl(style, username) {
  const url = new URL(`../${style}/`, location.href);
  if (username) url.searchParams.set("username", username);
  url.searchParams.set("style", style);
  return url;
}

if (DEDICATED.has(styleQuery.get("style"))) {
  location.replace(dedicatedViewerUrl(styleQuery.get("style"), styleQuery.get("username")).toString());
}

if (styleSelectRouter) {
  styleSelectRouter.addEventListener("change", (event) => {
    if (!DEDICATED.has(styleSelectRouter.value)) return;
    event.stopImmediatePropagation();
    location.assign(dedicatedViewerUrl(styleSelectRouter.value, styleQuery.get("username")).toString());
  }, true);
}
