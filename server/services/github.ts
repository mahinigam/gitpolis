import type {
  GitHubCommitData,
  GitHubProfilePayload,
  GitHubRepoData,
  GitHubUserData,
} from '../../src/domain/city/types';
import { mapRawRepository } from '../../src/domain/github/mapRepository';
import { classifyCommitMessage } from '../../src/domain/github/commitClassifier';

import { TtlCache } from '../lib/cache';
import { mapWithConcurrency, sleep } from '../lib/async';

export { classifyCommitMessage };

const CACHE_TTL_MS = 15 * 60 * 1000;
/**
 * Only anonymous results are cached.
 *
 * A caller-supplied token can see that account's *private* repositories, so
 * caching by username alone would serve one visitor's private data to another.
 */
const anonymousCache = new TtlCache<GitHubProfilePayload>(CACHE_TTL_MS);

/** De-duplicates concurrent anonymous requests for the same user. */
const inFlight = new Map<string, Promise<GitHubProfilePayload>>();

const MAX_CONCURRENT_UPSTREAM = 6;

/** Optional server-wide token. Raises the API budget for every visitor. */
function resolveToken(token?: string): string | undefined {
  const explicit = token?.trim();
  if (explicit) return explicit;
  const envToken =
    (typeof process !== 'undefined' && process.env?.GITHUB_TOKEN) || undefined;
  return envToken?.trim() || undefined;
}

interface FetchResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  linkHeader?: string | null;
  rateLimit?: {
    remaining: number;
    limit: number;
    resetAt: number;
  } | null;
  error?: string;
}

async function ghFetchOnce<T>(url: string, token?: string): Promise<FetchResult<T>> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'GitPolis-3D-City-App/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
  const remaining = Number(res.headers.get('x-ratelimit-remaining'));
  const limit = Number(res.headers.get('x-ratelimit-limit'));
  const reset = Number(res.headers.get('x-ratelimit-reset'));
  const rateLimit =
    Number.isFinite(remaining) && Number.isFinite(limit) && limit > 0
      ? { remaining, limit, resetAt: reset * 1000 }
      : null;

  if (!res.ok) {
    let msg = `GitHub API error (${res.status})`;
    try {
      const errJson = (await res.json()) as { message?: string };
      if (errJson?.message) msg = errJson.message;
    } catch {
      // ignore json parse failure
    }
    return { ok: false, status: res.status, rateLimit, error: msg };
  }

  const data = (await res.json()) as T;
  return {
    ok: true,
    status: res.status,
    data,
    linkHeader: res.headers.get('link'),
    rateLimit,
  };
}

/**
 * GET with bounded retries for transient failures.
 * Rate-limit and not-found responses are terminal and returned immediately.
 */
async function ghFetch<T>(url: string, token?: string): Promise<FetchResult<T>> {
  let last: FetchResult<T>;
  try {
    last = await ghFetchOnce<T>(url, token);
  } catch (err) {
    last = { ok: false, status: 0, error: err instanceof Error ? err.message : 'Network error' };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    if (last.ok || [400, 401, 403, 404, 422].includes(last.status)) return last;
    await sleep(250 * 2 ** attempt);
    try {
      last = await ghFetchOnce<T>(url, token);
    } catch (err) {
      last = { ok: false, status: 0, error: err instanceof Error ? err.message : 'Network error' };
    }
  }
  return last;
}

function parseLastPageFromLink(linkHeader: string | null | undefined, perPage: number): number | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/[?&]page=(\d+)>;\s*rel="last"/);
  if (!match) return null;
  const lastPage = parseInt(match[1], 10);
  if (!Number.isFinite(lastPage) || lastPage <= 0) return null;
  return lastPage * perPage;
}

function scoreRepo(repo: any, nowMs: number): number {
  const pushedMs = new Date(repo.pushed_at || repo.updated_at || repo.created_at).getTime();
  const daysAgo = Math.max(0, (nowMs - pushedMs) / (1000 * 60 * 60 * 24));
  const recencyBoost = daysAgo < 30 ? 80 : daysAgo < 180 ? 45 : daysAgo < 365 ? 20 : 0;
  const starScore =
    Math.log10((repo.stargazers_count || 0) + 1) * 55 + Math.min(repo.stargazers_count || 0, 500) * 0.2;
  const forkScore = Math.log10((repo.forks_count || 0) + 1) * 20;
  const sizeScore = Math.log10((repo.size || 0) + 10) * 14;
  const ownBonus = repo.fork ? -35 : 35;
  const descBonus = repo.description ? 8 : 0;
  const archivedPenalty = repo.archived ? -8 : 0;
  return starScore + forkScore + sizeScore + recencyBoost + ownBonus + descBonus + archivedPenalty;
}

export class GitHubServiceError extends Error {
  status: number;
  rateLimited: boolean;
  resetAt?: number;

