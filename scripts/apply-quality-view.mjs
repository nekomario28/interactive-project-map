import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SCRIPT_TAG = '<script src="../quality-view.js" defer></script>';

export async function applyQualityView({
  siteDir = join(process.cwd(), "site"),
  sourceDir = join(process.cwd(), "scripts"),
} = {}) {
  const sourcePath = join(sourceDir, "public-quality-view.js");
  const outputScriptPath = join(siteDir, "quality-view.js");
  const viewerPath = join(siteDir, "u", "index.html");

  const [script, originalHtml] = await Promise.all([
    readFile(sourcePath, "utf8"),
    readFile(viewerPath, "utf8"),
  ]);

  let html = originalHtml;
  if (!html.includes(SCRIPT_TAG)) {
    if (!html.includes("</body>")) throw new Error("Could not inject Quality viewer runtime: </body> not found");
    html = html.replace("</body>", `${SCRIPT_TAG}\n</body>`);
  }

  await writeFile(outputScriptPath, script);
  if (html !== originalHtml) await writeFile(viewerPath, html);

  return {
    viewerPath,
    outputScriptPath,
    injected: html !== originalHtml,
  };
}

async function main() {
  const result = await applyQualityView();
  console.log(`Applied opt-in Quality viewer runtime to ${result.viewerPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
