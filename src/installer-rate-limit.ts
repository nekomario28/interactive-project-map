import type { Env } from "./types";
import { InstallerError } from "./github-app-installer.ts";

export async function enforceInstallerRateLimit(request: Request, env: Env, phase: "start" | "callback"): Promise<void> {
  if (!env.API_RATE_LIMITER) return;
  const address = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const { success } = await env.API_RATE_LIMITER.limit({ key: `installer:${phase}:${address}` });
  if (!success) throw new InstallerError("Installer rate limit reached", 429, "installer_rate_limited");
}
