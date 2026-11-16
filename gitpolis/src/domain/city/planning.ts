import type {
  BuildingBlueprint,
  CityBlueprint,
  CommitCategory,
  DistrictBlueprint,
  DistrictTier,
  DistrictVitality,
  GitHubCommitData,
  GitHubProfilePayload,
  GitHubRepoData,
  LampProp,
  RoadSegment,
  StyleId,
  TimelineMilestone,
  TransitLink,
  TreeProp,
} from './types';
import { resolveLanguageStyle } from './styles';
import { hashString, SeededRNG } from '../prng';

import {
  computeCityName,
  dominantCategory,
  formatLOCShort,
  generateBuildingName,
} from './naming';
import { classifyRepoDomain, computeDistrictProsperity } from './analysis';
import { computeClimate } from './climate';

const CELL_STRIDE = 22;
const CANAL_Z = 13;
const SOUTH_SHIFT = 4; // extra gap between row 0 and row 1 to hold the canal cleanly

/**
 * Generates an unlimited spiral of urban block grid slots around Central Plaza (0, 0),
 * ordered cleanly from inner downtown rings outward so ANY number of repos fits organically!
 */
function generateSpiralSlots(count: number): { c: number; r: number; tier: DistrictTier }[] {
  const slots: { c: number; r: number; tier: DistrictTier }[] = [];
  let ring = 1;
  while (slots.length < count) {
    const ringCells: { c: number; r: number; angle: number; dist: number }[] = [];
    for (let c = -ring; c <= ring; c++) {
      for (let r = -ring; r <= ring; r++) {
        if (Math.max(Math.abs(c), Math.abs(r)) !== ring) continue;
        ringCells.push({
          c,
          r,
          dist: Math.hypot(c, r),
          angle: Math.atan2(r, c),
        });
      }
    }
    // Prefer cardinal anchors first inside each ring (more circular organic island silhouette!)
    ringCells.sort((a, b) => a.dist - b.dist || a.angle - b.angle);
    const tier: DistrictTier = ring === 1 ? 'downtown' : ring === 2 ? 'midtown' : 'outskirts';
    for (const cell of ringCells) {
      if (slots.length >= count) break;
      slots.push({ c: cell.c, r: cell.r, tier });
    }
    ring++;
  }
  return slots;
}

function cellToWorld(c: number, r: number): { x: number; z: number } {
  const x = c * CELL_STRIDE;
  const z = r * CELL_STRIDE + (r >= 1 ? SOUTH_SHIFT : 0);
  return { x, z };
}

function computeVitality(repo: GitHubRepoData, nowMs: number): {
  vitality: DistrictVitality;
  label: string;
  overgrowth: number;
  pedDensity: number;
} {
  if (repo.archived) {
    return {
      vitality: 'heritage',
      label: 'Archived Heritage Quarter',
      overgrowth: 0.88,
      pedDensity: 0.35,
    };
  }
  const pushedMs = new Date(repo.pushedAt || repo.updatedAt || repo.createdAt).getTime();
  const daysAgo = Math.max(0, (nowMs - pushedMs) / (1000 * 60 * 60 * 24));

  if (daysAgo <= 35) {
    return {
      vitality: 'active',
      label: 'Active Construction Zone',
      overgrowth: 0.04,
      pedDensity: 1.0,
    };
  }
  if (daysAgo <= 190) {
    return {
      vitality: 'thriving',
      label: 'Thriving Neighborhood',
      overgrowth: 0.14,
      pedDensity: 0.78,
    };
  }
  if (daysAgo <= 620) {
    return {
      vitality: 'dormant',
      label: 'Quiet Overgrown Block',
      overgrowth: 0.52,
      pedDensity: 0.45,
    };
  }
  return {
    vitality: 'heritage',
    label: 'Preserved Heritage District',
    overgrowth: 0.78,
    pedDensity: 0.32,
  };
}

function sortReposForUrbanPlanning(repos: GitHubRepoData[], nowMs: number): GitHubRepoData[] {
  return [...repos].sort((a, b) => {
    const locA = a.estimatedLOC || Math.max(50, a.size * 10);
    const locB = b.estimatedLOC || Math.max(50, b.size * 10);
    const starsA = a.stargazersCount || 0;
    const starsB = b.stargazersCount || 0;
    const forksA = a.forksCount || 0;
    const forksB = b.forksCount || 0;
    const pushA = new Date(a.pushedAt || a.updatedAt || a.createdAt).getTime();
    const pushB = new Date(b.pushedAt || b.updatedAt || b.createdAt).getTime();
    const daysA = Math.max(0, (nowMs - pushA) / 86400000);
    const daysB = Math.max(0, (nowMs - pushB) / 86400000);

    // Flagship prestige formula: balances stars, forks, LOC, and recency
    const prestigeA =
      Math.log10(starsA + 1) * 36 +
      Math.log10(forksA + 1) * 16 +
      Math.log10(locA + 1) * 18 +
      (daysA < 90 ? 14 : 0) +
      (a.fork ? -24 : 16);
    const prestigeB =
      Math.log10(starsB + 1) * 36 +
      Math.log10(forksB + 1) * 16 +
      Math.log10(locB + 1) * 18 +
      (daysB < 90 ? 14 : 0) +
      (b.fork ? -24 : 16);
    return prestigeB - prestigeA;
  });
}

