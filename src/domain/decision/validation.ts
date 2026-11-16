import type {
  CitySummaryDecision,
  DistrictDecision,
  HistoricalChronicle,
  InterDistrictConnection,
  MunicipalDecisionPlan,
} from './types';
import {
  DEVELOPER_ARCHETYPES,
  MONUMENT_TYPES,
  MUNICIPAL_ZONES,
  TRANSIT_TYPES,
  WEATHER_MODES,
} from './types';

/** Clamp a numeric field into a range, with a fallback when it is not a number. */
function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function oneOf<T extends readonly string[]>(allowed: T, value: unknown, fallback: T[number]): T[number] {
  return allowed.includes(value as T[number]) ? (value as T[number]) : fallback;
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
      civicTitle: stringOr(rawSum.civicTitle, `Metropolis of @${username}`),
      foundingMotto: stringOr(rawSum.foundingMotto, 'Engineered with Precision & Vision'),
      developerArchetype: oneOf(DEVELOPER_ARCHETYPES, rawSum.developerArchetype, 'The Polyglot Artisan'),
      vitalityAssessment: clampNumber(rawSum.vitalityAssessment, 0, 100, 85),
      climateRationale: stringOr(
        rawSum.climateRationale,
        'Reflecting continuous architectural momentum and code commits.'
      ),
      suggestedWeather: oneOf(WEATHER_MODES, rawSum.suggestedWeather, 'clear'),
      suggestedTimeOfDay: clampNumber(rawSum.suggestedTimeOfDay, 0, 24, 14.5),
    };

    const districts: DistrictDecision[] = Array.isArray(raw.districts)
      ? raw.districts.map((d: any) => ({
          repoName: String(d.repoName || ''),
          assignedZone: oneOf(MUNICIPAL_ZONES, d.assignedZone, 'downtown_financial_core'),
          civicCritique: {
            prosperityScore: clampNumber(d.civicCritique?.prosperityScore, 0, 100, 50),
            fulfillmentScore: clampNumber(d.civicCritique?.fulfillmentScore, 0, 100, 50),
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
          connectionType: oneOf(TRANSIT_TYPES, c.connectionType, 'elevated_rail'),
          synergyReason: typeof c.synergyReason === 'string'
            ? c.synergyReason
            : 'Shared technology and contributor synergy.',
          bandwidthWeight: clampNumber(c.bandwidthWeight, 1, 5, 2),
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
            monumentType: oneOf(MONUMENT_TYPES, h.monument?.monumentType, 'obelisk'),
          },
        }))
      : [];

    return {
      id: raw.id || `plan_${Date.now()}`,
      username,
      generatedAt: Number(raw.generatedAt) || Date.now(),
      model: raw.model || 'gemini-3.5-flash',
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
