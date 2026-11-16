import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCityBlueprint } from '../../../src/domain/city/planning';
import type { GitHubProfilePayload } from '../../../src/domain/city/types';
import {
  makeCommit,
  makeDiversePayload,
  makePayload,
  makeRepo,
  makeUser,
} from '../../fixtures/github';

const NOW = new Date('2025-06-01T00:00:00.000Z');
const NOW_ISO = NOW.toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function distanceFromPlaza(d: { x: number; z: number }): number {
  return Math.abs(d.x) + Math.abs(d.z);
}

describe('buildCityBlueprint determinism', () => {
  it('produces deep-equal blueprints for the same payload at the same instant', () => {
    const payload = makeDiversePayload();
    const first = buildCityBlueprint(payload);
    const second = buildCityBlueprint(payload);

    expect(second).toEqual(first);
    expect(second.seed).toBe(first.seed);
    expect(second.timeline).toEqual(first.timeline);
    expect(second.districts).toEqual(first.districts);
  });

  it('bases the city seed on the login', () => {
    const a = buildCityBlueprint(makePayload({ user: makeUser({ login: 'ada' }) }));
    const b = buildCityBlueprint(makePayload({ user: makeUser({ login: 'grace' }) }));

    expect(a.seed).not.toBe(b.seed);
  });
});

