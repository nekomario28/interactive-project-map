import { PROJECT_MAP_ACTION_REF } from "./action-ref.ts";
import { boolParam, intParam } from "./params.ts";
import { normalizeUsername } from "./hosted-options.ts";

const CHECKOUT_SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1"; // actions/checkout v7.0.1
const DOWNLOAD_SHA = "3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c"; // actions/download-artifact v8.0.1
export const STABLE_REUSABLE_REF = "v1";
const COMMIT_SHA_RE = /^[0-9a-f]{40}$/;
export const MAP_STYLES = ["radial", "galaxy-classic", "galaxy-systems", "galaxy-hybrid", "obsidian", "tree", "treemap", "timeline", "cluster", "sunburst", "matrix", "sankey"] as const;
export type MapStyle = typeof MAP_STYLES[number];
const MAP_STYLE_VALUES = new Set<string>(MAP_STYLES);

export interface InstallOptions {
  username: string;
  theme: "dark" | "light";
  style: MapStyle;
  maxRepos: number;
  includeForks: boolean;
  includeArchived: boolean;
  includeContributed?: boolean;
  generatorRef?: string;
}

export function normalizeGeneratorRef(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized || normalized === STABLE_REUSABLE_REF) return STABLE_REUSABLE_REF;
  if (!COMMIT_SHA_RE.test(normalized)) {
    throw new URIError("Invalid generator_ref: expected v1 or a 40-character commit SHA");
  }
  return normalized;
}

export function normalizeStyle(value: string | null | undefined): MapStyle {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized || normalized === "galaxy") return normalized === "galaxy" ? "galaxy-systems" : "radial";
  if (!MAP_STYLE_VALUES.has(normalized)) throw new URIError("Invalid style");
  return normalized as MapStyle;
}

export function installOptionsFromUrl(url: URL): InstallOptions {
  return {
    username: normalizeUsername(url.searchParams.get("username") ?? ""),
    theme: url.searchParams.get("theme") === "light" ? "light" : "dark",
    style: normalizeStyle(url.searchParams.get("style")),
    maxRepos: intParam(url, "max_repos", 100, 1, 300),
    includeForks: boolParam(url, "forks", true),
    includeArchived: boolParam(url, "archived", false),
    includeContributed: boolParam(url, "contributed", false),
    generatorRef: normalizeGeneratorRef(url.searchParams.get("generator_ref")),
  };
}

export function supportsOneClickInstall(options: InstallOptions): boolean {
  return options.includeContributed !== true;
}

export function staticAssetUrls(origin: string, options: InstallOptions) {
  const owner = encodeURIComponent(options.username);
  const rawBase = `https://raw.githubusercontent.com/${owner}/${owner}/HEAD/project-map`;
  const viewer = new URL(`/u/${owner}`, origin);
  viewer.searchParams.set("style", normalizeStyle(options.style));
  viewer.searchParams.set("max_repos", String(options.maxRepos));
  viewer.searchParams.set("forks", String(options.includeForks));
  viewer.searchParams.set("archived", String(options.includeArchived));
  return {
    svg: `${rawBase}/galaxy.svg`,
    graph: `${rawBase}/graph.json`,
    viewer: viewer.toString(),
  };
}

export function renderInstallWorkflow(options: InstallOptions): string {
  const generatorRef = normalizeGeneratorRef(options.generatorRef);
  const style = normalizeStyle(options.style);
  const includeContributed = options.includeContributed === true;
  const generatorPolicy = generatorRef === STABLE_REUSABLE_REF ? "stable-v1" : `pinned-${generatorRef}`;
  return `name: Update project map
# Project Map generator policy: ${generatorPolicy}
# Reviewed immutable inner Action baseline: nekomario28/interactive-project-map@${PROJECT_MAP_ACTION_REF}

on:
  workflow_dispatch:
  schedule:
    - cron: "37 3 * * *"

permissions:
  contents: read

jobs:
  generate:
    permissions:
      contents: read
    uses: nekomario28/interactive-project-map/.github/workflows/generate-project-map.yml@${generatorRef}
    with:
      theme: ${options.theme}
      style: ${style}
      max_repos: "${options.maxRepos}"
      forks: ${options.includeForks}
      archived: ${options.includeArchived}
      contributed: ${includeContributed}

  publish:
    needs: generate
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: write
    steps:
      - name: Checkout profile repository
        uses: actions/checkout@${CHECKOUT_SHA} # v7.0.1

      - name: Download generated files
        uses: actions/download-artifact@${DOWNLOAD_SHA} # v8.0.1
        with:
          name: project-map-generated
          path: project-map

      - name: Commit only when the generated map changed
        shell: bash
        run: |
          set -euo pipefail
          git add -- project-map/galaxy.svg project-map/graph.json
          if git diff --cached --quiet; then
            echo "Project map is already up to date."
            exit 0
          fi
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git commit -m "chore: update project map"
          git push
`;
}
