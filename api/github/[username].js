// src/domain/github/metrics.ts
var BYTES_PER_LOC = {
  TypeScript: 36,
  JavaScript: 35,
  Python: 34,
  Rust: 36,
  Go: 31,
  C: 31,
  "C++": 34,
  Java: 43,
  Kotlin: 38,
  "C#": 40,
  Ruby: 30,
  PHP: 36,
  Swift: 37,
  HTML: 48,
  CSS: 28,
  SCSS: 30,
  Shell: 32,
  Dockerfile: 38,
  Markdown: 62,
  "Jupyter Notebook": 85,
  Vue: 38,
  Svelte: 36
};
var SOURCE_TEXT_RATIO = 0.36;
function estimateRepoLOC(languages, primaryLanguage, sizeKB) {
  const entries = Object.entries(languages);
  if (entries.length > 0) {
    let totalLines = 0;
    for (const [lang, bytes] of entries) {
      const bytesPerLine2 = BYTES_PER_LOC[lang] || 36;
      totalLines += bytes / bytesPerLine2;
    }
    return Math.max(15, Math.round(totalLines));
  }
  const bytesPerLine = primaryLanguage && BYTES_PER_LOC[primaryLanguage] || 36;
  const sourceBytesEstimate = Math.max(400, sizeKB * 1024 * SOURCE_TEXT_RATIO);
  return Math.max(20, Math.round(sourceBytesEstimate / bytesPerLine));
}

// src/domain/prng.ts
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// src/domain/github/commitClassifier.ts
function classifyCommitMessage(message, isOldest = false) {
  const firstLine = (message || "").split("\n")[0].trim().toLowerCase();
  if (isOldest || /\b(initial commit|init|bootstrap|first commit|scaffold|create project)\b/.test(firstLine)) {
    return "init";
  }
  if (/^(release|v\d+\.\d+|bump|tag|publish|merge pull request|merge branch)/.test(firstLine) || /\brelease\b/.test(firstLine)) {
    return "release";
  }
  const conventional = firstLine.match(
    /^(feat|feature|fix|bugfix|hotfix|perf|refactor|docs?|test|spec|ci|build|chore|style|revert)(?:\([^)]*\))?!?:/
  );
  if (conventional) {
    const prefixes = {
      feat: "feat",
      feature: "feat",
      fix: "fix",
      bugfix: "fix",
      hotfix: "fix",
      perf: "refactor",
      refactor: "refactor",
      doc: "docs",
      docs: "docs",
      test: "test",
      spec: "test",
      ci: "test",
      build: "refactor",
      chore: "chore",
      style: "refactor",
      revert: "fix"
    };
    return prefixes[conventional[1]] ?? "chore";
  }
  if (/^(feat|feature|add|implement|create|introduce|support|build)\b/.test(firstLine) || /\badd(ed|ing)?\b/.test(firstLine)) {
    return "feat";
  }
  if (/^(fix|bug|hotfix|patch|resolve|correct|repair|prevent|handle)\b/.test(firstLine) || /\bfix(ed|es|ing)?\b/.test(firstLine)) {
    return "fix";
  }
  if (/^(refactor|perf|optimi[sz]e|clean|simplify|restructure|rewrite|migrate|upgrade|modernize)\b/.test(
    firstLine
  )) {
    return "refactor";
  }
  if (/^(docs?|readme|comment|changelog|guide|wiki|license)\b/.test(firstLine) || /\bdoc(s|umentation)?\b/.test(firstLine)) {
    return "docs";
  }
  if (/^(test|spec|ci|e2e|coverage|lint|check)\b/.test(firstLine) || /\btests?\b/.test(firstLine)) {
    return "test";
  }
  return "chore";
}
function buildSyntheticCommitTimeline(repo, authorFallback = "Author") {
  const createdMs = new Date(repo.created_at ?? Date.now()).getTime();
  const pushedMs = Math.max(
    createdMs + 864e5,
    new Date(repo.pushed_at || repo.updated_at || repo.created_at || Date.now()).getTime()
  );
  const count = Math.min(10, Math.max(3, Math.round(Math.log2((repo.size || 20) + 8))));
  const seed = hashString(repo.full_name || repo.name || "repository");
  const lang = repo.language || "project";
  const templates = [
    { msg: `Initial ${lang} architecture scaffold for ${repo.name}`, cat: "init" },
    { msg: `feat: core ${lang} module implementation`, cat: "feat" },
    { msg: `refactor: streamline internal structure and APIs`, cat: "refactor" },
    { msg: `fix: edge-case handling and stability improvements`, cat: "fix" },
    { msg: `docs: expand README and usage guide`, cat: "docs" },
    { msg: `test: add verification suite and build checks`, cat: "test" },
    { msg: `feat: extend capabilities and configuration`, cat: "feat" },
    { msg: `release: polish production build`, cat: "release" }
  ];
  const author = repo.owner?.login || authorFallback;
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 1 : i / (count - 1);
    const ts = new Date(createdMs + (pushedMs - createdMs) * t).toISOString();
    const tpl = i === 0 ? templates[0] : templates[1 + (seed + i * 7) % (templates.length - 1)];
    const hex = ((seed ^ i * 2654435761) >>> 0).toString(16).padStart(8, "0");
    out.push({
      sha: `${hex}${(seed >>> 3).toString(16).padStart(8, "0")}`.slice(0, 12),
      message: tpl.msg,
      date: ts,
      authorName: author,
      authorLogin: repo.owner?.login,
      category: tpl.cat
    });
  }
  return out.reverse();
}

