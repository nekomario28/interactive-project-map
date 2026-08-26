export function createProjectMapSearchContextApi() {
  function normalizeQuery(value) {
    return String(value || "").normalize("NFKC").toLocaleLowerCase("en-US").trim();
  }

  function groupNodeId(value) {
    const id = String(value || "");
    if (!id) return "";
    return id.startsWith("group:") ? id : `group:${id}`;
  }

  function searchText(values) {
    return values.filter(Boolean).join(" ").normalize("NFKC").toLocaleLowerCase("en-US");
  }

  function directMatchReasons(repository, query) {
    const reasons = [];
    const add = (reason) => {
      if (reason && !reasons.includes(reason)) reasons.push(reason);
    };
    if (searchText([repository.label]).includes(query)) add("repo name");
    if (searchText([repository.description]).includes(query)) add("description");
    if (repository.language && searchText([repository.language]).includes(query)) add(`language:${repository.language}`);
    for (const topic of Array.isArray(repository.topics) ? repository.topics : []) {
      const reason = `topic:${topic}`;
      if (searchText([topic, reason]).includes(query)) add(reason);
    }
    for (const facet of Array.isArray(repository.searchFacets) ? repository.searchFacets : []) {
      if (searchText([facet]).includes(query)) add(facet);
    }
    return reasons;
  }

  function categoryMatches(group, query, taxonomyById) {
    const id = String(group.id || "").replace(/^group:/, "");
    const category = taxonomyById.get(id);
    return searchText([group.label, id, ...(category?.aliases || [])]).includes(query);
  }

  function project(graph, queryValue) {
    const query = normalizeQuery(queryValue);
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    const repositories = nodes.filter((node) => node?.type === "repository");
    const groups = nodes.filter((node) => node?.type === "group");
    const nodeById = new Map(nodes.filter((node) => typeof node?.id === "string").map((node) => [node.id, node]));
    const taxonomyById = new Map(
      (Array.isArray(graph?.searchTaxonomy?.categories) ? graph.searchTaxonomy.categories : [])
        .filter((category) => category && typeof category.id === "string")
        .map((category) => [category.id, category]),
    );

    const directRepositoryIds = new Set();
    const directCategoryIds = new Set();
    const contextCategoryIds = new Set();
    const categoryMemberIds = new Set();
    const matchReasons = new Map();

    if (query) {
      for (const repository of repositories) {
        const reasons = directMatchReasons(repository, query);
        if (!reasons.length) continue;
        directRepositoryIds.add(repository.id);
        matchReasons.set(repository.id, reasons);
      }
      for (const group of groups) {
        if (!categoryMatches(group, query, taxonomyById)) continue;
        directCategoryIds.add(group.id);
        matchReasons.set(group.id, ["category"]);
      }

      for (const repository of repositories) {
        if (!directRepositoryIds.has(repository.id)) continue;
        const id = groupNodeId(repository.groupId);
        if (id) contextCategoryIds.add(id);
      }
      for (const edge of Array.isArray(graph?.edges) ? graph.edges : []) {
        if (edge?.type !== "membership" || !directRepositoryIds.has(edge.target)) continue;
        if (typeof edge.source === "string" && edge.source.startsWith("group:")) contextCategoryIds.add(edge.source);
      }

      for (const id of directCategoryIds) contextCategoryIds.add(id);
      if (directCategoryIds.size) {
        for (const repository of repositories) {
          const id = groupNodeId(repository.groupId);
          if (id && directCategoryIds.has(id)) categoryMemberIds.add(repository.id);
        }
        for (const edge of Array.isArray(graph?.edges) ? graph.edges : []) {
          if (edge?.type === "membership" && directCategoryIds.has(edge.source)) categoryMemberIds.add(edge.target);
        }
      }
    }

    function nodeFor(nodeOrId) {
      if (nodeOrId && typeof nodeOrId === "object") return nodeOrId;
      return nodeById.get(String(nodeOrId || "")) || null;
    }

    function level(nodeOrId) {
      const node = nodeFor(nodeOrId);
      if (!query || !node) return query ? "none" : "all";
      if (node.type === "repository") {
        if (directRepositoryIds.has(node.id)) return "direct";
        if (categoryMemberIds.has(node.id)) return "category-member";
        return "none";
      }
      if (node.type === "group") {
        if (directCategoryIds.has(node.id)) return "direct-category";
        if (contextCategoryIds.has(node.id)) return "category-context";
      }
      return "none";
    }

    function reasons(nodeOrId) {
      const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId?.id;
      return [...(matchReasons.get(id) || [])];
    }

    function snapshot() {
      return {
        query,
        directRepositoryIds: [...directRepositoryIds].sort(),
        directCategoryIds: [...directCategoryIds].sort(),
        contextCategoryIds: [...contextCategoryIds].sort(),
        categoryMemberIds: [...categoryMemberIds].sort(),
        matchReasons: Object.fromEntries([...matchReasons.entries()].sort(([a], [b]) => a.localeCompare(b))),
      };
    }

    return Object.freeze({
      query,
      directRepositoryIds: Object.freeze([...directRepositoryIds]),
      directCategoryIds: Object.freeze([...directCategoryIds]),
      contextCategoryIds: Object.freeze([...contextCategoryIds]),
      categoryMemberIds: Object.freeze([...categoryMemberIds]),
      level,
      matches: (nodeOrId) => level(nodeOrId) !== "none",
      reasons,
      directRepositories: () => [...directRepositoryIds],
      snapshot,
    });
  }

  return Object.freeze({
    version: 1,
    normalizeQuery,
    project,
  });
}

export const ProjectMapSearchContext = createProjectMapSearchContextApi();
