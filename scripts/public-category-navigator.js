"use strict";
/* global state, updateDetails, rebuildLayout, draw, canvas, searchInput */

(() => {
  if (typeof state === "undefined" || typeof updateDetails !== "function" || !canvas) return;

  const workspace = document.querySelector(".workspace");
  const controls = document.querySelector(".controls");
  if (!workspace || !controls || document.getElementById("categoryNavigator")) return;

  const manualExpanded = new Set();
  let panelOpen = window.matchMedia?.("(min-width: 980px)")?.matches ?? true;
  let lastGraphSignature = "";
  let rendering = false;

  const toggleButton = document.createElement("button");
  toggleButton.id = "categoryNavigatorToggle";
  toggleButton.type = "button";
  toggleButton.textContent = "Categories";
  toggleButton.setAttribute("aria-controls", "categoryNavigator");
  controls.append(toggleButton);

  const panel = document.createElement("aside");
  panel.id = "categoryNavigator";
  panel.className = "category-navigator";
  panel.setAttribute("aria-label", "Category navigator");
  panel.innerHTML = `
    <div class="category-navigator-head">
      <div>
        <strong>Categories</strong>
        <span id="categoryNavigatorSummary">Loading…</span>
      </div>
      <button id="categoryNavigatorClear" type="button">Clear focus</button>
    </div>
    <div id="categoryNavigatorList" class="category-navigator-list"></div>`;
  workspace.append(panel);

  const summary = panel.querySelector("#categoryNavigatorSummary");
  const list = panel.querySelector("#categoryNavigatorList");
  const clearButton = panel.querySelector("#categoryNavigatorClear");

  function normalizedText(value) {
    return String(value || "").normalize("NFKC").toLocaleLowerCase("en-US").trim();
  }

  function normalizedGroupId(value) {
    const id = String(value || "");
    if (!id) return "";
    return id.startsWith("group:") ? id : `group:${id}`;
  }

  function graphNodes() {
    return Array.isArray(state.graph?.nodes) ? state.graph.nodes : [];
  }

  function visibleNode(id) {
    return state.byId?.get?.(id)
      || state.nodes?.find?.((node) => node?.id === id)
      || graphNodes().find((node) => node?.id === id)
      || null;
  }

  function repositoriesFor(group) {
    const key = normalizedGroupId(group.id);
    const raw = String(group.id || "").replace(/^group:/, "");
    return graphNodes()
      .filter((node) => node?.type === "repository" && (normalizedGroupId(node.groupId) === key || node.groupId === raw))
      .sort((a, b) => (b.stars || 0) - (a.stars || 0) || String(a.label || "").localeCompare(String(b.label || "")));
  }

  function nodeSearchText(node) {
    return normalizedText([
      node?.label,
      node?.description,
      node?.language,
      node?.groupLabel,
      ...(Array.isArray(node?.topics) ? node.topics : []),
    ].filter(Boolean).join(" "));
  }

  function activeQuery() {
    return normalizedText(searchInput?.value || state.query || "");
  }

  function selectedGroupId() {
    const selected = state.selected;
    if (!selected) return "";
    if (selected.type === "group") return normalizedGroupId(selected.id);
    if (selected.type === "repository") return normalizedGroupId(selected.groupId);
    return "";
  }

  function groupMatches(group, repositories, query) {
    if (!query) return false;
    return nodeSearchText(group).includes(query) || repositories.some((repo) => nodeSearchText(repo).includes(query));
  }

  function groupSignature(groups) {
    return groups.map((group) => `${group.id}:${repositoriesFor(group).map((repo) => repo.id).join(",")}`).join("|");
  }

  function setPanelOpen(open) {
    panelOpen = Boolean(open);
    panel.classList.toggle("is-open", panelOpen);
    toggleButton.setAttribute("aria-expanded", String(panelOpen));
  }

  function focusNode(id) {
    const node = visibleNode(id);
    if (!node) return;
    updateDetails(node);
    canvas.focus({ preventScroll: true });
  }

  function clearFocus() {
    updateDetails(null);
    canvas.focus({ preventScroll: true });
  }

  function createGroupEntry(group, repositories, query) {
    const groupId = normalizedGroupId(group.id);
    const selected = state.selected;
    const selectedGroup = selectedGroupId();
    const searchOpen = groupMatches(group, repositories, query);
    const expanded = manualExpanded.has(groupId) || selectedGroup === groupId || searchOpen;

    const section = document.createElement("section");
    section.className = "category-nav-group";
    if (selected?.id === group.id) section.classList.add("is-selected");
    if (selectedGroup === groupId) section.classList.add("has-selected-repository");

    const row = document.createElement("div");
    row.className = "category-nav-row";

    const focus = document.createElement("button");
    focus.type = "button";
    focus.className = "category-nav-focus";
    focus.dataset.categoryId = group.id;
    focus.setAttribute("aria-pressed", String(selected?.id === group.id));
    focus.innerHTML = `<span>${group.label}</span><small>${repositories.length}</small>`;
    focus.addEventListener("click", () => focusNode(group.id));

    const disclosure = document.createElement("button");
    disclosure.type = "button";
    disclosure.className = "category-nav-disclosure";
    disclosure.setAttribute("aria-expanded", String(expanded));
    disclosure.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} ${group.label} repositories`);
    disclosure.textContent = expanded ? "−" : "+";
    disclosure.addEventListener("click", () => {
      if (manualExpanded.has(groupId)) manualExpanded.delete(groupId);
      else manualExpanded.add(groupId);
      render({ force: true });
    });

    row.append(focus, disclosure);
    section.append(row);

    const repoList = document.createElement("div");
    repoList.className = "category-nav-repositories";
    repoList.hidden = !expanded;

    for (const repo of repositories) {
      const match = !query || nodeSearchText(repo).includes(query);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "category-nav-repository";
      button.dataset.repositoryId = repo.id;
      button.setAttribute("aria-pressed", String(selected?.id === repo.id));
      if (query && match) button.classList.add("is-search-match");
      if (query && !match) button.classList.add("is-search-muted");
      const status = repo.archived ? "Archived" : repo.fork ? "Fork" : "Original";
      button.innerHTML = `<span>${repo.label}</span><small>${repo.language || status}</small>`;
      button.addEventListener("click", () => focusNode(repo.id));
      repoList.append(button);
    }

    section.append(repoList);
    return section;
  }

  function render({ force = false } = {}) {
    if (rendering) return;
    rendering = true;
    try {
      const groups = graphNodes()
        .filter((node) => node?.type === "group")
        .sort((a, b) => String(a.label || "").localeCompare(String(b.label || "")));
      const signature = groupSignature(groups);
      const query = activeQuery();
      const selectedId = state.selected?.id || "";
      const renderKey = `${signature}::${query}::${selectedId}::${[...manualExpanded].sort().join(",")}::${panelOpen}`;
      if (!force && renderKey === lastGraphSignature) return;
      lastGraphSignature = renderKey;

      list.replaceChildren();
      if (!groups.length) {
        summary.textContent = state.graph ? "No categories" : "Loading…";
        clearButton.disabled = !state.selected;
        return;
      }

      let repositoryTotal = 0;
      for (const group of groups) {
        const repositories = repositoriesFor(group);
        repositoryTotal += repositories.length;
        list.append(createGroupEntry(group, repositories, query));
      }
      summary.textContent = `${groups.length} categories · ${repositoryTotal} repos`;
      clearButton.disabled = !state.selected;
    } finally {
      rendering = false;
    }
  }

  toggleButton.addEventListener("click", () => {
    setPanelOpen(!panelOpen);
    render({ force: true });
  });
  clearButton.addEventListener("click", clearFocus);
  searchInput?.addEventListener("input", () => render({ force: true }));

  const baseUpdateDetails = updateDetails;
  updateDetails = function categoryNavigatorUpdateDetails(node) {
    const result = baseUpdateDetails(node);
    queueMicrotask(() => render({ force: true }));
    return result;
  };

  if (typeof rebuildLayout === "function") {
    const baseRebuildLayout = rebuildLayout;
    rebuildLayout = function categoryNavigatorRebuildLayout(...args) {
      const result = baseRebuildLayout(...args);
      queueMicrotask(() => render({ force: true }));
      return result;
    };
  }

  const nativeResize = () => {
    if (window.innerWidth < 700 && panelOpen) setPanelOpen(false);
  };
  window.addEventListener("resize", nativeResize, { passive: true });

  setPanelOpen(panelOpen);
  render({ force: true });
  window.ProjectMapCategoryNavigator = Object.freeze({
    render: () => render({ force: true }),
    focusCategory: (id) => focusNode(normalizedGroupId(id)),
    focusRepository: focusNode,
    clearFocus,
    expandedCategories: () => [...manualExpanded],
  });
})();
