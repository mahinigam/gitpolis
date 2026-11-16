import type { ConstructionProgress, GitHubProfilePayload } from '../../domain/city/types';
import {
  deriveActivityCounts,
  mapRawRepository,
  mapRawUser,
  type RawGitHubRepo,
} from '../../domain/github/mapRepository';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Direct client-side fetcher with automatic fallback from local Vite middleware
 * to direct public GitHub API (https://api.github.com), delivering real-time building progress.
 */
export interface FetchProfileOptions {
  /** Cancels every in-flight request for this build. */
  signal?: AbortSignal;
}

export async function fetchGitHubProfileWithProgress(
  rawUsername: string,
  token?: string,
  onProgress?: (progress: ConstructionProgress) => void,
  options: FetchProfileOptions = {}
): Promise<GitHubProfilePayload> {
  const { signal } = options;
  const username = rawUsername.trim().replace(/^@/, '');
  if (!username) {
    throw new Error('Please enter a GitHub username.');
  }

  // Stage 1: Surveying
  onProgress?.({
    phase: 'survey',
    phaseIndex: 1,
    totalPhases: 5,
    percentage: 15,
    headline: `Surveying @${username}`,
    detail: 'Connecting to GitHub satellites and querying public profile metadata…',
  });

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  };
  if (token && token.trim()) {
    headers['x-github-token'] = token.trim();
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  // 1. Try local Vite server API first
  try {
    const localRes = await fetch(`/api/github/${encodeURIComponent(username)}`, {
      headers,
      signal,
    });
    if (localRes.ok) {
      const payload: GitHubProfilePayload = await localRes.json();

      // Animate the remaining construction phases smoothly so user sees the building process!
      onProgress?.({
        phase: 'cadastre',
        phaseIndex: 2,
        totalPhases: 5,
        percentage: 42,
        headline: 'Zoning Municipal Cadastre',
        detail: `Calculating prosperity ratings & zoning ${payload.repos.length} distinct repository blocks…`,
        stats: {
          repoCount: payload.repos.length,
          locCount: payload.repos.reduce((s, r) => s + (r.estimatedLOC || 0), 0),
          langCount: new Set(payload.repos.map((r) => r.language).filter(Boolean)).size,
        },
      });
      await delay(260);

      onProgress?.({
        phase: 'coastline',
        phaseIndex: 3,
        totalPhases: 5,
        percentage: 65,
        headline: 'Reclaiming Coastline & Waterways',
        detail: 'Dredging dual-bank harbor canal, building transit bridges & paving avenues…',
      });
      await delay(240);

      onProgress?.({
        phase: 'skyline',
        phaseIndex: 4,
        totalPhases: 5,
        percentage: 86,
        headline: 'Raising Architectural Skylines',
        detail: 'Extruding commit-based structures, mounting cranes & installing gilded spires…',
      });
      await delay(220);

      onProgress?.({
        phase: 'life',
        phaseIndex: 5,
        totalPhases: 5,
        percentage: 98,
        headline: 'Simulating Commuter Life',
        detail: 'Lighting streetlamps, dispatching canal boats & tuning live atmospheric climate…',
      });
      await delay(180);

      return payload;
    }
  } catch {
    // If local API fails or is not running, proceed to direct client-side GitHub API
  }

  // 2. Direct client-side GitHub REST API
  const ghHeaders: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  };
  if (token && token.trim()) {
    ghHeaders.Authorization = `Bearer ${token.trim()}`;
  }

  const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
    headers: ghHeaders,
    signal,
  });

  if (!userRes.ok) {
    if (userRes.status === 404) {
      throw new Error(`GitHub user "@${username}" was not found.`);
    }
    if (userRes.status === 403) {
      throw new Error(
        'GitHub public API rate limit reached (60 req/hr). Add an optional GitHub token for 5,000 req/hr, or explore the showcase city.'
      );
    }
    throw new Error(`GitHub API error (${userRes.status})`);
  }

  const u = await userRes.json();
  const user = mapRawUser(u);

  // Stage 2: Repositories
  onProgress?.({
    phase: 'cadastre',
    phaseIndex: 2,
    totalPhases: 5,
    percentage: 38,
    headline: `Cataloging @${username}'s Repositories`,
    detail: `Surveying public repositories and inspecting language distributions…`,
  });

  const reposRes = await fetch(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=pushed&per_page=100&type=owner`,
    { headers: ghHeaders, signal }
  );

  if (!reposRes.ok) {
    throw new Error(`Failed to retrieve repositories for @${username}.`);
  }

  const rawRepos: any[] = await reposRes.json();
  const reposToProcess = rawRepos.slice(0, 100);

  // Stage 3: Sampling top repos commit details
  onProgress?.({
    phase: 'coastline',
    phaseIndex: 3,
    totalPhases: 5,
    percentage: 62,
    headline: 'Analyzing Architectural DNA',
    detail: `Sampled ${reposToProcess.length} repositories. Analyzing commit categories & LOC…`,
  });

  const enrichedRepos = reposToProcess.map((repo: RawGitHubRepo) =>
    mapRawRepository(repo, { authorFallback: username })
  );
  const totalLOC = enrichedRepos.reduce((sum, repo) => sum + repo.estimatedLOC, 0);

  // Stage 4 & 5
  onProgress?.({
    phase: 'skyline',
    phaseIndex: 4,
    totalPhases: 5,
    percentage: 85,
    headline: 'Erecting Architectural Districts',
    detail: `Constructing ${enrichedRepos.length} blocks with ~${totalLOC.toLocaleString()} estimated lines of code…`,
  });
  await delay(180);

  onProgress?.({
    phase: 'life',
    phaseIndex: 5,
    totalPhases: 5,
    percentage: 98,
    headline: 'Infusing Commuter Life',
    detail: 'Aligning astronomical solar angles and dispatching transit links…',
  });
  await delay(160);

  // The events feed is not available on this path, so activity counters are
  // derived from push dates instead of being invented.
  const activity = deriveActivityCounts(enrichedRepos);

  return {
    user,
    repos: enrichedRepos,
    recentEventCount: 0,
    recentPushCount: activity.recentPushCount,
    lastActivityAt: activity.lastActivityAt || user.createdAt,
    source: 'mixed',
    rateLimit: null,
    fetchedAt: new Date().toISOString(),
  };
}
