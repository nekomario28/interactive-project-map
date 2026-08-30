import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  THREE_CORE_LOCAL_FILENAME,
  THREE_CORE_SOURCE_URL,
  THREE_LOCAL_FILENAME,
  THREE_LOCAL_SPECIFIER,
  THREE_SOURCE_COMMIT,
  THREE_SOURCE_URL,
  applyThreejsLocalEngine,
  patchThreejsCspForLocalEngine,
  patchThreejsRuntimeForLocalEngine,
} from "../scripts/apply-threejs-local-engine.mjs";

const CDN_URL = "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js";
const fakeEngine = `import{Vector3}from"./three.core.min.js";/* WebGLRenderer */\n${"x".repeat(100_100)}`;
const fakeCore = `/* Vector3 */\n${"y".repeat(100_100)}`;

function fakeResponse({ ok = true, status = 200, body = fakeEngine } = {}) {
  return { ok, status, text: async () => body };
}

test("runtime and CSP patches remove the runtime jsDelivr dependency", () => {
  const runtime = `const THREE_URL = "${CDN_URL}";`;
  const html = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self'; connect-src https://raw.githubusercontent.com https://cdn.jsdelivr.net; img-src 'self' data:;">`;

  const patchedRuntime = patchThreejsRuntimeForLocalEngine(runtime);
  const patchedHtml = patchThreejsCspForLocalEngine(html);

  assert.match(patchedRuntime, new RegExp(THREE_LOCAL_SPECIFIER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(patchedRuntime, /cdn\.jsdelivr\.net/);
  assert.match(patchedHtml, /script-src 'self';/);
  assert.match(patchedHtml, /connect-src https:\/\/raw\.githubusercontent\.com;/);
  assert.doesNotMatch(patchedHtml, /cdn\.jsdelivr\.net/);
});

test("build localization writes the pinned Three.js module and its core dependency", async () => {
  const root = await mkdtemp(join(tmpdir(), "ipm-three-local-"));
  try {
    await mkdir(join(root, "three"), { recursive: true });
    await writeFile(join(root, "threejs-viewer.js"), `const THREE_URL = "${CDN_URL}";`);
    await writeFile(
      join(root, "three", "index.html"),
      `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self'; connect-src https://raw.githubusercontent.com https://cdn.jsdelivr.net; img-src 'self' data:;">`,
    );

    const requestedUrls = [];
    const result = await applyThreejsLocalEngine({
      siteDir: root,
      fetchImpl: async (url) => {
        requestedUrls.push(url);
        if (url === THREE_SOURCE_URL) return fakeResponse({ body: fakeEngine });
        if (url === THREE_CORE_SOURCE_URL) return fakeResponse({ body: fakeCore });
        return fakeResponse({ ok: false, status: 404 });
      },
    });

    const [runtime, html, vendor, coreVendor] = await Promise.all([
      readFile(join(root, "threejs-viewer.js"), "utf8"),
      readFile(join(root, "three", "index.html"), "utf8"),
      readFile(join(root, "vendor", THREE_LOCAL_FILENAME), "utf8"),
      readFile(join(root, "vendor", THREE_CORE_LOCAL_FILENAME), "utf8"),
    ]);

    assert.deepEqual(requestedUrls.sort(), [THREE_CORE_SOURCE_URL, THREE_SOURCE_URL].sort());
    assert.equal(result.sourceCommit, THREE_SOURCE_COMMIT);
    assert.equal(vendor, fakeEngine);
    assert.equal(coreVendor, fakeCore);
    assert.match(runtime, /\.\.\/vendor\/three-0\.185\.1\.module\.min\.js/);
    assert.doesNotMatch(runtime, /cdn\.jsdelivr\.net/);
    assert.doesNotMatch(html, /cdn\.jsdelivr\.net/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("localization fails closed on an invalid engine response", async () => {
  await assert.rejects(
    () => applyThreejsLocalEngine({
      siteDir: "/does-not-matter",
      fetchImpl: async (url) => url === THREE_SOURCE_URL
        ? fakeResponse({ ok: false, status: 503 })
        : fakeResponse({ body: fakeCore }),
    }),
    /module fetch failed with HTTP 503/,
  );
});

test("localization fails closed if the pinned module dependency shape changes", async () => {
  const incompatibleModule = `/* WebGLRenderer */\n${"z".repeat(100_100)}`;
  await assert.rejects(
    () => applyThreejsLocalEngine({
      siteDir: "/does-not-matter",
      fetchImpl: async (url) => url === THREE_SOURCE_URL
        ? fakeResponse({ body: incompatibleModule })
        : fakeResponse({ body: fakeCore }),
    }),
    /no longer imports \.\/three\.core\.min\.js/,
  );
});

test("local-engine source passes Node syntax check", () => {
  const result = spawnSync(process.execPath, ["--check", "scripts/apply-threejs-local-engine.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
});
