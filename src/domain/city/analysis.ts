import type { MunicipalDecisionPlan } from '../decision/types';
import type {
  CityBlueprint,
  CityClimate,
  DistrictBlueprint,
  DistrictProsperityMetrics,
  GitHubCommitData,
  GitHubRepoData,
  RepoDomainInfo,
} from './types';

/**
 * Pure heuristics that turn repository metadata into municipal identity:
 * domain classification for architectural specialisation, and the
 * prosperity/fulfilment indices used for zoning and visual prestige.
 */

export function classifyRepoDomain(repo: GitHubRepoData): RepoDomainInfo {
  const topics = (repo.topics || []).map((t) => t.toLowerCase());
  const name = repo.name.toLowerCase();
  const desc = (repo.description || '').toLowerCase();
  const lang = (repo.language || '').toLowerCase();
  const allText = `${name} ${desc} ${topics.join(' ')} ${lang}`;

  // 1. AI & Machine Learning
  if (
    topics.some((t) =>
      [
        'ai',
        'ml',
        'machine-learning',
        'deep-learning',
        'neural-network',
        'llm',
        'nlp',
        'pytorch',
        'tensorflow',
        'transformers',
        'diffusion',
        'computer-vision',
        'gpt',
        'rag',
      ].includes(t)
    ) ||
    /\b(ai|ml|neural|transformer|gpt|llm|pytorch|tensorflow|deeplearning|classifier|embedding|model|inference|diffusion|reinforcement|agent|genai)\b/.test(
      allText
    )
  ) {
    return {
      id: 'ai_ml',
      label: 'AI & Neural Systems',
      shortLabel: 'AI / Neural',
      badgeColor: '#8b5cf6',
      description:
        'Advanced machine learning models, neural graph pipelines, generative inference, and cognitive computing architectures.',
      architecturalFeature: 'Holographic Neural Telemetry Dome & Fiber Optic Spire',
    };
  }

  // 2. Systems, Cloud & DevOps Infrastructure
  if (
    topics.some((t) =>
      [
        'devops',
        'docker',
        'kubernetes',
        'cloud',
        'infrastructure',
        'server',
        'linux',
        'kernel',
        'aws',
        'gcp',
        'terraform',
        'ci-cd',
        'microservices',
        'distributed-systems',
      ].includes(t)
    ) ||
    ['dockerfile', 'shell', 'bash', 'hcl', 'makefile'].includes(lang) ||
    /\b(kubernetes|docker|cluster|k8s|cloud|infra|devops|kernel|linux|scheduler|mesh|microservice|proxy|loadbalancer|distributed)\b/.test(
      allText
    )
  ) {
    return {
      id: 'systems_cloud',
      label: 'Systems & Cloud Infrastructure',
      shortLabel: 'Systems / Cloud',
      badgeColor: '#0ea5e9',
      description:
        'Resilient low-latency services, distributed orchestration, container runtimes, and cloud backbone infrastructure.',
      architecturalFeature: 'Modular Logistics Container Bays & Telecommunications Radar',
    };
  }

  // 3. Web & Interactive Frontend Studio
  if (
    topics.some((t) =>
      [
        'react',
        'nextjs',
        'vue',
        'svelte',
        'frontend',
        'ui',
        'css',
        'tailwind',
        'portfolio',
        'web',
        'website',
        'design-system',
        'html',
      ].includes(t)
    ) ||
    ['html', 'css', 'scss', 'vue', 'svelte', 'astro'].includes(lang) ||
    /\b(frontend|react|nextjs|tailwind|portfolio|website|dashboard|canvas|animation|component|design-system|landing)\b/.test(
      allText
    )
  ) {
    return {
      id: 'web_frontend',
      label: 'Web & Interactive Studio',
      shortLabel: 'Web Studio',
      badgeColor: '#ec4899',
      description:
        'Modern reactive web applications, rich user experiences, responsive interfaces, and interactive design craft.',
      architecturalFeature: 'Canal Terraces, Glass Cafe Atrium & Sunlit Awnings',
    };
  }

  // 4. Mobile & Touch Pavilions
  if (
    topics.some((t) =>
      ['ios', 'android', 'react-native', 'flutter', 'swiftui', 'mobile', 'kotlin-multiplatform'].includes(
        t
      )
    ) ||
    ['swift', 'kotlin', 'dart'].includes(lang) ||
    /\b(ios|android|mobile|swiftui|react-native|flutter|touch|app-store)\b/.test(allText)
  ) {
    return {
      id: 'mobile',
      label: 'Mobile & Touch Pavilions',
      shortLabel: 'Mobile / Touch',
      badgeColor: '#f97316',
      description:
        'Smooth native and hybrid mobile client experiences, iOS/Android tactile apps, and pocket interfaces.',
      architecturalFeature: 'Sculpted Cupertino Ivory Pavilions & Minimalist Rings',
    };
  }

  // 5. Data Science & Analytics
  if (
    topics.some((t) =>
      [
        'data-science',
        'analytics',
        'pandas',
        'jupyter',
        'statistics',
        'dataset',
        'visualization',
        'bi',
        'etl',
      ].includes(t)
    ) ||
    ['jupyter notebook', 'r', 'julia'].includes(lang) ||
    /\b(analytics|pandas|dataframe|dataset|statistics|visualization|etl|bi|mining|jupyter|dashboard)\b/.test(
      allText
    )
  ) {
    return {
      id: 'data_science',
      label: 'Data Science & Scientific Computing',
      shortLabel: 'Data Science',
      badgeColor: '#10b981',
      description:
        'Exploratory data analysis, mathematical modeling, statistical pipelines, and quantitative research laboratories.',
      architecturalFeature: 'Astronomical Dome, Solar Arrays & Knowledge Obelisk',
    };
  }

  // 6. Security, Auth & Cryptography
  if (
    topics.some((t) =>
      [
        'security',
        'cryptography',
        'crypto',
        'auth',
        'cybersecurity',
        'encryption',
        'blockchain',
        'zero-knowledge',
      ].includes(t)
    ) ||
    /\b(security|cryptography|crypto|auth|encryption|oauth|token|vulnerability|audit|cipher|hash|firewall)\b/.test(
      allText
    )
  ) {
    return {
      id: 'security_crypto',
      label: 'Security & Cryptographic Citadel',
      shortLabel: 'Security / Crypto',
      badgeColor: '#ef4444',
      description:
        'Hardened cryptographic verification, authentication vaults, threat modeling, and defensive cyber architecture.',
      architecturalFeature: 'Reinforced Granite Bastion & Cryptographic Vault Pylons',
    };
  }

  // 7. Gaming, Graphics & 3D Lab
  if (
    topics.some((t) =>
      [
        'game',
        'gamedev',
        'threejs',
        'webgl',
        'opengl',
        'graphics',
        'shaders',
        'vulkan',
        'unity',
        'unreal',
      ].includes(t)
    ) ||
    ['glsl', 'hlsl', 'wgsl'].includes(lang) ||
    /\b(game|gamedev|graphics|threejs|webgl|shader|opengl|vulkan|rendering|canvas|physics-engine)\b/.test(
      allText
    )
  ) {
    return {
      id: 'gaming_graphics',
      label: '3D Graphics & Game Engine Lab',
      shortLabel: 'Graphics / Games',
      badgeColor: '#a855f7',
      description:
        'Real-time rendering, procedural geometry, game mechanics, shader pipelines, and immersive virtual environments.',
      architecturalFeature: 'Kinetic Neon Spire Sculpture & Prismatic Facade',
    };
  }

  // 8. Developer Tooling & CLI Foundry
  if (
    topics.some((t) =>
      [
        'cli',
        'compiler',
        'linter',
        'parser',
        'tooling',
        'devtools',
        'sdk',
        'library',
        'package',
        'generator',
      ].includes(t)
    ) ||
    /\b(cli|compiler|linter|parser|tooling|devtools|sdk|library|generator|scaffolding|utility)\b/.test(
      allText
    )
  ) {
    return {
      id: 'devtools_cli',
      label: 'Developer Tooling & Foundry',
      shortLabel: 'DevTools / CLI',
      badgeColor: '#f59e0b',
      description:
        'High-utility command line engines, language compilers, linters, SDKs, and developer workflow accelerators.',
      architecturalFeature: 'Sturdy Brick Clocktower & Functionalist Logistics Hub',
    };
  }

  // 9. General Polyglot Engineering
  return {
    id: 'general',
    label: 'Civic Software Hall',
    shortLabel: 'Software Works',
    badgeColor: '#64748b',
    description:
      'Foundational open-source codebases, algorithmic solutions, utility modules, and community collaborations.',
    architecturalFeature: 'Civic Colonnade & Knowledge Pavilion',
  };
}

