/**
 * Strictly Typed Schema Contract for Google Gemini Decision API in GitPolis
 */

export type DeveloperArchetype =
  | 'The Core Architect'
  | 'The Polyglot Artisan'
  | 'The Distributed Systems Engineer'
  | 'The Research Synthesist'
  | 'The Open-Source Citizen'
  | 'The Full-Stack Innovator';

export type MunicipalZone =
  | 'downtown_financial_core'
  | 'cybernetics_ai_biosphere'
  | 'logistics_cloud_docks'
  | 'civic_arts_district'
  | 'ancient_heritage_quarter';

export type TransitType =
  | 'hyperloop_arterial'
  | 'waterfront_ferry'
  | 'elevated_rail'
  | 'pedestrian_boulevard';

export interface CitySummaryDecision {
  civicTitle: string;
  foundingMotto: string;
  developerArchetype: DeveloperArchetype;
  vitalityAssessment: number; // 0 - 100
  climateRationale: string;
  suggestedWeather: 'clear' | 'mist' | 'rain';
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
  monumentType: 'obelisk' | 'triumphal_arch' | 'beacon_spire' | 'atrium_dome';
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

/**
 * Robust runtime validator with fallbacks for 100% type safety
 */
export function validateMunicipalDecisionPlan(data: unknown, username: string): MunicipalDecisionPlan | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, any>;

  try {
    const rawSum = raw.citySummary || {};
    const citySummary: CitySummaryDecision = {
      civicTitle: typeof rawSum.civicTitle === 'string' && rawSum.civicTitle.trim()
        ? rawSum.civicTitle
        : `Metropolis of @${username}`,
      foundingMotto: typeof rawSum.foundingMotto === 'string' && rawSum.foundingMotto.trim()
        ? rawSum.foundingMotto
        : 'Engineered with Precision & Vision',
      developerArchetype: [
        'The Core Architect',
        'The Polyglot Artisan',
        'The Distributed Systems Engineer',
        'The Research Synthesist',
        'The Open-Source Citizen',
        'The Full-Stack Innovator',
      ].includes(rawSum.developerArchetype)
        ? rawSum.developerArchetype
        : 'The Polyglot Artisan',
      vitalityAssessment: Math.max(0, Math.min(100, Number(rawSum.vitalityAssessment) || 85)),
      climateRationale: typeof rawSum.climateRationale === 'string'
        ? rawSum.climateRationale
        : 'Reflecting continuous architectural momentum and code commits.',
      suggestedWeather: ['clear', 'mist', 'rain'].includes(rawSum.suggestedWeather)
        ? rawSum.suggestedWeather
        : 'clear',
      suggestedTimeOfDay: typeof rawSum.suggestedTimeOfDay === 'number' && !isNaN(rawSum.suggestedTimeOfDay)
        ? Math.max(0, Math.min(24, rawSum.suggestedTimeOfDay))
        : 14.5,
    };

    const districts: DistrictDecision[] = Array.isArray(raw.districts)
      ? raw.districts.map((d: any) => ({
          repoName: String(d.repoName || ''),
          assignedZone: [
            'downtown_financial_core',
            'cybernetics_ai_biosphere',
            'logistics_cloud_docks',
            'civic_arts_district',
            'ancient_heritage_quarter',
          ].includes(d.assignedZone)
            ? d.assignedZone
            : 'downtown_financial_core',
          civicCritique: {
            prosperityScore: Math.max(0, Math.min(100, Number(d.civicCritique?.prosperityScore) || 50)),
            fulfillmentScore: Math.max(0, Math.min(100, Number(d.civicCritique?.fulfillmentScore) || 50)),
            municipalRole: typeof d.civicCritique?.municipalRole === 'string'
              ? d.civicCritique.municipalRole
              : 'Municipal Repository Block',
            architecturalFeatures: Array.isArray(d.civicCritique?.architecturalFeatures)
              ? d.civicCritique.architecturalFeatures.map(String).slice(0, 3)
              : ['Standard Architecture'],
            urbanPlanningRationale: typeof d.civicCritique?.urbanPlanningRationale === 'string'
              ? d.civicCritique.urbanPlanningRationale
              : 'Categorized according to repo stats and software topology.',
          },
        }))
      : [];

    const interDistrictConnections: InterDistrictConnection[] = Array.isArray(raw.interDistrictConnections)
      ? raw.interDistrictConnections.map((c: any) => ({
          sourceRepo: String(c.sourceRepo || ''),
          targetRepo: String(c.targetRepo || ''),
          connectionType: [
            'hyperloop_arterial',
            'waterfront_ferry',
            'elevated_rail',
            'pedestrian_boulevard',
          ].includes(c.connectionType)
            ? c.connectionType
            : 'elevated_rail',
          synergyReason: typeof c.synergyReason === 'string'
            ? c.synergyReason
            : 'Shared technology and contributor synergy.',
          bandwidthWeight: Math.max(1, Math.min(5, Number(c.bandwidthWeight) || 2)),
        }))
      : [];

    const historicalChronicles: HistoricalChronicle[] = Array.isArray(raw.historicalChronicles)
      ? raw.historicalChronicles.map((h: any) => ({
          epochName: typeof h.epochName === 'string' ? h.epochName : 'Founding Epoch',
          timeRange: typeof h.timeRange === 'string' ? h.timeRange : 'Genesis',
          narrative: typeof h.narrative === 'string' ? h.narrative : 'The city expanded through continuous innovation.',
          monument: {
            name: typeof h.monument?.name === 'string' ? h.monument.name : 'Monument of Founding',
            era: typeof h.monument?.era === 'string' ? h.monument.era : 'Initial Era',
            lore: typeof h.monument?.lore === 'string' ? h.monument.lore : 'Honoring the first code push.',
            monumentType: [
              'obelisk',
              'triumphal_arch',
              'beacon_spire',
              'atrium_dome',
            ].includes(h.monument?.monumentType)
              ? h.monument.monumentType
              : 'obelisk',
          },
        }))
      : [];

    return {
      id: raw.id || `plan_${Date.now()}`,
      username,
      generatedAt: Number(raw.generatedAt) || Date.now(),
      model: raw.model || 'gemini-2.0-flash',
      citySummary,
      districts,
      interDistrictConnections,
      historicalChronicles,
    };
  } catch (err) {
    console.error('[Decision Plan Validator] Validation error:', err);
    return null;
  }
}
