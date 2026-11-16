import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type {
  CameraPreset,
  CityBlueprint,
  ConstructionProgress,
  GitHubProfilePayload,
} from '../domain/city/types';
import type { MunicipalDecisionPlan } from '../domain/decision';
import { buildCityBlueprint } from '../domain/city/planning';
import { withDecisionCritique } from '../domain/city/analysis';
import { SHOWCASE_PROFILES } from '../data/showcaseProfiles';
import { SAMPLE_DECISION_PLANS } from '../data/sampleDecisionPlans';
import { fetchGitHubProfileWithProgress } from '../services/github/client';
import {
  computeProfileFingerprint,
  executeGeminiMunicipalDecisions,
  getCachedDecisionSync,
} from '../services/gemini';
import { TopBar } from '../components/hud/TopBar';
import { TimelineScrubber } from '../components/hud/TimelineScrubber';
import { HoverTooltip } from '../components/hud/HoverTooltip';
import { CityConstructionSequence } from '../components/hud/CityConstructionSequence';
import { LeftSidebar } from '../components/panels/LeftSidebar';
import { InspectorDrawer } from '../components/panels/InspectorDrawer';
import { PostcardModal } from '../components/modals/PostcardModal';
import { DistrictDirectoryModal } from '../components/modals/DistrictDirectoryModal';
import { AIMayorModal } from '../components/modals/AIMayorModal';
import { useCityEngine } from './hooks/useCityEngine';
import { useTimelinePlayback } from './hooks/useTimelinePlayback';
import { useClimateControls } from './hooks/useClimateControls';

const HINT_TIMEOUT_MS = 9_000;

