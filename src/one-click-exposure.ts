import { isGitHubAppInstallerConfigured, type GitHubAppInstallerEnv } from "./github-app-installer.ts";

export interface OneClickExposureEnv extends GitHubAppInstallerEnv {
  ENABLE_ONE_CLICK_INSTALLER?: string;
}

export function isOneClickInstallerExposed(env: OneClickExposureEnv): boolean {
  return env.ENABLE_ONE_CLICK_INSTALLER === "true" && isGitHubAppInstallerConfigured(env);
}

export function dormantInstallerResponse(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
