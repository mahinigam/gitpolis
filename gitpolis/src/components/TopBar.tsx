import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Sun,
  Sunset,
  Moon,
  CloudRain,
  CloudFog,
  Sparkles,
  KeyRound,
  Camera,
  Compass,
  Eye,
  Map as MapIcon,
  RotateCw,
  GitBranch,
  Building2,
  X,
  Check,
} from 'lucide-react';
import type { CameraPreset, CityBlueprint, WeatherMode } from '../types/city';
import type { MunicipalDecisionPlan } from '../types/decision';
import { QUICK_TRY_USERNAMES } from '../data/showcaseProfiles';

interface TopBarProps {
  blueprint: CityBlueprint | null;
  decisionPlan?: MunicipalDecisionPlan | null;
  isAIGenerating?: boolean;
  isLoading: boolean;
  isNightUI: boolean;
  timeOfDay: number;
  weather: WeatherMode;
  autoClimate: boolean;
  autoOrbit: boolean;
  showTransit: boolean;
  githubToken: string;
  onSearch: (username: string) => void;
  onLoadShowcase: () => void;
  onTokenChange: (token: string) => void;
  onSetTimeOfDay: (h: number) => void;
  onSetWeather: (w: WeatherMode) => void;
  onResetAutoClimate: () => void;
  onCameraPreset: (p: CameraPreset) => void;
  onToggleTransit: () => void;
  onOpenPostcard: () => void;
  onOpenDirectory?: () => void;
  onOpenAIMayor?: () => void;
}

function formatHour(h: number): string {
  const norm = ((h % 24) + 24) % 24;
  const hrs = Math.floor(norm);
  const mins = Math.floor((norm - hrs) * 60);
  const suffix = hrs >= 12 ? 'PM' : 'AM';
  const h12 = hrs % 12 === 0 ? 12 : hrs % 12;
  return `${h12}:${mins.toString().padStart(2, '0')} ${suffix}`;
}

