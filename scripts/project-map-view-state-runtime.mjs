import { createProjectMapTransferableStateApi } from "../packages/project-map-view-model/src/view-state.js";

export function projectMapViewStateRuntimeSource() {
  return `"use strict";\nwindow.ProjectMapTransferableState = (${createProjectMapTransferableStateApi.toString()})();\n`;
}
