import type { CommitCategory, GitHubCommitData, StyleId } from './types';
import { ARCHITECTURAL_STYLES } from './styles';
import type { SeededRNG } from '../prng';

/**
 * Procedural naming for city, districts and individual structures.
 * Names are derived from real commit scopes so a repo's history shows up
 * in the skyline instead of generic placeholders.
 */

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'when', 'where',
  'have', 'has', 'had', 'not', 'but', 'are', 'was', 'were', 'will', 'can',
  'add', 'added', 'fix', 'fixed', 'update', 'updated', 'merge', 'pull', 'request',
  'branch', 'commit', 'chore', 'feat', 'refactor', 'docs', 'test', 'tests',
  'bump', 'version', 'minor', 'initial', 'change', 'changes', 'use', 'using',
  'make', 'more', 'some', 'all', 'new', 'old', 'now', 'only', 'also', 'work',
  'code', 'file', 'files', 'repo', 'readme', 'license', 'github', 'pr', 'ci',
]);

export function extractTopicKeyword(commits: GitHubCommitData[]): string | null {
  const counts = new Map<string, number>();
  for (const c of commits) {
    const firstLine = (c.message || '').split('\n')[0];
    const scopeMatch = firstLine.match(/^[a-z]+\(([^)]+)\):/i);
    if (scopeMatch && scopeMatch[1]) {
      const scope = scopeMatch[1].trim().replace(/[^a-zA-Z0-9-]/g, '');
      if (scope.length >= 3 && scope.length <= 14) {
        return scope.charAt(0).toUpperCase() + scope.slice(1);
      }
    }
    const words = firstLine
      .replace(/^[a-z]+(\([^)]*\))?:\s*/i, '')
      .toLowerCase()
      .match(/[a-z]{4,13}/g);
    if (!words) continue;
    for (const w of words) {
      if (STOP_WORDS.has(w)) continue;
      counts.set(w, (counts.get(w) || 0) + 1);
    }
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [w, n] of counts) {
    if (n > bestCount) {
      best = w;
      bestCount = n;
    }
  }
  return best ? best.charAt(0).toUpperCase() + best.slice(1) : null;
}

export function generateBuildingName(
  category: CommitCategory,
  styleId: StyleId,
  commits: GitHubCommitData[],
  index: number,
  isHero: boolean,
  rng: SeededRNG
): string {
  const keyword = extractTopicKeyword(commits);
  const styleNouns: Record<StyleId, string[]> = {
    typescript_glass: ['Terrace', 'Tower', 'Campus', 'Atrium', 'Pavilion'],
    javascript_studio: ['Loft', 'Studio', 'Atelier', 'Exchange', 'Hall'],
    python_botanical: ['Solarium', 'Conservatory', 'Observatory', 'Atrium', 'Academy'],
    rust_foundry: ['Foundry', 'Forge', 'Bastion', 'Works', 'Citadel'],
    go_nordic: ['Spire', 'Twin Tower', 'Concourse', 'Nexus', 'Hub'],
    cpp_monolith: ['Monolith', 'Vault', 'Basilica', 'Citadel', 'Keep'],
    java_artdeco: ['Crown Tower', 'Plaza', 'Spire', 'Exchange', 'Chambers'],
    ruby_oldtown: ['Maison', 'Townhouse', 'Guildhall', 'Courtyard', 'Atelier'],
    swift_pavilion: ['Pavilion', 'Rotunda', 'Gallery', 'Studio', 'Ring'],
    web_canal: ['Canal House', 'Design Loft', 'Gallery', 'Atelier', 'Studio'],
    devops_port: ['Control Tower', 'Terminal', 'Depot', 'Beacon', 'Station'],
    polyglot_library: ['Archive', 'Library', 'Hall', 'Pavilion', 'Scriptorium'],
  };

  const categoryPrefixes: Record<CommitCategory, string[]> = {
    feat: ['Feature', 'Expansion', 'Skyline', 'Horizon'],
    fix: ['Restoration', 'Foundry', 'Bastion', 'Anchor'],
    refactor: ['Refined', 'Streamline', 'Modernist', 'Renovated'],
    docs: ['Chronicle', 'Library', 'Codex', 'Scholar'],
    test: ['Sentinel', 'Watch', 'Proof', 'Calibration'],
    release: ['Milestone', 'Grand', 'Triumph', 'Crown'],
    init: ['Founders', 'Genesis', 'Origin', 'Cornerstone'],
    chore: ['Commons', 'Civic', 'Guild', 'Works'],
  };

  const noun = isHero ? styleNouns[styleId][0] : rng.pick(styleNouns[styleId]);
  if (keyword) {
    return `${keyword} ${noun}`;
  }
  const prefix = isHero ? 'Central' : rng.pick(categoryPrefixes[category]);
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
  return `${prefix} ${noun}${index > 1 ? ` ${numerals[index % numerals.length]}` : ''}`;
}

export function dominantCategory(commits: GitHubCommitData[]): CommitCategory {
  if (commits.length === 0) return 'init';
  const counts = new Map<CommitCategory, number>();
  for (const c of commits) {
    counts.set(c.category, (counts.get(c.category) || 0) + 1);
  }
  let best: CommitCategory = commits[0].category;
  let bestScore = -1;
  for (const [cat, count] of counts) {
    const bonus = cat === 'chore' ? 0 : 0.4;
    if (count + bonus > bestScore) {
      bestScore = count + bonus;
      best = cat;
    }
  }
  return best;
}

export function formatLOCShort(loc: number): string {
  if (loc >= 1_000_000) return `${(loc / 1_000_000).toFixed(1)}M LOC`;
  if (loc >= 1_000) return `${(loc / 1_000).toFixed(1)}k LOC`;
  return `${loc} LOC`;
}

export function computeCityName(login: string, primaryStyleId: StyleId): {
  cityName: string;
  citySubtitle: string;
  archetypeSummary: string;
} {
  const clean = login.replace(/[-_]+/g, ' ').trim();
  const base = clean.charAt(0).toUpperCase() + clean.slice(1);
  const styleSuffix: Record<StyleId, string> = {
    typescript_glass: 'Bay',
    javascript_studio: 'Commons',
    python_botanical: 'Gardens',
    rust_foundry: 'Forgeport',
    go_nordic: 'Fjord',
    cpp_monolith: 'Citadel',
    java_artdeco: 'Heights',
    ruby_oldtown: 'Quarter',
    swift_pavilion: 'Park',
    web_canal: 'Canals',
    devops_port: 'Harbor',
    polyglot_library: 'Avenue',
  };

  const styleMeta = ARCHITECTURAL_STYLES[primaryStyleId];
  const suffix = styleSuffix[primaryStyleId];
  const cityName = base.length > 14 ? `${base.slice(0, 13)} ${suffix}` : `${base} ${suffix}`;
  return {
    cityName,
    citySubtitle: `${styleMeta.styleName} Metropolis`,
    archetypeSummary: styleMeta.description,
  };
}
