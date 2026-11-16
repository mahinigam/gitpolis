import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MUNICIPAL_DECISION_JSON_SCHEMA } from '../src/domain/decision/geminiSchema';
import { buildDecisionPrompt } from '../src/domain/decision/prompt';
import { validateMunicipalDecisionPlan } from '../src/domain/decision/validation';
import { SHOWCASE_PROFILES } from '../src/data/showcaseProfiles';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load .env
let apiKey = process.env.GEMINI_API_KEY || '';
let model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

const envPath = path.join(projectRoot, '.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('GEMINI_API_KEY=') && !apiKey) {
      apiKey = trimmed.replace('GEMINI_API_KEY=', '').trim().replace(/^["']|["']$/g, '');
    }
    if (trimmed.startsWith('GEMINI_MODEL=') && !process.env.GEMINI_MODEL) {
      model = trimmed.replace('GEMINI_MODEL=', '').trim().replace(/^["']|["']$/g, '') || model;
    }
  }
}

if (!apiKey) {
  console.error('ERROR: No GEMINI_API_KEY found in process.env or .env');
  process.exit(1);
}

console.log(`[GitPolis Live Gemini Test] Initializing test with model: ${model}`);
console.log(`[GitPolis Live Gemini Test] API Key present (length: ${apiKey.length}, starts with: ${apiKey.substring(0, 4)}...)`);

const payload = SHOWCASE_PROFILES['atelier-dev'];
const promptText = buildDecisionPrompt(payload);

async function testCall(modelName: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`;
  console.log(`[GitPolis Live Gemini Test] Requesting: ${modelName}...`);
  const startTime = Date.now();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: MUNICIPAL_DECISION_JSON_SCHEMA,
      },
    }),
    signal: AbortSignal.timeout(30000),
  });

  const durationMs = Date.now() - startTime;
  console.log(`[GitPolis Live Gemini Test] HTTP Status: ${response.status} ${response.statusText} (${durationMs}ms)`);

  const responseText = await response.text();
  if (!response.ok) {
    console.error(`[GitPolis Live Gemini Test] Error response body:`, responseText);
    return { ok: false, status: response.status, body: responseText };
  }

  const json = JSON.parse(responseText);
  const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!candidateText) {
    console.error('[GitPolis Live Gemini Test] No candidate text returned in response!');
    return { ok: false, error: 'Empty candidate' };
  }

  console.log(`[GitPolis Live Gemini Test] Received candidate text (${candidateText.length} characters)`);
  const parsed = JSON.parse(candidateText);
  const validated = validateMunicipalDecisionPlan(parsed, payload.user.login);

  if (!validated) {
    console.error('[GitPolis Live Gemini Test] Schema validation failed against validateMunicipalDecisionPlan!');
    console.error(JSON.stringify(parsed, null, 2));
    return { ok: false, error: 'Validation failed' };
  }

  console.log('---------------------------------------------------------');
  console.log('✓ SUCCESS: Live Gemini Decision Plan fully validated!');
  console.log('  Civic Title:          ', validated.citySummary.civicTitle);
  console.log('  Developer Archetype:  ', validated.citySummary.developerArchetype);
  console.log('  Founding Motto:       ', `"${validated.citySummary.foundingMotto}"`);
  console.log('  Vitality Assessment:  ', `${validated.citySummary.vitalityAssessment}/100`);
  console.log('  Suggested Weather:    ', validated.citySummary.suggestedWeather);
  console.log('  Suggested Time Of Day:', `${validated.citySummary.suggestedTimeOfDay}:00`);
  console.log('  Zoned Districts:      ', validated.districts.length);
  console.log('  Transit Connections:  ', validated.interDistrictConnections.length);
  console.log('  Historical Chronicles:', validated.historicalChronicles.length);
  console.log('---------------------------------------------------------');
  return { ok: true, plan: validated };
}

async function run() {
  try {
    console.log(`\nTesting primary model: ${model}...`);
    let result = await testCall(model);
    if (!result.ok && model !== 'gemini-3.5-flash') {
      console.log(`\nRetrying with fallback model gemini-3.5-flash...`);
      result = await testCall('gemini-3.5-flash');
    }
    if (!result.ok && model !== 'gemini-3-flash-preview') {
      console.log(`\nRetrying with fallback model gemini-3-flash-preview...`);
      result = await testCall('gemini-3-flash-preview');
    }

    if (!result.ok) {
      process.exit(1);
    }
  } catch (err) {
    console.error('[GitPolis Live Gemini Test] Unexpected failure:', err);
    process.exit(1);
  }
}

run();

run();
