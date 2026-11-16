import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Service = typeof import('../../../server/services/github');

const USER_URL = 'https://api.github.com/users/ada';
const REPOS_URL = /\/users\/ada\/repos\?/;

const RAW_USER = {
  login: 'ada',
  name: 'Ada Lovelace',
  avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
  bio: 'Analytical engines',
  location: 'London',
  company: 'Analytical Engines Ltd',
  blog: '',
  followers: 120,
  following: 12,
  public_repos: 1,
  created_at: '2012-04-01T00:00:00.000Z',
  updated_at: '2025-05-01T00:00:00.000Z',
  html_url: 'https://github.com/ada',
};

function rawRepo(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    name: 'canal-city',
    full_name: 'ada/canal-city',
    description: 'A canal simulator',
    html_url: 'https://github.com/ada/canal-city',
    homepage: null,
    language: 'TypeScript',
    stargazers_count: 7,
    forks_count: 1,
    open_issues_count: 0,
    size: 1_000,
    created_at: '2020-01-01T00:00:00.000Z',
    updated_at: '2025-05-01T00:00:00.000Z',
    pushed_at: '2025-05-01T00:00:00.000Z',
    archived: false,
    fork: false,
    has_wiki: false,
    has_pages: false,
    topics: ['simulation'],
    license: { spdx_id: 'MIT', name: 'MIT License' },
    owner: { login: 'ada' },
    ...overrides,
  };
}

interface MockResponseInit {
  status?: number;
  ok?: boolean;
  rateRemaining?: number;
  link?: string;
}

function jsonResponse(data: unknown, init: MockResponseInit = {}) {
  const status = init.status ?? 200;
  const headers = new Map<string, string>();
  if (init.rateRemaining !== undefined) {
    headers.set('x-ratelimit-remaining', String(init.rateRemaining));
    headers.set('x-ratelimit-limit', '60');
    headers.set('x-ratelimit-reset', '1700000000');
  }
  if (init.link) headers.set('link', init.link);

  return {
    ok: init.ok ?? (status >= 200 && status < 300),
    status,
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    json: async () => data,
  };
}

interface RouterOptions {
  user?: unknown;
  userStatus?: number;
  userFailures?: number;
  repos?: unknown[];
  events?: unknown[];
  commits?: unknown[];
  commitsLink?: string;
  languages?: Record<string, number>;
  languagesStatus?: number;
  rateRemaining?: number;
}

let fetchMock: ReturnType<typeof vi.fn>;
let service: Service;
const originalToken = process.env.GITHUB_TOKEN;

