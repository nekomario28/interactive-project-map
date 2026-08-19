import type { GalaxyEdge, GalaxyGraph, GalaxyNode, GitHubRepo } from "./types";

type GroupRule = {
  id: string;
  label: string;
  keywords: string[];
};

const GROUP_RULES: GroupRule[] = [
  {
    id: "robotics",
    label: "Robotics / ROS 2",
    keywords: ["robot", "robotics", "ros", "ros2", "gazebo", "isaac", "mujoco", "slam", "lidar", "moveit", "manipulation"],
  },
  {
    id: "ai-ml",
    label: "AI / Machine Learning",
    keywords: ["ai", "machine-learning", "deep-learning", "pytorch", "tensorflow", "llm", "vlm", "vla", "vision", "opencv", "transformer"],
  },
  {
    id: "minecraft",
    label: "Minecraft Modding",
    keywords: ["minecraft", "forge", "neoforge", "fabric", "modding"],
  },
  {
    id: "hardware",
    label: "Hardware / Embedded",
    keywords: ["arduino", "esp32", "embedded", "raspberry", "jetson", "iot", "firmware", "hardware", "sensor"],
  },
  {
    id: "web-apps",
    label: "Web / Apps",
    keywords: ["web", "frontend", "backend", "nextjs", "react", "vue", "svelte", "api", "website", "app"],
  },
  {
    id: "coursework",
    label: "Coursework / Learning",
    keywords: ["course", "coursework", "homework", "assignment", "tutorial", "learning", "study", "school", "university"],
  },
];

const LANGUAGE_LABELS = new Map<string, string>([
  ["Rich Text Format", "RTF"],
  ["Jupyter Notebook", "Jupyter"],
  ["Visual Basic .NET", "VB.NET"],
]);

function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim();
}

function languageGroupKey(language: string): string {
  let key = "";
  for (const char of language.toLowerCase()) {
    if (/[a-z0-9]/.test(char)) {
      key += char;
    } else {
      key += `-u${char.codePointAt(0)?.toString(16) ?? "0"}-`;
    }
  }
  return key.replace(/-+/g, "-").replace(/^-|-$/g, "") || "other";
}

function languageDisplayLabel(language: string): string {
  const alias = LANGUAGE_LABELS.get(language);
  if (alias) return alias;
  return language.length <= 14 ? language : `${language.slice(0, 13)}…`;
}

function searchableText(repo: GitHubRepo): string {
  return normalizeSearch([
    repo.name,
    repo.description ?? "",
    repo.language ?? "",
    ...(repo.topics ?? []),
  ].join(" "));
}

function keywordMatches(text: string, keyword: string): boolean {
  const needle = normalizeSearch(keyword);
  if (!needle) return false;
  return ` ${text} `.includes(` ${needle} `);
}

function classify(repo: GitHubRepo): { id: string; label: string } {
  const text = searchableText(repo);
  let best: GroupRule | null = null;
  let bestScore = 0;

  for (const rule of GROUP_RULES) {
    let score = 0;
    for (const keyword of rule.keywords) {
      if (keywordMatches(text, keyword)) score += keyword.length >= 6 ? 2 : 1;
    }
    if (score > bestScore) {
      best = rule;
      bestScore = score;
    }
  }

  if (best) return { id: best.id, label: best.label };
  const language = repo.language || "Other";
  return { id: `lang-${languageGroupKey(language)}`, label: languageDisplayLabel(language) };
}

export function buildGraph(
  username: string,
  repos: GitHubRepo[],
  includeForks: boolean,
  includeArchived: boolean,
): GalaxyGraph {
  const filtered = repos.filter((repo) => {
    if (!includeForks && repo.fork) return false;
    if (!includeArchived && repo.archived) return false;
    return true;
  });

  const groups = new Map<string, { label: string; repos: GitHubRepo[] }>();
  for (const repo of filtered) {
    const group = classify(repo);
    const existing = groups.get(group.id) ?? { label: group.label, repos: [] };
    existing.repos.push(repo);
    groups.set(group.id, existing);
  }

  const sortedGroups = [...groups.entries()].sort((a, b) => {
    const countDiff = b[1].repos.length - a[1].repos.length;
    return countDiff || a[1].label.localeCompare(b[1].label);
  });

  const nodes: GalaxyNode[] = [
    {
      id: `user:${username}`,
      label: username,
      type: "owner",
      url: `https://github.com/${encodeURIComponent(username)}`,
    },
  ];
  const edges: GalaxyEdge[] = [];

  for (const [groupId, group] of sortedGroups) {
    const groupNodeId = `group:${groupId}`;
    nodes.push({
      id: groupNodeId,
      label: group.label,
      type: "group",
      repositoryCount: group.repos.length,
    });
    edges.push({ source: `user:${username}`, target: groupNodeId, type: "ownership" });

    group.repos
      .sort((a, b) => b.stargazers_count - a.stargazers_count || b.updated_at.localeCompare(a.updated_at))
      .forEach((repo) => {
        const repoNodeId = `repository:${repo.name}`;
        nodes.push({
          id: repoNodeId,
          label: repo.name,
          type: "repository",
          url: repo.html_url,
          description: repo.description ?? "",
          language: repo.language,
          topics: repo.topics ?? [],
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          fork: repo.fork,
          archived: repo.archived,
          updatedAt: repo.updated_at,
          groupId,
          groupLabel: group.label,
        });
        edges.push({ source: groupNodeId, target: repoNodeId, type: "membership" });
      });
  }

  return {
    owner: username,
    generatedAt: new Date().toISOString(),
    repositoryCount: filtered.length,
    groupCount: sortedGroups.length,
    nodes,
    edges,
  };
}
