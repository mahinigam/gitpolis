// src/domain/decision/types.ts
var DEVELOPER_ARCHETYPES = [
  "The Core Architect",
  "The Polyglot Artisan",
  "The Distributed Systems Engineer",
  "The Research Synthesist",
  "The Open-Source Citizen",
  "The Full-Stack Innovator"
];
var MUNICIPAL_ZONES = [
  "downtown_financial_core",
  "cybernetics_ai_biosphere",
  "logistics_cloud_docks",
  "civic_arts_district",
  "ancient_heritage_quarter"
];
var TRANSIT_TYPES = [
  "hyperloop_arterial",
  "waterfront_ferry",
  "elevated_rail",
  "pedestrian_boulevard"
];
var MONUMENT_TYPES = [
  "obelisk",
  "triumphal_arch",
  "beacon_spire",
  "atrium_dome"
];
var WEATHER_MODES = ["clear", "mist", "rain"];

// src/domain/decision/geminiSchema.ts
var MUNICIPAL_DECISION_JSON_SCHEMA = {
  type: "OBJECT",
  properties: {
    citySummary: {
      type: "OBJECT",
      properties: {
        civicTitle: {
          type: "STRING",
          description: "Poetic city name for this developer, e.g. 'Atelier of the Neural Horizon'"
        },
        foundingMotto: {
          type: "STRING",
          description: "Inspiring civic motto capturing the developer's coding ethos"
        },
        developerArchetype: {
          type: "STRING",
          enum: [...DEVELOPER_ARCHETYPES]
        },
        vitalityAssessment: {
          type: "INTEGER",
          description: "0 to 100 developer vitality score"
        },
        climateRationale: {
          type: "STRING",
          description: "Explanation for the atmospheric climate based on commit rhythms"
        },
        suggestedWeather: {
          type: "STRING",
          enum: [...WEATHER_MODES]
        },
        suggestedTimeOfDay: {
          type: "NUMBER",
          description: "Recommended solar time between 0 and 24"
        }
      },
      required: [
        "civicTitle",
        "foundingMotto",
        "developerArchetype",
        "vitalityAssessment",
        "climateRationale",
        "suggestedWeather",
        "suggestedTimeOfDay"
      ]
    },
    districts: {
      type: "ARRAY",
      description: "Zoning assignments and civic appraisal for each repository",
      items: {
        type: "OBJECT",
        properties: {
          repoName: { type: "STRING" },
          assignedZone: {
            type: "STRING",
            enum: [...MUNICIPAL_ZONES]
          },
          civicCritique: {
            type: "OBJECT",
            properties: {
              prosperityScore: { type: "INTEGER", description: "0 to 100 prosperity score" },
              fulfillmentScore: { type: "INTEGER", description: "0 to 100 fulfillment score" },
              municipalRole: {
                type: "STRING",
                description: "Civic title, e.g. 'Central Neural Observatory'"
              },
              architecturalFeatures: {
                type: "ARRAY",
                items: { type: "STRING" },
                description: "Up to 3 distinctive architectural elements"
              },
              urbanPlanningRationale: { type: "STRING" }
            },
            required: [
              "prosperityScore",
              "fulfillmentScore",
              "municipalRole",
              "architecturalFeatures",
              "urbanPlanningRationale"
            ]
          }
        },
        required: ["repoName", "assignedZone", "civicCritique"]
      }
    },
    interDistrictConnections: {
      type: "ARRAY",
      description: "Semantic transit links between repositories that communicate or share synergy",
      items: {
        type: "OBJECT",
        properties: {
          sourceRepo: { type: "STRING" },
          targetRepo: { type: "STRING" },
          connectionType: {
            type: "STRING",
            enum: [...TRANSIT_TYPES]
          },
          synergyReason: { type: "STRING", description: "Why these two repos are linked" },
          bandwidthWeight: { type: "INTEGER", description: "Traffic weight from 1 to 5" }
        },
        required: ["sourceRepo", "targetRepo", "connectionType", "synergyReason", "bandwidthWeight"]
      }
    },
    historicalChronicles: {
      type: "ARRAY",
      description: "3 to 4 historical epochs synthesized from the developer git history",
      items: {
        type: "OBJECT",
        properties: {
          epochName: { type: "STRING", description: "E.g. 'The Great Monolith Dismantling'" },
          timeRange: { type: "STRING", description: "E.g. '2022 - 2023'" },
          narrative: { type: "STRING", description: "Historical story of this coding era" },
          monument: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              era: { type: "STRING" },
              lore: { type: "STRING" },
              monumentType: {
                type: "STRING",
                enum: [...MONUMENT_TYPES]
              }
            },
            required: ["name", "era", "lore", "monumentType"]
          }
        },
        required: ["epochName", "timeRange", "narrative", "monument"]
      }
    }
  },
  required: ["citySummary", "districts", "interDistrictConnections", "historicalChronicles"]
};

