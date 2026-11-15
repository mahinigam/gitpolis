/**
 * Google Gemini Decision API Service for GitPolis
 * Implements strict responseSchema structured output, deterministic IndexedDB spatial caching,
 * and quota protection for the free Gemini API tier.
 */

import type { GitHubProfilePayload } from '../types/city';
import {
  type MunicipalDecisionPlan,
  validateMunicipalDecisionPlan,
} from '../types/decision';

const GEMINI_API_STORAGE_KEY = 'gitpolis_gemini_api_key';
const DB_NAME = 'gitpolis_ai_cache';
const DB_VERSION = 1;
const STORE_NAME = 'decisions';

// Open or initialize IndexedDB cache store
function openCacheDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function getCachedDecision(key: string): Promise<MunicipalDecisionPlan | null> {
  try {
    const db = await openCacheDatabase();
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result && req.result.plan) {
            resolve(req.result.plan as MunicipalDecisionPlan);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    }

    // LocalStorage fallback
    const raw = localStorage.getItem(`gitpolis_plan_${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function setCachedDecision(key: string, plan: MunicipalDecisionPlan): Promise<void> {
  try {
    const db = await openCacheDatabase();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ key, plan, timestamp: Date.now() });
    }
    localStorage.setItem(`gitpolis_plan_${key}`, JSON.stringify(plan));
  } catch (err) {
    console.warn('[Decision Cache] Cache write warning:', err);
  }
}

/**
 * Creates a deterministic fingerprint for cache validation
 */
export function computeProfileFingerprint(payload: GitHubProfilePayload): string {
  const username = payload.user.login.toLowerCase();
  const repoCount = payload.repos.length;
  const totalStars = payload.repos.reduce((acc, r) => acc + (r.stargazersCount || 0), 0);
  const latestPush = payload.repos.reduce((max, r) => {
    const t = new Date(r.pushedAt || 0).getTime();
    return Math.max(max, isNaN(t) ? 0 : t);
  }, 0);
  return `${username}:${repoCount}:${totalStars}:${latestPush}`;
}

export function getStoredGeminiKey(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem(GEMINI_API_STORAGE_KEY) ||
    ((import.meta as any).env?.VITE_GEMINI_API_KEY as string) ||
    ''
  );
}

export function setStoredGeminiKey(key: string): void {
  if (typeof window === 'undefined') return;
  if (!key.trim()) {
    localStorage.removeItem(GEMINI_API_STORAGE_KEY);
  } else {
    localStorage.setItem(GEMINI_API_STORAGE_KEY, key.trim());
  }
}

/**
 * Strict OpenAPI-compliant JSON schema for Gemini responseSchema
 */
const MUNICIPAL_DECISION_JSON_SCHEMA = {
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
          enum: [
            'The Core Architect',
            'The Polyglot Artisan',
            'The Distributed Systems Engineer',
            'The Research Synthesist',
            'The Open-Source Citizen',
            'The Full-Stack Innovator',
          ],
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
          enum: ['clear', 'mist', 'rain'],
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
            enum: [
              'downtown_financial_core',
              'cybernetics_ai_biosphere',
              'logistics_cloud_docks',
              'civic_arts_district',
              'ancient_heritage_quarter',
            ],
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
            enum: [
              'hyperloop_arterial',
              'waterfront_ferry',
              'elevated_rail',
              'pedestrian_boulevard',
            ],
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
                enum: ['obelisk', 'triumphal_arch', 'beacon_spire', 'atrium_dome'],
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
};

/**
 * Compact context serializer to stay well within free tier token ceilings
 */
function serializeContextForPrompt(payload: GitHubProfilePayload): string {
  const repos = payload.repos.slice(0, 32).map((r) => ({
    name: r.name,
    lang: r.language,
    stars: r.stargazersCount,
    forks: r.forksCount,
    issues: r.openIssuesCount,
    desc: (r.description || '').slice(0, 110),
    pushedAt: r.pushedAt,
    hasPages: !!r.hasPages,
  }));

  return JSON.stringify({
    user: {
      login: payload.user.login,
      name: payload.user.name,
      bio: payload.user.bio,
      public_repos: payload.user.publicRepos,
      followers: payload.user.followers,
      created_at: payload.user.createdAt,
    },
    sampleRepos: repos,
  });
}

/**
 * Executes Google's Decision API with strict responseSchema validation
 */
export async function executeGeminiMunicipalDecisions(
  payload: GitHubProfilePayload,
  apiKeyOverride?: string,
  onProgress?: (statusText: string) => void
): Promise<MunicipalDecisionPlan> {
  const username = payload.user.login;
  const cacheKey = computeProfileFingerprint(payload);

  // 1. Check local spatial cache first
  const cached = await getCachedDecision(cacheKey);
  if (cached) {
    onProgress?.('Loaded cached AI Municipal Blueprint instantly');
    return cached;
  }

  const apiKey = (apiKeyOverride || getStoredGeminiKey()).trim();
  if (!apiKey) {
    throw new Error('Gemini API Key is required. Please supply a free Google AI Studio API key.');
  }

  onProgress?.('Consulting Google Decision Engine (Gemini 2.0 Flash)…');

  const systemInstruction = `You are the Chief AI Urban Architect and Municipal Historian for GitPolis.
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
Adhere strictly to the requested JSON responseSchema.`;

  const userContext = `DEVELOPER TELEMETRY:\n${serializeContextForPrompt(payload)}`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemInstruction}\n\n${userContext}` }],
      },
    ],
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
      responseSchema: MUNICIPAL_DECISION_JSON_SCHEMA,
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errMessage = `Gemini Decision API Error (${response.status}): ${response.statusText}`;
    try {
      const errJson = JSON.parse(errorText);
      if (errJson.error?.message) {
        errMessage = `Gemini: ${errJson.error.message}`;
      }
    } catch {
      // fallback
    }
    throw new Error(errMessage);
  }

  const jsonResult = await response.json();
  const rawText = jsonResult.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Gemini Decision API returned an empty output candidate.');
  }

  onProgress?.('Validating structured decision schema contract…');
  const parsedData = JSON.parse(rawText);
  const validatedPlan = validateMunicipalDecisionPlan(parsedData, username);

  if (!validatedPlan) {
    throw new Error('Failed to validate MunicipalDecisionPlan against strict contract schema.');
  }

  // Persist to cache
  await setCachedDecision(cacheKey, validatedPlan);
  onProgress?.('AI Municipal Decisions verified and cached');

  return validatedPlan;
}
