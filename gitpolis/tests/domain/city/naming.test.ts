import { describe, expect, it } from 'vitest';
import {
  computeCityName,
  dominantCategory,
  extractTopicKeyword,
  formatLOCShort,
  generateBuildingName,
} from '../../../src/domain/city/naming';
import type { CommitCategory, StyleId } from '../../../src/domain/city/types';
import { ARCHITECTURAL_STYLES } from '../../../src/domain/city/styles';
import { SeededRNG } from '../../../src/domain/prng';
import { makeCommit } from '../../fixtures/github';

describe('formatLOCShort', () => {
  it.each([
    [0, '0 LOC'],
    [999, '999 LOC'],
    [1_500, '1.5k LOC'],
    [2_000_000, '2.0M LOC'],
  ])('formats %i as %s', (loc, expected) => {
    expect(formatLOCShort(loc)).toBe(expected);
  });
});

describe('dominantCategory', () => {
  it('returns init when there are no commits', () => {
    expect(dominantCategory([])).toBe('init');
  });

  it('picks the most frequent category', () => {
    const commits = [
      makeCommit({ category: 'fix' }),
      makeCommit({ category: 'feat' }),
      makeCommit({ category: 'fix' }),
      makeCommit({ category: 'docs' }),
      makeCommit({ category: 'fix' }),
    ];

    expect(dominantCategory(commits)).toBe('fix');
  });

  it('falls back to the first commit category when counts tie', () => {
    // 'chore' never receives the +0.4 tie-break bonus, so a feat/chore tie goes to feat.
    const commits = [
      makeCommit({ category: 'chore' }),
      makeCommit({ category: 'feat' }),
    ];

    expect(dominantCategory(commits)).toBe('feat');
  });

  it('returns a valid category for a single commit', () => {
    const category: CommitCategory = 'release';
    expect(dominantCategory([makeCommit({ category })])).toBe(category);
  });
});

describe('computeCityName', () => {
  const suffixes: Record<StyleId, string> = {
    typescript_glass: 'Bay',
    javascript_studio: 'Commons',
    python_botanical: 'Gardens',
    rust_foundry: 'Forgeport',
    go_nordic: 'Fjord',
    cpp_monolith: 'Citadel',
    java_artdeco: 'Heights',
    ruby_oldtown: 'Quarter',
    swift_pavilion: 'Park',
    web_canal: 'Canals',
    devops_port: 'Harbor',
    polyglot_library: 'Avenue',
  };

  it('is deterministic', () => {
    expect(computeCityName('ada', 'typescript_glass')).toEqual(
      computeCityName('ada', 'typescript_glass')
    );
  });

  it('builds the city name from the login and style suffix', () => {
    const result = computeCityName('ada', 'typescript_glass');

    expect(result.cityName).toBe('Ada Bay');
    expect(result.cityName.endsWith(suffixes.typescript_glass)).toBe(true);
  });

  it.each(Object.entries(suffixes) as Array<[StyleId, string]>)(
    'uses the %s suffix %s and mentions the style name',
    (styleId, suffix) => {
      const result = computeCityName('ada', styleId);

      expect(result.cityName.endsWith(` ${suffix}`)).toBe(true);
      expect(result.citySubtitle).toContain(ARCHITECTURAL_STYLES[styleId].styleName);
      expect(result.citySubtitle).toBe(`${ARCHITECTURAL_STYLES[styleId].styleName} Metropolis`);
      expect(result.archetypeSummary).toBe(ARCHITECTURAL_STYLES[styleId].description);
    }
  );

  it('turns hyphens and underscores into spaces', () => {
    expect(computeCityName('ada-lovelace', 'typescript_glass').cityName).toBe(
      'Ada lovelace Bay'
    );
    expect(computeCityName('ada_lovelace', 'typescript_glass').cityName).toBe(
      'Ada lovelace Bay'
    );
  });

  it('truncates long logins', () => {
    const login = 'abcdefghijklmnopqrstuvwxyz';
    const { cityName } = computeCityName(login, 'typescript_glass');

    expect(cityName).not.toContain(login);
    expect(cityName.startsWith('Abcdefghijklm ')).toBe(true);
    expect(cityName.length).toBeLessThanOrEqual(20);
  });
});

describe('extractTopicKeyword', () => {
  it('prefers a conventional-commit scope', () => {
    const keyword = extractTopicKeyword([
      makeCommit({ message: 'feat(canal): add lock' }),
    ]);

    expect(keyword).toBe('Canal');
  });

  it('capitalises the scope and strips punctuation', () => {
    expect(
      extractTopicKeyword([makeCommit({ message: 'fix(ledger!): repair totals' })])
    ).toBe('Ledger');
  });

  it('returns null when no useful keyword exists', () => {
    expect(extractTopicKeyword([])).toBeNull();
    expect(extractTopicKeyword([makeCommit({ message: 'chore: bump' })])).toBeNull();
    expect(
      extractTopicKeyword([makeCommit({ message: 'the and for with from that' })])
    ).toBeNull();
  });

  it('falls back to the most repeated meaningful word', () => {
    const keyword = extractTopicKeyword([
      makeCommit({ message: 'Refactor canal logic' }),
      makeCommit({ message: 'Polish canal render' }),
      makeCommit({ message: 'Tidy widgets' }),
    ]);

    expect(keyword).toBe('Canal');
  });
});

describe('generateBuildingName', () => {
  it('is deterministic for a fixed seed', () => {
    const commits = [makeCommit({ message: 'feat: add gizmo' })];
    const first = generateBuildingName('feat', 'rust_foundry', commits, 2, false, new SeededRNG(1234));
    const second = generateBuildingName('feat', 'rust_foundry', commits, 2, false, new SeededRNG(1234));

    expect(first).toBe(second);
  });

  it.each([
    ['typescript_glass', 'Terrace'],
    ['python_botanical', 'Solarium'],
    ['rust_foundry', 'Foundry'],
    ['go_nordic', 'Spire'],
  ] as Array<[StyleId, string]>)(
    'gives the hero building in %s the style first noun %s',
    (styleId, noun) => {
      const name = generateBuildingName('feat', styleId, [], 0, true, new SeededRNG(7));

      expect(name).toBe(`Central ${noun}`);
    }
  );

  it('reuses a commit keyword in the building name', () => {
    const name = generateBuildingName(
      'feat',
      'python_botanical',
      [makeCommit({ message: 'feat(canal): add lock' })],
      0,
      true,
      new SeededRNG(3)
    );

    expect(name).toBe('Canal Solarium');
  });

  it('uses a category prefix for a non-hero building without a keyword', () => {
    const name = generateBuildingName('feat', 'typescript_glass', [], 2, false, new SeededRNG(11));

    expect(name).toMatch(/^(Feature|Expansion|Skyline|Horizon) /);
  });
});
