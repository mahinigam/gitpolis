import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateMunicipalDecisionPlan } from '../../../src/domain/decision/validation';

const NOW = new Date('2025-06-01T12:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function validPlan() {
  return {
    id: 'plan_abc',
    generatedAt: 1_700_000_000_000,
    model: 'gemini-3.5-flash',
    citySummary: {
      civicTitle: 'Atelier of the Neural Horizon',
      foundingMotto: 'Ship small, learn fast',
      developerArchetype: 'The Core Architect',
      vitalityAssessment: 91,
      climateRationale: 'Frequent commits keep the skyline warm.',
      suggestedWeather: 'mist',
      suggestedTimeOfDay: 7.5,
    },
    districts: [
      {
        repoName: 'neural-lab',
        assignedZone: 'cybernetics_ai_biosphere',
        civicCritique: {
          prosperityScore: 88,
          fulfillmentScore: 76,
          municipalRole: 'Central Neural Observatory',
          architecturalFeatures: ['glass atrium', 'signal spire', 'roof garden'],
          urbanPlanningRationale: 'High commit velocity and a focused language stack.',
        },
      },
    ],
    interDistrictConnections: [
      {
        sourceRepo: 'neural-lab',
        targetRepo: 'edge-proxy',
        connectionType: 'hyperloop_arterial',
        synergyReason: 'Model serving calls the edge gateway.',
        bandwidthWeight: 4,
      },
    ],
    historicalChronicles: [
      {
        epochName: 'The First Compile',
        timeRange: '2016 - 2017',
        narrative: 'A single repository became a skyline.',
        monument: {
          name: 'Obelisk of Init',
          era: 'Founding',
          lore: 'Marks the first commit.',
          monumentType: 'obelisk',
        },
      },
    ],
  };
}

describe('validateMunicipalDecisionPlan — input rejection', () => {
  it.each([null, undefined, 0, 42, 'plan', true])('returns null for %j', (input) => {
    expect(validateMunicipalDecisionPlan(input, 'ada')).toBeNull();
  });

  it('returns null when a district entry crashes mapping', () => {
    // A null element makes the mapper dereference null; the validator must
    // contain the error instead of throwing into the caller.
    const plan = { ...validPlan(), districts: [null] };

    expect(validateMunicipalDecisionPlan(plan, 'ada')).toBeNull();
  });
});

describe('validateMunicipalDecisionPlan — defaults', () => {
  it('fills a complete plan from an empty object', () => {
    const plan = validateMunicipalDecisionPlan({}, 'ada');

    expect(plan).not.toBeNull();
    expect(plan?.username).toBe('ada');
    expect(plan?.id).toBe(`plan_${NOW.getTime()}`);
    expect(plan?.generatedAt).toBe(NOW.getTime());
    expect(plan?.model).toBe('gemini-3.5-flash');
    expect(plan?.citySummary).toEqual({
      civicTitle: 'Metropolis of @ada',
      foundingMotto: 'Engineered with Precision & Vision',
      developerArchetype: 'The Polyglot Artisan',
      vitalityAssessment: 85,
      climateRationale: 'Reflecting continuous architectural momentum and code commits.',
      suggestedWeather: 'clear',
      suggestedTimeOfDay: 14.5,
    });
    expect(plan?.districts).toEqual([]);
    expect(plan?.interDistrictConnections).toEqual([]);
    expect(plan?.historicalChronicles).toEqual([]);
  });

  it('replaces blank and non-string text with fallbacks', () => {
    const plan = validateMunicipalDecisionPlan(
      {
        citySummary: {
          civicTitle: '   ',
          foundingMotto: 42,
          climateRationale: null,
        },
      },
      'ada'
    );

    expect(plan?.citySummary.civicTitle).toBe('Metropolis of @ada');
    expect(plan?.citySummary.foundingMotto).toBe('Engineered with Precision & Vision');
    expect(plan?.citySummary.climateRationale).toBe(
      'Reflecting continuous architectural momentum and code commits.'
    );
  });

  it('falls back to safe enum values for unknown members', () => {
    const plan = validateMunicipalDecisionPlan(
      {
        citySummary: {
          developerArchetype: 'The Unknown',
          suggestedWeather: 'snow',
        },
        districts: [{ repoName: 'x', assignedZone: 'moon_base' }],
        interDistrictConnections: [{ connectionType: 'teleport' }],
        historicalChronicles: [{ monument: { monumentType: 'pyramid' } }],
      },
      'ada'
    );

    expect(plan?.citySummary.developerArchetype).toBe('The Polyglot Artisan');
    expect(plan?.citySummary.suggestedWeather).toBe('clear');
    expect(plan?.districts[0].assignedZone).toBe('downtown_financial_core');
    expect(plan?.interDistrictConnections[0].connectionType).toBe('elevated_rail');
    expect(plan?.historicalChronicles[0].monument.monumentType).toBe('obelisk');
  });
});