export const TopBar: React.FC<TopBarProps> = ({
  blueprint,
  decisionPlan,
  isAIGenerating,
  isLoading,
  isNightUI,
  timeOfDay,
  weather,
  autoClimate,
  autoOrbit,
  showTransit,
  githubToken,
  onSearch,
  onLoadShowcase,
  onTokenChange,
  onSetTimeOfDay,
  onSetWeather,
  onResetAutoClimate,
  onCameraPreset,
  onToggleTransit,
  onOpenPostcard,
  onOpenDirectory,
  onOpenAIMayor,
}) => {
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [showAtmoMenu, setShowAtmoMenu] = useState(false);
  const [showTokenMenu, setShowTokenMenu] = useState(false);
  const [tokenDraft, setTokenDraft] = useState(githubToken);

  const searchRef = useRef<HTMLDivElement>(null);
  const atmoRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
      if (atmoRef.current && !atmoRef.current.contains(e.target as Node)) {
        setShowAtmoMenu(false);
      }
      if (tokenRef.current && !tokenRef.current.contains(e.target as Node)) {
        setShowTokenMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const panelClass = isNightUI ? 'glass-panel-dark' : 'glass-panel';
  const subtleText = isNightUI ? 'text-slate-200' : 'text-slate-700';
  const hoverBg = isNightUI ? 'hover:bg-white/14 hover:text-white' : 'hover:bg-slate-900/10 hover:text-slate-950';
  const activeBg = isNightUI
    ? 'bg-amber-500/30 text-amber-100 border-amber-400/60 shadow-xs'
    : 'bg-amber-500/20 text-amber-950 border-amber-500/60 shadow-xs font-bold';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = query.trim().replace(/^@/, '');
    if (!cleaned) return;
    setSearchFocused(false);
    onSearch(cleaned);
  };

  return (
    <header className="pointer-events-none fixed top-0 left-0 right-0 z-30 flex items-center justify-between gap-2 p-2 sm:px-4">
      {/* Left: Brand + Search */}
      <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Brand Badge */}
        <div className={`${panelClass} flex h-9 items-center gap-2 rounded-2xl px-3`}>
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xs">
            <Building2 className="h-3.5 w-3.5" />
          </div>
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-display text-sm font-bold tracking-tight text-slate-950 dark:text-white">GitPolis</span>
            {blueprint && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  blueprint.source === 'live'
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-500/50'
                    : 'bg-amber-100 text-amber-950 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-500/50'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    blueprint.source === 'live' ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-amber-600 dark:bg-amber-400'
                  }`}
                />
                {blueprint.source === 'live' ? 'Live' : 'Showcase'}
              </span>
            )}
          </div>
        </div>

        {/* GitHub Username Search Pill */}
        <div ref={searchRef} className="relative">
          <form
            onSubmit={handleSubmit}
            className={`${panelClass} flex h-9 items-center gap-1.5 rounded-2xl px-2.5 transition-all`}
          >
            <Search className={`h-3.5 w-3.5 shrink-0 ${subtleText}`} />
            <span className={`font-mono-code text-xs font-bold ${subtleText}`}>@</span>
            <input
              type="text"
              value={query}
              onFocus={() => setSearchFocused(true)}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="github username..."
              aria-label="GitHub username"
              className="w-20 bg-transparent text-xs font-semibold text-slate-950 outline-none placeholder:text-slate-600 dark:text-white dark:placeholder:text-slate-300 sm:w-28 md:w-36 lg:w-44"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className={`rounded-lg p-0.5 ${subtleText} ${hoverBg}`}
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="rounded-xl bg-slate-900 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer dark:bg-amber-600 dark:hover:bg-amber-500"
            >
              {isLoading ? 'Building…' : 'Build'}
            </button>
          </form>

          {/* Quick-Try Developers Popover */}
          {searchFocused && (
            <div
              className={`${panelClass} absolute left-0 top-full mt-2 w-80 rounded-2xl p-3 shadow-2xl`}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${subtleText}`}>
                  Explore Live GitHub Cities
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchFocused(false);
                    onLoadShowcase();
                  }}
                  className="text-[11px] font-bold text-amber-600 hover:underline cursor-pointer dark:text-amber-400"
                >
                  Polyglot Showcase
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_TRY_USERNAMES.map((item) => (
                  <button
                    key={item.username}
                    type="button"
                    onClick={() => {
                      setQuery(item.username);
                      setSearchFocused(false);
                      onSearch(item.username);
                    }}
                    className={`flex flex-col items-start rounded-xl border border-transparent px-2.5 py-2 text-left transition cursor-pointer ${hoverBg} hover:border-amber-500/25`}
                  >
                    <span className="font-mono-code text-xs font-bold">@{item.label}</span>
                    <span className={`text-[10.5px] ${subtleText}`}>{item.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Optional GitHub PAT Token Button */}
        <div ref={tokenRef} className="relative">
          <button
            type="button"
            onClick={() => setShowTokenMenu((v) => !v)}
            title="Optional GitHub Personal Access Token (5,000 req/hr)"
            className={`${panelClass} flex h-9 items-center gap-1.5 rounded-2xl border px-2.5 text-xs font-semibold transition cursor-pointer ${
              githubToken ? 'border-emerald-500/50 bg-emerald-500/10' : `border-transparent ${hoverBg}`
            }`}
          >
            <KeyRound className={`h-3.5 w-3.5 ${githubToken ? 'text-emerald-500' : subtleText}`} />
            <span className="hidden xl:inline">{githubToken ? 'Token Active' : 'API Key'}</span>
          </button>

          {showTokenMenu && (
            <div className={`${panelClass} absolute left-0 top-full mt-2 w-80 rounded-2xl p-3.5 shadow-2xl`}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-display text-xs font-bold">Optional GitHub Token</span>
                {blueprint?.rateLimit && (
                  <span className={`font-mono-code text-[10px] ${subtleText}`}>
                    {blueprint.rateLimit.remaining}/{blueprint.rateLimit.limit} left
                  </span>
                )}
              </div>
              <p className={`mb-2.5 text-[11.5px] leading-relaxed ${subtleText}`}>
                Public GitHub lookups allow 60 req/hr. Adding a read-only token boosts this to 5,000 req/hr and fetches
                deeper commit history across more repos. Kept in memory only.
              </p>
              <div className="flex gap-1.5">
                <input
                  type="password"
                  value={tokenDraft}
                  onChange={(e) => setTokenDraft(e.target.value)}
                  placeholder="ghp_••••••••••••"
                  className={`flex-1 rounded-xl border px-2.5 py-1.5 font-mono-code text-xs outline-none ${
                    isNightUI
                      ? 'border-white/15 bg-black/25 text-white'
                      : 'border-slate-300/70 bg-white/70 text-slate-900'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    onTokenChange(tokenDraft.trim());
                    setShowTokenMenu(false);
                  }}
                  className="flex items-center gap-1 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  Save
                </button>
              </div>
              {githubToken && (
                <button
                  type="button"
                  onClick={() => {
                    setTokenDraft('');
                    onTokenChange('');
                  }}
                  className="mt-2 text-[11px] font-medium text-rose-500 hover:underline cursor-pointer"
                >
                  Clear saved token
                </button>
              )}
            </div>
          )}
        </div>

        {/* Cadastre Directory Button */}
        {onOpenDirectory && (
          <button
            type="button"
            onClick={onOpenDirectory}
            title="Open Full District Directory & Cadastre"
            className={`${panelClass} flex h-9 items-center gap-1.5 rounded-2xl border border-transparent px-2.5 text-xs font-semibold transition cursor-pointer hover:border-amber-500/50`}
          >
            <Building2 className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span className="hidden md:inline">Directory</span>
            {blueprint && (
              <span className="ml-0.5 rounded-full bg-slate-900/10 dark:bg-white/10 px-1.5 py-0.2 font-mono-code text-[10px] font-bold">
                {blueprint.districts.length}
              </span>
            )}
          </button>
        )}

        {/* AI Mayor / Gemini Decision Engine Button */}
        {onOpenAIMayor && (
          <button
            type="button"
            onClick={onOpenAIMayor}
            title="Google Gemini Decision Engine (Autonomous Urban Architect & Historical Lore)"
            className={`${panelClass} flex h-9 items-center gap-1.5 rounded-2xl border px-2.5 text-xs font-bold transition cursor-pointer ${
              decisionPlan
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                : isAIGenerating
                  ? 'border-amber-500/50 bg-amber-500/15 text-amber-900 dark:text-amber-200 animate-pulse'
                  : `border-transparent ${hoverBg}`
            }`}
          >
            <Sparkles className={`h-3.5 w-3.5 ${decisionPlan ? 'text-emerald-500' : 'text-amber-500'}`} />
            <span className="hidden xl:inline">
              {decisionPlan ? 'AI Mayor Active' : isAIGenerating ? 'Planning…' : 'AI Mayor'}
            </span>
          </button>
        )}
      </div>

      {/* Right: Atmosphere, Camera & Postcard Controls */}
      <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Atmosphere & Time Pill */}
        <div ref={atmoRef} className="relative">
          <div className={`${panelClass} flex h-9 items-center gap-0.5 sm:gap-1 rounded-2xl px-1.5`}>
            <button
              type="button"
              onClick={onResetAutoClimate}
              title="Auto atmosphere driven by GitHub commit activity"
              className={`flex items-center gap-1.5 rounded-xl border px-2 py-1 text-xs font-semibold transition cursor-pointer ${
                autoClimate ? activeBg : `border-transparent ${hoverBg}`
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden 2xl:inline">Live Climate</span>
            </button>
            <button
              type="button"
              onClick={() => onSetTimeOfDay(13.5)}
              title="Daylight (1:30 PM)"
              className={`rounded-xl border p-1.5 transition cursor-pointer ${
                !autoClimate && timeOfDay >= 8 && timeOfDay < 16 ? activeBg : `border-transparent ${hoverBg}`
              }`}
            >
              <Sun className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onSetTimeOfDay(17.4)}
              title="Golden Hour (5:24 PM)"
              className={`rounded-xl border p-1.5 transition cursor-pointer ${
                !autoClimate && timeOfDay >= 16 && timeOfDay < 19.5 ? activeBg : `border-transparent ${hoverBg}`
              }`}
            >
              <Sunset className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onSetTimeOfDay(22.2)}
              title="Starlit Night (10:12 PM)"
              className={`rounded-xl border p-1.5 transition cursor-pointer ${
                !autoClimate && (timeOfDay >= 19.5 || timeOfDay < 6.5) ? activeBg : `border-transparent ${hoverBg}`
              }`}
            >
              <Moon className="h-3.5 w-3.5" />
            </button>

            <div className={`mx-0.5 h-4 w-px ${isNightUI ? 'bg-white/20' : 'bg-slate-300'}`} />

            <button
              type="button"
              onClick={() => setShowAtmoMenu((v) => !v)}
              className={`flex items-center gap-1 rounded-xl border border-transparent px-1.5 py-1 font-mono-code text-[11px] font-bold transition cursor-pointer ${hoverBg}`}
              title="Fine-tune Sun Time & Weather"
            >
              {weather === 'rain' ? (
                <CloudRain className="h-3.5 w-3.5 text-sky-500" />
              ) : weather === 'mist' ? (
                <CloudFog className="h-3.5 w-3.5 text-amber-500" />
              ) : (
                <Sun className="h-3.5 w-3.5 text-amber-500" />
              )}
              <span className="hidden sm:inline tabular-nums">{formatHour(timeOfDay)}</span>
            </button>
          </div>

          {showAtmoMenu && (
            <div className={`${panelClass} absolute right-0 top-full mt-2 w-72 rounded-2xl p-3.5 shadow-2xl`}>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-display text-xs font-bold">Time of Day</span>
                <span className="font-mono-code text-xs tabular-nums font-bold">{formatHour(timeOfDay)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={23.9}
                step={0.1}
                value={timeOfDay}
                onChange={(e) => onSetTimeOfDay(parseFloat(e.target.value))}
                className="city-slider mb-3.5 w-full"
              />
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-display text-xs font-bold">Weather</span>
                {blueprint && (
                  <span className={`text-[10.5px] font-medium ${subtleText}`}>
                    Live: {blueprint.climate.recommendedWeather}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(['clear', 'mist', 'rain'] as WeatherMode[]).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => onSetWeather(w)}
                    className={`flex items-center justify-center gap-1 rounded-xl border py-1.5 text-xs font-bold capitalize transition cursor-pointer ${
                      weather === w ? activeBg : `border-transparent ${hoverBg}`
                    }`}
                  >
                    {w === 'clear' && <Sun className="h-3.5 w-3.5" />}
                    {w === 'mist' && <CloudFog className="h-3.5 w-3.5" />}
                    {w === 'rain' && <CloudRain className="h-3.5 w-3.5" />}
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Camera & Visual Layers Pill */}
        <div className={`${panelClass} hidden h-9 items-center gap-0.5 rounded-2xl px-1 md:flex`}>
          <button
            type="button"
            onClick={() => onCameraPreset('overview')}
            title="Island Overview"
            className={`rounded-xl border border-transparent p-1.5 transition cursor-pointer ${hoverBg}`}
          >
            <Compass className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onCameraPreset('street')}
            title="Street-Level View"
            className={`hidden 2xl:inline-flex rounded-xl border border-transparent p-1.5 transition cursor-pointer ${hoverBg}`}
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onCameraPreset('blueprint')}
            title="Top-Down Urban Plan"
            className={`hidden 2xl:inline-flex rounded-xl border border-transparent p-1.5 transition cursor-pointer ${hoverBg}`}
          >
            <MapIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onCameraPreset('orbit')}
            title="Toggle Cinematic Orbit"
            className={`rounded-xl border p-1.5 transition cursor-pointer ${
              autoOrbit ? activeBg : `border-transparent ${hoverBg}`
            }`}
          >
            <RotateCw className={`h-3.5 w-3.5 ${autoOrbit ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
          </button>
          <button
            type="button"
            onClick={onToggleTransit}
            title="Toggle Related Repo Corridors"
            className={`rounded-xl border p-1.5 transition cursor-pointer ${
              showTransit ? activeBg : `border-transparent ${hoverBg}`
            }`}
          >
            <GitBranch className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Postcard Snapshot Button */}
        <button
          type="button"
          onClick={onOpenPostcard}
          disabled={!blueprint}
          className={`${panelClass} flex h-9 items-center gap-1.5 rounded-2xl border border-transparent px-3 text-xs font-bold transition hover:scale-[1.02] cursor-pointer disabled:opacity-45`}
          title="Open City Postcard & Stats Dossier"
        >
          <Camera className="h-3.5 w-3.5 text-amber-500" />
          <span className="hidden sm:inline">Postcard</span>
        </button>
      </div>
    </header>
  );
};
