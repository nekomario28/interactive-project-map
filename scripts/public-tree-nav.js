"use strict";

const treeNavSelect = document.getElementById("style");
const treeNavQuery = new URL(location.href).searchParams;

if (treeNavSelect) {
  treeNavSelect.addEventListener("change", (event) => {
    if (treeNavSelect.value !== "radial") return;
    event.stopImmediatePropagation();
    const url = new URL("../radial/", location.href);
    const username = treeNavQuery.get("username");
    if (username) url.searchParams.set("username", username);
    url.searchParams.set("style", "radial");
    location.assign(url.toString());
  }, true);
}
