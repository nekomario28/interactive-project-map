import { buildRepoSemanticDocuments } from "./semantic-document.mjs";

export const TAXONOMY_ADJUDICATION_VERSION = 1;
export const DEFAULT_TAXONOMY_ADJUDICATION_MIN_CONFIDENCE = 0.7;
export const DEFAULT_TAXONOMY_ADJUDICATION_MAX_CASES = 20;
export const HARD_TAXONOMY_ADJUDICATION_MAX_CASES = 20;
export const DEFAULT_TAXONOMY_ADJUDICATION_BATCH_SIZE = 8;
export const HARD_TAXONOMY_ADJUDICATION_BATCH_SIZE = 16;

export const DISABLED_TAXONOMY_ADJUDICATOR = Object.freeze({
  id: "disabled",
  model: "disabled",
  async adjudicate() { throw new Error("Disabled taxonomy adjudicator must not be invoked"); },
});

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function bounded(value, fallback, min, max) { if (!Number.isFinite(value)) return fallback; return clamp(Number(value), min, max); }
function boundedInt(value, fallback, min, max) { if (!Number.isFinite(value)) return fallback; return Math.max(min, Math.min(max, Math.floor(Number(value)))); }
function providerIdentity(provider) { const id = String(provider?.id ?? "").trim(); const model = String(provider?.model ?? "").trim(); if (!id || id.length > 120) throw new Error("Taxonomy adjudicator id must be 1-120 characters"); if (!model || model.length > 180) throw new Error("Taxonomy adjudicator model must be 1-180 characters"); return { id, model }; }
function repoKey(value) { return String(value || "").toLocaleLowerCase("en-US"); }
function boundedTags(value) { if (!Array.isArray(value)) return []; const seen = new Set(); const result = []; for (const raw of value.slice(0, 16)) { const tag = String(raw ?? "").normalize("NFKC").replace(/\s+/gu, " ").trim().slice(0, 60); if (!tag) continue; const key = tag.toLocaleLowerCase("en-US"); if (seen.has(key)) continue; seen.add(key); result.push(tag); if (result.length >= 8) break; } return result; }

function buildCases(repos, taxonomy, ambiguousNames) {
  const wanted = new Set(ambiguousNames.map(repoKey));
  const selected = repos.filter((repo) => wanted.has(repoKey(repo.name)));
  const documents = buildRepoSemanticDocuments(selected);
  return selected.map((repo, index) => {
    const document = documents[index];
    return {
      repoName: repo.name,
      repository: {
        name: document.name,
        description: document.description.slice(0, 500),
        topics: [...document.topics].slice(0, 20),
        readmeExcerpt: document.readmeExcerpt.slice(0, 1_200),
        language: document.language,
        frameworks: [...document.frameworks].slice(0, 24),
        manifests: [...document.manifests].slice(0, 12),
        classification: repo.classification ? { categoryId: repo.classification.categoryId, categoryLabel: repo.classification.categoryLabel, confidence: repo.classification.confidence, secondaryTags: [...repo.classification.secondaryTags].slice(0, 8) } : undefined,
      },
      categories: taxonomy.categories.map((category) => ({ id: category.id, label: category.label, description: category.description, aliases: [...category.aliases].slice(0, 32), parentId: category.parentId })),
    };
  });
}

function validateDecision(raw, expectedRepoName, taxonomy, minConfidence) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { invalid: true, declined: false };
  if (String(raw.repoName ?? "") !== expectedRepoName) return { invalid: true, declined: false };
  const confidence = raw.confidence;
  if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) return { invalid: true, declined: false };
  const categoryId = raw.categoryId == null ? null : String(raw.categoryId).normalize("NFKC").trim().toLocaleLowerCase("en-US");
  if (categoryId === null || categoryId === "") return { invalid: false, declined: true };
  const category = taxonomy.categories.find((candidate) => candidate.id === categoryId);
  if (!category) return { invalid: true, declined: false };
  if (confidence < minConfidence) return { invalid: false, declined: true };
  const reason = String(raw.reason ?? "").normalize("NFKC").replace(/\s+/gu, " ").trim().slice(0, 240);
  if (!reason) return { invalid: true, declined: false };
  return { invalid: false, declined: false, assignment: { categoryId: category.id, categoryLabel: category.label, secondaryTags: boundedTags(raw.secondaryTags), confidence: Math.round(confidence * 1_000_000) / 1_000_000, method: "llm", evidence: [{ categoryId: category.id, source: "llm", value: reason, weight: Math.round(confidence * 1_000_000) / 1_000_000 }] } };
}

