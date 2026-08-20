import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateStaticMap } from "../scripts/action.mjs";
import { STANDARD_TAXONOMY_CATEGORIES, STANDARD_TAXONOMY_ID } from "../scripts/standard-taxonomy.mjs";

function repo(id, name, overrides = {}) {
  return {
    id,
    name,
    html_url: `https://github.com/example/${name}`,
    description: null,
    language: null,
    topics: [],
    stargazers_count: 0,
    forks_count: 0,
    fork: false,
    archived: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-08-20T00:00:00Z",
    ...overrides,
  };
}

const config = {
  username: "example",
  theme: "dark",
  style: "tree",
  maxRepos: 100,
  includeForks: true,
  includeArchived: false,
  width: 740,
  height: 420,
  outputDir: "project-map",
};

const representativeRepos = [
  repo(1, "claim-mod", {
    description: "NeoForge Minecraft mod that extends FTB Chunks claim behavior.",
    language: "Java",
    topics: ["minecraft", "neoforge"],
    readmeExcerpt: "A Minecraft 1.21.1 NeoForge game mod for FTB Chunks.",
    manifests: ["neoforge.mods.toml"],
    frameworks: ["neoforge", "ftb-chunks"],
  }),
  repo(2, "robot-nav", {
    description: "ROS 2 robot navigation and manipulation in Gazebo using Nav2 and MoveIt2.",
    language: "Python",
    topics: ["robotics", "ros2"],
    readmeExcerpt: "Launch the Gazebo robot simulation and use Nav2 and MoveIt2.",
    manifests: ["package.xml"],
    frameworks: ["nav2", "moveit2", "ros-gz"],
  }),
  repo(3, "othello-game", {
    description: "Pygame Othello board game with skills and expanding boards.",
    language: "Python",
    topics: ["pygame", "game"],
    readmeExcerpt: "対戦型ボードゲーム。オセロをPygameで実装。",
  }),
  repo(4, "usb-screen", {
    description: "System monitor and hardware integration for a small USB smart display.",
    language: "Python",
    topics: ["hardware", "display"],
    readmeExcerpt: "Control a small IPS USB display using serial protocols and Python.",
    frameworks: ["pyserial"],
  }),
  repo(5, "project-map", {
    description: "Turn GitHub repositories into an interactive project map and reusable portfolio visualization.",
    language: "JavaScript",
    topics: ["data-visualization", "github-pages"],
    readmeExcerpt: "Interactive project map with graph visualization, Treemap, Sunburst, Sankey, search and GitHub Pages viewers.",
    frameworks: ["react"],
  }),
];

function assignmentsByName(result) {
  return new Map(result.graph.nodes.filter((node) => node.type === "repository").map((node) => [node.label, node.taxonomyAssignment]));
}

test("default Action uses the same standard taxonomy for arbitrary portfolios without changing the visible P1 hierarchy", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "project-map-standard-default-"));
  try {
    const result = await generateStaticMap(config, { cwd, token: "read-token", fetchRepos: async () => representativeRepos });
    assert.equal(result.taxonomyMode, "standard");
    assert.equal(result.graph.taxonomy?.source.providerId, "standard");
    assert.equal(result.graph.taxonomy?.source.model, STANDARD_TAXONOMY_ID);
    assert.equal(result.graph.taxonomy?.categories.length, STANDARD_TAXONOMY_CATEGORIES.length);

    const assignments = assignmentsByName(result);
    assert.equal(assignments.get("claim-mod")?.categoryId, "game-modding");
    assert.equal(assignments.get("robot-nav")?.categoryId, "robotics-automation");
    assert.equal(assignments.get("othello-game")?.categoryId, "game-development");
    assert.equal(assignments.get("usb-screen")?.categoryId, "hardware-embedded");
    assert.equal(assignments.get("project-map")?.categoryId, "visualization-knowledge");
    assert.ok(assignments.get("project-map")?.secondaryTags.includes("topic:project-visualization"));

    const projectMapNode = result.graph.nodes.find((node) => node.type === "repository" && node.label === "project-map");
    assert.notEqual(projectMapNode?.groupId, "visualization-knowledge", "standard taxonomy must remain a migration field until hierarchy promotion is separately gated");
    assert.notEqual(projectMapNode?.classification?.categoryId, "visualization-knowledge");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("explicit portfolio mode preserves the previous provider-specific taxonomy path", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "project-map-portfolio-mode-"));
  try {
    const result = await generateStaticMap({ ...config, outputDir: "project-map-portfolio" }, {
      cwd,
      token: "read-token",
      fetchRepos: async () => [representativeRepos[0]],
      taxonomyMode: "portfolio",
    });
    assert.equal(result.taxonomyMode, "portfolio");
    assert.equal(result.graph.taxonomy, undefined);
    assert.equal(result.taxonomy.taxonomy, undefined);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("custom category definitions intentionally select custom/portfolio taxonomy mode", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "project-map-custom-taxonomy-"));
  try {
    const result = await generateStaticMap({ ...config, outputDir: "project-map-custom" }, {
      cwd,
      token: "read-token",
      fetchRepos: async () => [representativeRepos[0]],
      taxonomyOverrides: {
        version: 1,
        categories: [{ id: "custom-domain", label: "Custom Domain", description: "User-authored custom taxonomy category.", aliases: [] }],
      },
    });
    assert.equal(result.taxonomyMode, "portfolio");
    assert.equal(result.graph.taxonomy?.source.providerId, "override");
    assert.deepEqual(result.graph.taxonomy?.categories.map((category) => category.id), ["custom-domain"]);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("repository overrides remain authoritative inside standard taxonomy mode", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "project-map-standard-override-"));
  try {
    const result = await generateStaticMap({ ...config, outputDir: "project-map-override" }, {
      cwd,
      token: "read-token",
      fetchRepos: async () => [representativeRepos[4]],
      taxonomyOverrides: {
        version: 1,
        repositories: {
          "project-map": { categoryId: "developer-tools", secondaryTags: ["topic:manual-override"] },
        },
      },
    });
    assert.equal(result.taxonomyMode, "standard");
    assert.equal(assignmentsByName(result).get("project-map")?.categoryId, "developer-tools");
    assert.equal(assignmentsByName(result).get("project-map")?.method, "override");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