export interface BuildCityOptions {
  /** Clock override; defaults to `Date.now()`. Injecting it makes planning pure. */
  nowMs?: number;
}

export function buildCityBlueprint(
  payload: GitHubProfilePayload,
  options: BuildCityOptions = {}
): CityBlueprint {
  const nowMs = options.nowMs ?? Date.now();
  const citySeed = hashString(`gitpolis:${payload.user.login.toLowerCase()}`);
  const cityRng = new SeededRNG(citySeed);

  // Aggregate global language bytes across ALL repos
  const langBytesMap = new Map<string, number>();
  for (const repo of payload.repos) {
    const entries = Object.entries(repo.languages || {});
    if (entries.length > 0) {
      for (const [lang, bytes] of entries) {
        langBytesMap.set(lang, (langBytesMap.get(lang) || 0) + bytes);
      }
    } else if (repo.language) {
      langBytesMap.set(
        repo.language,
        (langBytesMap.get(repo.language) || 0) + Math.max(1000, repo.size * 1024 * 0.36)
      );
    }
  }

  const totalLangBytes = Array.from(langBytesMap.values()).reduce((a, b) => a + b, 0) || 1;
  const languageBreakdown = Array.from(langBytesMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([language, bytes]) => {
      const style = resolveLanguageStyle(language);
      return {
        language,
        styleId: style.styleId,
        styleName: style.styleName,
        bytes,
        percentage: Math.round((bytes / totalLangBytes) * 1000) / 10,
        color: style.badgeColor,
      };
    });

  const primaryGlobalStyle: StyleId = languageBreakdown[0]?.styleId ?? 'typescript_glass';
  const { cityName, citySubtitle, archetypeSummary } = computeCityName(
    payload.user.login,
    primaryGlobalStyle
  );

  // Find global most recently pushed repo for pulse highlight
  let newestPushRepoId = payload.repos[0]?.id ?? -1;
  let newestPushMs = 0;
  for (const repo of payload.repos) {
    const ms = new Date(repo.pushedAt || repo.updatedAt || repo.createdAt).getTime();
    if (ms > newestPushMs) {
      newestPushMs = ms;
      newestPushRepoId = repo.id;
    }
  }

  // Sort repos intelligently: Flagships & high-impact repos claim prime downtown slots!
  const selectedRepos = sortReposForUrbanPlanning(payload.repos, nowMs);
  const spiralSlots = generateSpiralSlots(selectedRepos.length);
  const isLargeMetropolis = selectedRepos.length > 36;
  const isMegaMetropolis = selectedRepos.length > 85;

  const districts: DistrictBlueprint[] = [];
  let maxDistFromOrigin = 26;

  selectedRepos.forEach((repo, repoIndex) => {
    const slot = spiralSlots[repoIndex];
    const { x: centerX, z: centerZ } = cellToWorld(slot.c, slot.r);
    maxDistFromOrigin = Math.max(maxDistFromOrigin, Math.hypot(centerX, centerZ) + 18);

    const repoSeed = hashString(`${repo.fullName}:${repo.id}`);
    const rng = new SeededRNG(repoSeed);

    const primaryLanguage = repo.language || Object.keys(repo.languages || {})[0] || 'Markdown';
    const primaryStyle = resolveLanguageStyle(primaryLanguage);
    const vitalityInfo = computeVitality(repo, nowMs);

    // Language shares for polyglot building variety inside this block
    const repoLangEntries = Object.entries(repo.languages || {}).sort((a, b) => b[1] - a[1]);
    const repoLangTotal = repoLangEntries.reduce((s, [, b]) => s + b, 0) || 1;
    const languageShares =
      repoLangEntries.length > 0
        ? repoLangEntries.slice(0, 5).map(([lang, bytes]) => {
            const st = resolveLanguageStyle(lang);
            return {
              language: lang,
              percentage: Math.round((bytes / repoLangTotal) * 1000) / 10,
              color: st.badgeColor,
              styleId: st.styleId,
            };
          })
        : [
            {
              language: primaryLanguage,
              percentage: 100,
              color: primaryStyle.badgeColor,
              styleId: primaryStyle.styleId,
            },
          ];

    // Normalized LOC, codebase size, stars, and commit volume shape block scale & massing!
    const loc = repo.estimatedLOC || Math.max(50, Math.round(repo.size * 10));
    const locFactor = Math.min(1, Math.log10(loc + 20) / 5.2); // 100 LOC ~0.40, 10k LOC ~0.77, 150k LOC ~1.0
    const sizeFactor = Math.min(1, Math.log10((repo.size || 20) + 10) / 5.0);
    const starFactor = Math.min(1, Math.log10((repo.stargazersCount || 0) + 1) / 4.2);
    const commitDensityFactor = Math.min(1, Math.log10((repo.totalCommitEstimate || 5) + 1) / 3.0);
    const tierBonus = slot.tier === 'downtown' ? 1.4 : slot.tier === 'midtown' ? 0.45 : -0.45;

    // Deep Domain & Prosperity Metrics
    const domain = classifyRepoDomain(repo);
    const prosperity = computeDistrictProsperity(repo, loc, repo.commits || []);

    const width = Math.min(
      16.6,
      Math.max(10.8, 11.2 + locFactor * 2.5 + sizeFactor * 1.4 + starFactor * 1.2 + tierBonus * 0.4)
    );
    const depth = Math.min(
      16.6,
      Math.max(10.8, 11.2 + locFactor * 2.2 + sizeFactor * 1.3 + starFactor * 1.2 + tierBonus * 0.4)
    );
    const plinthHeight = slot.tier === 'downtown' ? 0.64 : slot.tier === 'midtown' ? 0.5 : 0.4;

    // Sort commits chronologically oldest -> newest
    const sortedCommits = [...(repo.commits || [])].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const repoCreatedMs = new Date(repo.createdAt).getTime();
    const repoLastMs = Math.max(
      repoCreatedMs + 86400000,
      new Date(repo.pushedAt || repo.updatedAt || repo.createdAt).getTime()
    );

    // Adaptive parcel grid driven by LOC + Commits + Stars (while staying 60fps on huge accounts!)
    const complexity =
      locFactor * 0.42 + commitDensityFactor * 0.32 + starFactor * 0.26;
    let cols = 2;
    let rows = 2;
    let targetBuildings = 3;

    if (isMegaMetropolis && slot.tier === 'outskirts') {
      cols = 2;
      rows = 2;
      targetBuildings = complexity > 0.6 ? 2 : 1;
    } else if (isLargeMetropolis && slot.tier === 'outskirts') {
      cols = 2;
      rows = 2;
      targetBuildings = complexity > 0.65 ? 3 : 2;
    } else if (complexity > 0.72) {
      cols = 3;
      rows = 3;
      targetBuildings = rng.int(6, 8);
    } else if (complexity > 0.45) {
      cols = 3;
      rows = 2;
      targetBuildings = rng.int(4, 5);
    } else if (loc < 450 && sortedCommits.length <= 4) {
      cols = 2;
      rows = 2;
      targetBuildings = 2;
    } else {
      cols = 2;
      rows = 2;
      targetBuildings = rng.int(2, 3);
    }

    const innerW = width - 2.2;
    const innerD = depth - 2.2;
    const parcelW = innerW / cols;
    const parcelD = innerD / rows;

    const parcels: {
      gx: number;
      gz: number;
      localX: number;
      localZ: number;
      distCenter: number;
      sortKey: number;
    }[] = [];
    for (let gx = 0; gx < cols; gx++) {
      for (let gz = 0; gz < rows; gz++) {
        const localX = -innerW / 2 + parcelW * (gx + 0.5);
        const localZ = -innerD / 2 + parcelD * (gz + 0.5);
        parcels.push({
          gx,
          gz,
          localX,
          localZ,
          distCenter: Math.hypot(localX, localZ),
          // Assign jitter once. Drawing it inside the comparator would consume
          // the shared RNG in an implementation-defined order and make the
          // layout non-deterministic.
          sortKey: Math.hypot(localX, localZ) + rng.range(-0.55, 0.55),
        });
      }
    }

    parcels.sort((a, b) => a.sortKey - b.sortKey);
    const buildingParcels = parcels.slice(0, Math.min(targetBuildings, parcels.length));
    const parkParcels = parcels.slice(buildingParcels.length);

    // Partition commits chronologically across buildings
    const bCount = buildingParcels.length;
    const clusters: GitHubCommitData[][] = Array.from({ length: bCount }, () => []);
    if (sortedCommits.length > 0) {
      sortedCommits.forEach((c, idx) => {
        const bucket = Math.min(bCount - 1, Math.floor((idx / sortedCommits.length) * bCount));
        clusters[bucket].push(c);
      });
      for (let i = 0; i < bCount; i++) {
        if (clusters[i].length === 0) {
          clusters[i].push(sortedCommits[i % sortedCommits.length]);
        }
      }
      let richestIdx = 0;
      for (let i = 1; i < bCount; i++) {
        if (clusters[i].length > clusters[richestIdx].length) richestIdx = i;
      }
      if (richestIdx !== 0) {
        const tmp = clusters[0];
        clusters[0] = clusters[richestIdx];
        clusters[richestIdx] = tmp;
      }
    }

    // Assign polyglot languages proportionally across buildings inside this block
    const buildingLanguages: string[] = [];
    for (let i = 0; i < bCount; i++) {
      if (i === 0 || languageShares.length === 1) {
        buildingLanguages.push(primaryLanguage);
      } else {
        const roll = (i * 37 + (repoSeed % 100)) % 100;
        let acc = 0;
        let chosen = primaryLanguage;
        for (const share of languageShares) {
          acc += share.percentage;
          if (roll <= acc) {
            chosen = share.language;
            break;
          }
        }
        buildingLanguages.push(chosen);
      }
    }

    const buildings: BuildingBlueprint[] = [];
    let newestBuildingIdx = 0;
    let newestBuildingTime = 0;

    buildingParcels.forEach((parcel, bIdx) => {
      const cluster = clusters[bIdx];
      const isHero = bIdx === 0;
      const bLang = buildingLanguages[bIdx];
      const bStyle = resolveLanguageStyle(bLang);
      const bCategory = dominantCategory(cluster);
      const anchorSha = cluster[0]?.sha || `${repo.id}-${bIdx}`;
      const bSeed = hashString(`${repo.fullName}:${bIdx}:${anchorSha}`);
      const bRng = new SeededRNG(bSeed);

      let foundedAt = repoCreatedMs + ((repoLastMs - repoCreatedMs) * bIdx) / Math.max(1, bCount);
      let completedAt = foundedAt + Math.max(86400000 * 3, (repoLastMs - repoCreatedMs) * 0.25);
      if (cluster.length > 0) {
        const times = cluster.map((c) => new Date(c.date).getTime()).filter((t) => Number.isFinite(t));
        if (times.length > 0) {
          const minT = Math.min(...times);
          const maxT = Math.max(...times);
          foundedAt = bIdx === 0 ? Math.min(minT, repoCreatedMs + (minT - repoCreatedMs) * 0.35) : minT;
          completedAt = Math.max(foundedAt + 86400000, maxT);
        }
      }
      if (completedAt > newestBuildingTime) {
        newestBuildingTime = completedAt;
        newestBuildingIdx = bIdx;
      }

      // Height shaped authentically by LOC + commits + stars + repo maturity + commit category!
      const commitFactor = Math.log2(cluster.length + 1.5) * 1.9;
      const totalCommitBonus = Math.min(3.8, commitDensityFactor * 3.8);
      const locHeightBonus = locFactor * 5.2;
      const categoryHeightMod: Record<CommitCategory, number> = {
        feat: 1.24,
        release: 1.32,
        refactor: 1.1,
        init: 0.98,
        fix: 0.92,
        docs: 0.82,
        test: 0.86,
        chore: 0.88,
      };
      const heroBoost = isHero ? 1.36 : bRng.range(0.74, 1.06);
      const forkMod = repo.fork ? 0.84 : 1.0;

      const rawHeight =
        (2.4 + commitFactor + locHeightBonus + starFactor * 4.2 + totalCommitBonus) *
        categoryHeightMod[bCategory] *
        heroBoost *
        forkMod *
        bRng.range(0.9, 1.12);

      const height = Math.min(20.0, Math.max(2.6, Math.round(rawHeight * 10) / 10));
      const floors = Math.max(2, Math.round(height / 0.78));

      const maxW = parcelW * (isHero ? 0.86 : bRng.range(0.64, 0.82));
      const maxD = parcelD * (isHero ? 0.86 : bRng.range(0.64, 0.82));
      const bw = Math.max(2.0, Math.min(5.4, maxW));
      const bd = Math.max(2.0, Math.min(5.4, maxD));

      const jitterX = (parcelW - bw) * bRng.range(-0.22, 0.22);
      const jitterZ = (parcelD - bd) * bRng.range(-0.22, 0.22);
      const localX = parcel.localX + jitterX;
      const localZ = parcel.localZ + jitterZ;

      const rotation = bRng.pick([0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]);
      const prestige = Math.min(1, starFactor * 0.78 + (bCategory === 'release' ? 0.24 : 0) + (repo.homepage || repo.hasPages ? 0.12 : 0));

      const dnaTags: string[] = [
        `${cluster.length} commit${cluster.length === 1 ? '' : 's'}`,
        `${floors} floors`,
        `${bCategory.toUpperCase()} architecture`,
        `SHA #${anchorSha.slice(0, 6)}`,
      ];
      if (prestige > 0.55) dnaTags.push('Star Landmark');
      if (vitalityInfo.overgrowth > 0.45) dnaTags.push('Heritage Patina');
      if (repo.fork) dnaTags.push('Fork Annex');

      const isObservationSpire = isHero && (prosperity.prosperityTier === 'gilded' || starFactor > 0.55);
      const bHasScaffolding =
        (repo.openIssuesCount >= 8 && vitalityInfo.vitality !== 'heritage' && bIdx === 1) ||
        (vitalityInfo.vitality === 'active' && bIdx === 0);
      const domainFeature = isHero ? domain.architecturalFeature : undefined;

      buildings.push({
        id: `${repo.name}::b${bIdx}`,
        districtId: repo.name,
        districtName: repo.name,
        name: generateBuildingName(bCategory, bStyle.styleId, cluster, bIdx, isHero, bRng),
        archetype: bStyle.archetype,
        language: bLang,
        styleId: bStyle.styleId,
        dominantCommitType: bCategory,
        seed: bSeed,
        localX,
        localZ,
        worldX: centerX + localX,
        worldZ: centerZ + localZ,
        width: bw,
        depth: bd,
        height,
        floors,
        rotation,
        commits: [...cluster].reverse(),
        foundedAt,
        completedAt,
        hasCrane: false,
        hasPulseBeacon: false,
        hasScaffolding: bHasScaffolding,
        isObservationSpire,
        domainFeature,
        overgrowth: vitalityInfo.overgrowth,
        prestige,
        dnaTags,
      });
    });

    // District unique architectural identity features derived from EVERYTHING in the repo!
    const hasCrane =
      vitalityInfo.vitality === 'active' ||
      (vitalityInfo.vitality === 'thriving' && repo.openIssuesCount >= 8);
    if (hasCrane && buildings[newestBuildingIdx]) {
      buildings[newestBuildingIdx].hasCrane = true;
    }
    if (repo.id === newestPushRepoId && buildings[newestBuildingIdx]) {
      buildings[newestBuildingIdx].hasPulseBeacon = true;
    }

    const hasLiveBeacon = Boolean((repo.homepage && repo.homepage.trim().length > 4) || repo.hasPages);
    const hasLibraryKiosk = Boolean(repo.hasWiki);
    const isForkAnnex = Boolean(repo.fork);
    const hasScaffolding =
      (repo.openIssuesCount >= 8 && vitalityInfo.vitality !== 'heritage') || vitalityInfo.vitality === 'active';
    const hasMilestoneArch = prosperity.hasReleases || repo.stargazersCount >= 28;
    const hasPier = prosperity.hasPages || Boolean(repo.homepage);
    const hasFountain = slot.tier === 'downtown' && prosperity.prosperityScore >= 42;

    const identityTraits: string[] = [
      formatLOCShort(loc),
      domain.shortLabel,
      `${prosperity.prosperityScore}/100 Prosperity`,
      `${prosperity.fulfillmentScore}/100 Fulfillment`,
    ];
    if (languageShares.length > 1) identityTraits.push(`Polyglot (${languageShares.length} langs)`);
    if (hasCrane) identityTraits.push('Active Crane');
    if (hasMilestoneArch) identityTraits.push('Milestone Arch');
    if (hasPier) identityTraits.push('Coastal Pier');
    if (hasScaffolding) identityTraits.push(`${repo.openIssuesCount} Issues (Scaffolding)`);
    if (hasLiveBeacon) identityTraits.push('Live Web Beacon');
    if (hasLibraryKiosk) identityTraits.push('Wiki Pavilion');
    if (isForkAnnex) identityTraits.push('Forked Guild Annex');
    if (repo.archived) identityTraits.push('Archived Monument');
    if (repo.licenseName) identityTraits.push(repo.licenseName);

    // Trees & Lamps (trimmed slightly in distant outskirts of huge 90+ repo cities for smooth 60fps)
    const trees: TreeProp[] = [];
    const baseTreeVariant = vitalityInfo.overgrowth > 0.6 ? 'weeping' : primaryStyle.treeVariant;

    const maxParkTrees = isMegaMetropolis && slot.tier === 'outskirts' ? 1 : vitalityInfo.overgrowth > 0.45 ? 3 : 2;
    for (const park of parkParcels.slice(0, isMegaMetropolis ? 2 : parkParcels.length)) {
      for (let t = 0; t < maxParkTrees; t++) {
        trees.push({
          x: centerX + park.localX + rng.range(-parcelW * 0.3, parcelW * 0.3),
          z: centerZ + park.localZ + rng.range(-parcelD * 0.3, parcelD * 0.3),
          scale: rng.range(0.78, 1.32) * (1 + vitalityInfo.overgrowth * 0.25),
          variant: t === 0 ? baseTreeVariant : rng.pick(['oak', 'cypress', 'cherry', baseTreeVariant]),
          foundedAt: repoCreatedMs + (repoLastMs - repoCreatedMs) * rng.range(0.15, 0.7),
        });
      }
    }

    const edgeOffsets =
      isMegaMetropolis && slot.tier === 'outskirts'
        ? [
            { x: -width / 2 + 0.7, z: depth / 2 - 0.7 },
            { x: width / 2 - 0.7, z: depth / 2 - 0.7 },
          ]
        : [
            { x: -width / 2 + 0.7, z: -depth / 2 + 0.7 },
            { x: width / 2 - 0.7, z: -depth / 2 + 0.7 },
            { x: -width / 2 + 0.7, z: depth / 2 - 0.7 },
            { x: width / 2 - 0.7, z: depth / 2 - 0.7 },
          ];

    const lamps: LampProp[] = edgeOffsets.map((e) => ({
      x: centerX + e.x,
      z: centerZ + e.z,
    }));

    if (!(isMegaMetropolis && slot.tier === 'outskirts')) {
      const midEdges = [
        { x: 0, z: -depth / 2 + 0.65 },
        { x: 0, z: depth / 2 - 0.65 },
        { x: -width / 2 + 0.65, z: 0 },
        { x: width / 2 - 0.65, z: 0 },
      ];
      for (const m of midEdges) {
        if (rng.chance(0.5 + vitalityInfo.overgrowth * 0.35)) {
          trees.push({
            x: centerX + m.x + rng.range(-0.4, 0.4),
            z: centerZ + m.z + rng.range(-0.4, 0.4),
            scale: rng.range(0.68, 1.05),
            variant: baseTreeVariant,
            foundedAt: repoCreatedMs + (repoLastMs - repoCreatedMs) * 0.4,
          });
        }
      }
    }

    const secondaryLangs = languageShares
      .slice(1, 3)
      .filter((l) => l.percentage >= 8)
      .map((l) => `${l.language} (${Math.round(l.percentage)}%)`);

    const architecturalSummary = `${primaryStyle.styleName} (${domain.label}) shaped by ${primaryLanguage}${
      secondaryLangs.length ? ` with ${secondaryLangs.join(' & ')} wings` : ''
    } — ~${loc.toLocaleString()} LOC, ${prosperity.prosperityScore}/100 Prosperity, ${prosperity.fulfillmentScore}/100 Fulfillment across ${buildings.length} commit structure${
      buildings.length === 1 ? '' : 's'
    }${repo.stargazersCount > 0 ? ` and ${repo.stargazersCount.toLocaleString()} stars` : ''}${
      isForkAnnex ? ' (forked annex block)' : ''
    }${hasLiveBeacon ? ' with a live web broadcast spire' : ''}.`;

    districts.push({
      id: repo.name,
      repo,
      primaryLanguage,
      styleId: primaryStyle.styleId,
      styleName: primaryStyle.styleName,
      accentColor: primaryStyle.badgeColor,
      vitality: vitalityInfo.vitality,
      vitalityLabel: vitalityInfo.label,
      tier: slot.tier,
      domain,
      prosperity,
      x: centerX,
      z: centerZ,
      width,
      depth,
      plinthHeight,
      hasCrane,
      hasLandmarkBeacon: repo.stargazersCount >= 25 || slot.tier === 'downtown',
      hasLiveBeacon,
      hasLibraryKiosk,
      hasScaffolding,
      hasMilestoneArch,
      hasPier,
      hasFountain,
      isForkAnnex,
      overgrowthLevel: vitalityInfo.overgrowth,
      pedestrianDensity: vitalityInfo.pedDensity * (1 + Math.min(0.6, starFactor)),
      estimatedLOC: loc,
      identityTraits,
      buildings,
      trees,
      lamps,
      foundedAt: repoCreatedMs,
      lastActiveAt: repoLastMs,
      architecturalSummary,
      languageShares,
    });
  });

  // Build crisp Avenue & Bridge Network covering all active cells
  const roads: RoadSegment[] = [];
  const allCols = new Set<number>([0]);
  const allRows = new Set<number>([0]);
  for (let i = 0; i < selectedRepos.length; i++) {
    allCols.add(spiralSlots[i].c);
    allRows.add(spiralSlots[i].r);
  }
  const minC = Math.min(...allCols);
  const maxC = Math.max(...allCols);
  const minR = Math.min(...allRows);
  const maxR = Math.max(...allRows);

  const roadMinX = minC * CELL_STRIDE - CELL_STRIDE / 2;
  const roadMaxX = maxC * CELL_STRIDE + CELL_STRIDE / 2;
  const roadMinZ = minR * CELL_STRIDE - CELL_STRIDE / 2;
  const roadMaxZ = maxR * CELL_STRIDE + (maxR >= 1 ? SOUTH_SHIFT : 0) + CELL_STRIDE / 2;

  for (let r = minR; r <= maxR + 1; r++) {
    if (r === 1) {
      roads.push({
        id: 'h-north-quay',
        x1: roadMinX,
        z1: CANAL_Z - 4.3,
        x2: roadMaxX,
        z2: CANAL_Z - 4.3,
        width: 2.2,
        isBoulevard: true,
      });
      roads.push({
        id: 'h-south-quay',
        x1: roadMinX,
        z1: CANAL_Z + 4.3,
        x2: roadMaxX,
        z2: CANAL_Z + 4.3,
        width: 2.2,
        isBoulevard: true,
      });
      continue;
    }
    const z =
      r <= 0 ? r * CELL_STRIDE - CELL_STRIDE / 2 : r * CELL_STRIDE + SOUTH_SHIFT - CELL_STRIDE / 2;
    roads.push({
      id: `h-${r}`,
      x1: roadMinX,
      z1: z,
      x2: roadMaxX,
      z2: z,
      width: r === 0 ? 3.8 : 3.2,
      isBoulevard: r === 0,
    });
  }

  for (let c = minC; c <= maxC + 1; c++) {
    const x = c * CELL_STRIDE - CELL_STRIDE / 2;
    const hasSouthBank = maxR >= 1;
    if (hasSouthBank) {
      roads.push({
        id: `v-n-${c}`,
        x1: x,
        z1: roadMinZ,
        x2: x,
        z2: CANAL_Z - 3.6,
        width: c === 0 || c === 1 ? 3.6 : 3.1,
        isBoulevard: c === 0 || c === 1,
      });
      roads.push({
        id: `bridge-${c}`,
        x1: x,
        z1: CANAL_Z - 3.9,
        x2: x,
        z2: CANAL_Z + 3.9,
        width: 3.6,
        isBridge: true,
      });
      roads.push({
        id: `v-s-${c}`,
        x1: x,
        z1: CANAL_Z + 3.6,
        x2: x,
        z2: roadMaxZ,
        width: c === 0 || c === 1 ? 3.6 : 3.1,
        isBoulevard: c === 0 || c === 1,
      });
    } else {
      roads.push({
        id: `v-${c}`,
        x1: x,
        z1: roadMinZ,
        x2: x,
        z2: Math.min(roadMaxZ, CANAL_Z - 4.0),
        width: 3.4,
      });
    }
  }

  if (maxR >= 1) {
    roads.push({
      id: 'bridge-central',
      x1: 0,
      z1: CANAL_Z - 4.1,
      x2: 0,
      z2: CANAL_Z + 4.1,
      width: 4.2,
      isBridge: true,
      isBoulevard: true,
    });
  }

  // Inter-district Transit Links between related repos (shared topics or shared language)
  const transitLinks: TransitLink[] = [];
  const maxLinkScan = Math.min(districts.length, 40);
  for (let i = 0; i < maxLinkScan; i++) {
    for (let j = i + 1; j < maxLinkScan; j++) {
      if (transitLinks.length >= 14) break;
      const a = districts[i];
      const b = districts[j];
      const dist = Math.hypot(a.x - b.x, a.z - b.z);
      if (dist > 36) continue;
      const sharedTopic = a.repo.topics.find((t) => b.repo.topics.includes(t));
      if (sharedTopic) {
        transitLinks.push({
          fromDistrictId: a.id,
          toDistrictId: b.id,
          x1: a.x,
          z1: a.z,
          x2: b.x,
          z2: b.z,
          color: a.accentColor,
          reason: `Shared topic #${sharedTopic}`,
        });
      } else if (a.primaryLanguage === b.primaryLanguage && dist <= 26) {
        transitLinks.push({
          fromDistrictId: a.id,
          toDistrictId: b.id,
          x1: a.x,
          z1: a.z,
          x2: b.x,
          z2: b.z,
          color: a.accentColor,
          reason: `${a.primaryLanguage} corridor`,
        });
      }
    }
  }

  const totalStars = payload.repos.reduce((s, r) => s + r.stargazersCount, 0);
  const totalForks = payload.repos.reduce((s, r) => s + r.forksCount, 0);
  const totalSizeKB = payload.repos.reduce((s, r) => s + r.size, 0);
  const totalEstimatedLOC = districts.reduce((s, d) => s + d.estimatedLOC, 0);
  const totalBuildings = districts.reduce((s, d) => s + d.buildings.length, 0);
  const totalCommitsSampled = districts.reduce((s, d) => s + d.repo.commits.length, 0);
  const activeDistricts = districts.filter(
    (d) => d.vitality === 'active' || d.vitality === 'thriving'
  ).length;
  const heritageDistricts = districts.filter(
    (d) => d.vitality === 'heritage' || d.vitality === 'dormant'
  ).length;
  const profileCreatedMs = new Date(payload.user.createdAt).getTime();
  const accountAgeYears = Math.max(
    0.2,
    Math.round(((nowMs - profileCreatedMs) / (1000 * 60 * 60 * 24 * 365.25)) * 10) / 10
  );

  const monumentHeight = Math.min(
    18.5,
    Math.max(
      7.2,
      6.5 +
        Math.min(4.5, accountAgeYears * 0.42) +
        Math.log10(payload.user.followers + 1) * 1.4 +
        Math.log10(totalStars + 1) * 1.2 +
        Math.log10(totalEstimatedLOC + 100) * 0.4
    )
  );

  // Timeline buckets & milestones
  const allTimes: number[] = [profileCreatedMs];
  const milestones: TimelineMilestone[] = [
    {
      time: profileCreatedMs,
      label: `Founded Civic Plaza (@${payload.user.login} joined GitHub)`,
      type: 'founded',
    },
  ];

  for (const d of districts) {
    allTimes.push(d.foundedAt, d.lastActiveAt);
    milestones.push({
      time: d.foundedAt,
      label: `Chartered ${d.id} (${d.styleName} • ${formatLOCShort(d.estimatedLOC)})`,
      districtId: d.id,
      type: 'district',
    });
    for (const b of d.buildings) {
      allTimes.push(b.foundedAt, b.completedAt);
      if (b.dominantCommitType === 'release') {
        milestones.push({
          time: b.completedAt,
          label: `Release Spire topped out in ${d.id}`,
          districtId: d.id,
          type: 'release',
        });
      }
    }
  }

  const startTime = Math.min(...allTimes);
  const endTime = Math.max(nowMs, ...allTimes);
  const span = Math.max(86400000 * 30, endTime - startTime);
  const bucketCount = 48;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    time: startTime + (span * i) / (bucketCount - 1),
    count: 0,
  }));

  for (const d of districts) {
    for (const c of d.repo.commits) {
      const t = new Date(c.date).getTime();
      if (!Number.isFinite(t)) continue;
      const idx = Math.min(
        bucketCount - 1,
        Math.max(0, Math.floor(((t - startTime) / span) * bucketCount))
      );
      buckets[idx].count += 1;
    }
    const dIdx = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor(((d.foundedAt - startTime) / span) * bucketCount))
    );
    buckets[dIdx].count += 2;
  }

  milestones.sort((a, b) => a.time - b.time);

  const climate = computeClimate(payload, districts, nowMs);

  // Island radius scales dynamically to fit ALL districts comfortably!
  const islandRadius = Math.max(40, maxDistFromOrigin + 12 + cityRng.range(0, 2));

  return {
    cityName,
    citySubtitle,
    archetypeSummary,
    seed: citySeed,
    profile: payload.user,
    source: payload.source,
    rateLimit: payload.rateLimit,
    climate,
    stats: {
      totalStars,
      totalForks,
      totalCommitsSampled,
      totalSizeKB,
      totalEstimatedLOC,
      totalBuildings,
      activeDistricts,
      heritageDistricts,
      accountAgeYears,
      languageBreakdown,
    },
    islandRadius,
    canalZ: CANAL_Z,
    plaza: {
      x: 0,
      z: 0,
      radius: 8.6,
      monumentHeight,
      rings: Math.min(5, Math.max(2, Math.floor(Math.log10(totalStars + 10)) + 1)),
      foundedAt: profileCreatedMs,
    },
    districts,
    roads,
    transitLinks,
    timeline: {
      startTime,
      endTime,
      buckets,
      milestones: milestones.slice(0, 60),
    },
  };
}
