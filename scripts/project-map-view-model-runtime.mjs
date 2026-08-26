import { createProjectMapViewModelApi } from "../packages/project-map-view-model/src/index.js";
import { createProjectMapLocalGraphApi } from "../packages/project-map-view-model/src/local-graph.js";
import { normalizeWeightedEdges } from "../packages/spatial-core/src/relations.js";

export function projectMapViewModelRuntimeSource() {
  return `"use strict";\n/* global window */\n(() => {\n  const normalizeWeightedEdges = ${normalizeWeightedEdges.toString()};\n  const base = (${createProjectMapViewModelApi.toString()})({ normalizeWeightedEdges });\n  const localGraph = (${createProjectMapLocalGraphApi.toString()})({ projectByStatuses: base.projectByStatuses });\n  window.ProjectMapViewModel = Object.freeze({ ...base, projectLocalGraph: localGraph.project });\n})();\n`;
}
