import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildThreejsLab } from "./build-threejs-lab.mjs";
import { projectMapViewStateRuntimeSource } from "./project-map-view-state-runtime.mjs";

const MARKER = "/* IPM_QUERY_GATED_QUALITY_PRESENTATION_V1 */";
const TRANSFER_MARKER = "/* IPM_RENDERER_NEUTRAL_TRANSFERABLE_STATE_V1 */";
const TRANSFER_SCRIPT = '<script src="../project-map-view-state.js" defer></script>';
const BOOTSTRAP = `${MARKER}
(() => {
  const requested = new URL(location.href).searchParams.get("quality") === "1";

  function installExperimentalControl() {
    if (document.getElementById("qualityToggle")) return;
    const host = document.querySelector(".control-cluster.view-options") || document.querySelector(".controls");
    if (!host) return;
    const button = document.createElement("button");
    button.id = "qualityToggle";
    button.type = "button";
    button.dataset.qualityDiscoverability = "experimental";
    button.setAttribute("aria-pressed", String(requested));
    button.textContent = requested ? "Quality On (experimental)" : "Quality (experimental)";
    button.title = requested
      ? "Disable the experimental Quality overlay and return to Structure. Quality evidence may be a frozen snapshot."
      : "Opt in to the experimental Quality overlay. Structure remains the default; Quality evidence may be a frozen snapshot.";
    button.addEventListener("click", () => {
      const url = new URL(location.href);
      if (requested) url.searchParams.delete("quality");
      else url.searchParams.set("quality", "1");
      location.assign(url.toString());
    });
    host.append(button);
  }

  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", installExperimentalControl, { once: true });
  else installExperimentalControl();

  if (!requested) {
    document.body.dataset.qualityMode = "disabled";
    window.ProjectMapQualityView = Object.freeze({
      snapshot: () => ({
        requested: false,
        state: "disabled",
        presentationUrl: null,
        available: 0,
        unavailable: 0,
        lastDrawnRings: 0,
        error: null,
        featureGate: "query-param",
        defaultAdditionalRequests: 0,
        semanticSource: "renderer-neutral-presentation",
        geometryAuthority: "overlay-only",
        productionRankingAllowed: false,
      }),
    });
    return;
  }
  const script = document.createElement("script");
  script.src = "../quality-view.js";
  script.async = false;
  document.body.append(script);
})();`;

export function patchSharedTransferableViewState(source) {
  if (source.includes(TRANSFER_MARKER)) return source;
  const parsePattern = /    function parseStatuses\(value\) \{[\s\S]*?\n    \}\n\n    const statuses = parseStatuses\(initialParams\.get\("status"\)\);/;
  if (!parsePattern.test(source)) throw new Error("Could not locate shared 2D status URL parser");
  let next = source.replace(parsePattern, `    ${TRANSFER_MARKER}
    function parseStatuses(value) {
      const shared = window.ProjectMapTransferableState?.parse(location.href);
      if (Array.isArray(shared?.statuses)) {
        const parsed = shared.statuses.filter((item) => STATUS_VALUES.includes(item));
        if (parsed.length) return new Set(parsed);
      }
      if (!value) return new Set(STATUS_VALUES);
      const aliases = { o: "original", f: "fork", a: "archived", c: "contributed" };
      const parsed = String(value)
        .split(",")
        .map((item) => aliases[item] || item)
        .filter((item) => STATUS_VALUES.includes(item));
      return parsed.length ? new Set(parsed) : new Set(STATUS_VALUES);
    }

    const statuses = parseStatuses(initialParams.get("status"));`);

  const syncPattern = /    function syncUrl\(\) \{[\s\S]*?\n    \}\n\n    function visibleRepositories\(\) \{/;
  if (!syncPattern.test(next)) throw new Error("Could not locate shared 2D URL serializer");
  next = next.replace(syncPattern, `    function syncUrl() {
      const api = window.ProjectMapTransferableState;
      if (!api) return;
      const counts = statusCounts();
      const available = state.graph ? STATUS_VALUES.filter((value) => counts[value] > 0) : STATUS_VALUES;
      const current = api.parse(location.href);
      const url = api.applyToUrl(new URL(location.href), {
        ...current,
        statuses: STATUS_VALUES.filter((value) => statuses.has(value)),
        motionOff: userMotionOff,
        activity,
        focus: focusRoot,
        depth: focusDepth,
        q: state.query,
      }, { availableStatuses: available });
      history.replaceState(null, "", url);
    }

    function visibleRepositories() {`);
  return next;
}

export function attachTransferableStateScript(html) {
  if (html.includes(TRANSFER_SCRIPT)) return html;
  const viewStateScript = '<script src="../view-state.js" defer></script>';
  if (!html.includes(viewStateScript)) throw new Error("Could not locate shared 2D view-state script tag");
  return html.replace(viewStateScript, `${TRANSFER_SCRIPT}\n${viewStateScript}`);
}

export async function applyQualityView({ siteDir = join(process.cwd(), "site"), sourceDir = join(process.cwd(), "scripts") } = {}) {
  const sourcePath = join(sourceDir, "public-quality-view.js");
  const outputScriptPath = join(siteDir, "quality-view.js");
  const transferableRuntimePath = join(siteDir, "project-map-view-state.js");
  const viewStatePath = join(siteDir, "view-state.js");
  const viewerHtmlPath = join(siteDir, "u", "index.html");
  const [runtime, originalViewState, originalViewerHtml] = await Promise.all([
    readFile(sourcePath, "utf8"),
    readFile(viewStatePath, "utf8"),
    readFile(viewerHtmlPath, "utf8"),
  ]);

  const withTransferableState = patchSharedTransferableViewState(originalViewState);
  const viewState = withTransferableState.includes(MARKER)
    ? withTransferableState
    : `${withTransferableState.trimEnd()}\n\n${BOOTSTRAP}\n`;
  const viewerHtml = attachTransferableStateScript(originalViewerHtml);

  await Promise.all([
    writeFile(outputScriptPath, runtime),
    writeFile(transferableRuntimePath, projectMapViewStateRuntimeSource()),
  ]);
  if (viewState !== originalViewState) await writeFile(viewStatePath, viewState);
  if (viewerHtml !== originalViewerHtml) await writeFile(viewerHtmlPath, viewerHtml);
  return {
    viewStatePath,
    outputScriptPath,
    transferableRuntimePath,
    viewerHtmlPath,
    injected: viewState !== originalViewState || viewerHtml !== originalViewerHtml,
  };
}

async function main() {
  const result = await applyQualityView();
  const threejs = await buildThreejsLab();
  console.log(`Applied query-gated Quality presentation bootstrap to ${result.viewStatePath}`);
  console.log(`Attached renderer-neutral transferable state to ${result.viewerHtmlPath}`);
  console.log(`Built isolated Three.js cosmic lab into ${threejs.threeDir}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
