import type { MunicipalDecisionPlan } from '../../src/domain/decision';

export function makeDecisionPlan(overrides: Partial<MunicipalDecisionPlan> = {}): MunicipalDecisionPlan {
  return {
    id: 'plan_test',
    username: 'ada',
    generatedAt: 1_700_000_000_000,
    model: 'gemini-2.5-flash',
    citySummary: {
      civicTitle: 'The Analytical Atrium',
      foundingMotto: 'Compute with intent',
      developerArchetype: 'The Core Architect',
      vitalityAssessment: 78,
      climateRationale: 'Consistent weekly pushes over two years.',
      suggestedWeather: 'clear',
      suggestedTimeOfDay: 14.2,
    },
    districts: [
      {
        repoName: 'neural-lab',
        assignedZone: 'cybernetics_ai_biosphere',
        civicCritique: {
          prosperityScore: 82,
          fulfillmentScore: 74,
          municipalRole: 'Central Neural Observatory',
          architecturalFeatures: ['Holographic dome', 'Fiber optic spire'],
          urbanPlanningRationale: 'High-signal ML research cluster.',
        },
      },
    ],
    interDistrictConnections: [
      {
        sourceRepo: 'neural-lab',
        targetRepo: 'edge-proxy',
        connectionType: 'elevated_rail',
        synergyReason: 'Model serving over the edge network.',
        bandwidthWeight: 4,
      },
    ],
    historicalChronicles: [
      {
        epochName: 'The Founding',
        timeRange: '2012 - 2015',
        narrative: 'First experiments with analytical engines.',
        monument: {
          name: 'Monument of the First Commit',
          era: 'Genesis',
          lore: 'Marks the initial push.',
          monumentType: 'obelisk',
        },
      },
    ],
    ...overrides,
  };
}