// src/domain/decision/validation.ts
function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
function stringOr(value, fallback) {
  return typeof value === "string" && value.trim() ? value : fallback;
}
function oneOf(allowed, value, fallback) {
  return allowed.includes(value) ? value : fallback;
}
function validateMunicipalDecisionPlan(data, username) {
  if (!data || typeof data !== "object") return null;
  const raw = data;
  try {
    const rawSum = raw.citySummary || {};
    const citySummary = {
      civicTitle: stringOr(rawSum.civicTitle, `Metropolis of @${username}`),
      foundingMotto: stringOr(rawSum.foundingMotto, "Engineered with Precision & Vision"),
      developerArchetype: oneOf(DEVELOPER_ARCHETYPES, rawSum.developerArchetype, "The Polyglot Artisan"),
      vitalityAssessment: clampNumber(rawSum.vitalityAssessment, 0, 100, 85),
      climateRationale: stringOr(
        rawSum.climateRationale,
        "Reflecting continuous architectural momentum and code commits."
      ),
      suggestedWeather: oneOf(WEATHER_MODES, rawSum.suggestedWeather, "clear"),
      suggestedTimeOfDay: clampNumber(rawSum.suggestedTimeOfDay, 0, 24, 14.5)
    };
    const districts = Array.isArray(raw.districts) ? raw.districts.map((d) => ({
      repoName: String(d.repoName || ""),
      assignedZone: oneOf(MUNICIPAL_ZONES, d.assignedZone, "downtown_financial_core"),
      civicCritique: {
        prosperityScore: clampNumber(d.civicCritique?.prosperityScore, 0, 100, 50),
        fulfillmentScore: clampNumber(d.civicCritique?.fulfillmentScore, 0, 100, 50),
        municipalRole: typeof d.civicCritique?.municipalRole === "string" ? d.civicCritique.municipalRole : "Municipal Repository Block",
        architecturalFeatures: Array.isArray(d.civicCritique?.architecturalFeatures) ? d.civicCritique.architecturalFeatures.map(String).slice(0, 3) : ["Standard Architecture"],
        urbanPlanningRationale: typeof d.civicCritique?.urbanPlanningRationale === "string" ? d.civicCritique.urbanPlanningRationale : "Categorized according to repo stats and software topology."
      }
    })) : [];
    const interDistrictConnections = Array.isArray(raw.interDistrictConnections) ? raw.interDistrictConnections.map((c) => ({
      sourceRepo: String(c.sourceRepo || ""),
      targetRepo: String(c.targetRepo || ""),
      connectionType: oneOf(TRANSIT_TYPES, c.connectionType, "elevated_rail"),
      synergyReason: typeof c.synergyReason === "string" ? c.synergyReason : "Shared technology and contributor synergy.",
      bandwidthWeight: clampNumber(c.bandwidthWeight, 1, 5, 2)
    })) : [];
    const historicalChronicles = Array.isArray(raw.historicalChronicles) ? raw.historicalChronicles.map((h) => ({
      epochName: typeof h.epochName === "string" ? h.epochName : "Founding Epoch",
      timeRange: typeof h.timeRange === "string" ? h.timeRange : "Genesis",
      narrative: typeof h.narrative === "string" ? h.narrative : "The city expanded through continuous innovation.",
      monument: {
        name: typeof h.monument?.name === "string" ? h.monument.name : "Monument of Founding",
        era: typeof h.monument?.era === "string" ? h.monument.era : "Initial Era",
        lore: typeof h.monument?.lore === "string" ? h.monument.lore : "Honoring the first code push.",
        monumentType: oneOf(MONUMENT_TYPES, h.monument?.monumentType, "obelisk")
      }
    })) : [];
    return {
      id: raw.id || `plan_${Date.now()}`,
      username,
      generatedAt: Number(raw.generatedAt) || Date.now(),
      model: raw.model || "gemini-3.5-flash",
      citySummary,
      districts,
      interDistrictConnections,
      historicalChronicles
    };
  } catch (err) {
    console.error("[Decision Plan Validator] Validation error:", err);
    return null;
  }
}

