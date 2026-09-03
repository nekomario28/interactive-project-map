import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PROJECT_MAP_ACTION_REF } from "../src/action-ref.ts";

// Compatibility export for validators/tests that consume the emitted Pages
// release surface. The authority lives in src/action-ref.ts.
export const PUBLIC_ACTION_REF = PROJECT_MAP_ACTION_REF;

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
    if (/frame-ancestors\s+'none'/.test(source)) {
      throw new Error(`Legacy frame-ancestors CSP reached postprocess: ${path}`);
    }
    if (/style-src\s+'self'(?!\s+'unsafe-inline')/.test(source)) {
      throw new Error(`Non-canonical style-src CSP reached postprocess: ${path}`);
    }
  }
}

async function main() {
  const outputDir = resolve(process.argv[2] || join(process.cwd(), "site"));
  await postprocessPublicPages(outputDir);
  console.log(`Validated canonical public Pages output in ${outputDir}`);
  console.log(`Published installer Action ref: ${PUBLIC_ACTION_REF}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
