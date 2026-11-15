export type CommitCategory =
  | 'feat'
  | 'fix'
  | 'refactor'
  | 'docs'
  | 'test'
  | 'release'
  | 'chore'
  | 'init';

export type StyleId =
  | 'typescript_glass'
  | 'javascript_studio'
  | 'python_botanical'
  | 'rust_foundry'
  | 'go_nordic'
  | 'cpp_monolith'
  | 'java_artdeco'
  | 'ruby_oldtown'
  | 'swift_pavilion'
  | 'web_canal'
  | 'devops_port'
  | 'polyglot_library';

export type BuildingArchetype =
  | 'glass_terrace'
  | 'botanical_dome'
  | 'corten_foundry'
  | 'nordic_twin'
  | 'monolith_ziggurat'
  | 'art_deco_spire'
  | 'gabled_townhouse'
  | 'cupertino_pavilion'
  | 'control_tower'
  | 'heritage_hall';

export type DistrictVitality = 'active' | 'thriving' | 'dormant' | 'heritage';
export type DistrictTier = 'downtown' | 'midtown' | 'outskirts';
export type WeatherMode = 'clear' | 'mist' | 'rain';
export type CameraPreset = 'overview' | 'street' | 'blueprint' | 'orbit';

export type RepoDomainId =
  | 'ai_ml'
  | 'systems_cloud'
  | 'web_frontend'
  | 'mobile'
  | 'data_science'
  | 'security_crypto'
  | 'gaming_graphics'
  | 'devtools_cli'
  | 'general';

export interface RepoDomainInfo {
  id: RepoDomainId;
  label: string;
  shortLabel: string;
  badgeColor: string;
  description: string;
  architecturalFeature: string;
}

export interface DistrictProsperityMetrics {
  prosperityScore: number; // 0..100 (stars, forks, community prestige)
  fulfillmentScore: number; // 0..100 (documentation, completeness, tests, homepage)
  prosperityTier: 'gilded' | 'thriving' | 'commercial' | 'artisan';
  fulfillmentTier: 'complete' | 'established' | 'scaffold';
  maintenanceHealth: number; // 0..100 (issue turnover vs activity)
  openIssuesRatio: number; // issues per commit
  hasReleases: boolean;
  hasPages: boolean;
  hasWiki: boolean;
  licenseName: string | null;
}

export interface ConstructionProgress {
  phase: 'idle' | 'survey' | 'cadastre' | 'coastline' | 'skyline' | 'life' | 'ready';
  phaseIndex: number;
  totalPhases: number;
  percentage: number;
  headline: string;
  detail: string;
  stats?: {
    repoCount?: number;
    locCount?: number;
    langCount?: number;
    starCount?: number;
    buildingCount?: number;
  };
}

export interface GitHubCommitData {
  sha: string;
  message: string;
  date: string; // ISO
  authorName: string;
  authorLogin?: string;
  category: CommitCategory;
}

export interface GitHubRepoData {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  homepage: string | null;
  language: string | null;
  languages: Record<string, number>;
  stargazersCount: number;
  forksCount: number;
  openIssuesCount: number;
  size: number; // KB
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  archived: boolean;
  fork: boolean;
  hasWiki: boolean;
  hasPages: boolean;
  topics: string[];
  licenseName: string | null;
  commits: GitHubCommitData[];
  totalCommitEstimate: number;
  estimatedLOC: number;
}

export interface GitHubUserData {
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  location: string | null;
  company: string | null;
  blog: string | null;
  followers: number;
  following: number;
  publicRepos: number;
  createdAt: string;
  htmlUrl: string;
}

export interface GitHubProfilePayload {
  user: GitHubUserData;
  repos: GitHubRepoData[];
  recentEventCount: number;
  recentPushCount: number;
  lastActivityAt: string;
  source: 'live' | 'showcase';
  rateLimit?: {
    remaining: number;
    limit: number;
    resetAt: number;
  } | null;
  fetchedAt: string;
}

