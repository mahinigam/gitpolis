import React from 'react';
import {
  X,
  ExternalLink,
  Star,
  GitFork,
  AlertCircle,
  HardDrive,
  GitCommitHorizontal,
  Building2,
  ArrowLeft,
  Calendar,
  Sparkles,
  Code2,
  Landmark,
  Users,
  Globe,
} from 'lucide-react';
import type { CityBlueprint, CommitCategory, SelectionState } from '../types/city';
import { ARCHITECTURAL_STYLES } from '../engine/languageStyles';

interface InspectorDrawerProps {
  blueprint: CityBlueprint;
  selection: SelectionState | null;
  isNightUI: boolean;
  onClose: () => void;
  onSelect: (sel: SelectionState) => void;
}

const COMMIT_BADGE: Record<CommitCategory, { label: string; bg: string }> = {
  feat: { label: 'FEAT', bg: 'bg-blue-100 text-blue-950 border border-blue-300 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-500/40' },
  fix: { label: 'FIX', bg: 'bg-amber-100 text-amber-950 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-500/40' },
  refactor: { label: 'REFACTOR', bg: 'bg-violet-100 text-violet-950 border border-violet-300 dark:bg-violet-950/70 dark:text-violet-200 dark:border-violet-500/40' },
  release: { label: 'RELEASE', bg: 'bg-emerald-100 text-emerald-950 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-500/40' },
  docs: { label: 'DOCS', bg: 'bg-teal-100 text-teal-950 border border-teal-300 dark:bg-teal-950/70 dark:text-teal-200 dark:border-teal-500/40' },
  test: { label: 'TEST', bg: 'bg-cyan-100 text-cyan-950 border border-cyan-300 dark:bg-cyan-950/70 dark:text-cyan-200 dark:border-cyan-500/40' },
  init: { label: 'INIT', bg: 'bg-orange-100 text-orange-950 border border-orange-300 dark:bg-orange-950/70 dark:text-orange-200 dark:border-orange-500/40' },
  chore: { label: 'CHORE', bg: 'bg-slate-200 text-slate-900 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600/40' },
};

