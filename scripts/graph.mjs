const GROUP_RULES = [
  { id: "robotics", label: "Robotics / ROS 2", keywords: ["robot", "robotics", "ros", "ros2", "gazebo", "isaac", "mujoco", "slam", "lidar", "moveit", "manipulation"] },
  { id: "ai-ml", label: "AI / Machine Learning", keywords: ["ai", "machine-learning", "deep-learning", "pytorch", "tensorflow", "llm", "vlm", "vla", "vision", "opencv", "transformer"] },
  { id: "minecraft", label: "Minecraft Modding", keywords: ["minecraft", "forge", "neoforge", "fabric", "modding"] },
  { id: "hardware", label: "Hardware / Embedded", keywords: ["arduino", "esp32", "embedded", "raspberry", "jetson", "iot", "firmware", "hardware", "sensor"] },
  { id: "web-apps", label: "Web / Apps", keywords: ["web", "frontend", "backend", "nextjs", "react", "vue", "svelte", "api", "website", "app"] },
  { id: "coursework", label: "Coursework / Learning", keywords: ["course", "coursework", "homework", "assignment", "tutorial", "learning", "study", "school", "university"] },
];

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "other";
}

function searchableText(repo) {
  return [repo.name, repo.description ?? "", repo.language ?? "", ...(repo.topics ?? [])].join(" ").toLowerCase();
}

function keywordMatches(text, keyword) {
  if (keyword.length > 3 || keyword.includes("-")) return text.includes(keyword);
  const tokens = new Set(text.split(/[^a-z0-9+#.]+/g).filter(Boolean));
  return tokens.has(keyword);
}

function classify(repo) {
  const text = searchableText(repo);
  let best = null;
  let bestScore = 0;
  for (const rule of GROUP_RULES) {
    let score = 0;
    for (const keyword of rule.keywords) if (keywordMatches(text, keyword)) score += keyword.length >= 6 ? 2 : 1;
    if (score > bestScore) { best = rule; bestScore = score; }
  }
  if (best) return { id: best.id, label: best.label };
  const language = repo.language || "Other";
  return { id: `lang-${slugify(language)}`, label: `${language} Projects` };
}

export function buildGraph(username, repos, includeForks, includeArchived) {
  const filtered = repos.filter((repo) => (includeForks || !repo.fork) && (includeArchived || !repo.archived));
  const groups = new Map();
  for (const repo of filtered) {
    const group = classify(repo);
    const existing = groups.get(group.id) ?? { label: group.label, repos: [] };
    existing.repos.push(repo);
    groups.set(group.id, existing);
  }

  const sortedGroups = [...groups.entries()].sort((a, b) => b[1].repos.length - a[1].repos.length || a[1].label.localeCompare(b[1].label));
  const nodes = [{ id: `user:${username}`, label: username, type: "owner", url: `https://github.com/${encodeURIComponent(username)}` }];
  const edges = [];

  for (const [groupId, group] of sortedGroups) {
    const groupNodeId = `group:${groupId}`;
    nodes.push({ id: groupNodeId, label: group.label, type: "group", repositoryCount: group.repos.length });
    edges.push({ source: `user:${username}`, target: groupNodeId, type: "ownership" });
    group.repos.sort((a, b) => b.stargazers_count - a.stargazers_count || b.updated_at.localeCompare(a.updated_at)).forEach((repo) => {
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
