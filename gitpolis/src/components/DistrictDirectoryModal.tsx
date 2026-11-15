import React, { useMemo, useState } from 'react';
import {
  Building2,
  Search,
  X,
  Star,
  GitFork,
  Code2,
  Calendar,
  ArrowUpDown,
} from 'lucide-react';
import type { CityBlueprint } from '../types/city';

interface DistrictDirectoryModalProps {
  open: boolean;
  blueprint: CityBlueprint;
  isNightUI: boolean;
  selectedDistrictId?: string;
  onSelectDistrict: (districtId: string) => void;
  onClose: () => void;
}

type SortField = 'stars' | 'loc' | 'prosperity' | 'pushed' | 'name';

function fmtLOC(loc: number): string {
  if (loc >= 1_000_000) return `${(loc / 1_000_000).toFixed(1)}M`;
  if (loc >= 1_000) return `${(loc / 1_000).toFixed(1)}k`;
  return loc.toLocaleString();
}

function fmtDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export const DistrictDirectoryModal: React.FC<DistrictDirectoryModalProps> = ({
  open,
  blueprint,
  isNightUI,
  selectedDistrictId,
  onSelectDistrict,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [langFilter, setLangFilter] = useState('All');
  const [domainFilter, setDomainFilter] = useState('All');
  const [sortBy, setSortBy] = useState<SortField>('prosperity');

  const languages = useMemo(() => {
    const set = new Set<string>();
    for (const d of blueprint.districts) {
      if (d.primaryLanguage) set.add(d.primaryLanguage);
    }
    return ['All', ...Array.from(set)];
  }, [blueprint.districts]);

  const domains = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of blueprint.districts) {
      map.set(d.domain.id, d.domain.shortLabel);
    }
    return [{ id: 'All', label: 'All Domains' }, ...Array.from(map.entries()).map(([id, label]) => ({ id, label }))];
  }, [blueprint.districts]);

  const filteredDistricts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = blueprint.districts.filter((d) => {
      const matchLang = langFilter === 'All' || d.primaryLanguage === langFilter;
      const matchDomain = domainFilter === 'All' || d.domain.id === domainFilter;
      const matchText =
        q.length === 0 ||
        d.id.toLowerCase().includes(q) ||
        (d.repo.description || '').toLowerCase().includes(q) ||
        d.domain.label.toLowerCase().includes(q) ||
        d.styleName.toLowerCase().includes(q);
      return matchLang && matchDomain && matchText;
    });

    return list.sort((a, b) => {
      if (sortBy === 'stars') {
        return (b.repo.stargazersCount || 0) - (a.repo.stargazersCount || 0);
      }
      if (sortBy === 'loc') {
        return (b.estimatedLOC || 0) - (a.estimatedLOC || 0);
      }
      if (sortBy === 'prosperity') {
        return (b.prosperity.prosperityScore || 0) - (a.prosperity.prosperityScore || 0);
      }
      if (sortBy === 'pushed') {
        return b.lastActiveAt - a.lastActiveAt;
      }
      return a.id.localeCompare(b.id);
    });
  }, [blueprint.districts, search, langFilter, domainFilter, sortBy]);

  if (!open) return null;

  const panelClass = isNightUI ? 'glass-panel-dark' : 'glass-panel';
  const divider = isNightUI ? 'border-white/15' : 'border-slate-900/12';
  const cardBg = isNightUI ? 'bg-white/10 border border-white/15' : 'bg-slate-900/[0.05] border border-slate-900/10';
  const hoverBg = isNightUI ? 'hover:bg-white/16 hover:text-white' : 'hover:bg-slate-900/[0.09] hover:text-slate-950';
  const subtle = isNightUI ? 'text-slate-200' : 'text-slate-800 font-medium';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-fade-in">
      <div
        className={`${panelClass} relative flex h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/20 shadow-2xl`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between border-b px-5 py-4 ${divider}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">
                Municipal Cadastre & District Directory
              </h2>
              <p className={`text-xs ${subtle}`}>
                {blueprint.districts.length} active repository districts cataloged for @{blueprint.profile.login}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl p-2 ${subtle} ${hoverBg} cursor-pointer transition`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter & Sort Controls */}
        <div className={`border-b p-4 space-y-3 ${divider}`}>
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${subtle}`} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search districts, keywords, domains…"
                className={`w-full rounded-xl pl-9 pr-3 py-1.5 text-xs font-semibold ${
                  isNightUI ? 'bg-slate-900/80 text-white placeholder:text-slate-400' : 'bg-white text-slate-950 placeholder:text-slate-500'
                } border ${divider} focus:outline-none focus:ring-2 focus:ring-amber-500/50`}
              />
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className={`h-3.5 w-3.5 ${subtle}`} />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortField)}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold ${
                  isNightUI ? 'bg-slate-900 text-white' : 'bg-white text-slate-950'
                } border ${divider} focus:outline-none`}
              >
                <option value="prosperity">Sort: Highest Prosperity</option>
                <option value="stars">Sort: Most Stars</option>
                <option value="loc">Sort: Largest LOC</option>
                <option value="pushed">Sort: Recent Push</option>
                <option value="name">Sort: Name (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Language filter pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[10.5px] font-bold uppercase tracking-wider ${subtle}`}>Langs:</span>
            {languages.slice(0, 8).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLangFilter(l)}
                className={`rounded-lg px-2 py-0.5 font-mono-code text-[11px] font-medium transition cursor-pointer ${
                  langFilter === l
                    ? 'bg-amber-500 text-white font-bold shadow-sm'
                    : `${cardBg} ${hoverBg}`
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Domain filter pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[10.5px] font-bold uppercase tracking-wider ${subtle}`}>Domains:</span>
            {domains.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDomainFilter(d.id)}
                className={`rounded-lg px-2 py-0.5 text-[11px] font-medium transition cursor-pointer ${
                  domainFilter === d.id
                    ? 'bg-blue-600 text-white font-bold shadow-sm'
                    : `${cardBg} ${hoverBg}`
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* District Grid / List */}
        <div className="thin-scroll flex-1 overflow-y-auto p-4 space-y-2">
          {filteredDistricts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No matching repository districts match your search or filters.
            </div>
          ) : (
            filteredDistricts.map((d) => {
              const isSelected = selectedDistrictId === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    onSelectDistrict(d.id);
                    onClose();
                  }}
                  className={`flex w-full items-start justify-between rounded-2xl border p-3.5 text-left transition cursor-pointer ${
                    isSelected
                      ? 'border-amber-500 bg-amber-500/10 shadow-sm'
                      : `border-transparent ${cardBg} ${hoverBg}`
                  }`}
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.accentColor }} />
                      <span className="font-display text-sm font-bold truncate">{d.id}</span>
                      <span className="rounded-md bg-blue-500/15 px-1.5 py-0.5 font-mono-code text-[10px] font-semibold text-blue-600 dark:text-blue-300">
                        {d.domain.shortLabel}
                      </span>
                      <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 font-mono-code text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                        {d.prosperity.prosperityTier.toUpperCase()}
                      </span>
                    </div>

                    {d.repo.description && (
                      <p className={`mt-1 line-clamp-1 text-xs ${subtle}`}>{d.repo.description}</p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-mono-code">
                      <span className="flex items-center gap-1 font-medium">
                        <Code2 className="h-3 w-3 text-emerald-500" /> ~{fmtLOC(d.estimatedLOC)} LOC
                      </span>
                      {d.repo.stargazersCount > 0 && (
                        <span className="flex items-center gap-1 font-medium">
                          <Star className="h-3 w-3 text-amber-500" /> {d.repo.stargazersCount}
                        </span>
                      )}
                      {d.repo.forksCount > 0 && (
                        <span className="flex items-center gap-1 font-medium">
                          <GitFork className="h-3 w-3 text-blue-400" /> {d.repo.forksCount}
                        </span>
                      )}
                      <span className={`flex items-center gap-1 ${subtle}`}>
                        <Calendar className="h-3 w-3" /> Pushed {fmtDate(d.lastActiveAt)}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="rounded-xl bg-slate-900/10 dark:bg-white/10 px-2.5 py-1.5 text-center">
                      <div className="font-mono-code text-sm font-bold text-amber-600 dark:text-amber-400">
                        {d.prosperity.prosperityScore}
                      </div>
                      <div className={`text-[9.5px] uppercase font-semibold ${subtle}`}>Prosperity</div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