function fmtDate(isoOrMs: string | number): string {
  const d = new Date(isoOrMs);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtLOC(loc: number): string {
  if (loc >= 1_000_000) return `${(loc / 1_000_000).toFixed(2)}M`;
  if (loc >= 1_000) return `${(loc / 1_000).toFixed(1)}k`;
  return loc.toLocaleString();
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  blueprint,
  selection,
  isNightUI,
  onClose,
  onSelect,
}) => {
  if (!selection) return null;

  const panelClass = isNightUI ? 'glass-panel-dark' : 'glass-panel';
  const subtle = isNightUI ? 'text-slate-200' : 'text-slate-700 font-medium';
  const divider = isNightUI ? 'border-white/15' : 'border-slate-900/12';
  const cardBg = isNightUI ? 'bg-white/10 border border-white/15' : 'bg-slate-900/[0.05] border border-slate-900/10';
  const hoverBg = isNightUI ? 'hover:bg-white/16 hover:text-white' : 'hover:bg-slate-900/[0.09] hover:text-slate-950';

  // 1. CENTRAL CIVIC PLAZA VIEW (Overall GitHub Profile)
  if (selection.type === 'plaza') {
    const p = blueprint.profile;
    return (
      <aside
        className={`${panelClass} pointer-events-auto fixed right-3 top-[58px] bottom-3 z-20 flex w-[355px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-3xl sm:right-4 shadow-xl`}
      >
        <div className={`flex items-center justify-between border-b px-4 py-3.5 ${divider}`}>
          <div className="flex items-center gap-2">
            <Landmark className="h-4.5 w-4.5 text-amber-500" />
            <span className="font-display text-sm font-bold">Central Civic Plaza</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl p-1.5 ${subtle} ${hoverBg} cursor-pointer`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="thin-scroll flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center gap-3">
            <img
              src={p.avatarUrl}
              alt={p.login}
              className="h-14 w-14 rounded-2xl object-cover shadow ring-2 ring-amber-500/40"
            />
            <div className="min-w-0">
              <h2 className="font-display truncate text-base font-bold">{p.name || p.login}</h2>
              <a
                href={p.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono-code text-xs text-amber-600 hover:underline dark:text-amber-400"
              >
                @{p.login} <ExternalLink className="h-3 w-3" />
              </a>
              {p.location && <p className={`mt-0.5 text-[11px] ${subtle}`}>{p.location}</p>}
            </div>
          </div>

          {p.bio && <p className="text-xs leading-relaxed opacity-90">{p.bio}</p>}

          <div className={`rounded-2xl p-3.5 ${cardBg}`}>
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Live City Climate: {blueprint.climate.label}
            </div>
            <p className={`mt-1.5 text-[11.5px] leading-relaxed ${subtle}`}>
              {blueprint.climate.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className={`rounded-2xl p-3 ${cardBg}`}>
              <div className={`flex items-center gap-1 text-[10.5px] ${subtle}`}>
                <Code2 className="h-3 w-3" /> Estimated Total LOC
              </div>
              <div className="mt-0.5 font-mono-code text-base font-bold tabular-nums">
                ~{fmtLOC(blueprint.stats.totalEstimatedLOC)}
              </div>
            </div>
            <div className={`rounded-2xl p-3 ${cardBg}`}>
              <div className={`flex items-center gap-1 text-[10.5px] ${subtle}`}>
                <Star className="h-3 w-3 text-amber-500" /> Total Stars
              </div>
              <div className="mt-0.5 font-mono-code text-base font-bold tabular-nums">
                {blueprint.stats.totalStars.toLocaleString()}
              </div>
            </div>
            <div className={`rounded-2xl p-3 ${cardBg}`}>
              <div className={`flex items-center gap-1 text-[10.5px] ${subtle}`}>
                <Users className="h-3 w-3" /> Followers
              </div>
              <div className="mt-0.5 font-mono-code text-base font-bold tabular-nums">
                {p.followers.toLocaleString()}
              </div>
            </div>
            <div className={`rounded-2xl p-3 ${cardBg}`}>
              <div className={`flex items-center gap-1 text-[10.5px] ${subtle}`}>
                <Calendar className="h-3 w-3" /> City Tenure
              </div>
              <div className="mt-0.5 font-mono-code text-base font-bold tabular-nums">
                {blueprint.stats.accountAgeYears} yrs
              </div>
            </div>
          </div>

          <div>
            <h3 className={`mb-2 text-[11px] font-bold uppercase tracking-wider ${subtle}`}>
              Architectural Style Breakdown
            </h3>
            <div className="space-y-2">
              {blueprint.stats.languageBreakdown.map((l) => (
                <div key={l.language} className={`rounded-xl p-2.5 ${cardBg}`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                      {l.language}
                    </span>
                    <span className="font-mono-code text-[11px] font-semibold">{l.percentage}%</span>
                  </div>
                  <p className={`mt-0.5 text-[10.5px] ${subtle}`}>{l.styleName}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    );
  }

  const district = blueprint.districts.find((d) => d.id === selection.districtId);
  if (!district) return null;

  // 2. SPECIFIC BUILDING VIEW (Commit Architecture Breakdown)
  if (selection.type === 'building' && selection.buildingId) {
    const building = district.buildings.find((b) => b.id === selection.buildingId);
    if (!building) return null;
    const styleMeta = ARCHITECTURAL_STYLES[building.styleId];

    return (
      <aside
        className={`${panelClass} pointer-events-auto fixed right-3 top-[58px] bottom-3 z-20 flex w-[365px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-3xl sm:right-4 shadow-xl`}
      >
        <div className={`flex items-center justify-between border-b px-4 py-3 ${divider}`}>
          <button
            type="button"
            onClick={() => onSelect({ type: 'district', districtId: district.id })}
            className={`flex items-center gap-1.5 rounded-xl px-2 py-1 text-xs font-semibold transition cursor-pointer ${hoverBg}`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="truncate max-w-[190px]">{district.id}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl p-1.5 ${subtle} ${hoverBg} cursor-pointer`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="thin-scroll flex-1 overflow-y-auto p-4 space-y-4">
          {/* Building Header */}
          <div>
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-[4px]"
                style={{ backgroundColor: styleMeta.badgeColor }}
              />
              <span className="font-mono-code text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {building.language} • {styleMeta.shortLabel}
              </span>
            </div>
            <h2 className="font-display mt-1 text-lg font-bold leading-tight text-slate-950 dark:text-white">{building.name}</h2>
            <p className={`mt-1 text-[11.5px] leading-relaxed ${subtle}`}>{styleMeta.description}</p>
          </div>

          {/* Building Architectural Metrics */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className={`rounded-2xl p-2.5 ${cardBg}`}>
              <div className="font-mono-code text-sm font-bold tabular-nums text-slate-950 dark:text-white">{building.floors}</div>
              <div className={`text-[10px] font-bold ${isNightUI ? 'text-slate-300' : 'text-slate-700'}`}>Floors</div>
            </div>
            <div className={`rounded-2xl p-2.5 ${cardBg}`}>
              <div className="font-mono-code text-sm font-bold tabular-nums text-slate-950 dark:text-white">{building.commits.length}</div>
              <div className={`text-[10px] font-bold ${isNightUI ? 'text-slate-300' : 'text-slate-700'}`}>Commits</div>
            </div>
            <div className={`rounded-2xl p-2.5 ${cardBg}`}>
              <div className="font-mono-code text-sm font-bold tabular-nums text-slate-950 dark:text-white">
                {Math.round(building.height * 3.4)}m
              </div>
              <div className={`text-[10px] font-bold ${isNightUI ? 'text-slate-300' : 'text-slate-700'}`}>Spire Ht</div>
            </div>
          </div>

          {/* Architectural Feature Callouts */}
          {building.domainFeature && (
            <div className={`rounded-2xl p-3 ${cardBg} border ${divider}`}>
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                <Sparkles className="h-3.5 w-3.5" />
                Domain Architectural Feature
              </div>
              <p className={`mt-1 text-[11px] leading-relaxed ${subtle}`}>
                {building.domainFeature}
              </p>
            </div>
          )}

          {building.hasScaffolding && (
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs font-medium text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
              Active Construction Scaffolding (Maintenance / Issue Resolution Zone)
            </div>
          )}

          {building.isObservationSpire && (
            <div className="rounded-2xl bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 p-2.5 text-xs font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              Gilded Observation Deck & Beacon Spire (High Prosperity Landmark)
            </div>
          )}

          {/* DNA Tags */}
          <div className="flex flex-wrap gap-1.5">
            {building.dnaTags.map((tag, i) => (
              <span
                key={i}
                className={`rounded-lg px-2 py-1 font-mono-code text-[10.5px] font-medium ${cardBg}`}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Construction Era */}
          <div className={`flex items-center justify-between rounded-2xl px-3 py-2 text-[11px] ${cardBg}`}>
            <span className={subtle}>Constructed</span>
            <span className="font-mono-code font-medium">
              {fmtDate(building.foundedAt)} → {fmtDate(building.completedAt)}
            </span>
          </div>

          {/* Commits That Built This Structure */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${subtle}`}>
                <GitCommitHorizontal className="h-3.5 w-3.5" /> Commit Blueprint ({building.commits.length})
              </h3>
            </div>
            <div className="space-y-2">
              {building.commits.map((c) => {
                const badge = COMMIT_BADGE[c.category] || COMMIT_BADGE.chore;
                const firstLine = (c.message || '').split('\n')[0];
                return (
                  <div key={`${c.sha}-${c.date}`} className={`rounded-2xl p-3 ${cardBg}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`rounded-md px-1.5 py-0.5 font-mono-code text-[9.5px] font-bold ${badge.bg}`}>
                        {badge.label}
                      </span>
                      <span className={`font-mono-code text-[10px] ${subtle}`}>
                        #{c.sha.slice(0, 7)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs font-medium leading-snug">{firstLine}</p>
                    <div className={`mt-1.5 flex items-center justify-between text-[10.5px] ${subtle}`}>
                      <span className="truncate">{c.authorName}</span>
                      <span className="shrink-0">{fmtDate(c.date)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // 3. DISTRICT (REPOSITORY BLOCK) VIEW
  return (
    <aside
      className={`${panelClass} pointer-events-auto fixed right-3 top-[58px] bottom-3 z-20 flex w-[365px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-3xl sm:right-4 shadow-xl`}
    >
      {/* Header */}
      <div className={`flex items-start justify-between gap-2 border-b px-4 py-3.5 ${divider}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-[4px]"
              style={{ backgroundColor: district.accentColor }}
            />
            <h2 className="font-display truncate text-base font-bold text-slate-950 dark:text-white">{district.id}</h2>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-amber-100 text-amber-950 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-500/50 px-2 py-0.5 text-[10px] font-bold">
              {district.vitalityLabel}
            </span>
            <span className={`text-[10.5px] font-bold uppercase tracking-wider ${isNightUI ? 'text-slate-200' : 'text-slate-800'}`}>{district.tier}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <a
            href={district.repo.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className={`rounded-xl border border-transparent p-1.5 ${subtle} ${hoverBg}`}
            title="Open repository on GitHub"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl border border-transparent p-1.5 ${subtle} ${hoverBg} cursor-pointer`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="thin-scroll flex-1 overflow-y-auto p-4 space-y-4">
        {district.repo.description && (
          <p className="text-xs leading-relaxed font-semibold text-slate-900 dark:text-slate-100">{district.repo.description}</p>
        )}

        {/* Domain & Prosperity Twin Meter */}
        <div className={`rounded-2xl p-3.5 ${cardBg} border ${divider}`}>
          <div className="flex items-center justify-between">
            <span
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 font-mono-code text-[11px] font-bold"
              style={{
                backgroundColor: `${district.domain.badgeColor}22`,
                color: district.domain.badgeColor,
              }}
            >
              {district.domain.label}
            </span>
            <span className="font-mono-code text-[10.5px] font-bold text-amber-900 dark:text-amber-300">
              {district.prosperity.prosperityTier.toUpperCase()} METROPOLIS
            </span>
          </div>

          <p className={`mt-1.5 text-[11px] leading-relaxed font-semibold ${subtle}`}>
            {district.domain.description}
          </p>

          {/* Prosperity & Fulfillment Gauges */}
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {/* Prosperity Score */}
            <div className="rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-300 dark:border-white/15 p-2.5">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="font-bold text-amber-900 dark:text-amber-300">Prosperity</span>
                <span className="font-mono-code font-bold tabular-nums text-slate-950 dark:text-white">
                  {district.prosperity.prosperityScore}/100
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                  style={{ width: `${district.prosperity.prosperityScore}%` }}
                />
              </div>
              <div className={`mt-1 font-mono-code text-[10px] font-bold text-slate-800 dark:text-slate-200`}>
                {district.repo.stargazersCount}★ • {district.repo.forksCount}⑂
              </div>
            </div>

            {/* Fulfillment Score */}
            <div className="rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-300 dark:border-white/15 p-2.5">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="font-bold text-emerald-900 dark:text-emerald-300">Fulfillment</span>
                <span className="font-mono-code font-bold tabular-nums text-slate-950 dark:text-white">
                  {district.prosperity.fulfillmentScore}/100
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                  style={{ width: `${district.prosperity.fulfillmentScore}%` }}
                />
              </div>
              <div className={`mt-1 font-mono-code text-[10px] font-bold text-slate-800 dark:text-slate-200`}>
                {district.prosperity.fulfillmentTier.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Maintenance Health Bar */}
          <div className="mt-2.5 flex items-center justify-between rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-300 dark:border-white/15 px-3 py-1.5 text-[10.5px]">
            <span className="font-bold text-slate-900 dark:text-slate-100">Maintenance Health:</span>
            <span className="font-mono-code font-bold tabular-nums text-slate-950 dark:text-white">
              {district.prosperity.maintenanceHealth}%
              {district.hasScaffolding && ' (Active Scaffolding)'}
            </span>
          </div>
        </div>

        {/* Architectural Story Card */}
        <div className={`rounded-2xl p-3.5 ${cardBg}`}>
          <div className="flex items-center justify-between">
            <span className="font-display text-xs font-bold">{district.styleName}</span>
            {district.repo.homepage && (
              <a
                href={
                  district.repo.homepage.startsWith('http')
                    ? district.repo.homepage
                    : `https://${district.repo.homepage}`
                }
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[10.5px] font-semibold text-sky-500 hover:underline"
              >
                <Globe className="h-3 w-3" /> Live
              </a>
            )}
          </div>
          <p className={`mt-1 text-[11.5px] leading-relaxed ${subtle}`}>{district.architecturalSummary}</p>

          {/* Identity Traits Chips */}
          <div className="mt-2.5 flex flex-wrap gap-1">
            {district.identityTraits.map((trait, i) => (
              <span
                key={i}
                className={`rounded-md px-1.5 py-0.5 font-mono-code text-[10px] font-bold ${
                  isNightUI ? 'bg-white/10 text-slate-100 border border-white/20' : 'bg-slate-100 text-slate-900 border border-slate-300'
                }`}
              >
                {trait}
              </span>
            ))}
          </div>
        </div>

        {/* 4 Repo Stats */}
        <div className="grid grid-cols-4 gap-1.5 text-center">
          <div className={`rounded-2xl py-2 px-1 ${cardBg}`}>
            <div className="font-mono-code text-xs font-bold tabular-nums text-slate-950 dark:text-white">
              {fmtLOC(district.estimatedLOC)}
            </div>
            <div className={`mt-0.5 flex items-center justify-center gap-0.5 text-[9.5px] font-bold ${isNightUI ? 'text-slate-300' : 'text-slate-800'}`}>
              <Code2 className="h-2.5 w-2.5 text-indigo-500" /> LOC
            </div>
          </div>
          <div className={`rounded-2xl py-2 px-1 ${cardBg}`}>
            <div className="font-mono-code text-xs font-bold tabular-nums text-slate-950 dark:text-white">
              {district.repo.stargazersCount >= 1000
                ? `${(district.repo.stargazersCount / 1000).toFixed(1)}k`
                : district.repo.stargazersCount}
            </div>
            <div className={`mt-0.5 flex items-center justify-center gap-0.5 text-[9.5px] font-bold ${isNightUI ? 'text-slate-300' : 'text-slate-800'}`}>
              <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" /> Stars
            </div>
          </div>
          <div className={`rounded-2xl py-2 px-1 ${cardBg}`}>
            <div className="font-mono-code text-xs font-bold tabular-nums text-slate-950 dark:text-white">
              {district.repo.forksCount}
            </div>
            <div className={`mt-0.5 flex items-center justify-center gap-0.5 text-[9.5px] font-bold ${isNightUI ? 'text-slate-300' : 'text-slate-800'}`}>
              <GitFork className="h-2.5 w-2.5 text-sky-500" /> Forks
            </div>
          </div>
          <div className={`rounded-2xl py-2 px-1 ${cardBg}`}>
            <div className="font-mono-code text-xs font-bold tabular-nums text-slate-950 dark:text-white">
              {district.repo.openIssuesCount}
            </div>
            <div className={`mt-0.5 flex items-center justify-center gap-0.5 text-[9.5px] font-bold ${isNightUI ? 'text-slate-300' : 'text-slate-800'}`}>
              <AlertCircle className="h-2.5 w-2.5 text-rose-500" /> Issues
            </div>
          </div>
        </div>

        {/* Polyglot Language Bar */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className={`font-bold uppercase tracking-wider ${isNightUI ? 'text-slate-200' : 'text-slate-900'}`}>Code Composition</span>
            <span className={`flex items-center gap-1 font-mono-code text-[10.5px] font-bold ${isNightUI ? 'text-slate-300' : 'text-slate-800'}`}>
              <HardDrive className="h-3 w-3" /> {(district.repo.size / 1024).toFixed(1)} MB
            </span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-500/20">
            {district.languageShares.map((s) => (
              <div
                key={s.language}
                style={{ width: `${Math.max(4, s.percentage)}%`, backgroundColor: s.color }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {district.languageShares.map((s) => (
              <span key={s.language} className="flex items-center gap-1 text-[11px]">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="font-bold text-slate-900 dark:text-slate-100">{s.language}</span>
                <span className={`font-mono-code text-[10px] font-bold ${isNightUI ? 'text-slate-300' : 'text-slate-700'}`}>{s.percentage}%</span>
              </span>
            ))}
          </div>
        </div>

        {/* Structures inside this Repo Block */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${subtle}`}>
              <Building2 className="h-3.5 w-3.5" /> Commit Structures ({district.buildings.length})
            </h3>
            <span className={`text-[10.5px] ${subtle}`}>Click to fly closer</span>
          </div>
          <div className="space-y-1.5">
            {district.buildings.map((b) => {
              const badge = COMMIT_BADGE[b.dominantCommitType] || COMMIT_BADGE.chore;
              const bStyle = ARCHITECTURAL_STYLES[b.styleId];
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() =>
                    onSelect({ type: 'building', districtId: district.id, buildingId: b.id })
                  }
                  className={`flex w-full items-center justify-between rounded-2xl border border-transparent p-2.5 text-left transition cursor-pointer ${cardBg} ${hoverBg} hover:border-amber-500/35`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: bStyle.badgeColor }}
                      />
                      <span className="truncate text-xs font-semibold">{b.name}</span>
                    </div>
                    <div className={`mt-0.5 flex items-center gap-1.5 text-[10.5px] ${subtle}`}>
                      <span>{b.language}</span>
                      <span>•</span>
                      <span>{b.floors} floors</span>
                      <span>•</span>
                      <span>{b.commits.length} commits</span>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono-code text-[9.5px] font-bold ${badge.bg}`}>
                    {badge.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dates Footer */}
        <div className={`flex items-center justify-between rounded-2xl px-3 py-2 text-[10.5px] ${cardBg} ${subtle}`}>
          <span>Founded {fmtDate(district.foundedAt)}</span>
          <span>Last push {fmtDate(district.lastActiveAt)}</span>
        </div>
      </div>
    </aside>
  );
};