export async function adjudicateAmbiguousTaxonomyAssignments(repos, taxonomy, base, provider = DISABLED_TAXONOMY_ADJUDICATOR, options = {}) {
  const chosen = provider ?? DISABLED_TAXONOMY_ADJUDICATOR;
  let identity;
  try { identity = providerIdentity(chosen); } catch (error) {
    return { assignments: { ...base.assignments }, ambiguous: [...base.ambiguous], diagnostics: { eligible: base.ambiguous.length, attempted: 0, accepted: 0, declined: 0, invalid: 0, remaining: base.ambiguous.length, capped: false, calls: 0, providerId: "invalid", model: "invalid", disabled: false }, error: String(error instanceof Error ? error.message : error).slice(0, 300) };
  }
  const assignments = { ...base.assignments };
  const originalAmbiguous = [...new Set(base.ambiguous)].sort((a, b) => a.localeCompare(b));
  const eligible = originalAmbiguous.length;
  if (!taxonomy || !eligible || identity.id === "disabled") {
    return { assignments, ambiguous: originalAmbiguous, diagnostics: { eligible, attempted: 0, accepted: 0, declined: 0, invalid: 0, remaining: eligible, capped: false, calls: 0, providerId: identity.id, model: identity.model, disabled: identity.id === "disabled" } };
  }
  const maxCases = boundedInt(options.maxCases, DEFAULT_TAXONOMY_ADJUDICATION_MAX_CASES, 0, HARD_TAXONOMY_ADJUDICATION_MAX_CASES);
  const batchSize = boundedInt(options.batchSize, DEFAULT_TAXONOMY_ADJUDICATION_BATCH_SIZE, 1, HARD_TAXONOMY_ADJUDICATION_BATCH_SIZE);
  const minConfidence = bounded(options.minConfidence, DEFAULT_TAXONOMY_ADJUDICATION_MIN_CONFIDENCE, 0, 1);
  const selectedNames = originalAmbiguous.slice(0, maxCases);
  const selectedSet = new Set(selectedNames.map(repoKey));
  const cases = buildCases(repos, taxonomy, selectedNames).filter((item) => selectedSet.has(repoKey(item.repoName)));
  const remaining = new Set(originalAmbiguous);
  let attempted = 0, accepted = 0, declined = 0, invalid = 0, calls = 0, errorMessage;
  for (let offset = 0; offset < cases.length; offset += batchSize) {
    const batch = cases.slice(offset, offset + batchSize);
    let raw;
    try { calls += 1; raw = await chosen.adjudicate(batch); } catch (error) { errorMessage = String(error instanceof Error ? error.message : error).slice(0, 300); break; }
    if (!Array.isArray(raw) || raw.length !== batch.length) { errorMessage = `Taxonomy adjudicator returned ${Array.isArray(raw) ? raw.length : "invalid"} decisions for ${batch.length} cases`; break; }
    for (let index = 0; index < batch.length; index += 1) {
      attempted += 1;
      const checked = validateDecision(raw[index], batch[index].repoName, taxonomy, minConfidence);
      if (checked.invalid) { invalid += 1; continue; }
      if (checked.declined || !checked.assignment) { declined += 1; continue; }
      assignments[batch[index].repoName] = checked.assignment;
      remaining.delete(batch[index].repoName);
      accepted += 1;
    }
  }
  return { assignments, ambiguous: [...remaining].sort((a, b) => a.localeCompare(b)), diagnostics: { eligible, attempted, accepted, declined, invalid, remaining: remaining.size, capped: eligible > maxCases, calls, providerId: identity.id, model: identity.model, disabled: false }, ...(errorMessage ? { error: errorMessage } : {}) };
}
