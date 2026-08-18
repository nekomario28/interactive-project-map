import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PUBLIC_ACTION_REF = "f9bf4b1117b596bf1fdc005722008f43a1e66077";
const BUILDER_ACTION_REF = "30c33c76008b282de8990333c879ae8c1da853d7";

const MOBILE_FIX = `

/* Emitted-site mobile hardening: keep the viewer inside narrow viewports. */
@media (max-width: 480px) {
  .app,
  .toolbar,
  .controls,
  .workspace,
  footer {
    min-width: 0;
    max-width: 100%;
  }

  .app {
    width: 100%;
  }

  .controls {
    width: 100%;
  }

  .field {
    min-width: 0;
  }

  .field:first-child {
    flex: 1 1 100%;
  }

  .field:nth-child(2) {
    flex: 1 1 150px;
  }

  .field select {
    width: 100%;
    min-width: 0;
  }

  .toolbar button {
    flex: 0 0 auto;
  }

  footer {
    overflow: hidden;
  }

  footer > span:first-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
`;

async function htmlFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await htmlFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) found.push(path);
  }
  return found;
}

export async function postprocessPublicPages(outputDir = resolve(process.cwd(), "site")) {
  for (const path of await htmlFiles(outputDir)) {
    const source = await readFile(path, "utf8");
    const cleaned = source
      .replace(/;?\s*frame-ancestors\s+'none'/g, "")
      .replace(/style-src\s+'self'(?!\s+'unsafe-inline')/g, "style-src 'self' 'unsafe-inline'");
    if (cleaned !== source) await writeFile(path, cleaned);
  }

  const cssPath = join(outputDir, "viewer.css");
  const css = await readFile(cssPath, "utf8");
  if (!css.includes("Emitted-site mobile hardening")) await writeFile(cssPath, css + MOBILE_FIX);

  const appPath = join(outputDir, "app.js");
  const app = await readFile(appPath, "utf8");
  if (!app.includes(BUILDER_ACTION_REF) && !app.includes(PUBLIC_ACTION_REF)) throw new Error("Emitted app.js does not contain the expected installer Action ref");
  const promotedApp = app.replaceAll(BUILDER_ACTION_REF, PUBLIC_ACTION_REF);
  if (!promotedApp.includes(PUBLIC_ACTION_REF) || promotedApp.includes(BUILDER_ACTION_REF)) throw new Error("Could not promote emitted installer Action ref");
  if (promotedApp !== app) await writeFile(appPath, promotedApp);
}

async function main() {
  const outputDir = resolve(process.argv[2] || join(process.cwd(), "site"));
  await postprocessPublicPages(outputDir);
  console.log(`Postprocessed public Pages output in ${outputDir}`);
  console.log(`Published installer Action ref: ${PUBLIC_ACTION_REF}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
