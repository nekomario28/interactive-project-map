import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEDICATED_STYLES = ["radial", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"];
const STATUS_CONTROLS = '<button type="button" data-status-filter="original" aria-pressed="true">Original</button><button type="button" data-status-filter="fork" aria-pressed="true">Fork</button><button type="button" data-status-filter="archived" aria-pressed="true">Archived</button><span id="resultCount" aria-live="polite"></span>';
const RESET_BUTTON = '<button id="reset" type="button">Reset</button>';
const ADAPTER_SCRIPT = '<script src="../dedicated-view-state.js" defer></script>';

export async function applyDedicatedViewState(outputDir = resolve(process.cwd(), "site")) {
  const sourceDir = resolve(process.cwd(), "scripts");
  await copyFile(join(sourceDir, "public-dedicated-view-state.js"), join(outputDir, "dedicated-view-state.js"));

  for (const mode of DEDICATED_STYLES) {
    const htmlPath = join(outputDir, mode, "index.html");
    const viewerScript = `<script src="../${mode}-viewer.js" defer></script>`;
    const html = await readFile(htmlPath, "utf8");
    if (!html.includes(RESET_BUTTON)) throw new Error(`Reset control not found in ${mode} viewer`);
    if (!html.includes(viewerScript)) throw new Error(`Viewer script not found in ${mode} viewer`);
    let next = html;
    if (!next.includes('data-status-filter="original"')) next = next.replace(RESET_BUTTON, `${RESET_BUTTON}${STATUS_CONTROLS}`);
    if (!next.includes(ADAPTER_SCRIPT)) next = next.replace(viewerScript, `${ADAPTER_SCRIPT}\n${viewerScript}`);
    if (!next.includes('data-status-filter="archived"') || !next.includes(ADAPTER_SCRIPT)) {
      throw new Error(`Could not attach repository filters to ${mode} viewer`);
    }
    if (next !== html) await writeFile(htmlPath, next);
  }
}

async function main() {
  const outputDir = resolve(process.argv[2] || join(process.cwd(), "site"));
  await applyDedicatedViewState(outputDir);
  console.log(`Attached shared repository status projection to ${DEDICATED_STYLES.length} dedicated viewers`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
