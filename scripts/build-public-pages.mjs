import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { renderPagesHome, renderPagesViewer } from "./pages-app.mjs";

export const PUBLIC_ACTION_REF = "5f62155e586dce5d49280e3ca07446c0a201229f";

export async function buildPublicPages(outputDir = join(process.cwd(), "site")) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(join(outputDir, "u"), { recursive: true });
  const home = renderPagesHome().replaceAll(
    "nekomario28/interactive-project-map@v1",
    `nekomario28/interactive-project-map@${PUBLIC_ACTION_REF}`,
  );
  await writeFile(join(outputDir, ".nojekyll"), "\n");
  await writeFile(join(outputDir, "index.html"), home);
  await writeFile(join(outputDir, "u", "index.html"), renderPagesViewer());
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