function installRouter(options: RouterOptions = {}) {
  const {
    user = RAW_USER,
    userStatus = 200,
    userFailures = 0,
    repos = [rawRepo()],
    events = [],
    commits = [],
    commitsLink,
    languages = {},
    languagesStatus = 200,
    rateRemaining = 2,
  } = options;
  let userCalls = 0;

  fetchMock.mockImplementation(async (input: unknown) => {
    const url = String(input);

    if (url === USER_URL) {
      userCalls += 1;
      if (userCalls <= userFailures) {
        return jsonResponse({ message: 'temporary failure' }, { status: 500 });
      }
      return jsonResponse(user, { status: userStatus, rateRemaining });
    }

    if (REPOS_URL.test(url)) {
      if (url.includes('type=all')) return jsonResponse(repos, { rateRemaining });
      return jsonResponse(repos, { rateRemaining });
    }

    if (url.includes('/users/ada/events/public')) {
      return jsonResponse(events, { rateRemaining });
    }

    if (url.includes('/commits?')) {
      return jsonResponse(commits, { rateRemaining, link: commitsLink });
    }

    if (url.endsWith('/languages')) {
      if (languagesStatus !== 200) {
        return jsonResponse({ message: 'nope' }, { status: languagesStatus, rateRemaining });
      }
      return jsonResponse(languages, { rateRemaining });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });
}

beforeEach(async () => {
  vi.resetModules();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  delete process.env.GITHUB_TOKEN;
  service = await import('../../../server/services/github');
});

afterEach(() => {
  if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = originalToken;
  vi.unstubAllGlobals();
});

describe('fetchGitHubProfileForCity — username validation', () => {
  it.each(['', '   ', '-ada', 'ada-', 'ada_love', 'a'.repeat(40), 'ada lovelace'])(
    'rejects %j without calling GitHub',
    async (username) => {
      await expect(service.fetchGitHubProfileForCity(username)).rejects.toMatchObject({
        status: 400,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it('strips surrounding whitespace and a leading @', async () => {
    installRouter();

    const payload = await service.fetchGitHubProfileForCity('  @ada  ');

    expect(payload.user.login).toBe('ada');
    expect(String(fetchMock.mock.calls[0][0])).toBe(USER_URL);
  });
});

describe('fetchGitHubProfileForCity — upstream errors', () => {
  it('maps a 404 to a not-found error', async () => {
    installRouter({ userStatus: 404 });

    await expect(service.fetchGitHubProfileForCity('ada')).rejects.toMatchObject({
      status: 404,
      message: expect.stringMatching(/not found/i),
    });
  });

  it('maps a 403 with an exhausted budget to a rate-limit error', async () => {
    installRouter({ userStatus: 403 });
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse({ message: 'API rate limit exceeded' }, { status: 403, rateRemaining: 0 })
    );

    await expect(service.fetchGitHubProfileForCity('ada')).rejects.toMatchObject({
      status: 429,
      rateLimited: true,
      resetAt: 1_700_000_000_000,
    });
  });

  it('passes through a non-rate-limit 403', async () => {
    installRouter({ userStatus: 403 });
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse({ message: 'Forbidden' }, { status: 403, rateRemaining: 59 })
    );

    await expect(service.fetchGitHubProfileForCity('ada')).rejects.toMatchObject({
      status: 403,
      rateLimited: false,
      message: 'Forbidden',
    });
  });

  it('retries a 500 before succeeding', async () => {
    installRouter({ userFailures: 1 });

    const payload = await service.fetchGitHubProfileForCity('ada');

    expect(payload.user.login).toBe('ada');
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === USER_URL)).toHaveLength(2);
  }, 10_000);

  it('gives up after retrying a persistent 500', async () => {
    installRouter({ userFailures: 3 });

    await expect(service.fetchGitHubProfileForCity('ada')).rejects.toMatchObject({
      status: 500,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  }, 10_000);
});

describe('fetchGitHubProfileForCity — mapping', () => {
  it('maps the profile and repositories to the domain shape', async () => {
    installRouter();

    const payload = await service.fetchGitHubProfileForCity('ada');

    expect(payload.user).toMatchObject({
      login: 'ada',
      name: 'Ada Lovelace',
      followers: 120,
      publicRepos: 1,
    });
    expect(payload.repos).toHaveLength(1);
    expect(payload.repos[0]).toMatchObject({
      id: 101,
      name: 'canal-city',
      fullName: 'ada/canal-city',
      language: 'TypeScript',
      stargazersCount: 7,
      licenseName: 'MIT',
      size: 1_000,
    });
    expect(payload.repos[0].estimatedLOC).toBeGreaterThan(0);
    expect(payload.rateLimit).toEqual({ remaining: 2, limit: 60, resetAt: 1_700_000_000_000 });
    expect(payload.fetchedAt).toEqual(expect.any(String));
  });

  it('derives synthetic commits and reports mixed provenance', async () => {
    installRouter();

    const payload = await service.fetchGitHubProfileForCity('ada');

    expect(payload.repos[0].commitsSource).toBe('synthetic');
    expect(payload.repos[0].commits.length).toBeGreaterThanOrEqual(3);
    expect(payload.source).toBe('mixed');
    expect(payload.recentEventCount).toBe(0);
    expect(payload.recentPushCount).toBe(0);
  });

  it('ranks repositories by score with the strongest first', async () => {
    installRouter({
      repos: [
        rawRepo({ id: 1, name: 'quiet', full_name: 'ada/quiet', stargazers_count: 0, forks_count: 0 }),
        rawRepo({ id: 2, name: 'flagship', full_name: 'ada/flagship', stargazers_count: 900, forks_count: 90 }),
      ],
    });

    const payload = await service.fetchGitHubProfileForCity('ada');

    expect(payload.repos[0].name).toBe('flagship');
    expect(payload.repos[1].name).toBe('quiet');
  });

  it('uses commit and language telemetry for live provenance', async () => {
    installRouter({
      commits: [
        {
          sha: 'abcdef1234567890',
          commit: { message: 'feat: add canal', author: { name: 'Ada', date: '2025-04-01T00:00:00Z' } },
          author: { login: 'ada' },
        },
        {
          sha: '1234567890abcdef',
          commit: { message: 'fix: lock gates', author: { name: 'Ada', date: '2025-04-02T00:00:00Z' } },
          author: { login: 'ada' },
        },
      ],
      commitsLink: '<https://api.github.com/repositories/1/commits?per_page=25&page=3>; rel="last"',
      languages: { TypeScript: 50_000 },
      rateRemaining: 100,
    });

    const payload = await service.fetchGitHubProfileForCity('ada');
    const repo = payload.repos[0];

    expect(repo.commitsSource).toBe('api');
    expect(repo.commits).toHaveLength(2);
    expect(repo.commits[0].sha).toBe('abcdef123456');
    expect(repo.commits[0].category).toBe('feat');
    // GitHub returns newest-first; a short list means the final entry is the
    // repository's oldest commit, which is classified as the founding commit.
    expect(repo.commits[1].category).toBe('init');
    expect(repo.totalCommitEstimate).toBe(75);
    expect(repo.languages).toEqual({ TypeScript: 50_000 });
    expect(payload.source).toBe('live');
  });

  it('keeps fetched commits when the languages call fails', async () => {
    installRouter({
      commits: [
        {
          sha: 'abcdef1234567890',
          commit: { message: 'feat: add canal', author: { name: 'Ada', date: '2025-04-01T00:00:00Z' } },
        },
      ],
      languagesStatus: 500,
      rateRemaining: 100,
    });

    const payload = await service.fetchGitHubProfileForCity('ada');
    const repo = payload.repos[0];

    expect(repo.commitsSource).toBe('api');
    expect(repo.totalCommitEstimate).toBe(1);
    // Without byte data, the mapper estimates from size and primary language.
    expect(Object.keys(repo.languages)).toEqual(['TypeScript']);
    expect(payload.source).toBe('live');
  });

  it('rebuilds commits from the public events feed', async () => {
    const pushedAt = '2025-05-10T12:00:00.000Z';
    installRouter({
      events: [
        {
          type: 'PushEvent',
          created_at: pushedAt,
          repo: { name: 'ada/canal-city' },
          payload: {
            commits: [
              { sha: 'aaaaaaaaaaaaaaaa', message: 'feat: add lock' },
              { sha: 'bbbbbbbbbbbbbbbb', message: 'fix: leak' },
              { sha: 'cccccccccccccccc', message: 'docs: explain' },
            ],
          },
        },
      ],
    });

    const payload = await service.fetchGitHubProfileForCity('ada');

    expect(payload.repos[0].commitsSource).toBe('events');
    expect(payload.repos[0].commits).toHaveLength(3);
    expect(payload.recentEventCount).toBe(1);
    expect(payload.recentPushCount).toBe(1);
    expect(payload.lastActivityAt).toBe(pushedAt);
    expect(payload.repos[0].commits.map((commit) => commit.category)).toEqual([
      'feat',
      'fix',
      'docs',
    ]);
  });

  it('falls back to repositories the user does not own', async () => {
    installRouter({ repos: [] });
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url === USER_URL) return jsonResponse(RAW_USER, { rateRemaining: 2 });
      if (url.includes('/events/public')) return jsonResponse([], { rateRemaining: 2 });
      if (url.includes('type=owner')) return jsonResponse([], { rateRemaining: 2 });
      if (url.includes('type=all')) {
        return jsonResponse([rawRepo({ fork: true })], { rateRemaining: 2 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const payload = await service.fetchGitHubProfileForCity('ada');

    expect(payload.repos).toHaveLength(1);
    expect(payload.repos[0].fork).toBe(true);
  });
});

describe('fetchGitHubProfileForCity — caching and tokens', () => {
  it('caches anonymous profiles for 15 minutes', async () => {
    installRouter();

    const first = await service.fetchGitHubProfileForCity('ada');
    const callsAfterFirst = fetchMock.mock.calls.length;
    const second = await service.fetchGitHubProfileForCity('ADA');

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(callsAfterFirst);
  });

  it('shares one upstream request between concurrent anonymous callers', async () => {
    installRouter();

    const [first, second] = await Promise.all([
      service.fetchGitHubProfileForCity('ada'),
      service.fetchGitHubProfileForCity('ada'),
    ]);

    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('never caches a token-authenticated response', async () => {
    installRouter();

    await service.fetchGitHubProfileForCity('ada');
    const anonymousCalls = fetchMock.mock.calls.length;

    const withToken = await service.fetchGitHubProfileForCity('ada', 'secret-token');
    await service.fetchGitHubProfileForCity('ada', 'secret-token');

    expect(fetchMock.mock.calls.length).toBeGreaterThan(anonymousCalls * 2);
    const tokenCall = fetchMock.mock.calls[anonymousCalls];
    expect(tokenCall[1].headers.Authorization).toBe('Bearer secret-token');
    // A token response is never served from, or written to, the anonymous cache.
    expect(withToken).not.toBe(await service.fetchGitHubProfileForCity('ada'));
  });

  it('uses GITHUB_TOKEN from the environment when no token is supplied', async () => {
    process.env.GITHUB_TOKEN = 'env-token';
    installRouter();

    await service.fetchGitHubProfileForCity('ada');

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer env-token');
    // Because a token may expose private repos, the result must not be cached.
    const calls = fetchMock.mock.calls.length;
    await service.fetchGitHubProfileForCity('ada');
    expect(fetchMock.mock.calls.length).toBeGreaterThan(calls);
  });

  it('prefers an explicit token over the environment token', async () => {
    process.env.GITHUB_TOKEN = 'env-token';
    installRouter();

    await service.fetchGitHubProfileForCity('ada', 'request-token');

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer request-token');
  });
});
