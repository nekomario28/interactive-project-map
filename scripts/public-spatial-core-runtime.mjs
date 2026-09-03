import {
  DEFAULT_FORCE_SETTINGS,
  hashText,
  linkForceEdges,
  normalizeWeightedEdges,
  stepForceLayout,
} from "../packages/spatial-core/src/index.js";

export function spatialCoreRuntimeSource() {
  return `"use strict";\n/* global window */\n(() => {\n  const DEFAULT_FORCE_SETTINGS = Object.freeze(${JSON.stringify(DEFAULT_FORCE_SETTINGS)});\n\n  ${hashText.toString()}\n\n  ${normalizeWeightedEdges.toString()}\n\n  ${linkForceEdges.toString()}\n\n  ${stepForceLayout.toString()}\n\n  window.ProjectMapSpatialCore = Object.freeze({\n    DEFAULT_FORCE_SETTINGS,\n    normalizeWeightedEdges,\n    linkForceEdges,\n    stepForceLayout,\n  });\n})();\n`;
}
