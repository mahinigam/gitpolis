import {
  DEVELOPER_ARCHETYPES,
  MONUMENT_TYPES,
  MUNICIPAL_ZONES,
  TRANSIT_TYPES,
  WEATHER_MODES,
} from './types';

/**
 * OpenAPI-compatible JSON schema for Gemini's `responseSchema` field.
 *
 * Kept in the domain layer so both the browser client and the optional
 * server-side proxy send an identical contract to the model. Enums are
 * imported from `types.ts` so there is exactly one source of truth.
 */
export const MUNICIPAL_DECISION_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    citySummary: {
      type: 'OBJECT',
      properties: {
        civicTitle: {
          type: 'STRING',
          description: "Poetic city name for this developer, e.g. 'Atelier of the Neural Horizon'",
        },
        foundingMotto: {
          type: 'STRING',
          description: "Inspiring civic motto capturing the developer's coding ethos",
        },
        developerArchetype: {
          type: 'STRING',
          enum: [...DEVELOPER_ARCHETYPES],
        },
        vitalityAssessment: {
          type: 'INTEGER',
          description: '0 to 100 developer vitality score',
        },
        climateRationale: {
          type: 'STRING',
          description: 'Explanation for the atmospheric climate based on commit rhythms',
        },
        suggestedWeather: {
          type: 'STRING',
          enum: [...WEATHER_MODES],
        },
        suggestedTimeOfDay: {
          type: 'NUMBER',
          description: 'Recommended solar time between 0 and 24',
        },
      },
      required: [
        'civicTitle',
        'foundingMotto',
        'developerArchetype',
        'vitalityAssessment',
        'climateRationale',
        'suggestedWeather',
        'suggestedTimeOfDay',
      ],
    },
    districts: {
      type: 'ARRAY',
      description: 'Zoning assignments and civic appraisal for each repository',
      items: {
        type: 'OBJECT',
        properties: {
          repoName: { type: 'STRING' },
          assignedZone: {
            type: 'STRING',
            enum: [...MUNICIPAL_ZONES],
          },
          civicCritique: {
            type: 'OBJECT',
            properties: {
              prosperityScore: { type: 'INTEGER', description: '0 to 100 prosperity score' },
              fulfillmentScore: { type: 'INTEGER', description: '0 to 100 fulfillment score' },
              municipalRole: {
                type: 'STRING',
                description: "Civic title, e.g. 'Central Neural Observatory'",
              },
              architecturalFeatures: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: 'Up to 3 distinctive architectural elements',
              },
              urbanPlanningRationale: { type: 'STRING' },
            },
            required: [
              'prosperityScore',
              'fulfillmentScore',
              'municipalRole',
              'architecturalFeatures',
              'urbanPlanningRationale',
            ],
          },
        },
        required: ['repoName', 'assignedZone', 'civicCritique'],
      },
    },
    interDistrictConnections: {
      type: 'ARRAY',
      description: 'Semantic transit links between repositories that communicate or share synergy',
      items: {
        type: 'OBJECT',
        properties: {
          sourceRepo: { type: 'STRING' },
          targetRepo: { type: 'STRING' },
          connectionType: {
            type: 'STRING',
            enum: [...TRANSIT_TYPES],
          },
          synergyReason: { type: 'STRING', description: 'Why these two repos are linked' },
          bandwidthWeight: { type: 'INTEGER', description: 'Traffic weight from 1 to 5' },
        },
        required: ['sourceRepo', 'targetRepo', 'connectionType', 'synergyReason', 'bandwidthWeight'],
      },
    },
    historicalChronicles: {
      type: 'ARRAY',
      description: '3 to 4 historical epochs synthesized from the developer git history',
      items: {
        type: 'OBJECT',
        properties: {
          epochName: { type: 'STRING', description: "E.g. 'The Great Monolith Dismantling'" },
          timeRange: { type: 'STRING', description: "E.g. '2022 - 2023'" },
          narrative: { type: 'STRING', description: 'Historical story of this coding era' },
          monument: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING' },
              era: { type: 'STRING' },
              lore: { type: 'STRING' },
              monumentType: {
                type: 'STRING',
                enum: [...MONUMENT_TYPES],
              },
            },
            required: ['name', 'era', 'lore', 'monumentType'],
          },
        },
        required: ['epochName', 'timeRange', 'narrative', 'monument'],
      },
    },
  },
  required: ['citySummary', 'districts', 'interDistrictConnections', 'historicalChronicles'],
} as const;
