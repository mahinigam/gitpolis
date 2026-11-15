import type {
  CommitCategory,
  GitHubCommitData,
  GitHubProfilePayload,
  GitHubRepoData,
  GitHubUserData,
} from '../src/types/city';

const CACHE_TTL_MS = 15 * 60 * 1000;

interface CacheEntry {
  data: GitHubProfilePayload;
  expiresAt: number;
}

const profileCache = new Map<string, CacheEntry>();

// Empirical average bytes per line of code by programming language
const BYTES_PER_LOC: Record<string, number> = {
  TypeScript: 36,
  JavaScript: 35,
  Python: 34,
  Rust: 36,
  Go: 31,
  C: 31,
  'C++': 34,
  Java: 43,
  Kotlin: 38,
  'C#': 40,
  Ruby: 30,
  PHP: 36,
  Swift: 37,
  HTML: 48,
  CSS: 28,
  SCSS: 30,
  Shell: 32,
  Dockerfile: 38,
  Markdown: 62,
  'Jupyter Notebook': 85,
  Vue: 38,
  Svelte: 36,
};

function estimateRepoLOC(
  languages: Record<string, number>,
  primaryLanguage: string | null,
  sizeKB: number
): number {
  const entries = Object.entries(languages);
  if (entries.length > 0) {
    let totalLines = 0;
    for (const [lang, bytes] of entries) {
      const bpl = BYTES_PER_LOC[lang] || 36;
      totalLines += bytes / bpl;
    }
    return Math.max(15, Math.round(totalLines));
  }
  // Calibrated fallback from GitHub repo size (KB includes git history & assets, ~38% is source text)
  const bpl = (primaryLanguage && BYTES_PER_LOC[primaryLanguage]) || 36;
  const sourceBytesEstimate = Math.max(400, sizeKB * 1024 * 0.36);
  return Math.max(20, Math.round(sourceBytesEstimate / bpl));
}