// src/domain/github/mapRepository.ts
var DEFAULT_SOURCE_BYTES_RATIO = 0.36;
function mapRawRepository(raw, options = {}) {
  const sizeKB = raw.size ?? 0;
  const primaryLanguage = raw.language ?? null;
  let languages = options.languages ?? {};
  if (Object.keys(languages).length === 0 && primaryLanguage) {
    languages = {
      [primaryLanguage]: Math.max(800, Math.round(sizeKB * 1024 * DEFAULT_SOURCE_BYTES_RATIO))
    };
  }
  const estimatedLOC = estimateRepoLOC(languages, primaryLanguage, sizeKB);
  let commits;
  let commitsSource;
  let totalCommitEstimate;
  if (options.commits && options.commits.length > 0) {
    commits = options.commits;
    commitsSource = "api";
    totalCommitEstimate = options.totalCommitEstimate ?? Math.max(commits.length, 1);
  } else if (options.eventCommits && options.eventCommits.length >= 3) {
    commits = options.eventCommits;
    commitsSource = "events";
    totalCommitEstimate = options.totalCommitEstimate ?? Math.max(commits.length, 1);
  } else {
    commits = [
      ...options.eventCommits ?? [],
      ...buildSyntheticCommitTimeline(raw, options.authorFallback ?? "Author")
    ];
    commitsSource = "synthetic";
    totalCommitEstimate = options.totalCommitEstimate ?? Math.max(commits.length, Math.round(Math.log2(sizeKB + 8) * 5));
  }
  return {
    id: raw.id,
    name: raw.name,
    fullName: raw.full_name ?? `${raw.owner?.login ?? "unknown"}/${raw.name}`,
    description: raw.description ?? null,
    htmlUrl: raw.html_url ?? `https://github.com/${raw.owner?.login ?? "unknown"}/${raw.name}`,
    homepage: raw.homepage || null,
    language: primaryLanguage ?? Object.keys(languages)[0] ?? null,
    languages,
    stargazersCount: raw.stargazers_count ?? 0,
    forksCount: raw.forks_count ?? 0,
    openIssuesCount: raw.open_issues_count ?? 0,
    size: sizeKB,
    createdAt: raw.created_at ?? (/* @__PURE__ */ new Date(0)).toISOString(),
    updatedAt: raw.updated_at ?? raw.pushed_at ?? (/* @__PURE__ */ new Date(0)).toISOString(),
    pushedAt: raw.pushed_at ?? raw.updated_at ?? raw.created_at ?? (/* @__PURE__ */ new Date(0)).toISOString(),
    archived: Boolean(raw.archived),
    fork: Boolean(raw.fork),
    hasWiki: Boolean(raw.has_wiki),
    hasPages: Boolean(raw.has_pages),
    topics: Array.isArray(raw.topics) ? raw.topics : [],
    licenseName: raw.license?.spdx_id || raw.license?.name || null,
    commits,
    totalCommitEstimate,
    estimatedLOC,
    commitsSource
  };
}