export function App() {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);

  // 3D engine, selection + hover
  const { engineRef, hoverInfo, selection, highlightedLanguage, select, highlightLanguage } =
    useCityEngine(canvasHostRef);

  // City data
  const [blueprint, setBlueprint] = useState<CityBlueprint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingUser, setLoadingUser] = useState('');
  const [constructionProgress, setConstructionProgress] = useState<ConstructionProgress | null>(null);
  const [errorBanner, setErrorBanner] = useState<{ message: string; rateLimited?: boolean } | null>(
    null
  );
  const [githubToken, setGithubToken] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  // The token is read through a ref so the search callback keeps a stable
  // identity; otherwise the boot effect would re-run whenever it changes.
  const githubTokenRef = useRef(githubToken);
  useEffect(() => {
    githubTokenRef.current = githubToken;
  }, [githubToken]);

  // AI decision plan
  const rawPayloadRef = useRef<GitHubProfilePayload | null>(null);
  const [decisionPlan, setDecisionPlan] = useState<MunicipalDecisionPlan | null>(null);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [aiMayorModalOpen, setAiMayorModalOpen] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState('');

  // Derived controllers
  const timeline = useTimelinePlayback(blueprint, engineRef);
  const climate = useClimateControls(blueprint, engineRef);

  // Camera + overlay toggles
  const [autoOrbit, setAutoOrbit] = useState(false);
  const [showTransit, setShowTransit] = useState(true);

  // Modals
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [postcardOpen, setPostcardOpen] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(true);

  const applyCityPayload = useCallback((payload: GitHubProfilePayload) => {
    rawPayloadRef.current = payload;
    const nextBlueprint = buildCityBlueprint(payload);
    setBlueprint(nextBlueprint);
    select(null);
    highlightLanguage(null);
    engineRef.current?.loadBlueprint(nextBlueprint);

    // Restore a cached/curated AI plan for this profile, if one exists.
    const cacheKey = computeProfileFingerprint(payload);
    const cachedPlan = getCachedDecisionSync(cacheKey);
    const username = payload.user.login.toLowerCase();
    const curated = Object.hasOwn(SAMPLE_DECISION_PLANS, username)
      ? SAMPLE_DECISION_PLANS[username]
      : null;
    const plan = cachedPlan ?? curated;

    setDecisionPlan(plan);
    if (plan) engineRef.current?.applyDecisionPlan(plan);
  }, [engineRef, select, highlightLanguage]);

  const handleTriggerAIDecisions = useCallback(async (customKey?: string) => {
    if (!rawPayloadRef.current) return;
    setIsAIGenerating(true);
    setErrorBanner(null);

    try {
      const plan = await executeGeminiMunicipalDecisions(
        rawPayloadRef.current,
        customKey,
        setAiStatusMessage
      );
      setDecisionPlan(plan);
      engineRef.current?.applyDecisionPlan(plan);
      setBlueprint((previous) =>
        previous
          ? {
              ...withDecisionCritique(previous, plan),
              cityName: plan.citySummary.civicTitle,
              citySubtitle: `${plan.citySummary.developerArchetype} • AI Orchestrated`,
            }
          : previous
      );
    } catch (err) {
      setErrorBanner({
        message: err instanceof Error ? err.message : 'Gemini Decision API failed',
      });
    } finally {
      setIsAIGenerating(false);
      setAiStatusMessage('');
    }
  }, [engineRef]);

  const handleSearchGitHub = useCallback(
    async (username: string) => {
      const cleaned = username.trim().replace(/^@/, '');
      if (!cleaned) return;

      // Abandon any previous build so its requests stop consuming quota.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

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
          githubTokenRef.current,
          setConstructionProgress,
          { signal: controller.signal }
        );

        if (!payload.repos || payload.repos.length === 0) {
          setErrorBanner({
            message: `@${payload.user.login} currently has 0 public repositories to build districts from.`,
          });
        }
        applyCityPayload(payload);

        const url = new URL(window.location.href);
        url.searchParams.set('user', cleaned);
        window.history.replaceState({}, '', url.toString());
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setErrorBanner({
          message:
            err instanceof Error ? err.message : 'Could not build city for this GitHub profile.',
        });
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setIsLoading(false);
        setConstructionProgress(null);
      }
    },
    [applyCityPayload]
  );

  // Boot: honour ?user=… otherwise render the instant showcase city.
  useEffect(() => {
    const initialUser = new URLSearchParams(window.location.search).get('user');
    if (initialUser?.trim()) {
      // Mount-time kickoff: starts an async fetch and owns the construction HUD.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void handleSearchGitHub(initialUser.trim());
    } else {
      applyCityPayload(SHOWCASE_PROFILES['atelier-dev']);
    }

    const hintTimer = window.setTimeout(() => setShowHint(false), HINT_TIMEOUT_MS);
    return () => window.clearTimeout(hintTimer);
  }, [applyCityPayload, handleSearchGitHub]);

  const handleLoadShowcase = useCallback(() => {
    setErrorBanner(null);
    applyCityPayload(SHOWCASE_PROFILES['atelier-dev']);
  }, [applyCityPayload]);

  const handleCameraPreset = useCallback(
    (preset: CameraPreset) => {
      setAutoOrbit(preset === 'orbit' ? (value) => !value : false);
      engineRef.current?.applyCameraPreset(preset);
    },
    [engineRef]
  );

  const handleToggleTransit = useCallback(() => {
    setShowTransit((previous) => {
      const next = !previous;
      engineRef.current?.setShowTransitLinks(next);
      return next;
    });
  }, [engineRef]);

  const handleOpenPostcard = useCallback(() => {
    setSnapshotUrl(engineRef.current?.captureSnapshotDataUrl() ?? null);
    setPostcardOpen(true);
  }, [engineRef]);

  const isNightUI = climate.isNightUI;

  return (
    <div className={`relative h-screen w-screen overflow-hidden bg-[#141c24] ${isNightUI ? 'dark' : ''}`}>
      <div ref={canvasHostRef} className="absolute inset-0 h-full w-full" />

      <TopBar
        blueprint={blueprint}
        decisionPlan={decisionPlan}
        isAIGenerating={isAIGenerating}
        isLoading={isLoading}
        isNightUI={isNightUI}
        timeOfDay={climate.timeOfDay}
        weather={climate.weather}
        autoClimate={climate.autoClimate}
        autoOrbit={autoOrbit}
        showTransit={showTransit}
        githubToken={githubToken}
        onSearch={handleSearchGitHub}
        onLoadShowcase={handleLoadShowcase}
        onTokenChange={setGithubToken}
        onSetTimeOfDay={climate.setTimeOfDay}
        onSetWeather={climate.setWeather}
        onResetAutoClimate={climate.resetAutoClimate}
        onCameraPreset={handleCameraPreset}
        onToggleTransit={handleToggleTransit}
        onOpenPostcard={handleOpenPostcard}
        onOpenDirectory={() => setDirectoryOpen(true)}
        onOpenAIMayor={() => setAiMayorModalOpen(true)}
      />

      {errorBanner && (
        <div className="pointer-events-auto fixed top-20 left-1/2 z-[60] w-[92%] max-w-lg -translate-x-1/2">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-slate-900/92 px-4 py-3 text-xs text-slate-100 shadow-2xl backdrop-blur-lg">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="flex-1 leading-relaxed">
              <p className="font-medium">{errorBanner.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {blueprint && (
        <LeftSidebar
          blueprint={blueprint}
          isNightUI={isNightUI}
          selection={selection}
          highlightedLanguage={highlightedLanguage}
          onSelect={select}
          onHighlightLanguage={highlightLanguage}
        />
      )}

      {blueprint && selection && (
        <InspectorDrawer
          blueprint={blueprint}
          selection={selection}
          isNightUI={isNightUI}
          onClose={() => select(null)}
          onSelect={select}
        />
      )}

      {showHint && !selection && (
        <div className="pointer-events-none fixed bottom-20 left-1/2 z-10 hidden -translate-x-1/2 md:block">
          <div
            className={`${isNightUI ? 'glass-panel-dark' : 'glass-panel'} rounded-full px-4 py-1.5 text-[11px] font-bold text-slate-800 shadow-lg dark:text-slate-100`}
          >
            Drag to Orbit • Right-Drag / WASD to Fly • Scroll to Zoom • Click any Repo Block or Tower
          </div>
        </div>
      )}

      {blueprint && (
        <TimelineScrubber
          blueprint={blueprint}
          isNightUI={isNightUI}
          timelineMs={timeline.timelineMs}
          isPlaying={timeline.isPlaying}
          speed={timeline.playbackSpeed}
          isDrawerOpen={Boolean(selection)}
          onChangeTime={timeline.changeTimeline}
          onTogglePlay={timeline.togglePlay}
          onCycleSpeed={timeline.cycleSpeed}
          onResetPresent={timeline.resetToPresent}
        />
      )}

      <HoverTooltip info={hoverInfo} isNightUI={isNightUI} />

      {postcardOpen && blueprint && (
        <PostcardModal
          blueprint={blueprint}
          snapshotDataUrl={snapshotUrl}
          onClose={() => setPostcardOpen(false)}
        />
      )}

      {isLoading && (
        <CityConstructionSequence
          username={loadingUser}
          progress={constructionProgress}
          onCancel={() => {
            abortRef.current?.abort();
            abortRef.current = null;
            setIsLoading(false);
            setConstructionProgress(null);
          }}
          onLoadShowcase={handleLoadShowcase}
        />
      )}

      {blueprint && directoryOpen && (
        <DistrictDirectoryModal
          open={directoryOpen}
          blueprint={blueprint}
          isNightUI={isNightUI}
          selectedDistrictId={selection?.districtId}
          onSelectDistrict={(districtId) => {
            select({ type: 'district', districtId });
            setDirectoryOpen(false);
          }}
          onClose={() => setDirectoryOpen(false)}
        />
      )}

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