export function classifyCommitMessage(message: string, isOldest = false): CommitCategory {
  const firstLine = (message || '').split('\n')[0].trim().toLowerCase();
  if (
    isOldest ||
    /\b(initial commit|init|bootstrap|first commit|scaffold|create project)\b/.test(firstLine)
  ) {
    return 'init';
  }
  if (
    /^(release|v\d+\.\d+|bump|tag|publish|merge pull request|merge branch)/.test(firstLine) ||
    /\brelease\b/.test(firstLine)
  ) {
    return 'release';
  }
  if (
    /^(feat|feature|add|implement|create|introduce|support|build)\b/.test(firstLine) ||
    /\badd(ed|ing)?\b/.test(firstLine)
  ) {
    return 'feat';
  }
  if (
    /^(fix|bug|hotfix|patch|resolve|correct|repair|prevent|handle)\b/.test(firstLine) ||
    /\bfix(ed|es|ing)?\b/.test(firstLine)
  ) {
    return 'fix';
  }
  if (
    /^(refactor|perf|optimi[sz]e|clean|simplify|restructure|rewrite|migrate|upgrade|modernize)\b/.test(
      firstLine
    )
  ) {
    return 'refactor';
  }
  if (
    /^(docs?|readme|comment|changelog|guide|wiki|license)\b/.test(firstLine) ||
    /\bdoc(s|umentation)?\b/.test(firstLine)
  ) {
    return 'docs';
  }
  if (/^(test|spec|ci|e2e|coverage|lint|check)\b/.test(firstLine) || /\btests?\b/.test(firstLine)) {
    return 'test';
  }
  return 'chore';
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

async function ghFetch<T>(url: string, token?: string): Promise<FetchResult<T>> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'GitPolis-3D-City-App/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  const res = await fetch(url, { headers });
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

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function buildFallbackRepoTimelineCommits(repo: any): GitHubCommitData[] {
  const createdMs = new Date(repo.created_at).getTime();
  const pushedMs = Math.max(createdMs + 86400000, new Date(repo.pushed_at || repo.updated_at).getTime());
  const count = Math.min(10, Math.max(3, Math.round(Math.log2((repo.size || 20) + 8))));
  const seed = hashSeed(repo.full_name || repo.name);
  const lang = repo.language || 'project';
  const templates: { msg: string; cat: CommitCategory }[] = [
    { msg: `Initial ${lang} architecture scaffold for ${repo.name}`, cat: 'init' },
    { msg: `feat: core ${lang} module implementation`, cat: 'feat' },
    { msg: `refactor: streamline internal structure and APIs`, cat: 'refactor' },
    { msg: `fix: edge-case handling and stability improvements`, cat: 'fix' },
    { msg: `docs: expand README and usage guide`, cat: 'docs' },
    { msg: `test: add verification suite and build checks`, cat: 'test' },
    { msg: `feat: extend capabilities and configuration`, cat: 'feat' },
    { msg: `release: polish production build`, cat: 'release' },
  ];

  const out: GitHubCommitData[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 1 : i / (count - 1);
    const ts = new Date(createdMs + (pushedMs - createdMs) * t).toISOString();
    const tpl = i === 0 ? templates[0] : templates[1 + ((seed + i * 7) % (templates.length - 1))];
    const hex = ((seed ^ (i * 2654435761)) >>> 0).toString(16).padStart(8, '0');
    out.push({
      sha: `${hex}${(seed >>> 3).toString(16).padStart(8, '0')}`.slice(0, 12),
      message: tpl.msg,
      date: ts,
      authorName: repo.owner?.login || 'Author',
      authorLogin: repo.owner?.login,
      category: tpl.cat,
    });
  }
  return out.reverse();
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

  const cacheKey = `${username.toLowerCase()}:${token ? 'auth' : 'anon'}`;
  const cached = profileCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

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
    const extraResults = await Promise.all(pagePromises);
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
  const deepResults = await Promise.all(
    deepTargets.map(async (repo) => {
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
    })
  );

  const deepMap = new Map(deepResults.map((r) => [r.repoId, r]));

  const repos: GitHubRepoData[] = rankedRepos.map((repo) => {
    const deep = deepMap.get(repo.id);
    const fullName = repo.full_name || `${user.login}/${repo.name}`;

    // Languages map
    let languages: Record<string, number> = {};
    if (deep?.langsRes.ok && deep.langsRes.data && Object.keys(deep.langsRes.data).length > 0) {
      languages = deep.langsRes.data;
    } else if (repo.language) {
      languages = { [repo.language]: Math.max(800, Math.round((repo.size || 8) * 1024 * 0.36)) };
    }

    const estimatedLOC = estimateRepoLOC(
      deep?.langsRes.ok && deep.langsRes.data ? deep.langsRes.data : {},
      repo.language ?? Object.keys(languages)[0] ?? null,
      repo.size ?? 0
    );

    // Commits list
    let commits: GitHubCommitData[] = [];
    let totalCommitEstimate = 0;

    if (deep?.commitsRes.ok && Array.isArray(deep.commitsRes.data) && deep.commitsRes.data.length > 0) {
      const rawCommits = deep.commitsRes.data;
      commits = rawCommits.map((c: any, idx: number) => ({
        sha: (c.sha || '').slice(0, 12),
        message: c.commit?.message || 'Update repository',
        date: c.commit?.author?.date || c.commit?.committer?.date || repo.pushed_at || repo.updated_at,
        authorName: c.commit?.author?.name || c.author?.login || user.login,
        authorLogin: c.author?.login,
        category: classifyCommitMessage(
          c.commit?.message || '',
          idx === rawCommits.length - 1 && rawCommits.length < commitsPerRepo
        ),
      }));
      const linkEstimate = parseLastPageFromLink(deep.commitsRes.linkHeader, commitsPerRepo);
      totalCommitEstimate = linkEstimate ? Math.max(commits.length, linkEstimate) : commits.length;
    } else {
      const evCommits = eventCommitsByRepo.get(fullName.toLowerCase()) || [];
      if (evCommits.length >= 3) {
        commits = evCommits;
        totalCommitEstimate = Math.max(evCommits.length, Math.round(Math.log2((repo.size || 20) + 8) * 6));
      } else {
        commits = [...evCommits, ...buildFallbackRepoTimelineCommits(repo)];
        totalCommitEstimate = Math.max(commits.length, Math.round(Math.log2((repo.size || 20) + 8) * 5));
      }
    }

    const pushedAt = repo.pushed_at || repo.updated_at || repo.created_at;
    if (new Date(pushedAt).getTime() > new Date(lastActivityAt).getTime()) {
      lastActivityAt = pushedAt;
    }

    return {
      id: repo.id,
      name: repo.name,
      fullName,
      description: repo.description ?? null,
      htmlUrl: repo.html_url,
      homepage: repo.homepage || null,
      language: repo.language ?? Object.keys(languages)[0] ?? null,
      languages,
      stargazersCount: repo.stargazers_count ?? 0,
      forksCount: repo.forks_count ?? 0,
      openIssuesCount: repo.open_issues_count ?? 0,
      size: repo.size ?? 0,
      createdAt: repo.created_at,
      updatedAt: repo.updated_at,
      pushedAt,
      archived: Boolean(repo.archived),
      fork: Boolean(repo.fork),
      hasWiki: Boolean(repo.has_wiki),
      hasPages: Boolean(repo.has_pages),
      topics: Array.isArray(repo.topics) ? repo.topics : [],
      licenseName: repo.license?.spdx_id || repo.license?.name || null,
      commits,
      totalCommitEstimate,
      estimatedLOC,
    };
  });

  const payload: GitHubProfilePayload = {
    user,
    repos,
    recentEventCount: events.length,
    recentPushCount,
    lastActivityAt,
    source: 'live',
    rateLimit: latestRateLimit,
    fetchedAt: new Date().toISOString(),
  };

  profileCache.set(cacheKey, { data: payload, expiresAt: Date.now() + CACHE_TTL_MS });
  return payload;
}
