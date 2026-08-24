const OWNERSHIP = new Set(["owned", "contributed"]);
const COLLABORATION = new Set(["solo", "team", "unknown"]);
const LINEAGE = new Set(["original", "fork", "unknown"]);

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

export function normalizeRepositoryRelation(value, label = "relation") {
  const relation = object(value, label);
  if (!OWNERSHIP.has(relation.ownership)) throw new Error(`${label}.ownership is unsupported`);
  if (!COLLABORATION.has(relation.collaboration)) throw new Error(`${label}.collaboration is unsupported`);
  if (!LINEAGE.has(relation.lineage)) throw new Error(`${label}.lineage is unsupported`);
  return {
    ownership: relation.ownership,
    collaboration: relation.collaboration,
    lineage: relation.lineage,
  };
}

export function inferL0RepositoryRelation({ external = false, fork = false } = {}) {
  if (typeof external !== "boolean" || typeof fork !== "boolean") throw new Error("external and fork must be boolean");
  return {
    ownership: external ? "contributed" : "owned",
    collaboration: "unknown",
    lineage: fork ? "fork" : "original",
  };
}

export function relationRequiresResolution(value) {
  const relation = normalizeRepositoryRelation(value);
  return relation.collaboration === "unknown" || relation.lineage === "unknown";
}

export function relationRequiresLocalDelta(value) {
  return normalizeRepositoryRelation(value).lineage === "fork";
}

export function relationAttributionProfile(value) {
  const relation = normalizeRepositoryRelation(value);
  if (relation.collaboration === "unknown" || relation.lineage === "unknown") return "unresolved";
  if (relation.ownership === "contributed") return "contributed";
  if (relation.lineage === "fork") return "fork";
  if (relation.collaboration === "team") return "team";
  return "direct";
}

export function relationRequiresPersonalContribution(value) {
  return relationAttributionProfile(value) !== "direct";
}
