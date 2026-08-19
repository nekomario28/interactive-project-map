"use strict";

window.GalaxyCommon = (() => {
  const TAU = Math.PI * 2;
  const GALAXY_STYLES = new Set(["galaxy-classic", "galaxy-systems", "galaxy-hybrid"]);

  function rgba(hex, alpha) {
    const value = String(hex || "#000000").replace("#", "");
    const full = value.length === 3 ? value.split("").map((part) => part + part).join("") : value.padEnd(6, "0").slice(0, 6);
    return `rgba(${parseInt(full.slice(0, 2), 16)}, ${parseInt(full.slice(2, 4), 16)}, ${parseInt(full.slice(4, 6), 16)}, ${alpha})`;
  }

  function wrapAngle(angle) {
    let value = angle % TAU;
    if (value > Math.PI) value -= TAU;
    if (value < -Math.PI) value += TAU;
    return value;
  }

  function isGalaxyStyle(style) {
    return GALAXY_STYLES.has(style);
  }

  function memberMap(state) {
    const result = new Map();
    const groups = state.nodes.filter((node) => node.type === "group");
    for (const group of groups) result.set(group.id, []);
    const assigned = new Set();
    for (const edge of state.edges) {
      if (!["membership", "member"].includes(edge.type)) continue;
      const source = state.byId.get(edge.source);
      const target = state.byId.get(edge.target);
      if (source?.type === "group" && target?.type === "repository") {
        result.get(source.id)?.push(target);
        assigned.add(target.id);
      } else if (target?.type === "group" && source?.type === "repository") {
        result.get(target.id)?.push(source);
        assigned.add(source.id);
      }
    }
    for (const repo of state.nodes.filter((node) => node.type === "repository" && !assigned.has(node.id))) {
      const group = groups.find((candidate) => candidate.id === `group:${repo.groupId}` || String(candidate.id).replace(/^group:/, "") === repo.groupId);
      if (group) result.get(group.id)?.push(repo);
    }
    for (const members of result.values()) members.sort((a, b) => (b.stars || 0) - (a.stars || 0) || String(a.id).localeCompare(String(b.id)));
    return result;
  }

  function categoryForRepository(state, repo) {
    if (!repo || repo.type !== "repository") return null;
    const directId = repo.groupId ? `group:${repo.groupId}` : null;
    if (directId && state.byId.has(directId)) return state.byId.get(directId);
    for (const edge of state.edges) {
      if (!["membership", "member"].includes(edge.type)) continue;
      if (edge.source === repo.id && state.byId.get(edge.target)?.type === "group") return state.byId.get(edge.target);
      if (edge.target === repo.id && state.byId.get(edge.source)?.type === "group") return state.byId.get(edge.source);
    }
    return null;
  }

  function ownerNode(state) {
    return state.nodes.find((node) => node.type === "owner") || null;
  }

  return { TAU, GALAXY_STYLES, rgba, wrapAngle, isGalaxyStyle, memberMap, categoryForRepository, ownerNode };
})();
