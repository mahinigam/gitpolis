import { describe, expect, it } from 'vitest';
import {
  classifyRepoDomain,
  computeDistrictProsperity,
} from '../../../src/domain/city/analysis';
import type { RepoDomainId } from '../../../src/domain/city/types';
import { makeCommit, makeRepo } from '../../fixtures/github';

describe('classifyRepoDomain', () => {
  const cases: Array<{ label: string; expected: RepoDomainId; repo: ReturnType<typeof makeRepo> }> = [
    {
      label: 'AI / LLM research',
      expected: 'ai_ml',
      repo: makeRepo({
        name: 'pytorch-llm-lab',
        description: 'Transformer training experiments',
        language: 'Python',
        topics: ['pytorch', 'llm'],
      }),
    },
    {
      label: 'systems / cloud infrastructure',
      expected: 'systems_cloud',
      repo: makeRepo({
        name: 'kubernetes-cluster',
        description: 'Docker orchestration and cluster scheduling',
        language: 'Dockerfile',
        topics: ['kubernetes', 'docker'],
      }),
    },
    {
      label: 'web frontend',
      expected: 'web_frontend',
      repo: makeRepo({
        name: 'react-design-system',
        description: 'React component library with Tailwind',
        language: 'CSS',
        topics: ['react', 'css', 'design-system'],
      }),
    },
    {
      label: 'mobile',
      expected: 'mobile',
      repo: makeRepo({
        name: 'swift-ios-app',
        description: 'Native iOS application',
        language: 'Swift',
        topics: ['ios', 'swiftui'],
      }),
    },
    {
      label: 'data science',
      expected: 'data_science',
      repo: makeRepo({
        name: 'pandas-notebook',
        description: 'Statistical analysis and dataframes',
        language: 'Jupyter Notebook',
        topics: ['pandas', 'data-science'],
      }),
    },
    {
      label: 'security / crypto',
      expected: 'security_crypto',
      repo: makeRepo({
        name: 'crypto-vault',
        description: 'Cryptographic audit and encryption primitives',
        language: 'Rust',
        topics: ['security', 'cryptography'],
      }),
    },
    {
      label: 'gaming / graphics',
      expected: 'gaming_graphics',
      repo: makeRepo({
        name: 'voxel-game',
        description: 'WebGL 3D game engine with shaders',
        language: 'JavaScript',
        topics: ['game', 'threejs', 'webgl'],
      }),
    },
    {
      label: 'developer tooling',
      expected: 'devtools_cli',
      repo: makeRepo({
        name: 'cli-toolkit',
        description: 'Developer tooling and command line helpers',
        language: 'TypeScript',
        topics: ['cli', 'developer-tools'],
      }),
    },
    {
      label: 'opaque general-purpose repo',
      expected: 'general',
      repo: makeRepo({
        name: 'atlas-notes',
        description: 'Personal notes and snippets',
        language: 'Perl',
        topics: [],
      }),
    },
  ];

  it.each(cases)('classifies $label as $expected', ({ expected, repo }) => {
    const info = classifyRepoDomain(repo);

    expect(info.id).toBe(expected);
    expect(info.label.length).toBeGreaterThan(0);
    expect(info.shortLabel.length).toBeGreaterThan(0);
    expect(info.badgeColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(info.architecturalFeature.length).toBeGreaterThan(0);
  });

  it('is insensitive to topic casing', () => {
    const info = classifyRepoDomain(
      makeRepo({ name: 'anything', description: '', topics: ['MACHINE-LEARNING'] })
    );

    expect(info.id).toBe('ai_ml');
  });

  it('is deterministic for the same repo', () => {
    const repo = makeRepo({ name: 'ledger', topics: ['security'] });
    expect(classifyRepoDomain(repo)).toEqual(classifyRepoDomain(repo));
  });
});

describe('computeDistrictProsperity', () => {
  it('keeps both scores inside [0, 100] across extreme inputs', () => {
    const repos = [
      makeRepo({
        name: 'massive',
        stargazersCount: 10_000_000,
        forksCount: 1_000_000,
        size: 10_000_000,
        openIssuesCount: 999_999,
        totalCommitEstimate: 500_000,
      }),
      makeRepo({
        name: 'empty',
        stargazersCount: 0,
        forksCount: 0,
        size: 0,
        openIssuesCount: 0,
        totalCommitEstimate: 0,
        description: null,
        licenseName: null,
        homepage: null,
        hasPages: false,
        hasWiki: false,
        topics: [],
        commits: [],
      }),
    ];

    for (const repo of repos) {
      const metrics = computeDistrictProsperity(repo, 1, repo.commits);
      expect(metrics.prosperityScore).toBeGreaterThanOrEqual(0);
      expect(metrics.prosperityScore).toBeLessThanOrEqual(100);
      expect(metrics.fulfillmentScore).toBeGreaterThanOrEqual(0);
      expect(metrics.fulfillmentScore).toBeLessThanOrEqual(100);
      expect(metrics.maintenanceHealth).toBeGreaterThanOrEqual(10);
      expect(metrics.maintenanceHealth).toBeLessThanOrEqual(100);
      expect(metrics.openIssuesRatio).toBeGreaterThanOrEqual(0);
    }
  });

  it.each([
    {
      label: 'gilded',
      repo: makeRepo({
        name: 'gilded-repo',
        stargazersCount: 10_000,
        forksCount: 1_000,
        size: 100_000,
      }),
      commits: [makeCommit({ category: 'release' })],
    },
    {
      label: 'thriving',
      repo: makeRepo({
        name: 'thriving-repo',
        stargazersCount: 100,
        forksCount: 10,
        size: 400,
      }),
      commits: [makeCommit({ category: 'feat' })],
    },
    {
      label: 'commercial',
      repo: makeRepo({
        name: 'commercial-repo',
        stargazersCount: 10,
        forksCount: 2,
        size: 100,
      }),
      commits: [makeCommit({ category: 'feat' })],
    },
    {
      label: 'artisan',
      repo: makeRepo({
        name: 'artisan-repo',
        stargazersCount: 0,
        forksCount: 0,
        size: 1,
        commits: [],
      }),
      commits: [],
    },
  ])('derives the $label tier consistently with the score thresholds', ({ label, repo, commits }) => {
    const metrics = computeDistrictProsperity(repo, 500, commits);

    const expectedTier =
      metrics.prosperityScore >= 68
        ? 'gilded'
        : metrics.prosperityScore >= 42
          ? 'thriving'
          : metrics.prosperityScore >= 22
            ? 'commercial'
            : 'artisan';

    expect(metrics.prosperityTier).toBe(expectedTier);
    expect(metrics.prosperityTier).toBe(label);
  });

  it('derives the fulfillment tier consistently with its thresholds', () => {
    const metrics = computeDistrictProsperity(makeRepo(), 3_000, makeRepo().commits);
    const expected =
      metrics.fulfillmentScore >= 70
        ? 'complete'
        : metrics.fulfillmentScore >= 42
          ? 'established'
          : 'scaffold';

    expect(metrics.fulfillmentTier).toBe(expected);
  });

  it('flags a release commit as hasReleases', () => {
    const metrics = computeDistrictProsperity(makeRepo({ name: 'released' }), 1_000, [
      makeCommit({ category: 'release', message: 'release: v2.0.0' }),
    ]);

    expect(metrics.hasReleases).toBe(true);
    expect(metrics.prosperityScore).toBeGreaterThanOrEqual(22);
  });

  it('flags release-like topics as hasReleases', () => {
    const metrics = computeDistrictProsperity(
      makeRepo({ name: 'versioned', topics: ['v2'] }),
      1_000,
      []
    );

    expect(metrics.hasReleases).toBe(true);
  });

  it('scores a documented repo higher on fulfillment than a bare repo', () => {
    const bare = makeRepo({
      name: 'bare',
      description: null,
      licenseName: null,
      homepage: null,
      hasPages: false,
      hasWiki: false,
      topics: [],
      commits: [],
    });
    const documented = makeRepo({
      name: 'documented',
      description: 'A thoroughly documented open-source project',
      licenseName: 'Apache-2.0',
      homepage: 'https://documented.example.com',
      hasWiki: true,
      topics: ['docs', 'library'],
      commits: [makeCommit({ category: 'test' })],
    });

    const bareMetrics = computeDistrictProsperity(bare, 3_000, bare.commits);
    const documentedMetrics = computeDistrictProsperity(documented, 3_000, documented.commits);

    expect(documentedMetrics.fulfillmentScore).toBeGreaterThan(bareMetrics.fulfillmentScore);
    expect(documentedMetrics.fulfillmentTier).not.toBe('scaffold');
    expect(documentedMetrics.licenseName).toBe('Apache-2.0');
    expect(documentedMetrics.hasWiki).toBe(true);
    expect(documentedMetrics.hasPages).toBe(false);
  });

  it('recognises github.io homepages as pages', () => {
    const metrics = computeDistrictProsperity(
      makeRepo({ name: 'pages', homepage: 'https://ada.github.io/pages', hasPages: false }),
      1_000,
      []
    );

    expect(metrics.hasPages).toBe(true);
  });

  it('drops maintenance health to the floor when issues dominate commits', () => {
    const metrics = computeDistrictProsperity(
      makeRepo({
        name: 'issue-flood',
        openIssuesCount: 50_000,
        totalCommitEstimate: 1,
      }),
      1_000,
      []
    );

    expect(metrics.maintenanceHealth).toBe(10);
  });
});