// server/lib/cache.ts
var TtlCache = class {
  constructor(ttlMs, maxEntries = 250) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }
  entries = /* @__PURE__ */ new Map();
  get(key, now = Date.now()) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }
  set(key, value, now = Date.now()) {
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== void 0) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expiresAt: now + this.ttlMs });
  }
};

// server/lib/async.ts
async function mapWithConcurrency(items, concurrency, mapper) {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// server/services/github.ts
var CACHE_TTL_MS = 15 * 60 * 1e3;
var anonymousCache = new TtlCache(CACHE_TTL_MS);
var inFlight = /* @__PURE__ */ new Map();
var MAX_CONCURRENT_UPSTREAM = 6;
function resolveToken(token) {
  const explicit = token?.trim();
  if (explicit) return explicit;
  const envToken = typeof process !== "undefined" && process.env?.GITHUB_TOKEN || void 0;
  return envToken?.trim() || void 0;
}
async function ghFetchOnce(url, token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "GitPolis-3D-City-App/1.0",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(2e4) });
  const remaining = Number(res.headers.get("x-ratelimit-remaining"));
  const limit = Number(res.headers.get("x-ratelimit-limit"));
  const reset = Number(res.headers.get("x-ratelimit-reset"));
  const rateLimit = Number.isFinite(remaining) && Number.isFinite(limit) && limit > 0 ? { remaining, limit, resetAt: reset * 1e3 } : null;
  if (!res.ok) {
    let msg = `GitHub API error (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson?.message) msg = errJson.message;
    } catch {
    }
    return { ok: false, status: res.status, rateLimit, error: msg };
  }
  const data = await res.json();
  return {
    ok: true,
    status: res.status,
    data,
    linkHeader: res.headers.get("link"),
    rateLimit
  };
}
async function ghFetch(url, token) {
  let last;
  try {
    last = await ghFetchOnce(url, token);
  } catch (err) {
    last = { ok: false, status: 0, error: err instanceof Error ? err.message : "Network error" };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    if (last.ok || [400, 401, 403, 404, 422].includes(last.status)) return last;
    await sleep(250 * 2 ** attempt);
    try {
      last = await ghFetchOnce(url, token);
    } catch (err) {
      last = { ok: false, status: 0, error: err instanceof Error ? err.message : "Network error" };
    }
  }
  return last;
}
function parseLastPageFromLink(linkHeader, perPage) {
  if (!linkHeader) return null;
  const match = linkHeader.match(/[?&]page=(\d+)>;\s*rel="last"/);
  if (!match) return null;
  const lastPage = parseInt(match[1], 10);
  if (!Number.isFinite(lastPage) || lastPage <= 0) return null;
  return lastPage * perPage;
}
function scoreRepo(repo, nowMs) {
  const pushedMs = new Date(repo.pushed_at || repo.updated_at || repo.created_at).getTime();
  const daysAgo = Math.max(0, (nowMs - pushedMs) / (1e3 * 60 * 60 * 24));
  const recencyBoost = daysAgo < 30 ? 80 : daysAgo < 180 ? 45 : daysAgo < 365 ? 20 : 0;
  const starScore = Math.log10((repo.stargazers_count || 0) + 1) * 55 + Math.min(repo.stargazers_count || 0, 500) * 0.2;
  const forkScore = Math.log10((repo.forks_count || 0) + 1) * 20;
  const sizeScore = Math.log10((repo.size || 0) + 10) * 14;
  const ownBonus = repo.fork ? -35 : 35;
  const descBonus = repo.description ? 8 : 0;
  const archivedPenalty = repo.archived ? -8 : 0;
  return starScore + forkScore + sizeScore + recencyBoost + ownBonus + descBonus + archivedPenalty;
}
var GitHubServiceError = class extends Error {
  status;
  rateLimited;
  resetAt;
  constructor(message, status, rateLimited = false, resetAt) {
    super(message);
    this.status = status;
    this.rateLimited = rateLimited;
    this.resetAt = resetAt;
  }
};
async function fetchGitHubProfileForCity(rawUsername, token) {
  const username = rawUsername.trim().replace(/^@/, "");
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username)) {
    throw new GitHubServiceError("Please enter a valid GitHub username.", 400);
  }
  token = resolveToken(token);
  const cacheKey = username.toLowerCase();
  if (!token) {
    const cached = anonymousCache.get(cacheKey);
    if (cached) return cached;
    const pending = inFlight.get(cacheKey);
    if (pending) return pending;
    const request = buildProfile(username, void 0).finally(() => inFlight.delete(cacheKey));
    inFlight.set(cacheKey, request);
    return request;
  }
  return buildProfile(username, token);
}
async function buildProfile(username, token) {
  const userRes = await ghFetch(`https://api.github.com/users/${encodeURIComponent(username)}`, token);
  let latestRateLimit = userRes.rateLimit ?? null;
  if (!userRes.ok || !userRes.data) {
    if (userRes.status === 404) {
      throw new GitHubServiceError(`GitHub user "@${username}" was not found.`, 404);
    }
    const isRateLimited = userRes.status === 403 && (latestRateLimit && latestRateLimit.remaining === 0 || (userRes.error || "").toLowerCase().includes("rate limit"));
    if (isRateLimited) {
      throw new GitHubServiceError(
        "GitHub public API rate limit reached. Add an optional GitHub token for 5,000 req/hr, or explore the showcase city.",
        429,
        true,
        latestRateLimit?.resetAt
      );
    }
    throw new GitHubServiceError(userRes.error || "Failed to reach GitHub API.", userRes.status);
  }
  const u = userRes.data;
  const user = {
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
    htmlUrl: u.html_url
  };
  const maxPages = token ? 5 : 3;
  const [firstReposRes, eventsRes] = await Promise.all([
    ghFetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=pushed&per_page=100&page=1&type=owner`,
      token
    ),
    ghFetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100`,
      token
    )
  ]);
  if (firstReposRes.rateLimit) latestRateLimit = firstReposRes.rateLimit;
  if (eventsRes.rateLimit) latestRateLimit = eventsRes.rateLimit;
  let rawRepos = firstReposRes.ok && Array.isArray(firstReposRes.data) ? [...firstReposRes.data] : [];
  if (rawRepos.length === 100 && maxPages > 1) {
    const extraPages = Math.min(maxPages, Math.ceil((user.publicRepos || 100) / 100));
    const pagePromises = [];
    for (let p = 2; p <= extraPages; p++) {
      pagePromises.push(
        ghFetch(
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
  if (rawRepos.length === 0) {
    const allReposRes = await ghFetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=100&type=all`,
      token
    );
    if (allReposRes.ok && Array.isArray(allReposRes.data)) {
      rawRepos = allReposRes.data;
    }
  }
  const dedupMap = /* @__PURE__ */ new Map();
  for (const r of rawRepos) {
    if (r && typeof r.id === "number") dedupMap.set(r.id, r);
  }
  rawRepos = Array.from(dedupMap.values());
  const events = eventsRes.ok && Array.isArray(eventsRes.data) ? eventsRes.data : [];
  const eventCommitsByRepo = /* @__PURE__ */ new Map();
  let recentPushCount = 0;
  let lastActivityAt = u.updated_at || u.created_at;
  if (events.length > 0 && events[0].created_at) {
    lastActivityAt = events[0].created_at;
  }
  for (const ev of events) {
    if (ev.type === "PushEvent") {
      recentPushCount++;
      const repoName = ev.repo?.name;
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
              category: classifyCommitMessage(c.message)
            });
          }
        }
        eventCommitsByRepo.set(repoName.toLowerCase(), list);
      }
    }
  }
  const nowMs = Date.now();
  const rankedRepos = [...rawRepos].sort((a, b) => scoreRepo(b, nowMs) - scoreRepo(a, nowMs));
  const remainingBudget = latestRateLimit ? latestRateLimit.remaining : token ? 4e3 : 40;
  const maxDeepRepos = token ? Math.min(28, rankedRepos.length) : Math.min(rankedRepos.length, Math.max(0, Math.min(8, Math.floor((remainingBudget - 4) / 2))));
  const commitsPerRepo = token ? 40 : 25;
  const deepTargets = rankedRepos.slice(0, maxDeepRepos);
  const deepResults = await mapWithConcurrency(
    deepTargets,
    MAX_CONCURRENT_UPSTREAM,
    async (repo) => {
      const [commitsRes, langsRes] = await Promise.all([
        ghFetch(
          `https://api.github.com/repos/${encodeURIComponent(repo.owner.login)}/${encodeURIComponent(repo.name)}/commits?per_page=${commitsPerRepo}`,
          token
        ),
        ghFetch(
          `https://api.github.com/repos/${encodeURIComponent(repo.owner.login)}/${encodeURIComponent(repo.name)}/languages`,
          token
        )
      ]);
      if (commitsRes.rateLimit) latestRateLimit = commitsRes.rateLimit;
      if (langsRes.rateLimit) latestRateLimit = langsRes.rateLimit;
      return { repoId: repo.id, commitsRes, langsRes };
    }
  );
  const deepMap = new Map(deepResults.map((r) => [r.repoId, r]));
  const repos = rankedRepos.map((repo) => {
    const deep = deepMap.get(repo.id);
    const fullName = repo.full_name || `${user.login}/${repo.name}`;
    let commits;
    let totalCommitEstimate;
    if (deep?.commitsRes.ok && Array.isArray(deep.commitsRes.data) && deep.commitsRes.data.length > 0) {
      const rawCommits = deep.commitsRes.data;
      commits = rawCommits.map((c, idx) => ({
        sha: (c.sha || "").slice(0, 12),
        message: c.commit?.message || "Update repository",
        date: c.commit?.author?.date || c.commit?.committer?.date || repo.pushed_at || repo.updated_at,
        authorName: c.commit?.author?.name || c.author?.login || user.login,
        authorLogin: c.author?.login,
        category: classifyCommitMessage(
          c.commit?.message || "",
          idx === rawCommits.length - 1 && rawCommits.length < commitsPerRepo
        )
      }));
      const linkEstimate = parseLastPageFromLink(deep.commitsRes.linkHeader, commitsPerRepo);
      totalCommitEstimate = linkEstimate ? Math.max(commits.length, linkEstimate) : commits.length;
    }
    return mapRawRepository(repo, {
      languages: deep?.langsRes.ok && deep.langsRes.data ? deep.langsRes.data : void 0,
      commits,
      totalCommitEstimate,
      eventCommits: eventCommitsByRepo.get(fullName.toLowerCase()),
      authorFallback: user.login
    });
  });
  for (const repo of repos) {
    if (new Date(repo.pushedAt).getTime() > new Date(lastActivityAt).getTime()) {
      lastActivityAt = repo.pushedAt;
    }
  }
  const hasSyntheticCommits = repos.some((repo) => repo.commitsSource === "synthetic");
  const payload = {
    user,
    repos,
    recentEventCount: events.length,
    recentPushCount,
    lastActivityAt,
    source: hasSyntheticCommits ? "mixed" : "live",
    rateLimit: latestRateLimit,
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (!token) anonymousCache.set(username.toLowerCase(), payload);
  return payload;
}

