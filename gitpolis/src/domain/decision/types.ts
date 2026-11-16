/**
 * Strictly Typed Schema Contract for Google Gemini Decision API in GitPolis
 */

export const DEVELOPER_ARCHETYPES = [
  'The Core Architect',
  'The Polyglot Artisan',
  'The Distributed Systems Engineer',
  'The Research Synthesist',
  'The Open-Source Citizen',
  'The Full-Stack Innovator',
] as const;

export const MUNICIPAL_ZONES = [
  'downtown_financial_core',
  'cybernetics_ai_biosphere',
  'logistics_cloud_docks',
  'civic_arts_district',
  'ancient_heritage_quarter',
] as const;

export const TRANSIT_TYPES = [
  'hyperloop_arterial',
  'waterfront_ferry',
  'elevated_rail',
  'pedestrian_boulevard',
] as const;

export const MONUMENT_TYPES = [
  'obelisk',
  'triumphal_arch',
  'beacon_spire',
  'atrium_dome',
] as const;

export const WEATHER_MODES = ['clear', 'mist', 'rain'] as const;

/** Derived from the runtime array so schema, validator and types cannot drift. */
export type DeveloperArchetype = (typeof DEVELOPER_ARCHETYPES)[number];

export type MunicipalZone = (typeof MUNICIPAL_ZONES)[number];

export type TransitType = (typeof TRANSIT_TYPES)[number];

export interface CitySummaryDecision {
  civicTitle: string;
  foundingMotto: string;
  developerArchetype: DeveloperArchetype;
  vitalityAssessment: number; // 0 - 100
  climateRationale: string;
  suggestedWeather: (typeof WEATHER_MODES)[number];
  suggestedTimeOfDay: number; // 0 - 24
}

export interface DistrictCivicCritique {
  prosperityScore: number; // 0 - 100
  fulfillmentScore: number; // 0 - 100
  municipalRole: string;
  architecturalFeatures: string[];
  urbanPlanningRationale: string;
}

export interface DistrictDecision {
  repoName: string;
  assignedZone: MunicipalZone;
  civicCritique: DistrictCivicCritique;
}

export interface InterDistrictConnection {
  sourceRepo: string;
  targetRepo: string;
  connectionType: TransitType;
  synergyReason: string;
  bandwidthWeight: number; // 1 - 5
}

export interface LandmarkMonument {
  name: string;
  era: string;
  lore: string;
  monumentType: (typeof MONUMENT_TYPES)[number];
}

export interface HistoricalChronicle {
  epochName: string;
  timeRange: string;
  narrative: string;
  monument: LandmarkMonument;
}

export interface MunicipalDecisionPlan {
  id: string;
  username: string;
  generatedAt: number;
  model: string;
  citySummary: CitySummaryDecision;
  districts: DistrictDecision[];
  interDistrictConnections: InterDistrictConnection[];
  historicalChronicles: HistoricalChronicle[];
}