export interface BuildingBlueprint {
  id: string;
  districtId: string;
  districtName: string;
  name: string;
  archetype: BuildingArchetype;
  language: string;
  styleId: StyleId;
  dominantCommitType: CommitCategory;
  seed: number;
  localX: number;
  localZ: number;
  worldX: number;
  worldZ: number;
  width: number;
  depth: number;
  height: number;
  floors: number;
  rotation: number;
  commits: GitHubCommitData[];
  foundedAt: number;
  completedAt: number;
  hasCrane: boolean;
  hasPulseBeacon: boolean;
  hasScaffolding?: boolean;
  isObservationSpire?: boolean;
  domainFeature?: string;
  overgrowth: number; // 0..1
  prestige: number; // 0..1
  dnaTags: string[];
}

export interface TreeProp {
  x: number;
  z: number;
  scale: number;
  variant: 'oak' | 'cypress' | 'cherry' | 'weeping' | 'pine';
  foundedAt: number;
}

export interface LampProp {
  x: number;
  z: number;
}

export interface DistrictBlueprint {
  id: string;
  repo: GitHubRepoData;
  primaryLanguage: string;
  styleId: StyleId;
  styleName: string;
  accentColor: string;
  vitality: DistrictVitality;
  vitalityLabel: string;
  tier: DistrictTier;
  domain: RepoDomainInfo;
  prosperity: DistrictProsperityMetrics;
  x: number;
  z: number;
  width: number;
  depth: number;
  plinthHeight: number;
  hasCrane: boolean;
  hasLandmarkBeacon: boolean;
  hasLiveBeacon: boolean;
  hasLibraryKiosk: boolean;
  hasScaffolding: boolean;
  hasMilestoneArch: boolean;
  hasPier: boolean;
  hasFountain: boolean;
  isForkAnnex: boolean;
  overgrowthLevel: number;
  pedestrianDensity: number;
  estimatedLOC: number;
  identityTraits: string[];
  buildings: BuildingBlueprint[];
  trees: TreeProp[];
  lamps: LampProp[];
  foundedAt: number;
  lastActiveAt: number;
  architecturalSummary: string;
  languageShares: { language: string; percentage: number; color: string; styleId: StyleId }[];
}

export interface RoadSegment {
  id: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  isBridge?: boolean;
  isBoulevard?: boolean;
}

export interface TransitLink {
  fromDistrictId: string;
  toDistrictId: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  color: string;
  reason: string;
}

export interface CityClimate {
  mood: 'radiant' | 'breezy' | 'drizzle' | 'twilight_mist';
  label: string;
  description: string;
  vitalityScore: number; // 0..100
  recommendedTimeOfDay: number; // 0..24
  recommendedWeather: WeatherMode;
}

export interface TimelineMilestone {
  time: number;
  label: string;
  districtId?: string;
  type: 'founded' | 'district' | 'surge' | 'release';
}

export interface CityStats {
  totalStars: number;
  totalForks: number;
  totalCommitsSampled: number;
  totalSizeKB: number;
  totalEstimatedLOC: number;
  totalBuildings: number;
  activeDistricts: number;
  heritageDistricts: number;
  accountAgeYears: number;
  languageBreakdown: {
    language: string;
    styleId: StyleId;
    styleName: string;
    bytes: number;
    percentage: number;
    color: string;
  }[];
}

export interface CityBlueprint {
  cityName: string;
  citySubtitle: string;
  archetypeSummary: string;
  seed: number;
  profile: GitHubUserData;
  source: 'live' | 'showcase';
  rateLimit?: GitHubProfilePayload['rateLimit'];
  climate: CityClimate;
  stats: CityStats;
  islandRadius: number;
  canalZ: number;
  plaza: {
    x: number;
    z: number;
    radius: number;
    monumentHeight: number;
    rings: number;
    foundedAt: number;
  };
  districts: DistrictBlueprint[];
  roads: RoadSegment[];
  transitLinks: TransitLink[];
  timeline: {
    startTime: number;
    endTime: number;
    buckets: { time: number; count: number }[];
    milestones: TimelineMilestone[];
  };
}

export interface HoverInfo {
  type: 'building' | 'district' | 'plaza';
  screenX: number;
  screenY: number;
  districtId?: string;
  buildingId?: string;
  title: string;
  subtitle: string;
  accentColor: string;
  badges: string[];
}

export interface SelectionState {
  type: 'district' | 'building' | 'plaza';
  districtId?: string;
  buildingId?: string;
}
