import type { GitHubProfilePayload } from '../city/types';
import { hashString } from '../prng';

/**
 * Bump when the prompt, schema or planning heuristics change materially.
 * It is part of the cache key, so stale plans are simply ignored.
 */
const FINGERPRINT_VERSION = 'v2';

/**
 * Deterministic fingerprint of a profile's *shape*, used as a cache key for
 * AI decision plans.
 *
 * Deliberately coarse: a plan only needs regenerating when the set of repos,
 * their total popularity, or the latest push changes — not on every fetch.
 */
export function computeProfileFingerprint(payload: GitHubProfilePayload): string {
  const username = payload.user.login.toLowerCase();
  const repoCount = payload.repos.length;
  const totalStars = payload.repos.reduce((sum, repo) => sum + (repo.stargazersCount || 0), 0);
  const latestPush = payload.repos.reduce((max, repo) => {
    const time = new Date(repo.pushedAt || 0).getTime();
    return Math.max(max, Number.isNaN(time) ? 0 : time);
  }, 0);

  // Repo identities are included: swapping one repo for another with the same
  // count and stars must invalidate a plan that names districts.
  const repoNames = payload.repos
    .map((repo) => repo.name.toLowerCase())
    .sort()
    .join(',');

  return [
    FINGERPRINT_VERSION,
    username,
    repoCount,
    totalStars,
    latestPush,
    hashString(repoNames),
  ].join(':');
}
