import { describe, expect, it } from 'vitest';
import {
  buildSyntheticCommitTimeline,
  classifyCommitMessage,
} from '../../../src/domain/github/commitClassifier';

describe('classifyCommitMessage', () => {
  describe('categories', () => {
    it('classifies initial commits as init', () => {
      expect(classifyCommitMessage('Initial commit')).toBe('init');
      expect(classifyCommitMessage('initial commit')).toBe('init');
    });

    it('treats the oldest commit as init regardless of message', () => {
      expect(classifyCommitMessage('feat: add login', true)).toBe('init');
      expect(classifyCommitMessage('whatever', true)).toBe('init');
    });

    it('classifies release messages', () => {
      expect(classifyCommitMessage('release: v1.0.0')).toBe('release');
      expect(classifyCommitMessage('v2.1.0')).toBe('release');
      expect(classifyCommitMessage('bump deps')).toBe('release');
    });

    it('classifies feature messages', () => {
      expect(classifyCommitMessage('feat: add a canal')).toBe('feat');
      expect(classifyCommitMessage('Add login')).toBe('feat');
    });

    it('classifies fix messages', () => {
      expect(classifyCommitMessage('fix: broken bridge')).toBe('fix');
      expect(classifyCommitMessage('hotfix')).toBe('fix');
    });

    it('classifies refactor messages', () => {
      expect(classifyCommitMessage('refactor: extract zoning helpers')).toBe('refactor');
      expect(classifyCommitMessage('optimize queries')).toBe('refactor');
    });

    it('classifies docs messages', () => {
      expect(classifyCommitMessage('docs: expand the guide')).toBe('docs');
      expect(classifyCommitMessage('README')).toBe('docs');
    });

    it('classifies test messages', () => {
      expect(classifyCommitMessage('test: add e2e coverage')).toBe('test');
      expect(classifyCommitMessage('tests for the zoning grid')).toBe('test');
    });

    it('classifies unrecognised messages as chore', () => {
      expect(classifyCommitMessage('whatever')).toBe('chore');
      expect(classifyCommitMessage('housekeeping')).toBe('chore');
    });
  });

  describe('precedence', () => {
    it('checks feat before fix', () => {
      expect(classifyCommitMessage('feat: fix typo')).toBe('feat');
    });

    it('classifies "docs: update changelog" as docs, not release', () => {
      expect(classifyCommitMessage('docs: update changelog')).toBe('docs');
    });
  });

  describe('edge cases', () => {
    it('classifies bare "add e2e coverage" as feat (feat rules run before test rules)', () => {
      // KNOWN SOURCE QUIRK: /^add\b/ in the feat block (commitClassifier.ts:27)
      // matches before the test block (commitClassifier.ts:51) can see "e2e".
      expect(classifyCommitMessage('add e2e coverage')).toBe('feat');
    });

    it('returns chore for empty or whitespace-only messages', () => {
      expect(classifyCommitMessage('')).toBe('chore');
      expect(classifyCommitMessage('   ')).toBe('chore');
      expect(classifyCommitMessage('\n\n  \t')).toBe('chore');
    });

    it('returns init for empty messages when flagged as oldest', () => {
      expect(classifyCommitMessage('', true)).toBe('init');
      expect(classifyCommitMessage('   ', true)).toBe('init');
    });

    it('only looks at the first line of a message', () => {
      expect(classifyCommitMessage('chore: tidy up\n\nfix: something unrelated')).toBe('chore');
      expect(classifyCommitMessage('feat: new district\n\nFixes #12')).toBe('feat');
    });
  });
});

