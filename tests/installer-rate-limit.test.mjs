import assert from "node:assert/strict";
import test from "node:test";
import { enforceInstallerRateLimit } from "../src/installer-rate-limit.ts";

test("installer rate limiting reuses the Worker API limiter with phase and client-IP isolation", async () => {
  const keys = [];
  const env = { API_RATE_LIMITER: { async limit({ key }) { keys.push(key); return { success: true }; } } };
  const request = new Request("https://maps.example/api/install/start", { headers: { "CF-Connecting-IP": "203.0.113.9" } });
  await enforceInstallerRateLimit(request, env, "start");
  await enforceInstallerRateLimit(request, env, "callback");
  assert.deepEqual(keys, ["installer:start:203.0.113.9", "installer:callback:203.0.113.9"]);
});

test("installer limiter failure is a 429 installer error", async () => {
  const env = { API_RATE_LIMITER: { async limit() { return { success: false }; } } };
  await assert.rejects(
    () => enforceInstallerRateLimit(new Request("https://maps.example/api/install/callback"), env, "callback"),
    (error) => error?.status === 429 && error?.code === "installer_rate_limited",
  );
});
