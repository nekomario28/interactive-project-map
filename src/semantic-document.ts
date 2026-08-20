import type { GitHubRepo, RepoSemanticDocument } from "./types";

export const SEMANTIC_DOCUMENT_VERSION = 1;
export const SEMANTIC_README_CHAR_LIMIT = 12 * 1024;

function normalizedText(value: unknown, maxChars: number): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxChars);
}

function normalizedList(value: unknown, maxItems: number, maxChars: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of value) {
    if (result.length >= maxItems) break;
    const item = normalizedText(raw, maxChars);
    if (!item) continue;
    const key = item.toLocaleLowerCase("en-US");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

export function buildRepoSemanticDocument(repo: GitHubRepo): RepoSemanticDocument {
  return {
    repoId: Number.isFinite(repo.id) ? Math.trunc(repo.id) : 0,
    name: normalizedText(repo.name, 100),
    description: normalizedText(repo.description, 2_000),
    topics: normalizedList(repo.topics, 40, 80),
    readmeExcerpt: normalizedText(repo.readmeExcerpt, SEMANTIC_README_CHAR_LIMIT),
    language: repo.language ? normalizedText(repo.language, 100) || null : null,
    frameworks: normalizedList(repo.frameworks, 64, 80),
    manifests: normalizedList(repo.manifests, 32, 160),
    fork: { isFork: repo.fork === true },
  };
}

export function buildRepoSemanticDocuments(repos: GitHubRepo[]): RepoSemanticDocument[] {
  return repos.map(buildRepoSemanticDocument);
}

export function canonicalSemanticDocument(document: RepoSemanticDocument): string {
  return JSON.stringify({
    repoId: Number.isFinite(document.repoId) ? Math.trunc(document.repoId) : 0,
    name: normalizedText(document.name, 100),
    description: normalizedText(document.description, 2_000),
    topics: normalizedList(document.topics, 40, 80),
    readmeExcerpt: normalizedText(document.readmeExcerpt, SEMANTIC_README_CHAR_LIMIT),
    language: document.language ? normalizedText(document.language, 100) || null : null,
    frameworks: normalizedList(document.frameworks, 64, 80),
    manifests: normalizedList(document.manifests, 32, 160),
    fork: {
      isFork: document.fork?.isFork === true,
      sourceName: normalizedText(document.fork?.sourceName, 100) || undefined,
      sourceDescription: normalizedText(document.fork?.sourceDescription, 2_000) || undefined,
      sourceTopics: normalizedList(document.fork?.sourceTopics, 40, 80),
    },
  });
}

export function semanticDocumentText(document: RepoSemanticDocument): string {
  const lines = [
    `name: ${document.name}`,
    document.description ? `description: ${document.description}` : "",
    document.topics.length ? `topics: ${document.topics.join(", ")}` : "",
    document.readmeExcerpt ? `readme: ${document.readmeExcerpt}` : "",
    document.language ? `language: ${document.language}` : "",
    document.frameworks.length ? `frameworks: ${document.frameworks.join(", ")}` : "",
    document.manifests.length ? `manifests: ${document.manifests.join(", ")}` : "",
    document.fork?.isFork ? "fork: true" : "fork: false",
    document.fork?.sourceName ? `fork source: ${document.fork.sourceName}` : "",
    document.fork?.sourceDescription ? `fork source description: ${document.fork.sourceDescription}` : "",
    document.fork?.sourceTopics?.length ? `fork source topics: ${document.fork.sourceTopics.join(", ")}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}