// src/domain/decision/prompt.ts
var MAX_PROMPT_REPOS = 12;
function truncate(value, max) {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max)}\u2026` : value;
}
function serializeContextForPrompt(payload) {
  const repos = payload.repos.slice(0, MAX_PROMPT_REPOS).map((repo) => ({
    name: truncate(repo.name, 100),
    lang: truncate(repo.language, 40),
    stars: repo.stargazersCount,
    forks: repo.forksCount,
    issues: repo.openIssuesCount,
    desc: truncate(repo.description, 110),
    pushedAt: truncate(repo.pushedAt, 32),
    hasPages: Boolean(repo.hasPages)
  }));
  return JSON.stringify({
    user: {
      login: truncate(payload.user.login, 60),
      name: truncate(payload.user.name, 80),
      bio: truncate(payload.user.bio, 200),
      public_repos: payload.user.publicRepos,
      followers: payload.user.followers,
      created_at: truncate(payload.user.createdAt, 32)
    },
    totalRepos: payload.repos.length,
    sampleRepos: repos
  });
}
var DECISION_SYSTEM_INSTRUCTION = `You are the Chief AI Urban Architect and Municipal Historian for GitPolis.
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
Return at most ${MAX_PROMPT_REPOS} district entries \u2014 cover the sampled repositories and group the rest conceptually.
Keep every string under 240 characters. Adhere strictly to the requested JSON responseSchema.`;
function buildDecisionPrompt(payload) {
  return `${DECISION_SYSTEM_INSTRUCTION}

