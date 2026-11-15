import React from 'react';
import {
  Building2,
  Compass,
  Cpu,
  Layers,
  Sparkles,
  CheckCircle2,
  Radio,
  X,
  Code2,
} from 'lucide-react';
import type { ConstructionProgress } from '../types/city';

interface CityConstructionSequenceProps {
  username: string;
  progress: ConstructionProgress | null;
  onCancel?: () => void;
  onLoadShowcase?: () => void;
}

const PHASES = [
  { id: 'survey', label: 'Survey Profile', icon: Compass },
  { id: 'cadastre', label: 'Zoning & Prosperity', icon: Layers },
  { id: 'coastline', label: 'Coastline & Canals', icon: Radio },
  { id: 'skyline', label: 'Extruding Skyline', icon: Building2 },
  { id: 'life', label: 'Commuter Life', icon: Sparkles },
];

export const CityConstructionSequence: React.FC<CityConstructionSequenceProps> = ({
  username,
  progress,
  onCancel,
  onLoadShowcase,
}) => {
  const currentStep = progress?.phaseIndex ?? 1;
  const pct = Math.max(8, Math.min(100, progress?.percentage ?? 15));
  const headline = progress?.headline ?? `Surveying @${username}`;
  const detail =
    progress?.detail ??
    'Gathering repositories, language breakdowns, estimated LOC, and commit blueprints…';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-md p-4 animate-fade-in">
      <div className="glass-panel relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/20 p-6 shadow-2xl sm:p-7">
        {/* Glow ambient background accent */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-blue-500/15 blur-3xl" />

        {/* Top row */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
              <Building2 className="h-5 w-5 animate-pulse" />
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white text-[9px] font-bold text-white">
                ✓
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono-code text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Municipal Construction Engine
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 font-mono-code text-[10px] font-bold text-amber-700 dark:text-amber-300">
                  <span className="h-1.5 w-1.5 animate-ping rounded-full bg-amber-500" />
                  Building
                </span>
              </div>
              <h2 className="font-display mt-0.5 text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Raising City for @{username}
              </h2>
            </div>
          </div>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-900/10 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white transition cursor-pointer"
              title="Cancel generation"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 5-Step Phase Indicators */}
        <div className="mt-5 grid grid-cols-5 gap-1.5">
          {PHASES.map((p, idx) => {
            const stepNum = idx + 1;
            const isCompleted = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;
            const Icon = p.icon;

            return (
              <div
                key={p.id}
                className={`relative flex flex-col items-center rounded-xl p-2 text-center transition-all ${
                  isCurrent
                    ? 'bg-amber-500/15 border border-amber-500/35 text-amber-600 dark:text-amber-300 shadow-sm'
                    : isCompleted
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-900/5 dark:bg-white/5 text-slate-400'
                }`}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-lg">
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Icon className={`h-4 w-4 ${isCurrent ? 'animate-bounce' : ''}`} />
                  )}
                </div>
                <span className="mt-1 font-mono-code text-[9px] font-medium leading-tight">
                  {p.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Dynamic Construction Progress Status Card */}
        <div className="mt-4 rounded-2xl bg-slate-900/[0.04] dark:bg-white/5 border border-slate-900/10 dark:border-white/10 p-4">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-100">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              {headline}
            </span>
            <span className="font-mono-code text-amber-600 dark:text-amber-400 tabular-nums font-bold">
              {pct}%
            </span>
          </div>

          <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {detail}
          </p>

          {/* Animated Progress Bar with shimmer */}
          <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 transition-all duration-300 shadow-sm"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Discovered Stats Chips if available during generation */}
          {progress?.stats && (
            <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-slate-900/10 dark:border-white/10">
              {progress.stats.repoCount !== undefined && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-blue-500/10 px-2 py-1 font-mono-code text-[10.5px] font-semibold text-blue-600 dark:text-blue-400">
                  <Building2 className="h-3 w-3" />
                  {progress.stats.repoCount} Repositories
                </span>
              )}
              {progress.stats.locCount !== undefined && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-1 font-mono-code text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <Code2 className="h-3 w-3" />
                  ~{progress.stats.locCount.toLocaleString()} LOC
                </span>
              )}
              {progress.stats.langCount !== undefined && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-violet-500/10 px-2 py-1 font-mono-code text-[10.5px] font-semibold text-violet-600 dark:text-violet-400">
                  <Cpu className="h-3 w-3" />
                  {progress.stats.langCount} Languages
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer info & instant showcase option */}
        <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Synthesizing 3D terrain, canals & procedural geometry
          </span>

          {onLoadShowcase && (
            <button
              type="button"
              onClick={onLoadShowcase}
              className="text-amber-600 hover:text-amber-700 dark:text-amber-400 font-semibold underline underline-offset-2 cursor-pointer"
            >
              Explore Showcase City
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
