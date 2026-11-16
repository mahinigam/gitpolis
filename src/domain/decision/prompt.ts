import type { GitHubProfilePayload } from '../city/types';

/**
 * Maximum number of repositories sent to the model. Each repo becomes one
 * district in the response, so this also bounds output tokens.
 */
const MAX_PROMPT_REPOS = 12;

/** Truncates any model-facing string so a single field cannot blow the budget. */
function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/**
 * Compacts a full GitHub payload into the minimum telemetry the model needs.
 * Descriptions are truncated and only the 12 highest-ranked repos are included.
 */
export function serializeContextForPrompt(payload: GitHubProfilePayload): string {
  const repos = payload.repos.slice(0, MAX_PROMPT_REPOS).map((repo) => ({
    name: truncate(repo.name, 100),
    lang: truncate(repo.language, 40),
    stars: repo.stargazersCount,
    forks: repo.forksCount,
    issues: repo.openIssuesCount,
    desc: truncate(repo.description, 110),
    pushedAt: truncate(repo.pushedAt, 32),
    hasPages: Boolean(repo.hasPages),
  }));

  return JSON.stringify({
    user: {
      login: truncate(payload.user.login, 60),
      name: truncate(payload.user.name, 80),
      bio: truncate(payload.user.bio, 200),
      public_repos: payload.user.publicRepos,
      followers: payload.user.followers,
      created_at: truncate(payload.user.createdAt, 32),
    },
    totalRepos: payload.repos.length,
    sampleRepos: repos,
  });
}

export const DECISION_SYSTEM_INSTRUCTION = `You are the Chief AI Urban Architect and Municipal Historian for GitPolis.
Your mission is to evaluate a GitHub developer's telemetry and formulate a comprehensive, strictly-typesafe Municipal Decision Plan.
1. Classify the developer's Archetype, Civic Title, and Founding Motto.
2. Zone each repository into an appropriate municipal district:
   - downtown_financial_core: flagship repos, most starred, core business logic.
   - cybernetics_ai_biosphere: machine learning, neural models, python data analysis.
   - logistics_cloud_docks: servers, cloud infra, APIs, docker, devtools.
   - civic_arts_district: frontend, styling, design systems, UI components.
   - ancient_heritage_quarter: foundational early repos, archived milestones.
3. Discover inter-district transit connections: find repos that naturally communicate or form microservice/library ecosystems.
4. Synthesize 3 to 4 historical epochs and prescribe commemorative landmark monuments.
Return at most ${MAX_PROMPT_REPOS} district entries — cover the sampled repositories and group the rest conceptually.
Keep every string under 240 characters. Adhere strictly to the requested JSON responseSchema.`;

/** Builds the single text part sent to Gemini. */
export function buildDecisionPrompt(payload: GitHubProfilePayload): string {
  return `${DECISION_SYSTEM_INSTRUCTION}\n\nDEVELOPER TELEMETRY:\n${serializeContextForPrompt(payload)}`;
}
