import { describe, expect, it } from 'vitest';
import { BYTES_PER_LOC, estimateRepoLOC } from '../../../src/domain/github/metrics';

describe('BYTES_PER_LOC', () => {
  it('contains only positive finite values', () => {
    const entries = Object.entries(BYTES_PER_LOC);
    expect(entries.length).toBeGreaterThan(0);

    for (const [language, ratio] of entries) {
      expect(typeof ratio, language).toBe('number');
      expect(Number.isFinite(ratio), language).toBe(true);
      expect(ratio, language).toBeGreaterThan(0);
    }
  });
});

describe('estimateRepoLOC', () => {
  describe('with a language byte map', () => {
    it('sums bytes divided by each language ratio and rounds', () => {
      // 3600 / 36 = 100, 3400 / 34 = 100.
      const loc = estimateRepoLOC({ TypeScript: 3_600, Python: 3_400 }, 'TypeScript', 400);
      expect(loc).toBe(200);
    });

    it('rounds fractional results', () => {
      // 1000 / 36 = 27.777…
      expect(estimateRepoLOC({ TypeScript: 1_000 }, 'TypeScript', 400)).toBe(28);
    });

    it('falls back to 36 bytes per line for unknown languages', () => {
      // COBOL is not in BYTES_PER_LOC: 3600 / 36 = 100.
      expect(estimateRepoLOC({ COBOL: 3_600 }, 'COBOL', 400)).toBe(100);
    });

    it('handles a mix of known and unknown languages', () => {
      // 3600 / 36 = 100, 3600 / 36 (unknown) = 100.
      expect(estimateRepoLOC({ TypeScript: 3_600, Zig: 3_600 }, 'TypeScript', 400)).toBe(200);
    });

    it('never returns less than 15 lines when the map is non-empty', () => {
      // 10 / 62 = 0.16 → clamped up to 15.
      expect(estimateRepoLOC({ Markdown: 10 }, 'Markdown', 0)).toBe(15);
      expect(estimateRepoLOC({ TypeScript: 0 }, 'TypeScript', 0)).toBe(15);
    });
  });

  describe('without a language byte map', () => {
    it('falls back to a calibrated fraction of the repo size', () => {
      // max(400, 1000 * 1024 * 0.36) / 36 = 368640 / 36.
      expect(estimateRepoLOC({}, 'TypeScript', 1_000)).toBe(10_240);
    });

    it('uses the primary language ratio when known', () => {
      // 368640 / 62 = 5945.8…
      expect(estimateRepoLOC({}, 'Markdown', 1_000)).toBe(5_946);
    });

    it('uses 36 bytes per line when the primary language is unknown or null', () => {
      expect(estimateRepoLOC({}, 'Ada', 1_000)).toBe(10_240);
      expect(estimateRepoLOC({}, null, 1_000)).toBe(10_240);
    });

    it('scales with repo size', () => {
      const small = estimateRepoLOC({}, 'TypeScript', 1_000);
      const large = estimateRepoLOC({}, 'TypeScript', 2_000);
      expect(large).toBeGreaterThan(small);
      expect(large).toBe(20_480);
    });

    it('never returns less than 20 lines', () => {
      expect(estimateRepoLOC({}, 'TypeScript', 0)).toBe(20);
      expect(estimateRepoLOC({}, null, 0)).toBe(20);
    });
  });
});