export function computeDistrictProsperity(
  repo: GitHubRepoData,
  loc: number,
  commits: GitHubCommitData[]
): DistrictProsperityMetrics {
  const stars = repo.stargazersCount || 0;
  const forks = repo.forksCount || 0;
  const issues = repo.openIssuesCount || 0;
  const totalCommits = repo.totalCommitEstimate || commits.length || 1;

  // Prosperity Score (0..100)
  const starPoints = Math.min(48, Math.log10(stars + 1) * 16.5);
  const forkPoints = Math.min(24, Math.log10(forks + 1) * 13.5);
  const sizePoints = Math.min(14, Math.log10((repo.size || 10) + 1) * 3.5);
  const hasReleases =
    commits.some((c) => c.category === 'release') ||
    Boolean(repo.topics?.some((t) => /release|version|v\d+/i.test(t)));
  const releasePoints = hasReleases ? 14 : 0;
  const rawProsperity = starPoints + forkPoints + sizePoints + releasePoints;
  const prosperityScore = Math.max(8, Math.min(100, Math.round(rawProsperity)));

  // Fulfillment Score (0..100)
  let fulfillment = 15; // base presence
  if (repo.description && repo.description.trim().length > 10) fulfillment += 16;
  if (repo.licenseName) fulfillment += 14;
  if (repo.homepage || repo.hasPages) fulfillment += 15;
  if (repo.hasWiki) fulfillment += 10;
  if (repo.topics && repo.topics.length >= 2) fulfillment += 10;
  const locPoints = Math.min(15, Math.log10(loc + 10) * 4);
  fulfillment += locPoints;
  if (commits.some((c) => c.category === 'test')) fulfillment += 8;
  const fulfillmentScore = Math.max(12, Math.min(100, Math.round(fulfillment)));

  // Prosperity Tier
  const prosperityTier =
    prosperityScore >= 68
      ? 'gilded'
      : prosperityScore >= 42
        ? 'thriving'
        : prosperityScore >= 22
          ? 'commercial'
          : 'artisan';

  // Fulfillment Tier
  const fulfillmentTier =
    fulfillmentScore >= 70
      ? 'complete'
      : fulfillmentScore >= 42
        ? 'established'
        : 'scaffold';

  // Maintenance Health
  const openIssuesRatio = issues / Math.max(5, totalCommits);
  const maintenanceHealth = Math.max(10, Math.min(100, Math.round(100 - openIssuesRatio * 110)));

  return {
    prosperityScore,
    fulfillmentScore,
    prosperityTier,
    fulfillmentTier,
    maintenanceHealth,
    openIssuesRatio,
    hasReleases,
    hasPages: Boolean(repo.hasPages || (repo.homepage && repo.homepage.includes('github.io'))),
    hasWiki: Boolean(repo.hasWiki),
    licenseName: repo.licenseName || null,
  };
}

