/**
 * Empirical average source bytes per line of code, by language.
 * Used to estimate LOC when GitHub's language endpoint is unavailable.
 */
export const BYTES_PER_LOC: Record<string, number> = {
  TypeScript: 36,
  JavaScript: 35,
  Python: 34,
  Rust: 36,
  Go: 31,
  C: 31,
  'C++': 34,
  Java: 43,
  Kotlin: 38,
  'C#': 40,
  Ruby: 30,
  PHP: 36,
  Swift: 37,
  HTML: 48,
  CSS: 28,
  SCSS: 30,
  Shell: 32,
  Dockerfile: 38,
  Markdown: 62,
  'Jupyter Notebook': 85,
  Vue: 38,
  Svelte: 36,
};

/** Ratio of a repo's git size (KB, includes history/assets) that is source text. */
const SOURCE_TEXT_RATIO = 0.36;

/**
 * Estimates a repository's lines of code.
 *
 * Prefers the per-language byte map from the GitHub languages endpoint;
 * otherwise falls back to a calibrated fraction of the repo's git size.
 */
export function estimateRepoLOC(
  languages: Record<string, number>,
  primaryLanguage: string | null,
  sizeKB: number
): number {
  const entries = Object.entries(languages);
  if (entries.length > 0) {
    let totalLines = 0;
    for (const [lang, bytes] of entries) {
      const bytesPerLine = BYTES_PER_LOC[lang] || 36;
      totalLines += bytes / bytesPerLine;
    }
    return Math.max(15, Math.round(totalLines));
  }

  const bytesPerLine = (primaryLanguage && BYTES_PER_LOC[primaryLanguage]) || 36;
  const sourceBytesEstimate = Math.max(400, sizeKB * 1024 * SOURCE_TEXT_RATIO);
  return Math.max(20, Math.round(sourceBytesEstimate / bytesPerLine));
}
