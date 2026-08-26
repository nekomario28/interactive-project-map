import { createProjectMapViewModelApi } from "../packages/project-map-view-model/src/index.js";
import { normalizeWeightedEdges } from "../packages/spatial-core/src/relations.js";

export function projectMapViewModelRuntimeSource() {
  return `"use strict";\n/* global window */\n(() => {\n  const normalizeWeightedEdges = ${normalizeWeightedEdges.toString()};\n  window.ProjectMapViewModel = (${createProjectMapViewModelApi.toString()})({ normalizeWeightedEdges });\n})();\n`;
}
