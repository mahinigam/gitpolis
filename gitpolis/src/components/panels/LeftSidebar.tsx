import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Star,
  Users,
  Layers,
  MapPin,
  Sparkles,
  Building2,
  Activity,
} from 'lucide-react';
import type { CityBlueprint, SelectionState } from '../../domain/city/types';

interface LeftSidebarProps {
  blueprint: CityBlueprint;
  isNightUI: boolean;
  selection: SelectionState | null;
  highlightedLanguage: string | null;
  onSelect: (sel: SelectionState) => void;
  onHighlightLanguage: (lang: string | null) => void;
}

const VITALITY_DOT: Record<string, string> = {
  active: 'bg-emerald-500',
  thriving: 'bg-sky-500',
  dormant: 'bg-amber-500',
  heritage: 'bg-lime-700',
};

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  blueprint,
  isNightUI,
  selection,
  highlightedLanguage,
  onSelect,
  onHighlightLanguage,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [districtFilter, setDistrictFilter] = useState('');

  const panelClass = isNightUI ? 'glass-panel-dark' : 'glass-panel';
  const subtle = isNightUI ? 'text-slate-200' : 'text-slate-700';
  const divider = isNightUI ? 'border-white/15' : 'border-slate-900/12';
  const cardBg = isNightUI ? 'bg-white/10 border border-white/15' : 'bg-slate-900/[0.05] border border-slate-900/10';
  const hoverBg = isNightUI ? 'hover:bg-white/16 hover:text-white' : 'hover:bg-slate-900/[0.09] hover:text-slate-950';

  if (collapsed) {
    return (
      <div className="pointer-events-auto fixed left-3 top-[58px] z-20 sm:left-4">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className={`${panelClass} flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold transition hover:scale-[1.02] cursor-pointer`}
          title="Expand City Directory"
        >
          <img
            src={blueprint.profile.avatarUrl}
            alt={blueprint.profile.login}
            className="h-6 w-6 rounded-full object-cover ring-1 ring-white/50"
          />
          <span className="font-display font-bold">{blueprint.cityName}</span>
          <ChevronRight className="h-4 w-4 opacity-75" />
        </button>
      </div>
    );
  }

  return (
    <aside
      className={`${panelClass} pointer-events-auto fixed left-3 top-[58px] bottom-[72px] z-20 flex w-[284px] flex-col overflow-hidden rounded-3xl sm:left-4 shadow-xl`}
    >
      {/* Profile City Header */}
      <div className={`border-b p-3.5 ${divider}`}>
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onSelect({ type: 'plaza' })}
            className="group flex items-center gap-2.5 text-left cursor-pointer"
            title="Inspect Central Civic Plaza & GitHub Profile"
          >
            <img
              src={blueprint.profile.avatarUrl}
              alt={blueprint.profile.login}
              className="h-11 w-11 shrink-0 rounded-2xl object-cover shadow-sm ring-2 ring-amber-500/40 transition group-hover:ring-amber-500"
            />
            <div className="min-w-0">
              <h1 className="font-display truncate text-[15px] font-bold leading-tight text-slate-950 dark:text-white group-hover:text-amber-600 transition">
                {blueprint.cityName}
              </h1>
              <p className={`font-mono-code truncate text-[11px] font-bold ${subtle}`}>
                @{blueprint.profile.login}
              </p>
              <p className="mt-0.5 truncate text-[10.5px] font-bold text-amber-900 dark:text-amber-300">
                {blueprint.citySubtitle}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className={`rounded-xl border border-transparent p-1.5 ${subtle} ${hoverBg} cursor-pointer`}
            title="Collapse Sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Live Climate Pill */}
        <div className={`mt-3 rounded-2xl p-2.5 ${cardBg}`}>
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 font-bold text-slate-950 dark:text-white">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span className="truncate">{blueprint.climate.label.split('•')[0].trim()}</span>
            </span>
            <span className="font-mono-code text-[10.5px] font-bold tabular-nums text-emerald-800 dark:text-emerald-300">
              {blueprint.climate.vitalityScore}% Vitality
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-700"
              style={{ width: `${blueprint.climate.vitalityScore}%` }}
            />
          </div>
        </div>

        {/* 4 Compact Civic Stats */}
        <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-center">
          <div className={`rounded-xl py-1.5 px-1 ${cardBg}`}>
            <div className="flex items-center justify-center gap-0.5 font-mono-code text-xs font-bold tabular-nums text-slate-950 dark:text-white">
              {blueprint.stats.totalStars >= 1000
                ? `${(blueprint.stats.totalStars / 1000).toFixed(1)}k`
                : blueprint.stats.totalStars}
            </div>
            <div className={`flex items-center justify-center gap-0.5 text-[9.5px] font-bold ${isNightUI ? 'text-slate-300' : 'text-slate-800'}`}>
              <Star className="h-2.5 w-2.5 text-amber-500" /> Stars
            </div>
          </div>
          <div className={`rounded-xl py-1.5 px-1 ${cardBg}`}>
            <div className="font-mono-code text-xs font-bold tabular-nums text-slate-950 dark:text-white">
              {blueprint.profile.followers >= 1000
                ? `${(blueprint.profile.followers / 1000).toFixed(1)}k`
                : blueprint.profile.followers}
            </div>
            <div className={`flex items-center justify-center gap-0.5 text-[9.5px] font-bold ${isNightUI ? 'text-slate-300' : 'text-slate-800'}`}>
              <Users className="h-2.5 w-2.5 text-sky-500" /> Citizens
            </div>
          </div>
          <div className={`rounded-xl py-1.5 px-1 ${cardBg}`}>
            <div className="font-mono-code text-xs font-bold tabular-nums text-slate-950 dark:text-white">
              {blueprint.districts.length}
            </div>
            <div className={`flex items-center justify-center gap-0.5 text-[9.5px] font-bold ${isNightUI ? 'text-slate-300' : 'text-slate-800'}`}>
              <Layers className="h-2.5 w-2.5 text-indigo-500" /> Blocks
            </div>
          </div>
          <div className={`rounded-xl py-1.5 px-1 ${cardBg}`}>
            <div className="font-mono-code text-xs font-bold tabular-nums text-slate-950 dark:text-white">
              {blueprint.stats.totalBuildings}
            </div>
            <div className={`flex items-center justify-center gap-0.5 text-[9.5px] font-bold ${isNightUI ? 'text-slate-300' : 'text-slate-800'}`}>
              <Building2 className="h-2.5 w-2.5 text-amber-500" /> Towers
            </div>
          </div>
        </div>
      </div>

      {/* Architectural Style Legend */}
      <div className={`border-b px-3.5 py-2.5 ${divider}`}>
        <div className="mb-1.5 flex items-center justify-between">
          <span className={`text-[10.5px] font-bold uppercase tracking-wider ${subtle}`}>
            Language Architecture
          </span>
          {highlightedLanguage && (
            <button
              type="button"
              onClick={() => onHighlightLanguage(null)}
              className="text-[10.5px] font-bold text-amber-600 hover:underline cursor-pointer dark:text-amber-400"
            >
              Reset
            </button>
          )}
        </div>
        {/* Stacked Language Bar */}
        <div className="mb-2 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 ring-1 ring-black/5 dark:ring-white/10">
          {blueprint.stats.languageBreakdown.map((l) => (
            <div
              key={l.language}
              style={{ width: `${Math.max(3, l.percentage)}%`, backgroundColor: l.color }}
              title={`${l.language}: ${l.percentage}% (${l.styleName})`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {blueprint.stats.languageBreakdown.slice(0, 6).map((l) => {
            const active = highlightedLanguage === l.language;
            return (
              <button
                key={l.language}
                type="button"
                onClick={() => onHighlightLanguage(active ? null : l.language)}
                onMouseEnter={() => onHighlightLanguage(l.language)}
                onMouseLeave={() => {
                  if (!active) onHighlightLanguage(null);
                }}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[10.5px] font-semibold transition cursor-pointer ${
                  active
                    ? 'border-amber-500/50 bg-amber-500/20 text-amber-900 dark:text-amber-200'
                    : `border-transparent ${cardBg} ${hoverBg}`
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                <span>{l.language}</span>
                <span className={`font-mono-code text-[9.5px] font-bold ${subtle}`}>{Math.round(l.percentage)}%</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Repo Districts List */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-3.5 pt-2.5 pb-1.5">
          <span className={`flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider ${subtle}`}>
            <MapPin className="h-3 w-3" /> All Repos ({blueprint.districts.length})
          </span>
          <span className={`flex items-center gap-1 text-[10px] font-semibold ${subtle}`}>
            <Activity className="h-3 w-3 text-emerald-500" /> {blueprint.stats.activeDistricts} active
          </span>
        </div>

        {blueprint.districts.length > 8 && (
          <div className="px-3 pb-1.5">
            <input
              type="text"
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              placeholder="Filter repo districts..."
              className={`w-full rounded-xl border px-2.5 py-1 text-[11px] font-semibold outline-none ${
                isNightUI
                  ? 'border-white/20 bg-slate-900/80 text-white placeholder:text-slate-400'
                  : 'border-slate-400 bg-white text-slate-950 placeholder:text-slate-600'
              }`}
            />
          </div>
        )}

        <div className="thin-scroll flex-1 overflow-y-auto px-2 pb-2.5">
          {blueprint.districts
            .filter((d) =>
              districtFilter.trim() === ''
                ? true
                : d.id.toLowerCase().includes(districtFilter.toLowerCase()) ||
                  d.primaryLanguage.toLowerCase().includes(districtFilter.toLowerCase())
            )
            .map((d) => {
              const isSelected = selection?.districtId === d.id;
              const isFilteredOut =
                highlightedLanguage !== null &&
                !d.languageShares.some((l) => l.language === highlightedLanguage);

              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSelect({ type: 'district', districtId: d.id })}
                  className={`mb-1 flex w-full items-center justify-between rounded-2xl border px-2.5 py-2 text-left transition cursor-pointer ${
                    isSelected
                      ? isNightUI
                        ? 'border-amber-400/60 bg-amber-500/25 shadow-xs'
                        : 'border-amber-500/50 bg-amber-500/15 shadow-xs'
                      : `border-transparent ${hoverBg}`
                  } ${isFilteredOut ? 'opacity-40' : 'opacity-100'}`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-[4px]"
                        style={{ backgroundColor: d.accentColor }}
                      />
                      <span className="truncate text-xs font-bold text-slate-950 dark:text-white">{d.id}</span>
                    </div>
                    <div className={`mt-0.5 flex items-center gap-1.5 text-[10.5px] font-semibold ${subtle}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${VITALITY_DOT[d.vitality]}`} />
                      <span className="truncate">{d.primaryLanguage}</span>
                      <span>•</span>
                      <span className="font-mono-code text-[9.5px] font-bold">
                        {d.estimatedLOC >= 1000
                          ? `${(d.estimatedLOC / 1000).toFixed(1)}k LOC`
                          : `${d.estimatedLOC} LOC`}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {d.repo.stargazersCount > 0 && (
                      <div className="flex items-center justify-end gap-0.5 font-mono-code text-[11px] font-bold tabular-nums text-amber-900 dark:text-amber-300">
                        <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />
                        {d.repo.stargazersCount >= 1000
                          ? `${(d.repo.stargazersCount / 1000).toFixed(1)}k`
                          : d.repo.stargazersCount}
                      </div>
                    )}
                    <div className={`text-[9.5px] font-bold uppercase tracking-wider ${isNightUI ? 'text-slate-300' : 'text-slate-700'}`}>{d.tier}</div>
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </aside>
  );
};