DEVELOPER TELEMETRY:
${serializeContextForPrompt(payload)}`;
}

// server/services/gemini.ts
var GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
var DEFAULT_MODEL = "gemini-3.5-flash";
var FALLBACK_MODELS = [
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash"
];
var GeminiServiceError = class extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
    this.name = "GeminiServiceError";
  }
};
function resolveModel() {
  const model = typeof process !== "undefined" ? process.env?.GEMINI_MODEL : void 0;
  return model?.trim() || DEFAULT_MODEL;
}
function resolveGeminiKey(clientKey) {
  const envKey = typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : void 0;
  return envKey?.trim() || clientKey?.trim() || void 0;
}
function isProfilePayload(value) {
  if (!value || typeof value !== "object") return false;
  const payload = value;
  return Boolean(payload.user) && typeof payload.user?.login === "string" && payload.user.login.length > 0 && Array.isArray(payload.repos) && payload.repos.length > 0 && payload.repos.every((repo) => typeof repo?.name === "string");
}
var REQUEST_TIMEOUT_MS = 45e3;
async function requestMunicipalPlan(payload, apiKey) {
  const primaryModel = resolveModel();
  const modelsToTry = [primaryModel, ...FALLBACK_MODELS.filter((m) => m !== primaryModel)];
  let lastError = null;
  for (const model of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await requestOnce(payload, apiKey, model);
      } catch (err) {
        lastError = err instanceof GeminiServiceError ? err : new GeminiServiceError("Gemini request failed");
        if (lastError.status === 404 || /not found|no longer available/i.test(lastError.message)) {
          break;
        }
        if (lastError.status === 400 || lastError.status === 429 || /empty candidate|malformed JSON|decision schema/i.test(lastError.message)) {
          throw lastError;
        }
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        } else {
          throw lastError;
        }
      }
    }
  }
  throw lastError ?? new GeminiServiceError("Gemini request failed");
}
async function requestOnce(payload, apiKey, model) {
  const response = await fetch(
    `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildDecisionPrompt(payload) }] }],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          responseSchema: MUNICIPAL_DECISION_JSON_SCHEMA,
          thinkingConfig: { thinkingBudget: 0 }
        }
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    }
  );
  if (!response.ok) {
    const text2 = await response.text().catch(() => "");
    let message = `Gemini request failed (${response.status})`;
    try {
      const parsed2 = JSON.parse(text2);
      if (parsed2.error?.message) message = parsed2.error.message;
    } catch {
    }
    const status = response.status === 429 ? 429 : response.status === 400 ? 400 : response.status === 404 ? 404 : 502;
    throw new GeminiServiceError(message, status);
  }
  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new GeminiServiceError("Gemini returned an empty candidate.");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GeminiServiceError("Gemini returned malformed JSON.");
  }
  const plan = validateMunicipalDecisionPlan(parsed, payload.user.login);
  if (!plan) throw new GeminiServiceError("Gemini output did not match the decision schema.");
  return plan;
}

// server/lib/http.ts
var MAX_JSON_BYTES = 768 * 1024;
function sendJson(res, status, payload, extraHeaders = {}) {
  if (res.writableEnded) return;
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  for (const [key, value] of Object.entries(extraHeaders)) res.setHeader(key, value);
  res.end(JSON.stringify(payload));
}
function readJsonBody(req, maxBytes = MAX_JSON_BYTES) {
  return new Promise((resolve) => {
    const preParsed = req.body;
    if (preParsed !== void 0) {
      if (typeof preParsed === "object" && preParsed !== null) {
        resolve({ ok: true, status: 200, body: preParsed });
        return;
      }
      if (typeof preParsed === "string") {
        try {
          resolve({ ok: true, status: 200, body: JSON.parse(preParsed) });
          return;
        } catch {
          resolve({ ok: false, status: 400, error: "Malformed JSON body." });
          return;
        }
      }
    }
    const contentType = String(req.headers["content-type"] || "");
    if (!contentType.toLowerCase().includes("application/json")) {
      resolve({ ok: false, status: 415, error: "Expected application/json." });
      return;
    }
    let size = 0;
    let settled = false;
    const chunks = [];
    req.on("data", (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > maxBytes) {
        settled = true;
        resolve({ ok: false, status: 413, error: "Request body too large." });
        req.pause();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (settled) return;
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve({ ok: true, status: 200, body: raw ? JSON.parse(raw) : {} });
      } catch {
        resolve({ ok: false, status: 400, error: "Malformed JSON body." });
      }
    });
    req.on("error", () => {
      if (!settled) resolve({ ok: false, status: 400, error: "Request stream error." });
    });
  });
}
function isMethod(req, method) {
  return (req.method || "GET").toUpperCase() === method;
}
function isCrossOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    const originHost = new URL(origin).host;
    const isTrustedProxy = process.env.GITPOLIS_TRUST_PROXY === "1" || process.env.VERCEL === "1";
    const host = isTrustedProxy ? req.headers["x-forwarded-host"] || req.headers.host : req.headers.host;
    return originHost !== host;
  } catch {
    return true;
  }
}
function getClientIp(req) {
  const isTrustedProxy = process.env.GITPOLIS_TRUST_PROXY === "1" || process.env.VERCEL === "1";
  if (isTrustedProxy) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length > 0) {
      const hops = forwarded.split(",").map((hop) => hop.trim()).filter(Boolean);
      if (hops.length > 0) return hops[hops.length - 1];
    }
  }
  return req.socket?.remoteAddress || "unknown";
}
var BASE_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
};
var PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://avatars.githubusercontent.com https://raw.githubusercontent.com",
  "connect-src 'self' https://api.github.com https://generativelanguage.googleapis.com https://vitals.vercel-insights.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join("; ");

