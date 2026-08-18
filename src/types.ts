export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  GITHUB_TOKEN?: string;
  API_RATE_LIMITER?: RateLimitBinding;
  UPSTREAM_RATE_LIMITER?: RateLimitBinding;
  GLOBAL_UPSTREAM_RATE_LIMITER?: RateLimitBinding;
}

export interface GitHubRepo {
  id: number;
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  topics?: string[];
  stargazers_count: number;
  forks_count: number;
  fork: boolean;
  archived: boolean;
  updated_at: string;
  homepage?: string | null;
}

export type GalaxyNodeType = "owner" | "group" | "repository";

export interface GalaxyNode {
  id: string;
  label: string;
  type: GalaxyNodeType;
  url?: string;
  description?: string;
  language?: string | null;
  topics?: string[];
  stars?: number;
  forks?: number;
  fork?: boolean;
  archived?: boolean;
  updatedAt?: string;
  groupId?: string;
  groupLabel?: string;
  repositoryCount?: number;
}

export interface GalaxyEdge {
  source: string;
  target: string;
  type: "ownership" | "membership";
}

export interface GalaxyGraph {
  owner: string;
  generatedAt: string;
  repositoryCount: number;
  groupCount: number;
  nodes: GalaxyNode[];
  edges: GalaxyEdge[];
}
