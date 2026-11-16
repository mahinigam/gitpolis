import { describe, expect, it } from 'vitest';
import { computeProfileFingerprint } from '../../../src/domain/github/fingerprint';
import type { GitHubRepoData } from '../../../src/domain/city/types';
import { makePayload, makeRepo, makeUser } from '../../fixtures/github';

const CREATED = '2020-01-01T00:00:00.000Z';
const PUSHED = '2024-01-01T00:00:00.000Z';

function repo(overrides: Partial<GitHubRepoData> = {}): GitHubRepoData {
  return makeRepo({
    name: 'alpha',
    description: 'first project',
    createdAt: CREATED,
    pushedAt: PUSHED,
    stargazersCount: 10,
    ...overrides,
  });
}

function fingerprintOf(repos: GitHubRepoData[], login = 'ada'): string {
  return computeProfileFingerprint(makePayload({ user: makeUser({ login }), repos }));
}

describe('computeProfileFingerprint', () => {
  it('is stable for payloads with equal shape', () => {
    // Separate objects, identical shape; ids and commit details differ but
    // those are deliberately ignored by the fingerprint.
    const first = fingerprintOf([repo()]);
    const second = fingerprintOf([repo()]);

    expect(first).toBe(second);
  });

  it('changes when the repository count changes', () => {
    const one = fingerprintOf([repo()]);
    const two = fingerprintOf([
      repo(),
      repo({ name: 'beta', pushedAt: '2023-01-01T00:00:00.000Z', stargazersCount: 0 }),
    ]);

    expect(two).not.toBe(one);
  });

  it('changes when total stars change', () => {
    const quiet = fingerprintOf([repo({ stargazersCount: 10 })]);
    const popular = fingerprintOf([repo({ stargazersCount: 11 })]);

    expect(popular).not.toBe(quiet);
  });

  it('changes when the latest pushedAt changes', () => {
    const older = fingerprintOf([repo({ pushedAt: '2024-01-01T00:00:00.000Z' })]);
    const newer = fingerprintOf([repo({ pushedAt: '2024-02-01T00:00:00.000Z' })]);

    expect(newer).not.toBe(older);
  });

  it('uses the latest pushedAt across all repos', () => {
    const repos = [
      repo({ name: 'a', pushedAt: '2024-01-01T00:00:00.000Z' }),
      repo({ name: 'b', pushedAt: '2025-01-01T00:00:00.000Z' }),
    ];
    const withLatest = fingerprintOf(repos);
    const withDifferentOlder = fingerprintOf([
      repo({ name: 'a', pushedAt: '2023-01-01T00:00:00.000Z' }),
      repo({ name: 'b', pushedAt: '2025-01-01T00:00:00.000Z' }),
    ]);

    // Only the newest push matters, so changing an older repo's date is a no-op.
    expect(withDifferentOlder).toBe(withLatest);
  });

  it('treats usernames case-insensitively', () => {
    const lower = fingerprintOf([repo()], 'ada');
    const upper = fingerprintOf([repo()], 'ADA');
    const mixed = fingerprintOf([repo()], 'Ada');

    expect(upper).toBe(lower);
    expect(mixed).toBe(lower);
  });

  it('ignores repository descriptions', () => {
    const original = fingerprintOf([repo({ name: 'alpha', description: 'first project' })]);
    const described = fingerprintOf([repo({ name: 'alpha', description: null })]);

    expect(described).toBe(original);
  });

  it('changes when a repository is replaced by a differently named one', () => {
    // Plans name districts after repositories, so a rename must invalidate them
    // even when the count and star total are unchanged.
    const original = fingerprintOf([repo({ name: 'alpha' })]);
    const renamed = fingerprintOf([repo({ name: 'totally-different' })]);

    expect(renamed).not.toBe(original);
  });

  it('treats repository names case-insensitively', () => {
    const lower = fingerprintOf([repo({ name: 'alpha' })]);
    const upper = fingerprintOf([repo({ name: 'ALPHA' })]);

    expect(upper).toBe(lower);
  });

  it('includes the version, lowercased username, coarse shape and name hash', () => {
    const value = fingerprintOf([repo({ stargazersCount: 10 })], 'ADA');
    const [version, username, repoCount, totalStars, latestPush, nameHash] = value.split(':');

    expect(version).toBe('v2');
    expect(username).toBe('ada');
    expect(repoCount).toBe('1');
    expect(totalStars).toBe('10');
    expect(latestPush).toBe(String(Date.parse(PUSHED)));
    expect(nameHash).toMatch(/^\d+$/);
  });
});
