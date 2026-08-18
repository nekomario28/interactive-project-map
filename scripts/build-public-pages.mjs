import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { renderPagesHome, renderPagesViewer } from "./pages-app.mjs";

export const PUBLIC_ACTION_REF = "5f62155e586dce5d49280e3ca07446c0a201229f";

function externalizeBrowserScript(html, src) {
  const scriptPattern = /<script>[\s\S]*?<\/script>/;
  if (!scriptPattern.test(html)) {
    throw new Error(`Expected one inline browser script for ${src}`);
  }
  return html
    .replace("script-src 'unsafe-inline'", "script-src 'self'")
    .replace(scriptPattern, `<script src="${src}" defer></script>`);
}

function normalizePublicHtml(html) {
  return html
    .replace('<input id="username"', '<input id="username" type="text"')
    .replace(
      '<a id="openMap" class="button" target="_blank" rel="noopener">',
      '<a id="openMap" class="button" href="./u/" target="_blank" rel="noopener">',
    );
}

export async function buildPublicPages(outputDir = join(process.cwd(), "site")) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(join(outputDir, "u"), { recursive: true });

  const sourceDir = join(process.cwd(), "scripts");
  const homeScript = (await readFile(join(sourceDir, "public-home.js"), "utf8")).replaceAll(
    "__PROJECT_MAP_ACTION_REF__",
    PUBLIC_ACTION_REF,
  );
  const viewerScript = await readFile(join(sourceDir, "public-viewer.js"), "utf8");
  const home = normalizePublicHtml(externalizeBrowserScript(renderPagesHome(), "./app.js"));
  const viewer = normalizePublicHtml(externalizeBrowserScript(renderPagesViewer(), "../viewer.js"));

  await writeFile(join(outputDir, ".nojekyll"), "\n");
  await writeFile(join(outputDir, "index.html"), home);
  await writeFile(join(outputDir, "app.js"), homeScript);
  await writeFile(join(outputDir, "viewer.js"), viewerScript);
  await writeFile(join(outputDir, "u", "index.html"), viewer);
}

async function main() {
  const outputDir = join(process.cwd(), "site");
  await buildPublicPages(outputDir);
  console.log(`Built public GitHub Pages app into ${outputDir}`);
  console.log(`Installer Action ref: ${PUBLIC_ACTION_REF}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
