import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("local Cloudflare secret file families stay ignored while public examples stay placeholders", async () => {
  const [ignore, example] = await Promise.all([
    readFile(new URL("../.gitignore", import.meta.url), "utf8"),
    readFile(new URL("../.dev.vars.example", import.meta.url), "utf8"),
  ]);

  assert.match(ignore, /^\.dev\.vars\*$/m);
  assert.match(ignore, /^!\.dev\.vars\.example$/m);
  assert.match(ignore, /^\.env\*$/m);

  assert.match(example, /PUBLIC PLACEHOLDER FILE ONLY/);
  assert.match(example, /^ENABLE_ONE_CLICK_INSTALLER=false$/m);
  assert.doesNotMatch(example, /^ENABLE_ONE_CLICK_INSTALLER=true$/m);
  assert.match(example, /GITHUB_TOKEN=github_pat_x{8,}/);
  assert.match(example, /GITHUB_APP_CLIENT_SECRET=x{16,}/);
  assert.match(example, /INSTALL_STATE_SECRET=x{32,}/);
  assert.doesNotMatch(example, /gh[opusr]_[A-Za-z0-9]{20,}/);
});