// server/lib/http.ts
var MAX_JSON_BYTES = 768 * 1024;
function sendJson(res, status, payload, extraHeaders = {}) {
  if (res.writableEnded) return;
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  for (const [key, value] of Object.entries(extraHeaders)) res.setHeader(key, value);
  res.end(JSON.stringify(payload));
}
function isMethod(req, method) {
  return (req.method || "GET").toUpperCase() === method;
}
function isCrossOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    const originHost = new URL(origin).host;
    const isTrustedProxy = process.env.GITPOLIS_TRUST_PROXY === "1" || process.env.VERCEL === "1";
    const host = isTrustedProxy ? req.headers["x-forwarded-host"] || req.headers.host : req.headers.host;
    return originHost !== host;
  } catch {
    return true;
  }
}
function getClientIp(req) {
  const isTrustedProxy = process.env.GITPOLIS_TRUST_PROXY === "1" || process.env.VERCEL === "1";
  if (isTrustedProxy) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length > 0) {
      const hops = forwarded.split(",").map((hop) => hop.trim()).filter(Boolean);
      if (hops.length > 0) return hops[hops.length - 1];
    }
  }
  return req.socket?.remoteAddress || "unknown";
}
var BASE_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
};
var PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://avatars.githubusercontent.com https://raw.githubusercontent.com",
  "connect-src 'self' https://api.github.com https://generativelanguage.googleapis.com https://vitals.vercel-insights.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join("; ");