describe('buildSyntheticCommitTimeline', () => {
  const created = '2020-01-01T00:00:00.000Z';
  const pushed = '2024-01-01T00:00:00.000Z';

  function makeRepoInput(overrides: Record<string, unknown> = {}) {
    return {
      name: 'canal-city',
      full_name: 'ada/canal-city',
      created_at: created,
      pushed_at: pushed,
      size: 500,
      language: 'TypeScript',
      owner: { login: 'ada' },
      ...overrides,
    };
  }

  it('is deterministic for the same repo name and dates', () => {
    const first = buildSyntheticCommitTimeline(makeRepoInput());
    const second = buildSyntheticCommitTimeline(makeRepoInput());

    expect(first).toEqual(second);
  });

  it('produces between 3 and 10 commits', () => {
    for (const size of [0, 1, 20, 500, 10_000, 1_000_000]) {
      const timeline = buildSyntheticCommitTimeline(makeRepoInput({ size }));
      expect(timeline.length, `size ${size}`).toBeGreaterThanOrEqual(3);
      expect(timeline.length, `size ${size}`).toBeLessThanOrEqual(10);
    }
  });

  it('starts with an init commit chronologically (last element after reverse)', () => {
    const timeline = buildSyntheticCommitTimeline(makeRepoInput());
    const oldest = timeline[timeline.length - 1];

    expect(oldest.category).toBe('init');
    expect(oldest.message).toMatch(/^Initial/);
    expect(timeline[0].category).not.toBe('init');
    expect(timeline.filter((commit) => commit.category === 'init')).toHaveLength(1);
  });

  it('sorts commits newest-first', () => {
    const timeline = buildSyntheticCommitTimeline(makeRepoInput());
    const times = timeline.map((commit) => Date.parse(commit.date));

    expect(times).toHaveLength(timeline.length);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeLessThanOrEqual(times[i - 1]);
    }
    expect(new Set(times).size).toBe(times.length);
  });

  it('generates 12-character lowercase hex shas', () => {
    const timeline = buildSyntheticCommitTimeline(makeRepoInput());

    for (const commit of timeline) {
      expect(commit.sha).toMatch(/^[0-9a-f]{12}$/);
    }
    expect(new Set(timeline.map((commit) => commit.sha)).size).toBe(timeline.length);
  });

  it('places every commit between created_at and pushed_at', () => {
    const timeline = buildSyntheticCommitTimeline(makeRepoInput());
    const createdMs = Date.parse(created);
    const pushedMs = Date.parse(pushed);

    for (const commit of timeline) {
      const time = Date.parse(commit.date);
      expect(time).toBeGreaterThanOrEqual(createdMs);
      expect(time).toBeLessThanOrEqual(pushedMs);
    }
  });

  it('uses the owner login as the author when present', () => {
    const timeline = buildSyntheticCommitTimeline(makeRepoInput());

    for (const commit of timeline) {
      expect(commit.authorName).toBe('ada');
      expect(commit.authorLogin).toBe('ada');
    }
  });

  it('uses the author fallback when there is no owner', () => {
    const timeline = buildSyntheticCommitTimeline(makeRepoInput({ owner: undefined }), 'Fallback Author');

    for (const commit of timeline) {
      expect(commit.authorName).toBe('Fallback Author');
      expect(commit.authorLogin).toBeUndefined();
    }
  });

  it('defaults the author fallback to "Author"', () => {
    const timeline = buildSyntheticCommitTimeline(makeRepoInput({ owner: undefined }));

    for (const commit of timeline) {
      expect(commit.authorName).toBe('Author');
    }
  });

  it('derives the timeline from pushed_at when it is the later timestamp', () => {
    const later = '2025-06-01T00:00:00.000Z';
    const timeline = buildSyntheticCommitTimeline(makeRepoInput({ pushed_at: later }));
    const newest = timeline[0];

    expect(newest.date).toBe(later);
    expect(timeline[timeline.length - 1].date).toBe(created);
  });

  it('keeps at least one day of history when pushed_at predates created_at', () => {
    const timeline = buildSyntheticCommitTimeline(
      makeRepoInput({ created_at: pushed, pushed_at: created })
    );

    expect(timeline.length).toBeGreaterThanOrEqual(3);
    for (const commit of timeline) {
      expect(Number.isNaN(Date.parse(commit.date))).toBe(false);
    }
  });
});
