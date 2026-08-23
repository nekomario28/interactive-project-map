import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PROJECT_MAP_ACTION_REF } from "../src/action-ref.ts";
import { STABLE_REUSABLE_REF, renderInstallWorkflow } from "../src/install.ts";

const SHA_RE = /^[0-9a-f]{40}$/;

function requiredMatch(source, pattern, label) {
  const match = source.match(pattern);
  assert.ok(match?.[1], `missing ${label}`);
  return match[1];
}

test("release chain treats outer reusable ref and inner Action SHA as separate release targets", async () => {
  const [reusable, pagesPostprocess] = await Promise.all([
    readFile(new URL("../.github/workflows/generate-project-map.yml", import.meta.url), "utf8"),
    readFile(new URL("../scripts/postprocess-public-pages.mjs", import.meta.url), "utf8"),
  ]);

  const reusableInnerRef = requiredMatch(
    reusable,
    /uses:\s+nekomario28\/interactive-project-map@([0-9a-f]{40})/,
    "reusable workflow inner Action SHA",
  );
  const pagesInnerRef = requiredMatch(
    pagesPostprocess,
    /export const PUBLIC_ACTION_REF = "([0-9a-f]{40})"/,
    "Pages inner Action SHA",
  );

  assert.equal(STABLE_REUSABLE_REF, "v1");
  assert.match(reusableInnerRef, SHA_RE);
  assert.notEqual(STABLE_REUSABLE_REF, reusableInnerRef, "outer @v1 must not be mistaken for the inner immutable Action ref");
  assert.equal(reusableInnerRef, PROJECT_MAP_ACTION_REF, "Worker-generated workflows must advertise the reusable workflow's actual inner Action release");
  assert.equal(pagesInnerRef, reusableInnerRef, "Pages-generated workflows must advertise the same inner Action release");
  assert.match(reusable, /OUTER release target:/);
  assert.match(reusable, /INNER release target:/);
  assert.match(reusable, /theme:\s*\n\s*description: Static profile SVG theme/, "reusable workflow must not describe the static SVG theme as a viewer-wide theme");
  assert.match(reusable, /contributed:\s*\$\{\{\s*inputs\.contributed\s*\}\}/, "reusable workflow must forward the Contributed opt-in to the immutable inner Action");

  const generated = renderInstallWorkflow({
    username: "octocat",
    theme: "dark",
    style: "radial",
    maxRepos: 100,
    includeForks: true,
    includeArchived: false,
  });
  assert.match(generated, /generate-project-map\.yml@v1/);
  assert.match(generated, new RegExp(`Reviewed immutable inner Action baseline: nekomario28/interactive-project-map@${reusableInnerRef}`));
});
