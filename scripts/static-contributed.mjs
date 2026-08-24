export const CONTRIBUTED_DARK = "#E69F00";
export const CONTRIBUTED_LIGHT = "#A85D00";
export const EXTERNAL_GROUP_ID = "group:__project_map_external_contributions__";
export const EXTERNAL_GROUP_LABEL = "External contributions";

export function isContributedRepository(node) {
  return node?.type === "repository" && node?.relation === "contributed";
}

export function repositoryStatus(node) {
  if (node?.type !== "repository") return node?.type;
  if (isContributedRepository(node)) return "contributed";
  if (node.archived) return "archived";
  return node.fork ? "fork" : "original";
}

export function contributedColor(theme) {
  return theme === "light" ? CONTRIBUTED_LIGHT : CONTRIBUTED_DARK;
}

export function withContributedColor(colors, theme) {
  return { ...colors, contributed: contributedColor(theme) };
}

export function repositoryOpacity(node, defaults = {}) {
  const status = repositoryStatus(node);
  if (status === "contributed") return defaults.contributed ?? 0.96;
  if (status === "archived") return defaults.archived ?? 0.72;
  if (status === "fork") return defaults.fork ?? 0.82;
  return defaults.original ?? 0.96;
}

export function shouldDecorateArchived(node) {
  return node?.type === "repository" && node?.archived === true && !isContributedRepository(node);
}

export function visibleStructuralEdges(edges) {
  return Array.isArray(edges) ? edges.filter((edge) => edge?.type !== "contribution") : [];
}

export function partitionExternalRepositories(repositories) {
  const repos = Array.isArray(repositories) ? repositories : [];
  return {
    owned: repos.filter((repo) => !isContributedRepository(repo)),
    contributed: repos.filter(isContributedRepository),
  };
}

export function externalPresentationGroup(count) {
  return {
    id: EXTERNAL_GROUP_ID,
    label: EXTERNAL_GROUP_LABEL,
    type: "group",
    repositoryCount: Math.max(0, Number.isFinite(count) ? Math.floor(count) : 0),
    presentationOnly: true,
    external: true,
  };
}

export function addExternalBundle(bundles, repositories, makeBundle = (group, members) => ({ group, members })) {
  const contributed = (Array.isArray(repositories) ? repositories : []).filter(isContributedRepository);
  if (!contributed.length) return bundles;
  return [...bundles, makeBundle(externalPresentationGroup(contributed.length), contributed)];
}

export function statusLegendItems(colors) {
  return [
    [colors.original, "Original"],
    [colors.fork, "Fork"],
    [colors.archived, "Archived"],
    [colors.contributed, "Contributed"],
  ];
}
