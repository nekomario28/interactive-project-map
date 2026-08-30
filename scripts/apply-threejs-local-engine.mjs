import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const THREE_VERSION = "0.185.1";
export const THREE_SOURCE_COMMIT = "2431a09f46f34c560bc8e44b33be0e567723d5b9";
export const THREE_SOURCE_URL = `https://raw.githubusercontent.com/mrdoob/three.js/${THREE_SOURCE_COMMIT}/build/three.module.min.js`;
export const THREE_CORE_SOURCE_URL = `https://raw.githubusercontent.com/mrdoob/three.js/${THREE_SOURCE_COMMIT}/build/three.core.min.js`;
export const THREE_LOCAL_FILENAME = `three-${THREE_VERSION}.module.min.js`;
export const THREE_CORE_LOCAL_FILENAME = "three.core.min.js";
export const THREE_LOCAL_SPECIFIER = `./vendor/${THREE_LOCAL_FILENAME}`;

const THREE_CDN_SPECIFIER = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.min.js`;
const THREE_CDN_ORIGIN = "https://cdn.jsdelivr.net";
const MIN_ENGINE_BYTES = 100_000;

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Could not locate ${label}`);
  return source.replace(from, to);
}

export function patchThreejsRuntimeForLocalEngine(source) {
  return replaceRequired(source, THREE_CDN_SPECIFIER, THREE_LOCAL_SPECIFIER, "pinned Three.js runtime URL");
}

export function patchThreejsCspForLocalEngine(html) {
  let next = html;
  next = replaceRequired(next, `script-src 'self' ${THREE_CDN_ORIGIN};`, "script-src 'self';", "Three.js CDN script CSP source");
  next = replaceRequired(
    next,
    `connect-src https://raw.githubusercontent.com ${THREE_CDN_ORIGIN};`,
    "connect-src https://raw.githubusercontent.com;",
    "Three.js CDN connect CSP source",
  );
  return next;
}

function validateJavaScriptAsset(source, { label, requiredText }) {
  if (typeof source !== "string" || source.length < MIN_ENGINE_BYTES) {
    throw new Error(`Pinned Three.js ${label} source is unexpectedly small (${String(source?.length || 0)} bytes)`);
  }
  if (!source.includes(requiredText)) throw new Error(`Pinned Three.js ${label} source is missing ${requiredText}`);
  if (source.includes("<html") || source.includes("<!doctype")) {
    throw new Error(`Pinned Three.js ${label} source looks like HTML, not JavaScript`);
  }
}

async function fetchPinnedAsset(fetchImpl, url, label) {
  const response = await fetchImpl(url, { redirect: "error" });
  if (!response?.ok) throw new Error(`Pinned Three.js ${label} fetch failed with HTTP ${String(response?.status || "unknown")}`);
  return response.text();
}

export async function applyThreejsLocalEngine({
  siteDir = join(process.cwd(), "site"),
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required to acquire pinned Three.js");

  const [engineSource, coreSource] = await Promise.all([
    fetchPinnedAsset(fetchImpl, THREE_SOURCE_URL, "module"),
    fetchPinnedAsset(fetchImpl, THREE_CORE_SOURCE_URL, "core"),
  ]);
  validateJavaScriptAsset(engineSource, { label: "module", requiredText: "WebGLRenderer" });
  validateJavaScriptAsset(coreSource, { label: "core", requiredText: "Vector3" });
  if (!engineSource.includes('from"./three.core.min.js"') && !engineSource.includes("from'./three.core.min.js'")) {
    throw new Error("Pinned Three.js module no longer imports ./three.core.min.js as expected");
  }

  const runtimePath = join(siteDir, "threejs-viewer.js");
  const htmlPath = join(siteDir, "three", "index.html");
  const vendorDir = join(siteDir, "vendor");
  const vendorPath = join(vendorDir, THREE_LOCAL_FILENAME);
  const coreVendorPath = join(vendorDir, THREE_CORE_LOCAL_FILENAME);

  const [runtime, html] = await Promise.all([
    readFile(runtimePath, "utf8"),
    readFile(htmlPath, "utf8"),
  ]);
  const patchedRuntime = patchThreejsRuntimeForLocalEngine(runtime);
  const patchedHtml = patchThreejsCspForLocalEngine(html);

  await mkdir(vendorDir, { recursive: true });
  await Promise.all([
    writeFile(runtimePath, patchedRuntime),
    writeFile(htmlPath, patchedHtml),
    writeFile(vendorPath, engineSource),
    writeFile(coreVendorPath, coreSource),
  ]);

  return {
    version: THREE_VERSION,
    sourceCommit: THREE_SOURCE_COMMIT,
    sourceUrl: THREE_SOURCE_URL,
    coreSourceUrl: THREE_CORE_SOURCE_URL,
    runtimePath,
    htmlPath,
    vendorPath,
    coreVendorPath,
    bytes: engineSource.length,
    coreBytes: coreSource.length,
  };
}

async function main() {
  const result = await applyThreejsLocalEngine();
  console.log(`Localized Three.js ${result.version} from ${result.sourceCommit} (${result.bytes} module bytes + ${result.coreBytes} core bytes)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
