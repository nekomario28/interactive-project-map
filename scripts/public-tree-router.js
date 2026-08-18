"use strict";

const treeStyleSelect = document.getElementById("style");
const treeQuery = new URL(location.href).searchParams;

function treeViewerUrl(username) {
  const url = new URL("../tree/", location.href);
  if (username) url.searchParams.set("username", username);
  url.searchParams.set("style", "tree");
  return url;
}

if (treeQuery.get("style") === "tree") {
  location.replace(treeViewerUrl(treeQuery.get("username")).toString());
}

if (treeStyleSelect) {
  treeStyleSelect.addEventListener("change", (event) => {
    if (treeStyleSelect.value !== "tree") return;
    event.stopImmediatePropagation();
    location.assign(treeViewerUrl(treeQuery.get("username")).toString());
  });
}
