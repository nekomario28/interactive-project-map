import { boolParam, intParam } from "./params";
import { normalizeUsername } from "./hosted-options";

const CHECKOUT_SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1"; // actions/checkout v7.0.1
const UPLOAD_SHA = "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a"; // actions/upload-artifact v7.0.1
const DOWNLOAD_SHA = "3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c"; // actions/download-artifact v8.0.1

export interface InstallOptions {
  username: string;
  theme: "dark" | "light";
  maxRepos: number;
  includeForks: boolean;
  includeArchived: boolean;
}

export function installOptionsFromUrl(url: URL): InstallOptions {
  return {
    username: normalizeUsername(url.searchParams.get("username") ?? ""),
    theme: url.searchParams.get("theme") === "light" ? "light" : "dark",
    maxRepos: intParam(url, "max_repos", 100, 1, 300),
    includeForks: boolParam(url, "forks", true),
    includeArchived: boolParam(url, "archived", false),
  };
}

export function staticAssetUrls(origin: string, options: InstallOptions) {
  const owner = encodeURIComponent(options.username);
  const rawBase = `https://raw.githubusercontent.com/${owner}/${owner}/main/project-map`;
  const viewer = new URL(`/u/${owner}`, origin);
  viewer.searchParams.set("repo", `${options.username}/${options.username}`);
  viewer.searchParams.set("ref", "main");
  return {
    svg: `${rawBase}/galaxy.svg`,
    graph: `${rawBase}/graph.json`,
    viewer: viewer.toString(),
  };
}

export function renderInstallWorkflow(options: InstallOptions): string {
  return `name: Update project map

on:
  workflow_dispatch:
  schedule:
    - cron: "37 3 * * *"

permissions:
  contents: read

jobs:
  generate:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Checkout profile repository
        uses: actions/checkout@${CHECKOUT_SHA} # v7.0.1

      # v1 is convenient. For the strongest supply-chain guarantee,
      # replace v1 with a reviewed full commit SHA from this repository.
      - name: Generate project map
        uses: nekomario28/interactive-project-map@v1
        with:
          github_token: \${{ github.token }}
          username: \${{ github.repository_owner }}
          theme: ${options.theme}
          max_repos: "${options.maxRepos}"
          forks: "${options.includeForks}"
          archived: "${options.includeArchived}"
          output_dir: project-map

      - name: Transfer generated files to publish job
        uses: actions/upload-artifact@${UPLOAD_SHA} # v7.0.1
        with:
          name: project-map-generated
          path: project-map
          if-no-files-found: error
          retention-days: 1

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