// server/lib/rateLimit.ts
var FixedWindowRateLimiter = class {
  constructor(maxRequests, windowMs, maxKeys = 1e4) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.maxKeys = maxKeys;
  }
  buckets = /* @__PURE__ */ new Map();
  check(key, now = Date.now()) {
    this.prune(now);
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      if (this.buckets.size >= this.maxKeys) this.evictOldest();
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.maxRequests - 1, retryAfterSeconds: 0 };
    }
    if (bucket.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1e3))
      };
    }
    bucket.count += 1;
    return {
      allowed: true,
      remaining: this.maxRequests - bucket.count,
      retryAfterSeconds: 0
    };
  }
  prune(now) {
    if (this.buckets.size < 512) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
  /** Drops the oldest insertion-order bucket. */
  evictOldest() {
    const oldest = this.buckets.keys().next().value;
    if (oldest !== void 0) this.buckets.delete(oldest);
  }
};

// server/api/gemini.ts
var limiter = new FixedWindowRateLimiter(10, 6e4);
var MAX_KEY_LENGTH = 256;
async function handleGeminiDecisionRequest(req, res) {
  if (!isMethod(req, "POST")) {
    sendJson(res, 405, { error: "Method not allowed." }, { Allow: "POST" });
    return;
  }
  if (isCrossOrigin(req)) {
    sendJson(res, 403, { error: "Cross-origin requests are not allowed." });
    return;
  }
  const limit = limiter.check(`gemini:${getClientIp(req)}`);
  if (!limit.allowed) {
    sendJson(
      res,
      429,
      { error: "Too many AI plan requests. Please wait a moment.", rateLimited: true },
      { "Retry-After": String(limit.retryAfterSeconds) }
    );
    return;
  }
  const body = await readJsonBody(req, 192 * 1024);
  if (!body.ok) {
    sendJson(res, body.status, { error: body.error });
    return;
  }
  const payload = body.body?.payload;
  if (!isProfilePayload(payload)) {
    sendJson(res, 400, { error: "Request body must include a valid GitHub profile payload." });
    return;
  }
  const keyHeader = req.headers["x-gemini-key"];
  const clientKey = Array.isArray(keyHeader) ? keyHeader[0] : keyHeader;
  if (typeof clientKey === "string" && clientKey.length > MAX_KEY_LENGTH) {
    sendJson(res, 400, { error: "Gemini API key is malformed." });
    return;
  }
  const apiKey = resolveGeminiKey(typeof clientKey === "string" ? clientKey : void 0);
  if (!apiKey) {
    sendJson(res, 503, {
      error: "No Gemini API key configured. Set GEMINI_API_KEY on the server or supply a key in the app."
    });
    return;
  }
  try {
    const plan = await requestMunicipalPlan(payload, apiKey);
    sendJson(res, 200, { plan });
  } catch (err) {
    if (err instanceof GeminiServiceError) {
      sendJson(res, err.status, { error: err.message });
      return;
    }
    console.error("[GitPolis Gemini Error]", err);
    sendJson(res, 502, { error: "Unexpected error contacting the Gemini Decision API." });
  }
}

// server/vercel/gemini/decisions.ts
async function handler(req, res) {
  try {
    for (const [key, value] of Object.entries(BASE_SECURITY_HEADERS)) {
      res.setHeader(key, value);
    }
    await handleGeminiDecisionRequest(req, res);
  } catch (err) {
    console.error("[Vercel Serverless Function Error]", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : "Serverless function execution failed"
        })
      );
    }
  }
}
export {
  handler as default
};
