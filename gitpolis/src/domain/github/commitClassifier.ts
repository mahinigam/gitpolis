import type { CommitCategory, GitHubCommitData } from '../city/types';
import { hashString } from '../prng';

/**
 * Heuristic commit-message classifier.
 *
 * GitHub does not expose a commit's "type", so GitPolis infers it from the
 * conventional-commit prefix plus a few natural-language fallbacks. The
 * category drives which architectural structure a commit becomes in the city.
 */
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

  // An explicit conventional-commit prefix always wins over the looser
  // natural-language fallbacks below. Without this, a message such as
  // "test: add e2e coverage" would be classified as `feat` because the
  // fallback matches the word "add" in its description.
  const conventional = firstLine.match(
    /^(feat|feature|fix|bugfix|hotfix|perf|refactor|docs?|test|spec|ci|build|chore|style|revert)(?:\([^)]*\))?!?:/
  );
  if (conventional) {
    const prefixes: Record<string, CommitCategory> = {
      feat: 'feat',
      feature: 'feat',
      fix: 'fix',
      bugfix: 'fix',
      hotfix: 'fix',
      perf: 'refactor',
      refactor: 'refactor',
      doc: 'docs',
      docs: 'docs',
      test: 'test',
      spec: 'test',
      ci: 'test',
      build: 'refactor',
      chore: 'chore',
      style: 'refactor',
      revert: 'fix',
    };
    return prefixes[conventional[1]] ?? 'chore';
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

/**
 * Deterministically synthesises a plausible commit timeline when the GitHub
 * API cannot provide one (rate limits, empty events feed, deep history).
 *
 * This is a *visual* fallback: the resulting commits are derived from the
 * repository's created/pushed timestamps and size, and must never be
 * presented as real commit history.
 */
export function buildSyntheticCommitTimeline(
  repo: {
    name?: string;
    full_name?: string;
    created_at?: string;
    pushed_at?: string;
    updated_at?: string;
    size?: number;
    language?: string | null;
    owner?: { login?: string };
  },
  authorFallback = 'Author'
): GitHubCommitData[] {
  const createdMs = new Date(repo.created_at ?? Date.now()).getTime();
  const pushedMs = Math.max(
    createdMs + 86_400_000,
    new Date(repo.pushed_at || repo.updated_at || repo.created_at || Date.now()).getTime()
  );
  const count = Math.min(10, Math.max(3, Math.round(Math.log2((repo.size || 20) + 8))));
  const seed = hashString(repo.full_name || repo.name || 'repository');
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

  const author = repo.owner?.login || authorFallback;
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
      authorName: author,
      authorLogin: repo.owner?.login,
      category: tpl.cat,
    });
  }

  return out.reverse();
}
