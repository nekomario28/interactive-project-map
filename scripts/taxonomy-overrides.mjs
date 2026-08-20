const REPO_NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;
const CATEGORY_ID_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const MAX_OVERRIDE_BYTES = 256 * 1024;

function normalizeTags(value) {
  if (value == null) return undefined;
  if (!Array.isArray(value)) throw new Error("taxonomy repository override secondaryTags must be an array");
  const seen = new Set();
  const tags = [];
  for (const raw of value.slice(0, 16)) {
    const tag = String(raw ?? "").normalize("NFKC").replace(/\s+/gu, " ").trim().slice(0, 60);
    if (!tag) continue;
    const key = tag.toLocaleLowerCase("en-US");
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= 8) break;
  }
  return tags;
}

export function normalizeTaxonomyRepositoryOverrides(value) {
  if (value == null) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("taxonomy repository overrides must be an object");
  const result = {};
  for (const [rawName, raw] of Object.entries(value)) {
    const name = rawName.normalize("NFKC").trim();
    if (!REPO_NAME_RE.test(name)) throw new Error(`Invalid repository override name: ${name || "(empty)"}`);
    const key = name.toLocaleLowerCase("en-US");
    if (Object.prototype.hasOwnProperty.call(result, key)) throw new Error(`Duplicate repository override: ${name}`);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Repository override ${name} must be an object`);
    const categoryId = String(raw.categoryId ?? "").normalize("NFKC").trim().toLocaleLowerCase("en-US").slice(0, 64);
    if (!CATEGORY_ID_RE.test(categoryId)) throw new Error(`Repository override ${name} has invalid categoryId`);
    const secondaryTags = normalizeTags(raw.secondaryTags);
    result[key] = { categoryId, ...(secondaryTags ? { secondaryTags } : {}) };
  }
  return result;
}

export function parseTaxonomyRepositoryOverridesFile(text) {
  if (typeof text !== "string" || text.length > MAX_OVERRIDE_BYTES) throw new Error(`taxonomy-overrides.json must be at most ${MAX_OVERRIDE_BYTES} bytes`);
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Error("taxonomy-overrides.json must contain valid JSON"); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("taxonomy-overrides.json must contain an object");
  if (raw.version !== 1) throw new Error("Taxonomy override version must be 1");
  return normalizeTaxonomyRepositoryOverrides(raw.repositories);
}
