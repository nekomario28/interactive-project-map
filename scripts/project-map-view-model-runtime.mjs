import { createProjectMapViewModelApi } from "../packages/project-map-view-model/src/index.js";
import { createProjectMapLocalGraphApi } from "../packages/project-map-view-model/src/local-graph.js";
import { createRendererSnapshot } from "../packages/project-map-view-model/src/renderer-snapshot.js";
import { createProjectMapSearchContextApi } from "../packages/project-map-view-model/src/search-context.js";
import { normalizeWeightedEdges } from "../packages/spatial-core/src/relations.js";

export function projectMapViewModelRuntimeSource() {
  return `"use strict";\n(() => {\n  const normalizeWeightedEdges = ${normalizeWeightedEdges.toString()};\n  const base = (${createProjectMapViewModelApi.toString()})({ normalizeWeightedEdges });\n  const localGraph = (${createProjectMapLocalGraphApi.toString()})({ projectByStatuses: base.projectByStatuses });\n  const searchContext = (${createProjectMapSearchContextApi.toString()})();\n  const rendererSnapshot = ${createRendererSnapshot.toString()};\n  window.ProjectMapViewModel = Object.freeze({ ...base, projectLocalGraph: localGraph.project, normalizeSearchQuery: searchContext.normalizeQuery, projectSearchContext: searchContext.project, createRendererSnapshot: rendererSnapshot });\n})();\n`;
}