describe('buildCityBlueprint districts and zoning', () => {
  it('turns every repo into exactly one district with unique ids', () => {
    const payload = makeDiversePayload();
    const blueprint = buildCityBlueprint(payload);

    expect(blueprint.districts).toHaveLength(payload.repos.length);
    expect(new Set(blueprint.districts.map((d) => d.id)).size).toBe(payload.repos.length);
    expect(new Set(blueprint.districts.map((d) => d.repo.id)).size).toBe(payload.repos.length);
    expect(blueprint.districts.map((d) => d.id).sort()).toEqual(
      payload.repos.map((r) => r.name).sort()
    );
  });

  it('assigns unique building ids across the whole city', () => {
    const blueprint = buildCityBlueprint(makeDiversePayload());
    const ids = blueprint.districts.flatMap((d) => d.buildings.map((b) => b.id));

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('places a heavily-starred flagship repo closer to the plaza than a tiny dormant repo', () => {
    const flagship = makeRepo({
      name: 'flagship-engine',
      description: 'Large flagship platform',
      language: 'TypeScript',
      languages: { TypeScript: 900_000 },
      stargazersCount: 45_000,
      forksCount: 4_200,
      size: 9_000,
      estimatedLOC: 250_000,
      createdAt: '2020-01-01T00:00:00.000Z',
      pushedAt: NOW_ISO,
    });
    const middling = makeRepo({
      name: 'middling-app',
      description: 'A normal sized application',
      stargazersCount: 120,
      forksCount: 8,
      size: 800,
      estimatedLOC: 8_000,
      createdAt: '2021-01-01T00:00:00.000Z',
      pushedAt: '2024-01-01T00:00:00.000Z',
    });
    const dormant = makeRepo({
      name: 'tiny-dormant',
      description: null,
      language: 'C',
      languages: { C: 4_000 },
      stargazersCount: 0,
      forksCount: 0,
      size: 5,
      estimatedLOC: 80,
      createdAt: '2018-01-01T00:00:00.000Z',
      pushedAt: '2019-01-01T00:00:00.000Z',
      commits: [],
      topics: [],
    });

    const blueprint = buildCityBlueprint(
      makePayload({ repos: [dormant, flagship, middling] })
    );

    const flagshipDistrict = blueprint.districts.find((d) => d.id === 'flagship-engine')!;
    const dormantDistrict = blueprint.districts.find((d) => d.id === 'tiny-dormant')!;

    expect(flagshipDistrict.tier).toBe('downtown');
    expect(distanceFromPlaza(flagshipDistrict)).toBeLessThan(
      distanceFromPlaza(dormantDistrict)
    );
  });
});

describe('buildCityBlueprint stats aggregation', () => {
  it('aggregates stars, forks, LOC and buildings from the payload', () => {
    const payload = makeDiversePayload();
    const blueprint = buildCityBlueprint(payload);

    expect(blueprint.stats.totalStars).toBe(
      payload.repos.reduce((sum, r) => sum + r.stargazersCount, 0)
    );
    expect(blueprint.stats.totalForks).toBe(
      payload.repos.reduce((sum, r) => sum + r.forksCount, 0)
    );
    expect(blueprint.stats.totalEstimatedLOC).toBeGreaterThan(0);
    expect(blueprint.stats.totalEstimatedLOC).toBe(
      blueprint.districts.reduce((sum, d) => sum + d.estimatedLOC, 0)
    );
    expect(blueprint.stats.totalBuildings).toBe(
      blueprint.districts.reduce((sum, d) => sum + d.buildings.length, 0)
    );
    expect(blueprint.stats.totalBuildings).toBeGreaterThan(0);
  });

  it('reports a language breakdown whose percentages total roughly 100', () => {
    const blueprint = buildCityBlueprint(makeDiversePayload());
    const breakdown = blueprint.stats.languageBreakdown;

    expect(breakdown.length).toBeGreaterThan(0);
    expect(breakdown.reduce((sum, l) => sum + l.percentage, 0)).toBeCloseTo(100, 0);
    for (const entry of breakdown) {
      expect(entry.percentage).toBeGreaterThan(0);
      expect(entry.bytes).toBeGreaterThan(0);
    }
  });
});

describe('buildCityBlueprint timeline and envelope', () => {
  it('has an ordered timeline with milestones', () => {
    const blueprint = buildCityBlueprint(makeDiversePayload());
    const { startTime, endTime, buckets, milestones } = blueprint.timeline;

    expect(startTime).toBeLessThanOrEqual(endTime);
    expect(milestones.length).toBeGreaterThan(0);
    expect(buckets.length).toBeGreaterThan(1);

    for (let i = 1; i < buckets.length; i++) {
      expect(buckets[i].time).toBeGreaterThan(buckets[i - 1].time);
      expect(buckets[i].count).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps the plaza and island envelope sane', () => {
    const blueprint = buildCityBlueprint(makeDiversePayload());

    expect(blueprint.islandRadius).toBeGreaterThan(0);
    expect(blueprint.plaza.radius).toBeGreaterThan(0);
    expect(blueprint.plaza.monumentHeight).toBeGreaterThanOrEqual(7.2);
    expect(blueprint.plaza.monumentHeight).toBeLessThanOrEqual(18.5);
    expect(blueprint.plaza.rings).toBeGreaterThanOrEqual(2);
    expect(blueprint.plaza.rings).toBeLessThanOrEqual(5);
    expect(blueprint.canalZ).toBeGreaterThan(0);
    expect(blueprint.roads.length).toBeGreaterThan(0);
  });
});

describe('buildCityBlueprint vitality edge cases', () => {
  it('marks an archived repo as heritage', () => {
    const blueprint = buildCityBlueprint(
      makePayload({
        repos: [
          makeRepo({
            name: 'archive-ward',
            archived: true,
            pushedAt: NOW_ISO,
          }),
        ],
      })
    );

    expect(blueprint.districts[0].vitality).toBe('heritage');
  });

  it('marks a repo pushed today as active', () => {
    const blueprint = buildCityBlueprint(
      makePayload({
        repos: [makeRepo({ name: 'fresh-repo', archived: false, pushedAt: NOW_ISO })],
      })
    );

    expect(blueprint.districts[0].vitality).toBe('active');
  });

  it('handles an empty repo list without throwing', () => {
    const blueprint = buildCityBlueprint(makePayload({ repos: [] }));

    expect(blueprint.districts).toEqual([]);
    expect(blueprint.stats.totalBuildings).toBe(0);
    expect(blueprint.stats.totalEstimatedLOC).toBe(0);
    expect(blueprint.stats.totalStars).toBe(0);
    expect(blueprint.timeline.milestones.length).toBeGreaterThan(0);
    expect(blueprint.islandRadius).toBeGreaterThan(0);
    expect(blueprint.climate.recommendedWeather).toMatch(/^(clear|mist|rain)$/);
  });
});

describe('buildCityBlueprint climate mapping', () => {
  it('gives an active profile a bright mood', () => {
    const repos = Array.from({ length: 4 }, (_, i) =>
      makeRepo({ name: `active-${i}`, pushedAt: NOW_ISO })
    );
    const blueprint = buildCityBlueprint(
      makePayload({
        repos,
        lastActivityAt: NOW_ISO,
        recentPushCount: 9,
      })
    );

    expect(['radiant', 'breezy']).toContain(blueprint.climate.mood);
    expect(blueprint.climate.recommendedTimeOfDay).toBeGreaterThanOrEqual(0);
    expect(blueprint.climate.recommendedTimeOfDay).toBeLessThanOrEqual(24);
    expect(['clear', 'mist', 'rain']).toContain(blueprint.climate.recommendedWeather);
  });

  it('gives a years-stale profile twilight mist', () => {
    const staleRepos = [
      makeRepo({
        name: 'ancient-a',
        pushedAt: '2016-05-01T00:00:00.000Z',
        archived: true,
        commits: [],
      }),
      makeRepo({
        name: 'ancient-b',
        pushedAt: '2017-02-01T00:00:00.000Z',
        commits: [],
      }),
    ];

    const blueprint = buildCityBlueprint(
      makePayload({
        repos: staleRepos,
        lastActivityAt: '2017-02-01T00:00:00.000Z',
        recentPushCount: 0,
      })
    );

    expect(blueprint.climate.mood).toBe('twilight_mist');
    expect(blueprint.climate.recommendedTimeOfDay).toBeGreaterThanOrEqual(0);
    expect(blueprint.climate.recommendedTimeOfDay).toBeLessThanOrEqual(24);
    expect(blueprint.climate.recommendedWeather).toBe('mist');
  });
});

// Guard against accidental mutation of the fixture contract used above.
it('fixtures produce the expected payload shape', () => {
  const payload: GitHubProfilePayload = makePayload({
    repos: [makeRepo({ name: 'shape-check', commits: [makeCommit()] })],
  });

  expect(payload.user.login).toBe('ada');
  expect(payload.repos[0].name).toBe('shape-check');
});