// server/lib/rateLimit.ts
var FixedWindowRateLimiter = class {
  constructor(maxRequests, windowMs, maxKeys = 1e4) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.maxKeys = maxKeys;
  }
  buckets = /* @__PURE__ */ new Map();
  check(key, now = Date.now()) {
    this.prune(now);
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      if (this.buckets.size >= this.maxKeys) this.evictOldest();
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.maxRequests - 1, retryAfterSeconds: 0 };
    }
    if (bucket.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1e3))
      };
    }
    bucket.count += 1;
    return {
      allowed: true,
      remaining: this.maxRequests - bucket.count,
      retryAfterSeconds: 0
    };
  }
  prune(now) {
    if (this.buckets.size < 512) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
  /** Drops the oldest insertion-order bucket. */
  evictOldest() {
    const oldest = this.buckets.keys().next().value;
    if (oldest !== void 0) this.buckets.delete(oldest);
  }
};

// server/api/github.ts
var limiter = new FixedWindowRateLimiter(30, 6e4);
var MAX_TOKEN_LENGTH = 512;
var MAX_USERNAME_LENGTH = 39;
async function handleGithubProfileRequest(req, res, rawUsername) {
  if (!isMethod(req, "GET")) {
    sendJson(res, 405, { error: "Method not allowed." }, { Allow: "GET" });
    return;
  }
  if (isCrossOrigin(req)) {
    sendJson(res, 403, { error: "Cross-origin requests are not allowed." });
    return;
  }
  const limit = limiter.check(`github:${getClientIp(req)}`);
  if (!limit.allowed) {
    sendJson(
      res,
      429,
      { error: "Too many requests. Please slow down.", rateLimited: true },
      { "Retry-After": String(limit.retryAfterSeconds) }
    );
    return;
  }
  const username = (() => {
    try {
      return decodeURIComponent(rawUsername || "").trim();
    } catch {
      return null;
    }
  })();
  if (username === null) {
    sendJson(res, 400, { error: "GitHub username contains invalid characters." });
    return;
  }
  if (!username) {
    sendJson(res, 400, { error: "Missing GitHub username." });
    return;
  }
  if (username.length > MAX_USERNAME_LENGTH) {
    sendJson(res, 400, { error: "GitHub username is too long." });
    return;
  }
  const tokenHeader = req.headers["x-github-token"];
  const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
  if (typeof token === "string" && token.length > MAX_TOKEN_LENGTH) {
    sendJson(res, 400, { error: "GitHub token is malformed." });
    return;
  }
  try {
    const payload = await fetchGitHubProfileForCity(username, token);
    sendJson(res, 200, payload);
  } catch (err) {
    if (err instanceof GitHubServiceError) {
      sendJson(res, err.status, {
        error: err.message,
        rateLimited: err.rateLimited,
        resetAt: err.resetAt
      });
      return;
    }
    console.error("[GitPolis API Error]", err);
    sendJson(res, 500, { error: "Unexpected server error fetching GitHub profile." });
  }
}

// server/vercel/github/[username].ts
async function handler(req, res) {
  try {
    for (const [key, value] of Object.entries(BASE_SECURITY_HEADERS)) {
      res.setHeader(key, value);
    }
    const query = req.query || {};
    const rawUsername = Array.isArray(query.username) ? query.username[0] : query.username || "";
    await handleGithubProfileRequest(req, res, rawUsername);
  } catch (err) {
    console.error("[Vercel Serverless GitHub Error]", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : "Serverless GitHub request failed"
        })
      );
    }
  }
}
export {
  handler as default
};
