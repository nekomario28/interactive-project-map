import standardTaxonomy from "../data/standard-taxonomy.v1.json" with { type: "json" };
import {
  buildRepositoryAssessmentArtifact,
  makeAssessmentRepositorySkeleton,
} from "./repository-assessment-artifact.mjs";
import { inferL0RepositoryRelation } from "./repository-relation.mjs";

const ARTIFACT_VALUES = new Set(standardTaxonomy.facets.artifact.values);

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function observedCategory(node) {
  const assignment = node.taxonomyAssignment;
  if (assignment && typeof assignment === "object" && typeof assignment.categoryId === "string" && assignment.categoryId) {
    return assignment.categoryId;
  }
  const classification = node.classification;
  if (classification && typeof classification === "object" && typeof classification.categoryId === "string" && classification.categoryId) {
    return classification.categoryId;
  }
  return null;
}

function artifactTagsFrom(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.secondaryTags)) return [];
  return value.secondaryTags
    .filter((tag) => typeof tag === "string" && tag.startsWith("artifact:"))
    .map((tag) => tag.slice("artifact:".length))
    .filter((artifact) => ARTIFACT_VALUES.has(artifact));
}

function observedArtifacts(node) {
  const values = [...new Set([
    ...artifactTagsFrom(node.taxonomyAssignment),
    ...artifactTagsFrom(node.classification),
  ])];
  return values.length ? values : null;
}

function repositoryIdentity(graphOwner, node) {
  if (node.relation === "contributed") {
    return {
      owner: node.repositoryOwner,
      name: node.repositoryName,
      external: true,
    };
  }
  return {
    owner: graphOwner,
    name: node.label,
    external: false,
  };
}

export function buildL0RepositoryAssessmentFromGraph(graphValue, options = {}) {
  const graph = object(graphValue, "graph");
  if (typeof graph.owner !== "string" || !graph.owner) throw new Error("graph.owner is required");
  if (!Array.isArray(graph.nodes)) throw new Error("graph.nodes must be an array");
  if (typeof options.generatorRevision !== "string") throw new Error("generatorRevision is required");

  const observedAt = options.observedAt ?? graph.generatedAt;
  const repositoryNodes = graph.nodes.filter((node) => node && typeof node === "object" && node.type === "repository");
  const repositories = [];
  const diagnostics = {
    repositories: 0,
    owned: 0,
    contributed: 0,
    forks: 0,
    collaborationUnknown: 0,
    categoryObserved: 0,
    categoryUnknown: 0,
    artifactsObserved: 0,
    artifactsUnknown: 0,
    archived: 0,
    lifecycleUnknown: 0,
  };

  for (const node of repositoryNodes) {
    const identity = repositoryIdentity(graph.owner, node);
    const relation = inferL0RepositoryRelation({ external: identity.external, fork: node.fork === true });
    const categoryId = observedCategory(node);
    const artifacts = observedArtifacts(node);
    const lifecycle = node.archived === true ? "archived" : "unknown";

    repositories.push(makeAssessmentRepositorySkeleton(graph.owner, {
      owner: identity.owner,
      name: identity.name,
      githubRepositoryId: null,
      categoryId,
      artifacts,
      lifecycle,
      relation,
      observedAt,
    }));

    diagnostics.repositories += 1;
    diagnostics[identity.external ? "contributed" : "owned"] += 1;
    if (relation.lineage === "fork") diagnostics.forks += 1;
    if (relation.collaboration === "unknown") diagnostics.collaborationUnknown += 1;
    diagnostics[categoryId ? "categoryObserved" : "categoryUnknown"] += 1;
    diagnostics[artifacts ? "artifactsObserved" : "artifactsUnknown"] += 1;
    if (lifecycle === "archived") diagnostics.archived += 1;
    else diagnostics.lifecycleUnknown += 1;
  }

  const artifact = buildRepositoryAssessmentArtifact({
    owner: graph.owner,
    generatedAt: options.generatedAt ?? observedAt,
    generatorRevision: options.generatorRevision,
    prominenceCandidateId: options.prominenceCandidateId ?? null,
    repositories,
  });

  return { artifact, diagnostics };
}
