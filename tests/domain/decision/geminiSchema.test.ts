import { describe, expect, it } from 'vitest';
import { MUNICIPAL_DECISION_JSON_SCHEMA } from '../../../src/domain/decision/geminiSchema';
import {
  DEVELOPER_ARCHETYPES,
  MONUMENT_TYPES,
  MUNICIPAL_ZONES,
  TRANSIT_TYPES,
  WEATHER_MODES,
} from '../../../src/domain/decision/types';

/**
 * The schema is the contract sent to Gemini. These tests pin the invariants
 * that keep the schema, the runtime validator and the TypeScript types aligned.
 */

function propertiesOf(node: { properties?: Record<string, unknown> }) {
  return Object.keys(node.properties ?? {});
}

describe('MUNICIPAL_DECISION_JSON_SCHEMA — top level', () => {
  it('requires all four sections', () => {
    expect(MUNICIPAL_DECISION_JSON_SCHEMA.required).toEqual([
      'citySummary',
      'districts',
      'interDistrictConnections',
      'historicalChronicles',
    ]);
    expect(propertiesOf(MUNICIPAL_DECISION_JSON_SCHEMA)).toEqual([
      'citySummary',
      'districts',
      'interDistrictConnections',
      'historicalChronicles',
    ]);
  });

  it('uses Gemini OpenAPI type names', () => {
    const schema = MUNICIPAL_DECISION_JSON_SCHEMA;

    expect(schema.type).toBe('OBJECT');
    expect(schema.properties.citySummary.type).toBe('OBJECT');
    expect(schema.properties.districts.type).toBe('ARRAY');
    expect(schema.properties.districts.items.type).toBe('OBJECT');
    expect(schema.properties.interDistrictConnections.type).toBe('ARRAY');
    expect(schema.properties.historicalChronicles.type).toBe('ARRAY');
  });
});

describe('MUNICIPAL_DECISION_JSON_SCHEMA — enums', () => {
  it('mirrors the developer archetypes', () => {
    expect(MUNICIPAL_DECISION_JSON_SCHEMA.properties.citySummary.properties.developerArchetype.enum).toEqual([
      ...DEVELOPER_ARCHETYPES,
    ]);
  });

  it('mirrors the weather modes', () => {
    expect(MUNICIPAL_DECISION_JSON_SCHEMA.properties.citySummary.properties.suggestedWeather.enum).toEqual([
      ...WEATHER_MODES,
    ]);
  });

  it('mirrors the municipal zones', () => {
    expect(
      MUNICIPAL_DECISION_JSON_SCHEMA.properties.districts.items.properties.assignedZone.enum
    ).toEqual([...MUNICIPAL_ZONES]);
  });

  it('mirrors the transit types', () => {
    expect(
      MUNICIPAL_DECISION_JSON_SCHEMA.properties.interDistrictConnections.items.properties
        .connectionType.enum
    ).toEqual([...TRANSIT_TYPES]);
  });

  it('mirrors the monument types', () => {
    expect(
      MUNICIPAL_DECISION_JSON_SCHEMA.properties.historicalChronicles.items.properties.monument
        .properties.monumentType.enum
    ).toEqual([...MONUMENT_TYPES]);
  });

  it('has no duplicate enum members', () => {
    for (const allowed of [DEVELOPER_ARCHETYPES, MUNICIPAL_ZONES, TRANSIT_TYPES, MONUMENT_TYPES]) {
      expect(new Set(allowed).size, allowed.join(', ')).toBe(allowed.length);
    }
  });
});

describe('MUNICIPAL_DECISION_JSON_SCHEMA — required fields', () => {
  it('requires every city-summary property', () => {
    expect(MUNICIPAL_DECISION_JSON_SCHEMA.properties.citySummary.required).toEqual(
      propertiesOf(MUNICIPAL_DECISION_JSON_SCHEMA.properties.citySummary)
    );
  });

  it('requires every district property and critique property', () => {
    const district = MUNICIPAL_DECISION_JSON_SCHEMA.properties.districts.items;

    expect(district.required).toEqual(propertiesOf(district));
    expect(district.properties.civicCritique.required).toEqual(
      propertiesOf(district.properties.civicCritique)
    );
  });

  it('requires every transit property', () => {
    const connection = MUNICIPAL_DECISION_JSON_SCHEMA.properties.interDistrictConnections.items;

    expect(connection.required).toEqual(propertiesOf(connection));
  });

  it('requires every chronicle and monument property', () => {
    const chronicle = MUNICIPAL_DECISION_JSON_SCHEMA.properties.historicalChronicles.items;

    expect(chronicle.required).toEqual(propertiesOf(chronicle));
    expect(chronicle.properties.monument.required).toEqual(
      propertiesOf(chronicle.properties.monument)
    );
  });

  it('marks bounded numeric fields with matching descriptions', () => {
    const summary = MUNICIPAL_DECISION_JSON_SCHEMA.properties.citySummary.properties;
    const connection = MUNICIPAL_DECISION_JSON_SCHEMA.properties.interDistrictConnections.items
      .properties;

    expect(summary.vitalityAssessment.type).toBe('INTEGER');
    expect(summary.vitalityAssessment.description).toContain('0 to 100');
    expect(summary.suggestedTimeOfDay.type).toBe('NUMBER');
    expect(connection.bandwidthWeight.description).toContain('1 to 5');
  });
});
