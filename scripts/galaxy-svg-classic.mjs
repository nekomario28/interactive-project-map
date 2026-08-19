import { renderGalaxySvg } from "./svg.mjs";

export function renderGalaxyClassicSvg(graph, theme, width, height) {
  const denseGraph = {
    ...graph,
    repositoryCount: Math.max(81, graph.repositoryCount ?? graph.nodes.filter((node) => node.type === "repository").length),
  };
  return renderGalaxySvg(denseGraph, theme, width, height, "galaxy")
    .replace('role="img" aria-label="Galaxy-style map', 'role="img" data-galaxy-preset="classic" aria-label="Galaxy-style map')
    .replace('>project map</text>', '>Galaxy Classic</text>');
}
