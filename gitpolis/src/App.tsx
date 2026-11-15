import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type {
  CameraPreset,
  CityBlueprint,
  ConstructionProgress,
  GitHubProfilePayload,
  HoverInfo,
  SelectionState,
  WeatherMode,
} from './types/city';
import type { MunicipalDecisionPlan } from './types/decision';
import { SHOWCASE_PROFILES } from './data/showcaseProfiles';
import { SAMPLE_DECISION_PLANS } from './data/sampleDecisionPlans';
import { buildCityBlueprint } from './engine/cityPlanner';
import { CitySceneEngine } from './engine/CityScene';
import { fetchGitHubProfileWithProgress } from './services/githubClient';
import {
  executeGeminiMunicipalDecisions,
  computeProfileFingerprint,
} from './services/geminiDecisionEngine';
import { TopBar } from './components/TopBar';
import { LeftSidebar } from './components/LeftSidebar';
import { InspectorDrawer } from './components/InspectorDrawer';
import { TimelineScrubber } from './components/TimelineScrubber';
import { HoverTooltip } from './components/HoverTooltip';
import { PostcardModal } from './components/PostcardModal';
import { CityConstructionSequence } from './components/CityConstructionSequence';
import { DistrictDirectoryModal } from './components/DistrictDirectoryModal';
import { AIMayorModal } from './components/AIMayorModal';

const PLAY_SPEEDS = [1, 3, 8];