/**
 * Normalises a repository identifier for matching AI output to districts.
 * Accepts `owner/repo` or `repo`, ignores case and punctuation.
 */
export function normalizeRepoName(name: string): string {
  const tail = name.includes('/') ? name.split('/').pop() ?? name : name;
  return tail.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

/**
 * Exact, normalised lookup. Deliberately does **not** use substring matching:
 * `app` must not resolve to `app-store`.
 */
export function findDistrictByRepoName(
  districts: readonly DistrictBlueprint[],
  repoName: string
): DistrictBlueprint | null {
  const target = normalizeRepoName(repoName);
  if (!target) return null;
  return districts.find((district) => normalizeRepoName(district.id) === target) ?? null;
}

/**
 * Returns a new blueprint with AI prosperity/fulfilment critiques merged into
 * the matching districts. Never mutates the input, so React state stays sane.
 */
/**
 * Merges an AI MunicipalDecisionPlan into an existing CityBlueprint.
 *
 * Updates:
 * - District prosperity and fulfillment scores from civic critiques.
 * - City name and subtitle to match the AI civic title and archetype.
 * - Atmosphere and climate recommendations (solar hour, weather, narrative
 *   rationale, and mood label) so HUD controllers and 3D rendering remain
 *   in complete synchronization.
 */
export function withDecisionCritique(
  blueprint: CityBlueprint,
  plan: MunicipalDecisionPlan
): CityBlueprint {
  const critiques = new Map(
    plan.districts.map((district) => [normalizeRepoName(district.repoName), district.civicCritique])
  );

  const districts = blueprint.districts.map((district) => {
    const critique = critiques.get(normalizeRepoName(district.id));
    if (!critique) return district;
    return {
      ...district,
      prosperity: {
        ...district.prosperity,
        prosperityScore: critique.prosperityScore,
        fulfillmentScore: critique.fulfillmentScore,
      },
    };
  });

  const weather = plan.citySummary.suggestedWeather;
  const tod = plan.citySummary.suggestedTimeOfDay;

  let moodLabel = 'Radiant Daylight';
  if (weather === 'rain') moodLabel = 'Electric Drizzle';
  else if (weather === 'mist') moodLabel = 'Misty Twilight';
  else if (tod >= 19.5 || tod < 6.5) moodLabel = 'Nocturnal Glow';
  else if (tod >= 16 && tod < 19.5) moodLabel = 'Golden Hour';
  else if (tod < 12) moodLabel = 'Morning Light';

  let mood: CityClimate['mood'] = 'radiant';
  if (weather === 'rain') mood = 'drizzle';
  else if (weather === 'mist' || tod >= 18 || tod < 7) mood = 'twilight_mist';
  else if (tod < 12) mood = 'breezy';

  const climate: CityClimate = {
    mood,
    label: `${moodLabel} • AI Orchestrated`,
    description: plan.citySummary.climateRationale,
    vitalityScore: plan.citySummary.vitalityAssessment,
    recommendedTimeOfDay: tod,
    recommendedWeather: weather,
  };

  return {
    ...blueprint,
    cityName: plan.citySummary.civicTitle,
    citySubtitle: `${plan.citySummary.developerArchetype} • AI Orchestrated`,
    districts,
    climate,
  };
}
