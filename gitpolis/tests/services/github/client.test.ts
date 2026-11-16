import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchGitHubProfileWithProgress } from '../../../src/services/github/client';
import { makePayload } from '../../fixtures/github';

interface MockResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function jsonResponse(data: unknown, init: { ok?: boolean; status?: number } = {}): MockResponse {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => data,
  };
}

const DIRECT_USER = {
  login: 'ada',
  name: 'Ada Lovelace',
  avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
  bio: 'Analytical engines',
  location: 'London',
  company: 'Analytical Engines Ltd',
  blog: '',
  followers: 120,
  following: 12,
  public_repos: 2,
  created_at: '2012-04-01T00:00:00.000Z',
  html_url: 'https://github.com/ada',
};

function directRepo(overrides: Record<string, unknown> = {}) {
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
    updated_at: '2024-06-01T00:00:00.000Z',
    pushed_at: '2024-06-01T00:00:00.000Z',
    archived: false,
    fork: false,
    has_wiki: false,
    has_pages: false,
    topics: ['simulation'],
    license: { name: 'MIT License', spdx_id: 'MIT' },
    ...overrides,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

function headersOf(call: unknown[]): Record<string, string> {
  const init = call[1] as { headers?: Record<string, string> } | undefined;
  return init?.headers ?? {};
}

/**
 * Routed fetch mock: the local proxy always fails (503) so the client falls
 * back to the direct GitHub REST API, which is served from the given fixtures.
 */
function useDirectRouter(
  options: {
    user?: unknown;
    repos?: unknown[];
    reposStatus?: number;
  } = {}
) {
  const { user = DIRECT_USER, repos = [directRepo()], reposStatus } = options;

  fetchMock.mockImplementation(async (input: unknown) => {
    const url = String(input);

    if (url.startsWith('/api/github/')) {
      return jsonResponse({ message: 'proxy unavailable' }, { ok: false, status: 503 });
    }

    if (/^https:\/\/api\.github\.com\/users\/[^/?]+$/.test(url)) {
      return jsonResponse(user);
    }

    if (url.startsWith('https://api.github.com/users/') && url.includes('/repos?')) {
      if (reposStatus !== undefined) {
        return jsonResponse({ message: 'boom' }, { ok: false, status: reposStatus });
      }
      return jsonResponse(repos);
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchGitHubProfileWithProgress — proxy path', () => {
  it('returns the proxy payload and reports phases 1..5 in ascending order', async () => {
    const payload = makePayload();
    fetchMock.mockResolvedValue(jsonResponse(payload));

    const phases: number[] = [];
    const result = await fetchGitHubProfileWithProgress('ada', undefined, (progress) => {
      phases.push(progress.phaseIndex);
    });

    expect(result).toBe(payload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/github/ada');

    expect(phases).toEqual([1, 2, 3, 4, 5]);
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i]).toBeGreaterThan(phases[i - 1]);
    }
    expect(phases.at(-1)).toBe(5);
  });

  it('reports the final proxy phase as "life"', async () => {
    fetchMock.mockResolvedValue(jsonResponse(makePayload()));

    const seen: string[] = [];
    await fetchGitHubProfileWithProgress('ada', undefined, (progress) => {
      seen.push(progress.phase);
    });

    expect(seen).toEqual(['survey', 'cadastre', 'coastline', 'skyline', 'life']);
    expect(seen.at(-1)).toBe('life');
  });
});

describe('fetchGitHubProfileWithProgress — direct fallback', () => {
  it('falls back to api.github.com when the proxy responds non-ok', async () => {
    useDirectRouter();

    const result = await fetchGitHubProfileWithProgress('ada');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/github/ada');
    expect(String(fetchMock.mock.calls[1][0]).startsWith('https://api.github.com/users/')).toBe(true);
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://api.github.com/users/ada');
    expect(String(fetchMock.mock.calls[2][0])).toContain('/users/ada/repos?');

    expect(result.source).toBe('mixed');
    expect(result.rateLimit).toBeNull();
    expect(result.user.login).toBe('ada');
    expect(result.user.publicRepos).toBe(2);
    expect(result.repos).toHaveLength(1);

    const repo = result.repos[0];
    expect(repo.name).toBe('canal-city');
    expect(repo.fullName).toBe('ada/canal-city');
    expect(repo.stargazersCount).toBe(7);
    expect(repo.forksCount).toBe(1);
    expect(repo.size).toBe(1_000);
    expect(repo.pushedAt).toBe('2024-06-01T00:00:00.000Z');
    // Prefers the SPDX identifier, matching the showcase fixtures.
    expect(repo.licenseName).toBe('MIT');
    expect(repo.languages).toEqual({ TypeScript: 368_640 });

    // Synthetic fallback commits are generated for direct responses.
    expect(repo.commits.length).toBeGreaterThanOrEqual(3);
    expect(repo.commits.length).toBeLessThanOrEqual(10);
    expect(repo.commits[repo.commits.length - 1].category).toBe('init');
    expect(repo.commits[0].sha).toMatch(/^[0-9a-f]{12}$/);
  });

  it('falls back to api.github.com when the proxy network request throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    useDirectRouter();

    const result = await fetchGitHubProfileWithProgress('ada');

    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/github/ada');
    expect(String(fetchMock.mock.calls[1][0]).startsWith('https://api.github.com/users/')).toBe(true);
    expect(result.source).toBe('mixed');
    expect(result.repos).toHaveLength(1);
  });

  it('estimates LOC from the direct repo language and size', async () => {
    useDirectRouter({ repos: [directRepo({ size: 1_000, language: 'TypeScript' })] });

    const result = await fetchGitHubProfileWithProgress('ada');

    expect(result.repos[0].size).toBe(1_000);
    expect(result.repos[0].languages).toEqual({ TypeScript: 368_640 });
    expect(result.repos[0].estimatedLOC).toBeGreaterThanOrEqual(20);
  });
});

