import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { postprocessPublicPages } from "../scripts/postprocess-public-pages.mjs";

async function withHtml(source, run) {
  const root = await mkdtemp(join(tmpdir(), "ipm-csp-validator-"));
  try {
    await writeFile(join(root, "index.html"), source);
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("postprocess fails closed if legacy frame-ancestors cleanup would still be required", async () => {
  await withHtml(
    `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'">`,
    async (root) => {
      await assert.rejects(postprocessPublicPages(root), /Legacy frame-ancestors CSP reached postprocess/);
    },
  );
});

test("postprocess fails closed if legacy style-src relaxation would still be required", async () => {
  await withHtml(
    `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self'; base-uri 'none'">`,
    async (root) => {
      await assert.rejects(postprocessPublicPages(root), /Non-canonical style-src CSP reached postprocess/);
    },
  );
});
