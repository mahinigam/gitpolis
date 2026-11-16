import type {
  CommitsSource,
  GitHubCommitData,
  GitHubRepoData,
} from '../city/types';
import { estimateRepoLOC } from './metrics';
import { buildSyntheticCommitTimeline } from './commitClassifier';

/** Subset of the GitHub REST repository object that GitPolis consumes. */
export interface RawGitHubRepo {
  id: number;
  name: string;
  full_name?: string;
  description?: string | null;
  html_url?: string;
  homepage?: string | null;
  language?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  size?: number;
  created_at?: string;
  updated_at?: string;
  pushed_at?: string;
  archived?: boolean;
  fork?: boolean;
  has_wiki?: boolean;
  has_pages?: boolean;
  topics?: string[];
  license?: { spdx_id?: string | null; name?: string | null } | null;
  owner?: { login?: string };
}

export interface MapRepositoryOptions {
  /** Byte map from `/repos/:owner/:repo/languages`. */
  languages?: Record<string, number>;
  /** Commits fetched from the API. */
  commits?: GitHubCommitData[];
  /** Commit count derived from the pagination Link header. */
  totalCommitEstimate?: number;
  /** Commit list recovered from the public events feed. */
  eventCommits?: GitHubCommitData[];
  /** Fallback author name for synthetic commits. */
  authorFallback?: string;
}

export interface MappedRepository extends GitHubRepoData {
  commitsSource: CommitsSource;
}

const DEFAULT_SOURCE_BYTES_RATIO = 0.36;

/**
 * Single source of truth for turning a GitHub REST repository into the domain
 * model. Both the server proxy and the browser fallback use this, so the same
 * profile always produces the same city regardless of transport.
 */
export function mapRawRepository(
  raw: RawGitHubRepo,
  options: MapRepositoryOptions = {}
): MappedRepository {
  const sizeKB = raw.size ?? 0;
  const primaryLanguage = raw.language ?? null;

  let languages = options.languages ?? {};
  if (Object.keys(languages).length === 0 && primaryLanguage) {
    languages = {
      [primaryLanguage]: Math.max(800, Math.round(sizeKB * 1024 * DEFAULT_SOURCE_BYTES_RATIO)),
    };
  }

  const estimatedLOC = estimateRepoLOC(languages, primaryLanguage, sizeKB);

  let commits: GitHubCommitData[];
  let commitsSource: CommitsSource;
  let totalCommitEstimate: number;

  if (options.commits && options.commits.length > 0) {
    commits = options.commits;
    commitsSource = 'api';
    totalCommitEstimate =
      options.totalCommitEstimate ?? Math.max(commits.length, 1);
  } else if (options.eventCommits && options.eventCommits.length >= 3) {
    commits = options.eventCommits;
    commitsSource = 'events';
    totalCommitEstimate =
      options.totalCommitEstimate ?? Math.max(commits.length, 1);
  } else {
    commits = [
      ...(options.eventCommits ?? []),
      ...buildSyntheticCommitTimeline(raw, options.authorFallback ?? 'Author'),
    ];
    commitsSource = 'synthetic';
    totalCommitEstimate =
      options.totalCommitEstimate ??
      Math.max(commits.length, Math.round(Math.log2(sizeKB + 8) * 5));
  }

  return {
    id: raw.id,
    name: raw.name,
    fullName: raw.full_name ?? `${raw.owner?.login ?? 'unknown'}/${raw.name}`,
    description: raw.description ?? null,
    htmlUrl: raw.html_url ?? `https://github.com/${raw.owner?.login ?? 'unknown'}/${raw.name}`,
    homepage: raw.homepage || null,
    language: primaryLanguage ?? Object.keys(languages)[0] ?? null,
    languages,
    stargazersCount: raw.stargazers_count ?? 0,
    forksCount: raw.forks_count ?? 0,
    openIssuesCount: raw.open_issues_count ?? 0,
    size: sizeKB,
    createdAt: raw.created_at ?? new Date(0).toISOString(),
    updatedAt: raw.updated_at ?? raw.pushed_at ?? new Date(0).toISOString(),
    pushedAt: raw.pushed_at ?? raw.updated_at ?? raw.created_at ?? new Date(0).toISOString(),
    archived: Boolean(raw.archived),
    fork: Boolean(raw.fork),
    hasWiki: Boolean(raw.has_wiki),
    hasPages: Boolean(raw.has_pages),
    topics: Array.isArray(raw.topics) ? raw.topics : [],
    licenseName: raw.license?.spdx_id || raw.license?.name || null,
    commits,
    totalCommitEstimate,
    estimatedLOC,
    commitsSource,
  };
}

/** Maps a GitHub user object to the domain model. */
export function mapRawUser(raw: Record<string, any>) {
  return {
    login: raw.login as string,
    name: (raw.name ?? null) as string | null,
    avatarUrl: raw.avatar_url as string,
    bio: (raw.bio ?? null) as string | null,
    location: (raw.location ?? null) as string | null,
    company: (raw.company ?? null) as string | null,
    blog: (raw.blog ?? null) as string | null,
    followers: (raw.followers ?? 0) as number,
    following: (raw.following ?? 0) as number,
    publicRepos: (raw.public_repos ?? 0) as number,
    createdAt: raw.created_at as string,
    htmlUrl: raw.html_url as string,
  };
}

/**
 * Derives honest activity counters from repository push dates.
 * Used when the events feed is unavailable, rather than inventing numbers.
 */
export function deriveActivityCounts(
  repos: readonly GitHubRepoData[],
  nowMs = Date.now()
): { recentPushCount: number; lastActivityAt: string } {
  const fourteenDays = 14 * 86_400_000;
  let recentPushCount = 0;
  let latest = 0;

  for (const repo of repos) {
    const pushed = new Date(repo.pushedAt || repo.updatedAt).getTime();
    if (!Number.isFinite(pushed)) continue;
    if (nowMs - pushed <= fourteenDays) recentPushCount += 1;
    latest = Math.max(latest, pushed);
  }

  return {
    recentPushCount,
    lastActivityAt: latest > 0 ? new Date(latest).toISOString() : new Date(nowMs).toISOString(),
  };
}
