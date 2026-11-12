"use strict";

// 2D-only controls. Move existing elements to retain their event listeners.
(() => {
  const controls = document.querySelector(".toolbar .controls");
  if (!controls) return;
  const menu = document.createElement("details");
  menu.className = "view-options-menu";
  const summary = document.createElement("summary");
  summary.textContent = "View options";
  const panel = document.createElement("div");
  panel.className = "view-options-panel";
  panel.setAttribute("role", "group");
  panel.setAttribute("aria-label", "Additional view controls");
  for (const id of ["fit", "reset", "motionToggle", "activityToggle", "shareView"]) {
    const button = document.getElementById(id);
    if (button) panel.append(button);
  }
  if (!panel.children.length) return;
  menu.append(summary, panel);
  controls.append(menu);
  menu.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    menu.open = false;
    summary.focus();
  });
  document.addEventListener("pointerdown", (event) => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  // Keyboard navigation and scripted focus (e.g. search) do not generate a
  // pointerdown. Closing on focus departure prevents the menu overlay from
  // blocking canvas details and other view actions.
  document.addEventListener("focusin", (event) => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
})();