describe('validateMunicipalDecisionPlan — clamping', () => {
  it.each([
    [-50, 0],
    [0, 0],
    [55.5, 55.5],
    [100, 100],
    [250, 100],
  ])('clamps vitality %j to %j', (input, expected) => {
    const plan = validateMunicipalDecisionPlan(
      { citySummary: { vitalityAssessment: input } },
      'ada'
    );

    expect(plan?.citySummary.vitalityAssessment).toBe(expected);
  });

  it('uses the fallback for non-numeric scores', () => {
    const plan = validateMunicipalDecisionPlan(
      {
        citySummary: { vitalityAssessment: 'excellent', suggestedTimeOfDay: 'late' },
        districts: [
          {
            repoName: 'x',
            civicCritique: { prosperityScore: {}, fulfillmentScore: 'high' },
          },
        ],
        interDistrictConnections: [{ bandwidthWeight: 'heavy' }],
      },
      'ada'
    );

    expect(plan?.citySummary.vitalityAssessment).toBe(85);
    expect(plan?.citySummary.suggestedTimeOfDay).toBe(14.5);
    expect(plan?.districts[0].civicCritique.prosperityScore).toBe(50);
    expect(plan?.districts[0].civicCritique.fulfillmentScore).toBe(50);
    expect(plan?.interDistrictConnections[0].bandwidthWeight).toBe(2);
  });

  it('clamps the requested time of day to 0..24', () => {
    expect(
      validateMunicipalDecisionPlan({ citySummary: { suggestedTimeOfDay: -3 } }, 'ada')?.citySummary
        .suggestedTimeOfDay
    ).toBe(0);
    expect(
      validateMunicipalDecisionPlan({ citySummary: { suggestedTimeOfDay: 26 } }, 'ada')?.citySummary
        .suggestedTimeOfDay
    ).toBe(24);
  });
});

describe('validateMunicipalDecisionPlan — nested entries', () => {
  it('preserves a fully valid plan', () => {
    const input = validPlan();
    const plan = validateMunicipalDecisionPlan(input, 'ada');

    expect(plan).toMatchObject({
      id: 'plan_abc',
      username: 'ada',
      generatedAt: 1_700_000_000_000,
      model: 'gemini-3.5-flash',
      citySummary: input.citySummary,
      districts: input.districts,
      interDistrictConnections: input.interDistrictConnections,
      historicalChronicles: input.historicalChronicles,
    });
  });

  it('stringifies repo names and truncates architectural features to three', () => {
    const plan = validateMunicipalDecisionPlan(
      {
        districts: [
          {
            repoName: 123,
            civicCritique: {
              architecturalFeatures: ['one', 'two', 'three', 'four', 'five'],
            },
          },
        ],
      },
      'ada'
    );

    expect(plan?.districts[0].repoName).toBe('123');
    expect(plan?.districts[0].civicCritique.architecturalFeatures).toEqual([
      'one',
      'two',
      'three',
    ]);
  });

  it('turns non-array architectural features into the default feature', () => {
    const plan = validateMunicipalDecisionPlan(
      { districts: [{ repoName: 'x', civicCritique: { architecturalFeatures: 'tower' } }] },
      'ada'
    );

    expect(plan?.districts[0].civicCritique.architecturalFeatures).toEqual([
      'Standard Architecture',
    ]);
  });

  it('fills missing district, transit and chronicle fields', () => {
    const plan = validateMunicipalDecisionPlan(
      {
        districts: [{}],
        interDistrictConnections: [{}],
        historicalChronicles: [{}],
      },
      'ada'
    );

    expect(plan?.districts[0]).toEqual({
      repoName: '',
      assignedZone: 'downtown_financial_core',
      civicCritique: {
        prosperityScore: 50,
        fulfillmentScore: 50,
        municipalRole: 'Municipal Repository Block',
        architecturalFeatures: ['Standard Architecture'],
        urbanPlanningRationale: 'Categorized according to repo stats and software topology.',
      },
    });

    expect(plan?.interDistrictConnections[0]).toEqual({
      sourceRepo: '',
      targetRepo: '',
      connectionType: 'elevated_rail',
      synergyReason: 'Shared technology and contributor synergy.',
      bandwidthWeight: 2,
    });

    expect(plan?.historicalChronicles[0]).toEqual({
      epochName: 'Founding Epoch',
      timeRange: 'Genesis',
      narrative: 'The city expanded through continuous innovation.',
      monument: {
        name: 'Monument of Founding',
        era: 'Initial Era',
        lore: 'Honoring the first code push.',
        monumentType: 'obelisk',
      },
    });
  });

  it('clamps bandwidth weight to 1..5', () => {
    const low = validateMunicipalDecisionPlan(
      { interDistrictConnections: [{ bandwidthWeight: -4 }] },
      'ada'
    );
    const high = validateMunicipalDecisionPlan(
      { interDistrictConnections: [{ bandwidthWeight: 99 }] },
      'ada'
    );

    expect(low?.interDistrictConnections[0].bandwidthWeight).toBe(1);
    expect(high?.interDistrictConnections[0].bandwidthWeight).toBe(5);
  });

  it('falls back for empty strings inside chronicles', () => {
    const plan = validateMunicipalDecisionPlan(
      {
        historicalChronicles: [
          {
            epochName: '',
            timeRange: '',
            narrative: '',
            monument: { name: '', era: '', lore: '' },
          },
        ],
      },
      'ada'
    );

    // Empty strings are strings, so they are preserved; only non-strings fall back.
    expect(plan?.historicalChronicles[0].epochName).toBe('');
    expect(plan?.historicalChronicles[0].monument.name).toBe('');
  });

  it('ignores unknown extra properties', () => {
    const plan = validateMunicipalDecisionPlan(
      { ...validPlan(), injected: '<script>alert(1)</script>' },
      'ada'
    );

    expect(plan).not.toBeNull();
    expect(Object.keys(plan as object)).not.toContain('injected');
  });
});
