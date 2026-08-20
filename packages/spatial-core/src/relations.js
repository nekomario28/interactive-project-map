export function normalizeWeightedEdges(rawEdges, validIds, options = {}) {
  const ids = validIds instanceof Set ? validIds : new Set(validIds ?? []);
  const maxInput = Math.max(0, Math.floor(options.maxInput ?? 2400));
  const maxOutput = Math.max(0, Math.floor(options.maxOutput ?? 1200));
  const minScore = Number.isFinite(options.minScore) ? options.minScore : 0;
  const edgeType = typeof options.type === "string" && options.type ? options.type : "relation";
  const deduped = new Map();

  for (const raw of Array.isArray(rawEdges) ? rawEdges.slice(0, maxInput) : []) {
    if (!raw || typeof raw !== "object") continue;
    const source = typeof raw.source === "string" ? raw.source : "";
    const target = typeof raw.target === "string" ? raw.target : "";
    const score = Number(raw.score);
    if (!source || !target || source === target || !ids.has(source) || !ids.has(target)) continue;
    if (!Number.isFinite(score) || score < minScore || score > 1) continue;

    const left = source < target ? source : target;
    const right = source < target ? target : source;
    const key = `${left}\u0000${right}`;
    const edge = {
      source: left,
      target: right,
      type: edgeType,
      score: Math.round(score * 1_000_000) / 1_000_000,
    };
    const existing = deduped.get(key);
    if (!existing || edge.score > existing.score) deduped.set(key, edge);
  }

  return [...deduped.values()]
    .sort((a, b) => b.score - a.score || a.source.localeCompare(b.source) || a.target.localeCompare(b.target))
    .slice(0, maxOutput);
}