describe('fetchGitHubProfileWithProgress — token handling', () => {
  it('sends the token as x-github-token to the proxy and Bearer to direct requests', async () => {
    useDirectRouter();

    await fetchGitHubProfileWithProgress('ada', 'secret-token');

    const proxyHeaders = headersOf(fetchMock.mock.calls[0]);
    expect(proxyHeaders['x-github-token']).toBe('secret-token');

    const directCalls = fetchMock.mock.calls.slice(1);
    expect(directCalls.length).toBeGreaterThanOrEqual(2);
    for (const call of directCalls) {
      expect(headersOf(call).Authorization).toBe('Bearer secret-token');
    }
  });

  it('omits Authorization when the token is empty or whitespace', async () => {
    useDirectRouter();

    await fetchGitHubProfileWithProgress('ada', '   ');

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3);
    for (const call of fetchMock.mock.calls) {
      const headers = headersOf(call);
      expect(headers.Authorization).toBeUndefined();
      expect(headers['x-github-token']).toBeUndefined();
    }
  });
});

describe('fetchGitHubProfileWithProgress — direct API errors', () => {
  it('rejects with a "not found" message on a 404 direct response', async () => {
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.startsWith('/api/github/')) {
        return jsonResponse({}, { ok: false, status: 503 });
      }
      return jsonResponse({ message: 'Not Found' }, { ok: false, status: 404 });
    });

    await expect(fetchGitHubProfileWithProgress('ghost')).rejects.toThrow(/not found/i);
  });

  it('rejects with a rate-limit and token hint on a 403 direct response', async () => {
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.startsWith('/api/github/')) {
        return jsonResponse({}, { ok: false, status: 503 });
      }
      return jsonResponse({ message: 'rate limited' }, { ok: false, status: 403 });
    });

    const error = await fetchGitHubProfileWithProgress('ada').catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/rate limit/i);
    expect((error as Error).message).toMatch(/token/i);
  });

  it('rejects when the repos endpoint responds non-ok', async () => {
    useDirectRouter({ reposStatus: 500 });

    await expect(fetchGitHubProfileWithProgress('ada')).rejects.toThrow(/repositories/i);
  });
});

describe('fetchGitHubProfileWithProgress — username handling', () => {
  it('strips a leading "@" from the username in every request URL', async () => {
    useDirectRouter();

    await fetchGitHubProfileWithProgress('@ada');

    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/github/ada');
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://api.github.com/users/ada');
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toContain('@');
      expect(String(call[0])).not.toContain('%40');
    }
  });

  it.each(['', '   ', '\n\t'])('rejects an empty username %j without fetching', async (username) => {
    await expect(fetchGitHubProfileWithProgress(username)).rejects.toThrow(/username/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
