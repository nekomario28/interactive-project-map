"use strict";

(() => {
  if (window.ProjectMapThreejsCategoryNavigator) return;

  let adapter = null;
  let panelOpen = false;
  let initialized = false;
  let rendering = false;
  let lastRenderKey = "";
  const manualExpanded = new Set();

  function normalizedGroupId(value) {
    const id = String(value || "");
    if (!id) return "";
    return id.startsWith("group:") ? id : `group:${id}`;
  }

  function graphNodes() {
    const graph = adapter?.graph?.();
    return Array.isArray(graph?.nodes) ? graph.nodes : [];
  }

  function nodeById(id) {
    return adapter?.node?.(id) || graphNodes().find((node) => node?.id === id) || null;
  }

  function selectedId() {
    return adapter?.selectedId?.() || "";
  }

  function selectedGroupId() {
    const selected = nodeById(selectedId());
    if (!selected) return "";
    if (selected.type === "group") return normalizedGroupId(selected.id);
    if (selected.type === "repository") return normalizedGroupId(selected.groupId);
    return "";
  }

  function searchSnapshot() {
    return window.ProjectMapSearchContext?.snapshot?.() || {
      query: "",
      directRepositoryIds: [],
      directCategoryIds: [],
      contextCategoryIds: [],
      categoryMemberIds: [],
      matchReasons: {},
    };
  }

  function searchLevel(node) {
    return window.ProjectMapSearchContext?.level?.(node) || (searchSnapshot().query ? "none" : "all");
  }

  function isVisible(node) {
    return Boolean(node?.id && adapter?.isVisible?.(node.id));
  }

  function repositoriesFor(group) {
    const id = normalizedGroupId(group.id);
    const raw = String(group.id || "").replace(/^group:/, "");
    return graphNodes()
      .filter((node) => node?.type === "repository"
        && node.relation !== "contributed"
        && isVisible(node)
        && (normalizedGroupId(node.groupId) === id || node.groupId === raw))
      .sort((a, b) => (b.stars || 0) - (a.stars || 0) || String(a.label || "").localeCompare(String(b.label || "")));
  }

  function externalRepositories() {
    return graphNodes()
      .filter((node) => node?.type === "repository" && node.relation === "contributed" && isVisible(node))
      .sort((a, b) => String(a.label || "").localeCompare(String(b.label || "")));
  }

  function isDirectSearchLevel(level) {
    return level === "direct" || level === "direct-category";
  }

  function applySearchPresentation(element, node, query) {
    if (!query) return;
    const level = searchLevel(node);
    if (isDirectSearchLevel(level)) element.classList.add("is-search-match");
    else if (level === "none") element.classList.add("is-search-muted");
  }

  function toggleSelection(id) {
    if (!adapter) return;
    if (selectedId() === id) adapter.clearSelection?.();
    else adapter.selectNode?.(id);
    queueMicrotask(() => render({ force: true }));
  }

  function setPanelOpen(open) {
    panelOpen = Boolean(open);
    const panel = document.getElementById("categoryNavigator");
    const toggle = document.getElementById("categoryNavigatorToggle");
    panel?.classList.toggle("is-open", panelOpen);
    toggle?.setAttribute("aria-expanded", String(panelOpen));
  }

  function createRepositoryButton(repo, query) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-nav-repository";
    button.dataset.repositoryId = repo.id;
    button.setAttribute("aria-label", repo.relation === "contributed" ? `${repo.label}, external contribution` : repo.label);
    button.setAttribute("aria-pressed", String(selectedId() === repo.id));
    applySearchPresentation(button, repo, query);
    const fallbackStatus = repo.archived ? "Archived" : repo.fork ? "Fork" : repo.relation === "contributed" ? "External" : "Original";
    button.innerHTML = `<span>${repo.label}</span><small>${repo.language || fallbackStatus}</small>`;
    button.addEventListener("click", () => toggleSelection(repo.id));
    return button;
  }

  function createGroupEntry(group, repositories, query) {
    const groupId = normalizedGroupId(group.id);
    const activeId = selectedId();
    const activeGroup = selectedGroupId();
    const searchOpen = Boolean(query) && (searchLevel(group) !== "none" || repositories.some((repo) => searchLevel(repo) !== "none"));
    const expanded = manualExpanded.has(groupId) || activeGroup === groupId || searchOpen;

    const section = document.createElement("section");
    section.className = "category-nav-group";
    if (activeId === group.id) section.classList.add("is-selected");
    if (activeGroup === groupId) section.classList.add("has-selected-repository");

    const row = document.createElement("div");
    row.className = "category-nav-row";

    const focus = document.createElement("button");
    focus.type = "button";
    focus.className = "category-nav-focus";
    focus.dataset.categoryId = group.id;
    focus.setAttribute("aria-label", group.label);
    focus.setAttribute("aria-pressed", String(activeId === group.id));
    applySearchPresentation(focus, group, query);
    focus.innerHTML = `<span>${group.label}</span><small>${repositories.length}</small>`;
    focus.addEventListener("click", () => toggleSelection(group.id));

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
    for (const repo of repositories) repoList.append(createRepositoryButton(repo, query));
    section.append(repoList);
    return section;
  }

  function createExternalEntry(repositories, query) {
    const sectionKey = "external:contributions";
    const activeId = selectedId();
    const searchOpen = Boolean(query) && repositories.some((repo) => searchLevel(repo) !== "none");
    const expanded = manualExpanded.has(sectionKey) || repositories.some((repo) => repo.id === activeId) || searchOpen;

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
    for (const repo of repositories) repoList.append(createRepositoryButton(repo, query));
    section.append(repoList);
    return section;
  }

  function render({ force = false } = {}) {
    if (!adapter || rendering) return;
    const list = document.getElementById("categoryNavigatorList");
    const summary = document.getElementById("categoryNavigatorSummary");
    const clear = document.getElementById("categoryNavigatorClear");
    if (!list || !summary || !clear) return;

    rendering = true;
    try {
      const groups = graphNodes()
        .filter((node) => node?.type === "group" && isVisible(node))
        .map((group) => ({ group, repositories: repositoriesFor(group) }))
        .filter(({ repositories }) => repositories.length > 0)
        .sort((a, b) => String(a.group.label || "").localeCompare(String(b.group.label || "")));
      const external = externalRepositories();
      const search = searchSnapshot();
      const query = String(search.query || "");
      const key = JSON.stringify({
        groups: groups.map(({ group, repositories }) => [group.id, repositories.map((repo) => repo.id)]),
        external: external.map((repo) => repo.id),
        query,
        selectedId: selectedId(),
        expanded: [...manualExpanded].sort(),
        open: panelOpen,
      });
      if (!force && key === lastRenderKey) return;
      lastRenderKey = key;

      list.replaceChildren();
      let ownedTotal = 0;
      for (const { group, repositories } of groups) {
        ownedTotal += repositories.length;
        list.append(createGroupEntry(group, repositories, query));
      }
      if (external.length) list.append(createExternalEntry(external, query));

      if (!groups.length && !external.length) summary.textContent = "No visible repositories";
      else if (external.length) summary.textContent = `${groups.length} categories · ${ownedTotal} owned · ${external.length} external`;
      else summary.textContent = `${groups.length} categories · ${ownedTotal} repos`;
      clear.disabled = !selectedId();
    } finally {
      rendering = false;
    }
  }

  function init() {
    if (initialized) return;
    adapter = window.ProjectMapThreejsNavigatorAdapter;
    if (!adapter) return;
    const workspace = document.querySelector(".workspace");
    const controls = document.querySelector(".controls");
    if (!workspace || !controls) return;
    initialized = true;

    const toggle = document.createElement("button");
    toggle.id = "categoryNavigatorToggle";
    toggle.type = "button";
    toggle.textContent = "Categories";
    toggle.setAttribute("aria-controls", "categoryNavigator");
    toggle.setAttribute("aria-expanded", "false");
    controls.prepend(toggle);

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

    toggle.addEventListener("click", () => {
      setPanelOpen(!panelOpen);
      render({ force: true });
    });
    panel.querySelector("#categoryNavigatorClear")?.addEventListener("click", () => {
      adapter.clearSelection?.();
      render({ force: true });
    });
    document.getElementById("search")?.addEventListener("input", () => queueMicrotask(() => render({ force: true })));
    window.addEventListener("projectmap:threejs-navigator-change", () => render({ force: true }));
    window.addEventListener("resize", () => {
      if (window.innerWidth < 700 && panelOpen) setPanelOpen(false);
    }, { passive: true });

    setPanelOpen(false);
    render({ force: true });
    window.ProjectMapThreejsCategoryNavigator = Object.freeze({
      version: 1,
      render: () => render({ force: true }),
      open: () => { setPanelOpen(true); render({ force: true }); },
      close: () => setPanelOpen(false),
      selectNode: (id) => toggleSelection(id),
      clearSelection: () => adapter.clearSelection?.(),
      snapshot: () => ({
        open: panelOpen,
        selectedId: selectedId(),
        expandedCategories: [...manualExpanded].sort(),
        visibleRepositoryIds: graphNodes().filter((node) => node?.type === "repository" && isVisible(node)).map((node) => node.id).sort(),
        externalRepositoryIds: externalRepositories().map((node) => node.id),
      }),
    });
  }

  window.addEventListener("projectmap:threejs-navigator-ready", init);
  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
