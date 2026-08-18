"use strict";

const styleSelectRouter = document.getElementById("style");
const styleQuery = new URL(location.href).searchParams;

function dedicatedViewerUrl(style, username) {
  const url = new URL(style === "tree" ? "../tree/" : "../radial/", location.href);
  if (username) url.searchParams.set("username", username);
  url.searchParams.set("style", style);
  return url;
}

if (["tree", "radial"].includes(styleQuery.get("style"))) {
  location.replace(dedicatedViewerUrl(styleQuery.get("style"), styleQuery.get("username")).toString());
}

if (styleSelectRouter) {
  styleSelectRouter.addEventListener("change", (event) => {
    if (!["tree", "radial"].includes(styleSelectRouter.value)) return;
    event.stopImmediatePropagation();
    location.assign(dedicatedViewerUrl(styleSelectRouter.value, styleQuery.get("username")).toString());
  });
}
