import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const MARKER = "/* IPM_QUERY_GATED_QUALITY_PRESENTATION_V1 */";
const BOOTSTRAP = `${MARKER}
(() => {
  const requested = new URL(location.href).searchParams.get("quality") === "1";
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

export async function applyQualityView({ siteDir = join(process.cwd(), "site"), sourceDir = join(process.cwd(), "scripts") } = {}) {
  const sourcePath = join(sourceDir, "public-quality-view.js");
  const outputScriptPath = join(siteDir, "quality-view.js");
  const viewStatePath = join(siteDir, "view-state.js");
  const [runtime, originalViewState] = await Promise.all([readFile(sourcePath, "utf8"), readFile(viewStatePath, "utf8")]);

  const viewState = originalViewState.includes(MARKER)
    ? originalViewState
    : `${originalViewState.trimEnd()}\n\n${BOOTSTRAP}\n`;

  await writeFile(outputScriptPath, runtime);
  if (viewState !== originalViewState) await writeFile(viewStatePath, viewState);
  return { viewStatePath, outputScriptPath, injected: viewState !== originalViewState };
}

async function main() {
  const result = await applyQualityView();
  console.log(`Applied query-gated Quality presentation bootstrap to ${result.viewStatePath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
