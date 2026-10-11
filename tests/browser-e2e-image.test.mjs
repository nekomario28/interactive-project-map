import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL("../.github/workflows/ci.yml", import.meta.url);
const packageUrl = new URL("../package.json", import.meta.url);

test("browser-e2e container image matches the pinned @playwright/test version", async () => {
  const [workflow, manifest] = await Promise.all([
    readFile(workflowUrl, "utf8"),
    readFile(packageUrl, "utf8").then((source) => JSON.parse(source)),
  ]);

  const playwrightVersion = manifest.devDependencies?.["@playwright/test"];
  assert.match(playwrightVersion ?? "", /^\d+\.\d+\.\d+$/, "@playwright/test must be pinned to an exact version");

  assert.match(
    workflow,
    new RegExp(`mcr\\.microsoft\\.com/playwright:v${playwrightVersion.replaceAll(".", "\\.")}-`),
    "browser-e2e must run in the Playwright image that ships the pinned browser revisions",
  );
});