export function App() {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CitySceneEngine | null>(null);

  const [blueprint, setBlueprint] = useState<CityBlueprint | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [highlightedLanguage, setHighlightedLanguage] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingUser, setLoadingUser] = useState('');
  const [constructionProgress, setConstructionProgress] = useState<ConstructionProgress | null>(null);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [errorBanner, setErrorBanner] = useState<{ message: string; rateLimited?: boolean } | null>(null);
  const [githubToken, setGithubToken] = useState('');

  // Atmosphere & Camera states
  const [timeOfDay, setTimeOfDay] = useState(14.2);
  const [weather, setWeather] = useState<WeatherMode>('clear');
  const [autoClimate, setAutoClimate] = useState(true);
  const [autoOrbit, setAutoOrbit] = useState(false);
  const [showTransit, setShowTransit] = useState(true);

  // Time-lapse playback states
  const [timelineMs, setTimelineMs] = useState(Date.now());
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1); // default 3x

  // Postcard modal
  const [postcardOpen, setPostcardOpen] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  // Google Gemini Decision API state
  const rawPayloadRef = useRef<GitHubProfilePayload | null>(null);
  const [decisionPlan, setDecisionPlan] = useState<MunicipalDecisionPlan | null>(null);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [aiMayorModalOpen, setAiMayorModalOpen] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState('');

  // Controls hint auto-dismiss
  const [showHint, setShowHint] = useState(true);

  const applyCityPayload = useCallback((payload: GitHubProfilePayload) => {
    rawPayloadRef.current = payload;
    const bp = buildCityBlueprint(payload);
    setBlueprint(bp);
    setSelection(null);
    setHighlightedLanguage(null);
    setIsPlaying(false);
    setAutoClimate(true);
    setTimeOfDay(bp.climate.recommendedTimeOfDay);
    setWeather(bp.climate.recommendedWeather);
    setTimelineMs(bp.timeline.endTime);

    if (engineRef.current) {
      engineRef.current.loadBlueprint(bp);
    }

    // Auto-check if a decision plan already exists in local storage cache or curated plans
    const cacheKey = computeProfileFingerprint(payload);
    const cachedRaw = localStorage.getItem(`gitpolis_plan_${cacheKey}`);
    const username = payload.user.login.toLowerCase();
    const curated = SAMPLE_DECISION_PLANS[username] || null;

    if (cachedRaw) {
      try {
        const parsedPlan = JSON.parse(cachedRaw);
        setDecisionPlan(parsedPlan);
        engineRef.current?.applyDecisionPlan(parsedPlan);
      } catch {
        setDecisionPlan(curated);
        if (curated) engineRef.current?.applyDecisionPlan(curated);
      }
    } else if (curated) {
      setDecisionPlan(curated);
      engineRef.current?.applyDecisionPlan(curated);
    } else {
      setDecisionPlan(null);
    }
  }, []);

  const handleTriggerAIDecisions = useCallback(
    async (customKey?: string) => {
      if (!rawPayloadRef.current) return;
      setIsAIGenerating(true);
      setErrorBanner(null);
      try {
        const plan = await executeGeminiMunicipalDecisions(
          rawPayloadRef.current,
          customKey,
          (status) => setAiStatusMessage(status)
        );
        setDecisionPlan(plan);
        engineRef.current?.applyDecisionPlan(plan);
        setBlueprint((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            cityName: plan.citySummary.civicTitle,
            citySubtitle: `${plan.citySummary.developerArchetype} • AI Orchestrated`,
          };
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gemini Decision API failed';
        setErrorBanner({ message: msg });
      } finally {
        setIsAIGenerating(false);
        setAiStatusMessage('');
      }
    },
    []
  );

  const handleSearchGitHub = useCallback(
    async (username: string) => {
      const cleaned = username.trim().replace(/^@/, '');
      if (!cleaned) return;
      setErrorBanner(null);
      setIsLoading(true);
      setLoadingUser(cleaned);
      setConstructionProgress({
        phase: 'survey',
        phaseIndex: 1,
        totalPhases: 5,
        percentage: 15,
        headline: `Surveying @${cleaned}`,
        detail: 'Connecting to GitHub satellites and surveying public profile repositories…',
      });

      try {
        const payload = await fetchGitHubProfileWithProgress(
          cleaned,
          githubToken,
          (prog) => setConstructionProgress(prog)
        );

        if (!payload.repos || payload.repos.length === 0) {
          setErrorBanner({
            message: `@${payload.user.login} currently has 0 public repositories to build districts from.`,
          });
        }
        applyCityPayload(payload);

        // Update URL query parameter seamlessly
        const url = new URL(window.location.href);
        url.searchParams.set('user', cleaned);
        window.history.replaceState({}, '', url.toString());
      } catch (err) {
        setErrorBanner({
          message: err instanceof Error ? err.message : 'Could not build city for this GitHub profile.',
        });
      } finally {
        setIsLoading(false);
        setConstructionProgress(null);
      }
    },
    [githubToken, applyCityPayload]
  );

  // Initialize Three.js WebGL engine once
  useEffect(() => {
    if (!canvasHostRef.current) return;
    const engine = new CitySceneEngine(canvasHostRef.current, {
      onHover: (info) => setHoverInfo(info),
      onSelect: (sel) => setSelection(sel),
    });
    engineRef.current = engine;

    // Check query params (?user=...) on boot to load requested user, or boot showcase city instantly
    const params = new URLSearchParams(window.location.search);
    const initialUser = params.get('user');
    if (initialUser && initialUser.trim()) {
      handleSearchGitHub(initialUser.trim());
    } else {
      // Load instant polyglot showcase city on boot so viewport is alive in <100ms
      applyCityPayload(SHOWCASE_PROFILES['atelier-dev']);
    }

    const hintTimer = window.setTimeout(() => setShowHint(false), 9000);
    return () => {
      window.clearTimeout(hintTimer);
      engine.dispose();
      engineRef.current = null;
    };
  }, [applyCityPayload, handleSearchGitHub]);

  // Time-lapse animation RAF loop
  useEffect(() => {
    if (!isPlaying || !blueprint) return;
    let rafId = 0;
    let lastTs = performance.now();
    const { startTime, endTime } = blueprint.timeline;
    const span = Math.max(86400000 * 30, endTime - startTime);
    const speed = PLAY_SPEEDS[speedIndex];
    // Full history plays in ~18s at 1x, ~6s at 3x, ~2.2s at 8x
    const msPerSec = (span / 18) * speed;

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;
      setTimelineMs((prev) => {
        const next = prev + msPerSec * dt;
        if (next >= endTime) {
          setIsPlaying(false);
          engineRef.current?.setTimelineCursor(endTime);
          return endTime;
        }
        engineRef.current?.setTimelineCursor(next);
        return next;
      });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, blueprint, speedIndex]);

  const handleLoadShowcase = useCallback(() => {
    setErrorBanner(null);
    applyCityPayload(SHOWCASE_PROFILES['atelier-dev']);
  }, [applyCityPayload]);

  const handleSetTimeOfDay = (h: number) => {
    setAutoClimate(false);
    setTimeOfDay(h);
    engineRef.current?.setTimeOfDay(h);
  };

  const handleSetWeather = (w: WeatherMode) => {
    setAutoClimate(false);
    setWeather(w);
    engineRef.current?.setWeather(w);
  };

  const handleResetAutoClimate = () => {
    if (!blueprint) return;
    setAutoClimate(true);
    setTimeOfDay(blueprint.climate.recommendedTimeOfDay);
    setWeather(blueprint.climate.recommendedWeather);
    engineRef.current?.setTimeOfDay(blueprint.climate.recommendedTimeOfDay);
    engineRef.current?.setWeather(blueprint.climate.recommendedWeather);
  };

  const handleCameraPreset = (preset: CameraPreset) => {
    if (preset === 'orbit') {
      setAutoOrbit((v) => !v);
    } else {
      setAutoOrbit(false);
    }
    engineRef.current?.applyCameraPreset(preset);
  };

  const handleToggleTransit = () => {
    setShowTransit((prev) => {
      const next = !prev;
      engineRef.current?.setShowTransitLinks(next);
      return next;
    });
  };

  const handleSelect = (sel: SelectionState | null) => {
    setSelection(sel);
    engineRef.current?.setSelection(sel, true);
  };

  const handleHighlightLanguage = (lang: string | null) => {
    setHighlightedLanguage(lang);
    engineRef.current?.setHighlightedLanguage(lang);
  };

  const handleTogglePlay = () => {
    if (!blueprint) return;
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    // If at end, restart cleanly from founding date!
    if (timelineMs >= blueprint.timeline.endTime - 86400000) {
      setTimelineMs(blueprint.timeline.startTime);
      engineRef.current?.setTimelineCursor(blueprint.timeline.startTime);
    }
    setIsPlaying(true);
  };

  const handleChangeTimeline = (ms: number) => {
    setIsPlaying(false);
    setTimelineMs(ms);
    engineRef.current?.setTimelineCursor(ms);
  };

  const handleResetPresent = () => {
    if (!blueprint) return;
    setIsPlaying(false);
    setTimelineMs(blueprint.timeline.endTime);
    engineRef.current?.setTimelineCursor(blueprint.timeline.endTime);
  };

  const handleOpenPostcard = () => {
    const dataUrl = engineRef.current?.captureSnapshotDataUrl() ?? null;
    setSnapshotUrl(dataUrl);
    setPostcardOpen(true);
  };

  // Switch frosted HUD glass smoothly to dark nocturnal theme during dusk/night!
  const isNightUI = timeOfDay >= 19.2 || timeOfDay < 6.4;

  useEffect(() => {
    if (isNightUI) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isNightUI]);

  return (
    <div className={`relative h-screen w-screen overflow-hidden bg-[#141c24] ${isNightUI ? 'dark' : ''}`}>
      {/* Full-Viewport Interactive 3D WebGL Living City Canvas */}
      <div ref={canvasHostRef} className="absolute inset-0 h-full w-full" />

      {/* Top Floating Command Bar */}
      <TopBar
        blueprint={blueprint}
        decisionPlan={decisionPlan}
        isAIGenerating={isAIGenerating}
        isLoading={isLoading}
        isNightUI={isNightUI}
        timeOfDay={timeOfDay}
        weather={weather}
        autoClimate={autoClimate}
        autoOrbit={autoOrbit}
        showTransit={showTransit}
        githubToken={githubToken}
        onSearch={handleSearchGitHub}
        onLoadShowcase={handleLoadShowcase}
        onTokenChange={setGithubToken}
        onSetTimeOfDay={handleSetTimeOfDay}
        onSetWeather={handleSetWeather}
        onResetAutoClimate={handleResetAutoClimate}
        onCameraPreset={handleCameraPreset}
        onToggleTransit={handleToggleTransit}
        onOpenPostcard={handleOpenPostcard}
        onOpenDirectory={() => setDirectoryOpen(true)}
        onOpenAIMayor={() => setAiMayorModalOpen(true)}
      />

      {/* Error / Rate-Limit Toast */}
      {errorBanner && (
        <div className="pointer-events-auto fixed top-20 left-1/2 z-40 w-[92%] max-w-lg -translate-x-1/2">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-slate-900/92 px-4 py-3 text-xs text-slate-100 shadow-2xl backdrop-blur-lg">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="flex-1 leading-relaxed">
              <p className="font-medium">{errorBanner.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Left Collapsible City Profile & All-Repos Directory */}
      {blueprint && (
        <LeftSidebar
          blueprint={blueprint}
          isNightUI={isNightUI}
          selection={selection}
          highlightedLanguage={highlightedLanguage}
          onSelect={handleSelect}
          onHighlightLanguage={handleHighlightLanguage}
        />
      )}

      {/* Right Contextual Architectural Inspector (District / Building / Civic Plaza) */}
      {blueprint && selection && (
        <InspectorDrawer
          blueprint={blueprint}
          selection={selection}
          isNightUI={isNightUI}
          onClose={() => handleSelect(null)}
          onSelect={handleSelect}
        />
      )}

      {/* Subtle Free-Camera Hint Pill */}
      {showHint && !selection && (
        <div className="pointer-events-none fixed bottom-20 left-1/2 z-10 hidden -translate-x-1/2 md:block">
          <div
            className={`${isNightUI ? 'glass-panel-dark' : 'glass-panel'} rounded-full px-4 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-100 shadow-lg`}
          >
            Drag to Orbit • Right-Drag / WASD to Fly • Scroll to Zoom • Click any Repo Block or Tower
          </div>
        </div>
      )}

      {/* Bottom Chronological Growth Time-Lapse Scrubber */}
      {blueprint && (
        <TimelineScrubber
          blueprint={blueprint}
          isNightUI={isNightUI}
          timelineMs={timelineMs}
          isPlaying={isPlaying}
          speed={PLAY_SPEEDS[speedIndex]}
          isDrawerOpen={Boolean(selection)}
          onChangeTime={handleChangeTimeline}
          onTogglePlay={handleTogglePlay}
          onCycleSpeed={() => setSpeedIndex((i) => (i + 1) % PLAY_SPEEDS.length)}
          onResetPresent={handleResetPresent}
        />
      )}

      {/* Floating Cursor Hover Tooltip */}
      <HoverTooltip info={hoverInfo} isNightUI={isNightUI} />

      {/* Shareable City Postcard Modal */}
      {postcardOpen && blueprint && (
        <PostcardModal
          blueprint={blueprint}
          snapshotDataUrl={snapshotUrl}
          onClose={() => setPostcardOpen(false)}
        />
      )}

      {/* Live Interactive Municipal Construction Sequence HUD */}
      {isLoading && (
        <CityConstructionSequence
          username={loadingUser}
          progress={constructionProgress}
          onCancel={() => {
            setIsLoading(false);
            setConstructionProgress(null);
          }}
          onLoadShowcase={handleLoadShowcase}
        />
      )}

      {/* Full Municipal Cadastre District Directory Modal */}
      {blueprint && directoryOpen && (
        <DistrictDirectoryModal
          open={directoryOpen}
          blueprint={blueprint}
          isNightUI={isNightUI}
          selectedDistrictId={selection?.districtId}
          onSelectDistrict={(districtId) => {
            handleSelect({ type: 'district', districtId });
            setDirectoryOpen(false);
          }}
          onClose={() => setDirectoryOpen(false)}
        />
      )}

      {/* Google Gemini AI Mayor & Municipal Decision Engine Modal */}
      <AIMayorModal
        open={aiMayorModalOpen}
        isNightUI={isNightUI}
        username={blueprint?.profile.login || loadingUser || 'developer'}
        plan={decisionPlan}
        isLoading={isAIGenerating}
        statusMessage={aiStatusMessage}
        onClose={() => setAiMayorModalOpen(false)}
        onGeneratePlan={handleTriggerAIDecisions}
      />
    </div>
  );
}

export default App;
