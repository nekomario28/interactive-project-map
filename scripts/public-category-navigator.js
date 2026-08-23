"use strict";
/* global state, updateDetails, rebuildLayout, draw, canvas, searchInput */

(() => {
  if (typeof state === "undefined" || typeof updateDetails !== "function" || !canvas) return;

  const workspace = document.querySelector(".workspace");
  const controls = document.querySelector(".controls");
  if (!workspace || !controls || document.getElementById("categoryNavigator")) return;

  const manualExpanded = new Set();
  const baseUpdateDetails = updateDetails;
  let panelOpen = false;
  let lastRenderKey = "";
  let rendering = false;
  let fallbackFocus = null;

  const toggleButton = document.createElement("button");
  toggleButton.id = "categoryNavigatorToggle";
  toggleButton.type = "button";
  toggleButton.textContent = "Categories";
  toggleButton.setAttribute("aria-controls", "categoryNavigator");

  const toolbar = controls.closest(".toolbar");
  const titleBlock = toolbar?.querySelector(".title-block");
  if (toolbar && titleBlock && titleBlock.parentElement === toolbar) {
    const primary = document.createElement("div");
    primary.className = "category-navigator-primary";
    toolbar.insertBefore(primary, titleBlock);
    primary.append(toggleButton, titleBlock);
  } else {
    controls.prepend(toggleButton);
  }

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

  function repositoryVisible(node) {
    const checker = window.ProjectMapViewState?.statusVisible;
    return typeof checker === "function" ? checker(node) : true;
  }

  function renderedNode(id) {
    return state.byId?.get?.(id)
      || state.nodes?.find?.((node) => node?.id === id)
      || state.repos?.find?.((node) => node?.id === id)
      || state.groups?.find?.((node) => node?.id === id)
      || graphNodes().find((node) => node?.id === id)
      || null;
  }

  function supportsDirectSelection(node) {
    if (!node) return false;
    if (state.byId?.get?.(node.id)) return true;
    return Boolean(state.nodes?.find?.((candidate) => candidate?.id === node.id));
  }

  function repositoriesFor(group) {
    const key = normalizedGroupId(group.id);
    const raw = String(group.id || "").replace(/^group:/, "");
    return graphNodes()
      .filter((node) => node?.type === "repository"
        && repositoryVisible(node)
        && (normalizedGroupId(node.groupId) === key || node.groupId === raw))
      .sort((a, b) => (b.stars || 0) - (a.stars || 0) || String(a.label || "").localeCompare(String(b.label || "")));
  }

  function externalRepositories() {
    return graphNodes()
      .filter((node) => node?.type === "repository"
        && node?.relation === "contributed"
        && repositoryVisible(node))
      .sort((a, b) => String(a.label || "").localeCompare(String(b.label || "")));
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

  function userQuery() {
    return normalizedText(searchInput?.value || "");
  }

  function activeFocusId() {
    return fallbackFocus?.id || state.selected?.id || "";
  }

  function selectedGroupId() {
    const selected = fallbackFocus || state.selected;
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

  function restoreUserQuery() {
    state.query = userQuery();
  }

  function applyFallbackFocus(node) {
    fallbackFocus = {
      id: node.id,
      type: node.type,
      label: node.label,
      groupId: node.type === "group" ? node.id : node.groupId,
    };
    state.query = normalizedText(node.label);
    if (typeof draw === "function") draw();
  }

  function focusNode(id) {
    const node = renderedNode(id);
    if (!node || (node.type === "repository" && !repositoryVisible(node))) return;
    fallbackFocus = null;
    restoreUserQuery();
    if (supportsDirectSelection(node)) {
      baseUpdateDetails(node);
    } else {
      baseUpdateDetails(null);
      applyFallbackFocus(node);
    }
    queueMicrotask(() => render({ force: true }));
    canvas.focus({ preventScroll: true });
  }

  function clearFocus() {
    fallbackFocus = null;
    restoreUserQuery();
    baseUpdateDetails(null);
    if (typeof draw === "function") draw();
    queueMicrotask(() => render({ force: true }));
    canvas.focus({ preventScroll: true });
  }

  function toggleFocusNode(id) {
    if (activeFocusId() === id) {
      clearFocus();
      return;
    }
    focusNode(id);
  }

  function createGroupEntry(group, repositories, query) {
    const groupId = normalizedGroupId(group.id);
    const activeId = activeFocusId();
    const selectedGroup = selectedGroupId();
    const searchOpen = groupMatches(group, repositories, query);
    const expanded = manualExpanded.has(groupId) || selectedGroup === groupId || searchOpen;

    const section = document.createElement("section");
    section.className = "category-nav-group";
    if (activeId === group.id) section.classList.add("is-selected");
    if (selectedGroup === groupId) section.classList.add("has-selected-repository");

    const row = document.createElement("div");
    row.className = "category-nav-row";

    const focus = document.createElement("button");
    focus.type = "button";
    focus.className = "category-nav-focus";
    focus.dataset.categoryId = group.id;
    focus.setAttribute("aria-label", group.label);
    focus.setAttribute("aria-pressed", String(activeId === group.id));
    focus.innerHTML = `<span>${group.label}</span><small>${repositories.length}</small>`;
    focus.addEventListener("click", () => toggleFocusNode(group.id));

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
      button.setAttribute("aria-label", repo.label);
      button.setAttribute("aria-pressed", String(activeId === repo.id));
      if (query && match) button.classList.add("is-search-match");
      if (query && !match) button.classList.add("is-search-muted");
      const status = repo.archived ? "Archived" : repo.fork ? "Fork" : "Original";
      button.innerHTML = `<span>${repo.label}</span><small>${repo.language || status}</small>`;
      button.addEventListener("click", () => toggleFocusNode(repo.id));
      repoList.append(button);
    }

    section.append(repoList);
    return section;
  }

  function createExternalEntry(repositories, query) {
    const sectionKey = "external:contributions";
    const activeId = activeFocusId();
    const searchOpen = Boolean(query) && repositories.some((repo) => nodeSearchText(repo).includes(query));
    const expanded = manualExpanded.has(sectionKey)
      || repositories.some((repo) => repo.id === activeId)
      || searchOpen;

    const section = document.createElement("section");
    section.className = "category-nav-group category-nav-external";
    section.dataset.externalContributions = "true";
    section.setAttribute("aria-label", "External contributions, not an owned category");

    const row = document.createElement("div");
    row.className = "category-nav-row";

    const heading = document.createElement("div");
    heading.className = "category-nav-focus";
    heading.setAttribute("role", "heading");
    heading.setAttribute("aria-level", "3");
    heading.title = "External contributions are shown separately and are not part of an owned category.";
    heading.innerHTML = `<span>External contributions</span><small>${repositories.length} · not owned</small>`;

    const disclosure = document.createElement("button");
    disclosure.type = "button";
    disclosure.className = "category-nav-disclosure";
    disclosure.setAttribute("aria-expanded", String(expanded));
    disclosure.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} external contribution repositories`);
    disclosure.textContent = expanded ? "−" : "+";
    disclosure.addEventListener("click", () => {
      if (manualExpanded.has(sectionKey)) manualExpanded.delete(sectionKey);
      else manualExpanded.add(sectionKey);
      render({ force: true });
    });

    row.append(heading, disclosure);
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
      button.setAttribute("aria-label", `${repo.label}, external contribution`);
      button.setAttribute("aria-pressed", String(activeId === repo.id));
      if (query && match) button.classList.add("is-search-match");
      if (query && !match) button.classList.add("is-search-muted");
      button.innerHTML = `<span>${repo.label}</span><small>${repo.language || "External"}</small>`;
      button.addEventListener("click", () => toggleFocusNode(repo.id));
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
        .map((group) => ({ group, repositories: repositoriesFor(group) }))
        .filter(({ repositories }) => repositories.length > 0)
        .sort((a, b) => String(a.group.label || "").localeCompare(String(b.group.label || "")));
      const external = externalRepositories();
      const signature = `${groupSignature(groups.map(({ group }) => group))}::external:${external.map((repo) => repo.id).join(",")}`;
      const query = userQuery();
      const activeId = activeFocusId();
      const renderKey = `${signature}::${query}::${activeId}::${[...manualExpanded].sort().join(",")}::${panelOpen}`;
      if (!force && renderKey === lastRenderKey) return;
      lastRenderKey = renderKey;

      list.replaceChildren();
      if (!groups.length && !external.length) {
        summary.textContent = state.graph ? "No visible repositories" : "Loading…";
        clearButton.disabled = !activeId;
        return;
      }

      let repositoryTotal = 0;
      for (const { group, repositories } of groups) {
        repositoryTotal += repositories.length;
        list.append(createGroupEntry(group, repositories, query));
      }
      if (external.length) list.append(createExternalEntry(external, query));
      summary.textContent = fallbackFocus
        ? `${groups.length} categories · Focus: ${fallbackFocus.label}`
        : external.length
          ? `${groups.length} categories · ${repositoryTotal} owned · ${external.length} external`
          : `${groups.length} categories · ${repositoryTotal} repos`;
      clearButton.disabled = !activeId;
    } finally {
      rendering = false;
    }
  }

  toggleButton.addEventListener("click", () => {
    setPanelOpen(!panelOpen);
    render({ force: true });
  });
  clearButton.addEventListener("click", clearFocus);
  searchInput?.addEventListener("input", () => {
    fallbackFocus = null;
    queueMicrotask(() => render({ force: true }));
  });
  for (const button of document.querySelectorAll("[data-status-filter]")) {
    button.addEventListener("click", () => queueMicrotask(() => render({ force: true })));
  }

  updateDetails = function categoryNavigatorUpdateDetails(node) {
    fallbackFocus = null;
    restoreUserQuery();
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

  window.addEventListener("resize", () => {
    if (window.innerWidth < 700 && panelOpen) setPanelOpen(false);
  }, { passive: true });

  setPanelOpen(false);
  render({ force: true });
  window.ProjectMapCategoryNavigator = Object.freeze({
    render: () => render({ force: true }),
    focusCategory: (id) => focusNode(normalizedGroupId(id)),
    focusRepository: focusNode,
    clearFocus,
    expandedCategories: () => [...manualExpanded],
    snapshot: () => ({
      open: panelOpen,
      focus: fallbackFocus || state.selected || null,
      expandedCategories: [...manualExpanded],
    }),
  });
})();
