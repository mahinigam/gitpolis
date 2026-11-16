import { describe, expect, it } from 'vitest';
import {
  buildDecisionPrompt,
  DECISION_SYSTEM_INSTRUCTION,
  serializeContextForPrompt,
} from '../../../src/domain/decision/prompt';
import type { GitHubRepoData } from '../../../src/domain/city/types';
import { makePayload, makeRepo, makeUser } from '../../fixtures/github';

function parseContext(payload = makePayload()) {
  return JSON.parse(serializeContextForPrompt(payload)) as {
    user: Record<string, unknown>;
    totalRepos: number;
    sampleRepos: Array<Record<string, unknown>>;
  };
}

function payloadWithRepos(count: number) {
  const repos = Array.from({ length: count }, (_, index) =>
    makeRepo({ name: `repo-${index}`, description: `Description ${index}` })
  );
  return makePayload({ repos });
}

describe('serializeContextForPrompt', () => {
  it('emits valid compact JSON', () => {
    const context = parseContext();

    expect(context.user.login).toBe('ada');
    expect(context.user.public_repos).toBe(3);
    expect(context.user.followers).toBe(120);
    expect(context.sampleRepos).toHaveLength(1);
  });

  it('caps sampled repositories at twelve but reports the real total', () => {
    const context = parseContext(payloadWithRepos(30));

    expect(context.sampleRepos).toHaveLength(12);
    expect(context.totalRepos).toBe(30);
    expect(context.sampleRepos.map((repo) => repo.name)).toEqual(
      Array.from({ length: 12 }, (_, index) => `repo-${index}`)
    );
  });

  it('includes only the fields the model needs', () => {
    const context = parseContext();

    expect(Object.keys(context.user).sort()).toEqual([
      'bio',
      'created_at',
      'followers',
      'login',
      'name',
      'public_repos',
    ]);
    expect(Object.keys(context.sampleRepos[0]).sort()).toEqual([
      'desc',
      'forks',
      'hasPages',
      'issues',
      'lang',
      'name',
      'pushedAt',
      'stars',
    ]);
  });

  it('truncates long names and descriptions with an ellipsis', () => {
    const longName = 'n'.repeat(200);
    const longDescription = 'd'.repeat(400);
    const context = parseContext(
      makePayload({ repos: [makeRepo({ name: longName, description: longDescription })] })
    );

    const repo = context.sampleRepos[0];
    expect(repo.name).toBe(`${'n'.repeat(100)}…`);
    expect(repo.desc).toBe(`${'d'.repeat(110)}…`);
    expect(String(repo.name).length).toBe(101);
    expect(String(repo.desc).length).toBe(111);
  });

  it('keeps short strings intact and maps null optional fields to null', () => {
    const context = parseContext(
      makePayload({
        user: makeUser({ name: null, bio: null }),
        repos: [makeRepo({ name: 'short', description: null, language: null })],
      })
    );

    expect(context.user.name).toBeNull();
    expect(context.user.bio).toBeNull();
    expect(context.sampleRepos[0].name).toBe('short');
    expect(context.sampleRepos[0].desc).toBeNull();
    expect(context.sampleRepos[0].lang).toBeNull();
  });

  it('truncates the login and bio independently of the repo cap', () => {
    const context = parseContext(
      makePayload({
        user: makeUser({ login: 'l'.repeat(100), name: 'n'.repeat(100), bio: 'b'.repeat(300) }),
      })
    );

    expect(context.user.login).toBe(`${'l'.repeat(60)}…`);
    expect(context.user.name).toBe(`${'n'.repeat(80)}…`);
    expect(context.user.bio).toBe(`${'b'.repeat(200)}…`);
  });

  it('does not leak contact or identity fields that are not sent', () => {
    const serialized = serializeContextForPrompt(makePayload());

    expect(serialized).not.toContain('avatarUrl');
    expect(serialized).not.toContain('htmlUrl');
    expect(serialized).not.toContain('email');
  });

  it('handles a profile with no repositories', () => {
    const context = parseContext(makePayload({ repos: [] }));

    expect(context.totalRepos).toBe(0);
    expect(context.sampleRepos).toEqual([]);
  });
});

describe('buildDecisionPrompt', () => {
  it('prefixes the system instruction', () => {
    const prompt = buildDecisionPrompt(makePayload());

    expect(prompt.startsWith(DECISION_SYSTEM_INSTRUCTION)).toBe(true);
    expect(prompt).toContain('DEVELOPER TELEMETRY:');
  });

  it('embeds the serialized telemetry after the instruction', () => {
    const payload = makePayload();
    const prompt = buildDecisionPrompt(payload);

    expect(prompt).toContain(serializeContextForPrompt(payload));
    expect(prompt).toContain('"login":"ada"');
  });

  it('states the district cap in the instruction', () => {
    expect(DECISION_SYSTEM_INSTRUCTION).toContain('at most 12 district entries');
  });

  it('documents every municipal zone', () => {
    for (const zone of [
      'downtown_financial_core',
      'cybernetics_ai_biosphere',
      'logistics_cloud_docks',
      'civic_arts_district',
      'ancient_heritage_quarter',
    ]) {
      expect(DECISION_SYSTEM_INSTRUCTION).toContain(zone);
    }
  });

  it('bounds every model-facing string to 240 characters', () => {
    expect(DECISION_SYSTEM_INSTRUCTION).toContain('under 240 characters');
  });
});

describe('prompt payload isolation', () => {
  it('does not mutate the input repositories', () => {
    const payload = payloadWithRepos(3);
    const snapshot = JSON.parse(JSON.stringify(payload)) as {
      repos: GitHubRepoData[];
    };

    serializeContextForPrompt(payload);
    buildDecisionPrompt(payload);

    expect(payload.repos).toEqual(snapshot.repos);
  });
});