  constructor(message: string, status: number, rateLimited = false, resetAt?: number) {
    super(message);
    this.status = status;
    this.rateLimited = rateLimited;
    this.resetAt = resetAt;
  }
}

export async function fetchGitHubProfileForCity(
  rawUsername: string,
  token?: string
): Promise<GitHubProfilePayload> {
  const username = rawUsername.trim().replace(/^@/, '');
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username)) {
    throw new GitHubServiceError('Please enter a valid GitHub username.', 400);
  }
  // Never let a caller-supplied token reach a different host than api.github.com.
  token = resolveToken(token);

  const cacheKey = username.toLowerCase();
  if (!token) {
    const cached = anonymousCache.get(cacheKey);
    if (cached) return cached;

    const pending = inFlight.get(cacheKey);
    if (pending) return pending;

    const request = buildProfile(username, undefined).finally(() => inFlight.delete(cacheKey));
    inFlight.set(cacheKey, request);
    return request;
  }

  return buildProfile(username, token);
}

async function buildProfile(
  username: string,
  token: string | undefined
): Promise<GitHubProfilePayload> {

  // 1. User profile
  const userRes = await ghFetch<any>(`https://api.github.com/users/${encodeURIComponent(username)}`, token);
  let latestRateLimit = userRes.rateLimit ?? null;

  if (!userRes.ok || !userRes.data) {
    if (userRes.status === 404) {
      throw new GitHubServiceError(`GitHub user "@${username}" was not found.`, 404);
    }
    const isRateLimited =
      userRes.status === 403 &&
      ((latestRateLimit && latestRateLimit.remaining === 0) ||
        (userRes.error || '').toLowerCase().includes('rate limit'));
    if (isRateLimited) {
      throw new GitHubServiceError(
        'GitHub public API rate limit reached. Add an optional GitHub token for 5,000 req/hr, or explore the showcase city.',
        429,
        true,
        latestRateLimit?.resetAt
      );
    }
    throw new GitHubServiceError(userRes.error || 'Failed to reach GitHub API.', userRes.status);
  }

  const u = userRes.data;
  const user: GitHubUserData = {
    login: u.login,
    name: u.name,
    avatarUrl: u.avatar_url,
    bio: u.bio,
    location: u.location,
    company: u.company,
    blog: u.blog,
    followers: u.followers ?? 0,
    following: u.following ?? 0,
    publicRepos: u.public_repos ?? 0,
    createdAt: u.created_at,
    htmlUrl: u.html_url,
  };

  // 2. Paginate ALL public owned repositories (up to 300 anon / 500 with PAT) + fetch public events
  const maxPages = token ? 5 : 3;
  const [firstReposRes, eventsRes] = await Promise.all([
    ghFetch<any[]>(
      `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=pushed&per_page=100&page=1&type=owner`,
      token
    ),
    ghFetch<any[]>(
      `https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100`,
      token
    ),
  ]);

  if (firstReposRes.rateLimit) latestRateLimit = firstReposRes.rateLimit;
  if (eventsRes.rateLimit) latestRateLimit = eventsRes.rateLimit;

  let rawRepos: any[] = firstReposRes.ok && Array.isArray(firstReposRes.data) ? [...firstReposRes.data] : [];

  // Fetch additional pages if user has > 100 public repos!
  if (rawRepos.length === 100 && maxPages > 1) {
    const extraPages = Math.min(maxPages, Math.ceil((user.publicRepos || 100) / 100));
    const pagePromises: Promise<FetchResult<any[]>>[] = [];
    for (let p = 2; p <= extraPages; p++) {
      pagePromises.push(
        ghFetch<any[]>(
          `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=pushed&per_page=100&page=${p}&type=owner`,
          token
        )
      );
    }
    const extraResults = await mapWithConcurrency(
      pagePromises,
      MAX_CONCURRENT_UPSTREAM,
      (promise) => promise
    );
    for (const r of extraResults) {
      if (r.rateLimit) latestRateLimit = r.rateLimit;
      if (r.ok && Array.isArray(r.data)) {
        rawRepos.push(...r.data);
      }
    }
  }

  // Fallback if user has 0 owned repos
  if (rawRepos.length === 0) {
    const allReposRes = await ghFetch<any[]>(
      `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=100&type=all`,
      token
    );
    if (allReposRes.ok && Array.isArray(allReposRes.data)) {
      rawRepos = allReposRes.data;
    }
  }

  // Deduplicate by repo ID
  const dedupMap = new Map<number, any>();
  for (const r of rawRepos) {
    if (r && typeof r.id === 'number') dedupMap.set(r.id, r);
  }
  rawRepos = Array.from(dedupMap.values());

  // Extract commits & activity metrics from public events
  const events = eventsRes.ok && Array.isArray(eventsRes.data) ? eventsRes.data : [];
  const eventCommitsByRepo = new Map<string, GitHubCommitData[]>();
  let recentPushCount = 0;
  let lastActivityAt = u.updated_at || u.created_at;

  if (events.length > 0 && events[0].created_at) {
    lastActivityAt = events[0].created_at;
  }

  for (const ev of events) {
    if (ev.type === 'PushEvent') {
      recentPushCount++;
      const repoName = ev.repo?.name as string | undefined;
      const commits = ev.payload?.commits;
      if (repoName && Array.isArray(commits)) {
        const list = eventCommitsByRepo.get(repoName.toLowerCase()) || [];
        for (const c of commits) {
          if (c?.sha && c?.message) {
            list.push({
              sha: c.sha.slice(0, 12),
              message: c.message,
              date: ev.created_at,
              authorName: c.author?.name || user.login,
              authorLogin: user.login,
              category: classifyCommitMessage(c.message),
            });
          }
        }
        eventCommitsByRepo.set(repoName.toLowerCase(), list);
      }
    }
  }

  // Rank ALL repos (highest importance placed closest to Central Civic Plaza; ALL repos included!)
  const nowMs = Date.now();
  const rankedRepos = [...rawRepos].sort((a, b) => scoreRepo(b, nowMs) - scoreRepo(a, nowMs));

  // Allocate deep commit + language API fetches within GitHub rate-limit budget
  const remainingBudget = latestRateLimit ? latestRateLimit.remaining : token ? 4000 : 40;
  const maxDeepRepos = token
    ? Math.min(28, rankedRepos.length)
    : Math.min(rankedRepos.length, Math.max(0, Math.min(8, Math.floor((remainingBudget - 4) / 2))));
  const commitsPerRepo = token ? 40 : 25;

  const deepTargets = rankedRepos.slice(0, maxDeepRepos);
  const deepResults = await mapWithConcurrency(
    deepTargets,
    MAX_CONCURRENT_UPSTREAM,
    async (repo) => {
      const [commitsRes, langsRes] = await Promise.all([
        ghFetch<any[]>(
          `https://api.github.com/repos/${encodeURIComponent(repo.owner.login)}/${encodeURIComponent(repo.name)}/commits?per_page=${commitsPerRepo}`,
          token
        ),
        ghFetch<Record<string, number>>(
          `https://api.github.com/repos/${encodeURIComponent(repo.owner.login)}/${encodeURIComponent(repo.name)}/languages`,
          token
        ),
      ]);
      if (commitsRes.rateLimit) latestRateLimit = commitsRes.rateLimit;
      if (langsRes.rateLimit) latestRateLimit = langsRes.rateLimit;
      return { repoId: repo.id, commitsRes, langsRes };
    }
  );

  const deepMap = new Map(deepResults.map((r) => [r.repoId, r]));

  const repos: GitHubRepoData[] = rankedRepos.map((repo) => {
    const deep = deepMap.get(repo.id);
    const fullName: string = repo.full_name || `${user.login}/${repo.name}`;

    let commits: GitHubCommitData[] | undefined;
    let totalCommitEstimate: number | undefined;

    if (deep?.commitsRes.ok && Array.isArray(deep.commitsRes.data) && deep.commitsRes.data.length > 0) {
      const rawCommits = deep.commitsRes.data;
      commits = rawCommits.map((c: any, idx: number) => ({
        sha: (c.sha || '').slice(0, 12),
        message: c.commit?.message || 'Update repository',
        date:
          c.commit?.author?.date ||
          c.commit?.committer?.date ||
          repo.pushed_at ||
          repo.updated_at,
        authorName: c.commit?.author?.name || c.author?.login || user.login,
        authorLogin: c.author?.login,
        category: classifyCommitMessage(
          c.commit?.message || '',
          idx === rawCommits.length - 1 && rawCommits.length < commitsPerRepo
        ),
      }));
      const linkEstimate = parseLastPageFromLink(deep.commitsRes.linkHeader, commitsPerRepo);
      totalCommitEstimate = linkEstimate
        ? Math.max(commits.length, linkEstimate)
        : commits.length;
    }

    return mapRawRepository(repo, {
      languages:
        deep?.langsRes.ok && deep.langsRes.data ? deep.langsRes.data : undefined,
      commits,
      totalCommitEstimate,
      eventCommits: eventCommitsByRepo.get(fullName.toLowerCase()),
      authorFallback: user.login,
    });
  });

  for (const repo of repos) {
    if (new Date(repo.pushedAt).getTime() > new Date(lastActivityAt).getTime()) {
      lastActivityAt = repo.pushedAt;
    }
  }

  const hasSyntheticCommits = repos.some((repo) => repo.commitsSource === 'synthetic');
  const payload: GitHubProfilePayload = {
    user,
    repos,
    recentEventCount: events.length,
    recentPushCount,
    lastActivityAt,
    source: hasSyntheticCommits ? 'mixed' : 'live',
    rateLimit: latestRateLimit,
    fetchedAt: new Date().toISOString(),
  };

  if (!token) anonymousCache.set(username.toLowerCase(), payload);
  return payload;
}
