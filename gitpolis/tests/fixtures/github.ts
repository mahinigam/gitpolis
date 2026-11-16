import type {
  CommitCategory,
  GitHubCommitData,
  GitHubProfilePayload,
  GitHubRepoData,
  GitHubUserData,
} from '../../src/domain/city/types';

const BASE_TIME = Date.parse('2024-01-01T00:00:00.000Z');

let sequence = 0;

export function makeCommit(overrides: Partial<GitHubCommitData> = {}): GitHubCommitData {
  sequence += 1;
  return {
    sha: `sha${String(sequence).padStart(9, '0')}`,
    message: 'feat: add something useful',
    date: new Date(BASE_TIME - sequence * 86_400_000).toISOString(),
    authorName: 'Ada Lovelace',
    authorLogin: 'ada',
    category: 'feat' as CommitCategory,
    ...overrides,
  };
}

export function makeRepo(overrides: Partial<GitHubRepoData> = {}): GitHubRepoData {
  sequence += 1;
  const name = overrides.name ?? `repo-${sequence}`;
  const createdAt = overrides.createdAt ?? new Date(BASE_TIME - sequence * 30 * 86_400_000).toISOString();
  const pushedAt = overrides.pushedAt ?? new Date(BASE_TIME - sequence * 86_400_000).toISOString();

  return {
    id: sequence,
    name,
    fullName: `ada/${name}`,
    description: 'A useful open-source project',
    htmlUrl: `https://github.com/ada/${name}`,
    homepage: null,
    language: 'TypeScript',
    languages: { TypeScript: 120_000 },
    stargazersCount: 10,
    forksCount: 2,
    openIssuesCount: 1,
    size: 400,
    createdAt,
    updatedAt: pushedAt,
    pushedAt,
    archived: false,
    fork: false,
    hasWiki: false,
    hasPages: false,
    topics: [],
    licenseName: 'MIT',
    commits: [makeCommit()],
    totalCommitEstimate: 42,
    estimatedLOC: 3_000,
    ...overrides,
  };
}

export function makeUser(overrides: Partial<GitHubUserData> = {}): GitHubUserData {
  return {
    login: 'ada',
    name: 'Ada Lovelace',
    avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
    bio: 'Analytical engines',
    location: 'London',
    company: 'Analytical Engines Ltd',
    blog: 'https://example.com',
    followers: 120,
    following: 12,
    publicRepos: 3,
    createdAt: '2012-04-01T00:00:00.000Z',
    htmlUrl: 'https://github.com/ada',
    ...overrides,
  };
}

export function makePayload(overrides: Partial<GitHubProfilePayload> = {}): GitHubProfilePayload {
  const repos = overrides.repos ?? [makeRepo()];
  return {
    user: makeUser(),
    repos,
    recentEventCount: 30,
    recentPushCount: 5,
    lastActivityAt: repos[0]?.pushedAt ?? new Date(BASE_TIME).toISOString(),
    source: 'live',
    rateLimit: { remaining: 4_000, limit: 5_000, resetAt: BASE_TIME + 3_600_000 },
    fetchedAt: new Date(BASE_TIME).toISOString(),
    ...overrides,
  };
}

/** A profile with a spread of domains, languages and vitals. */
export function makeDiversePayload(): GitHubProfilePayload {
  return makePayload({
    user: makeUser({ login: 'polyglot', publicRepos: 7, followers: 900 }),
    repos: [
      makeRepo({
        name: 'neural-lab',
        description: 'PyTorch model training and transformer experiments',
        language: 'Python',
        languages: { Python: 300_000 },
        topics: ['machine-learning', 'pytorch'],
        stargazersCount: 2_400,
        forksCount: 310,
        hasPages: true,
        homepage: 'https://neural.example.com',
        commits: [
          makeCommit({ category: 'init', message: 'Initial commit' }),
          makeCommit({ category: 'feat', message: 'feat: add attention block' }),
          makeCommit({ category: 'release', message: 'release: v1.2.0' }),
        ],
      }),
      makeRepo({
        name: 'edge-proxy',
        description: 'Kubernetes ingress and cloud networking',
        language: 'Go',
        languages: { Go: 150_000 },
        topics: ['kubernetes', 'cloud'],
        stargazersCount: 320,
        forksCount: 40,
        hasWiki: true,
      }),
      makeRepo({
        name: 'canal-ui',
        description: 'React design system and Tailwind components',
        language: 'TypeScript',
        languages: { TypeScript: 90_000, CSS: 20_000 },
        topics: ['react', 'design-system'],
        stargazersCount: 85,
        forksCount: 9,
      }),
      makeRepo({
        name: 'old-foundation',
        description: 'Early experiments from university',
        language: 'C',
        languages: { C: 40_000 },
        archived: true,
        stargazersCount: 3,
        forksCount: 1,
        pushedAt: '2016-05-01T00:00:00.000Z',
      }),
      makeRepo({
        name: 'ledger',
        description: 'Cryptographic audit ledger',
        language: 'Rust',
        languages: { Rust: 60_000 },
        topics: ['security', 'cryptography'],
        stargazersCount: 640,
        forksCount: 55,
      }),
      makeRepo({
        name: 'voxel-toy',
        description: 'WebGL 3D game engine',
        language: 'JavaScript',
        languages: { JavaScript: 70_000 },
        topics: ['gamedev', 'threejs'],
        stargazersCount: 41,
        forksCount: 6,
      }),
      makeRepo({
        name: 'cli-kit',
        description: 'Developer tooling and command line helpers',
        language: 'Shell',
        languages: { Shell: 12_000 },
        topics: ['cli', 'devtools'],
        stargazersCount: 12,
        forksCount: 0,
      }),
    ],
  });
}
