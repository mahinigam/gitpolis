import React from 'react';
import { Play, Pause, RotateCcw, Clock } from 'lucide-react';
import type { CityBlueprint } from '../../domain/city/types';

interface TimelineScrubberProps {
  blueprint: CityBlueprint;
  isNightUI: boolean;
  timelineMs: number;
  isPlaying: boolean;
  speed: number;
  isDrawerOpen?: boolean;
  onChangeTime: (ms: number) => void;
  onTogglePlay: () => void;
  onCycleSpeed: () => void;
  onResetPresent: () => void;
}

function formatMonthYear(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  blueprint,
  isNightUI,
  timelineMs,
  isPlaying,
  speed,
  isDrawerOpen = false,
  onChangeTime,
  onTogglePlay,
  onCycleSpeed,
  onResetPresent,
}) => {
  const { startTime, endTime, buckets, milestones } = blueprint.timeline;
  const span = Math.max(1, endTime - startTime);
  const progress = Math.min(1, Math.max(0, (timelineMs - startTime) / span));
  const isAtPresent = progress >= 0.995;

  // Find most recent milestone <= timelineMs
  let activeMilestone = milestones[0]?.label || 'City Founded';
  for (const m of milestones) {
    if (m.time <= timelineMs + span * 0.01) {
      activeMilestone = m.label;
    } else {
      break;
    }
  }

  const maxBucket = Math.max(1, ...buckets.map((b) => b.count));

  const panelClass = isNightUI ? 'glass-panel-dark' : 'glass-panel';
  const subtle = isNightUI ? 'text-slate-200' : 'text-slate-800 font-bold';
  const hoverBg = isNightUI ? 'hover:bg-white/12 hover:text-white' : 'hover:bg-slate-900/8 hover:text-slate-950';

  return (
    <div
      className={`pointer-events-none fixed bottom-3 left-3 sm:left-[304px] z-20 flex justify-center transition-all duration-300 ${
        isDrawerOpen ? 'right-3 sm:right-[384px]' : 'right-3 sm:right-6'
      }`}
    >
      <div
        className={`${panelClass} pointer-events-auto flex w-full max-w-3xl items-center gap-3 rounded-3xl px-3.5 py-2.5 sm:px-4 shadow-xl`}
      >
        {/* Play/Pause & Speed */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onTogglePlay}
            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-600 text-white shadow-sm transition hover:bg-amber-500 cursor-pointer"
            title={isPlaying ? 'Pause city time-lapse' : 'Play city growth time-lapse'}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-0.5" />}
          </button>

          <button
            type="button"
            onClick={onCycleSpeed}
            className={`rounded-xl border border-transparent px-2 py-1 font-mono-code text-[11px] font-bold transition cursor-pointer text-slate-800 dark:text-slate-200 ${hoverBg}`}
            title="Time-lapse playback speed"
          >
            {speed}x
          </button>
        </div>

        {/* Sparkline + Slider + Milestone Ticker */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
            <span className="flex items-center gap-1.5 truncate font-bold text-slate-950 dark:text-white">
              <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="truncate">{isAtPresent ? `${blueprint.cityName} — Present State` : activeMilestone}</span>
            </span>
            <span className="font-mono-code shrink-0 text-xs font-bold tabular-nums text-amber-900 dark:text-amber-300">
              {formatMonthYear(timelineMs)}
            </span>
          </div>

          <div className="relative flex h-7 items-end">
            {/* Background Commit Activity Sparkline Bars */}
            <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex h-5 items-end gap-[2px] px-0.5">
              {buckets.map((b, i) => {
                const frac = i / Math.max(1, buckets.length - 1);
                const passed = frac <= progress;
                const hPct = Math.max(22, Math.round((b.count / maxBucket) * 100));
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-t-sm transition-colors ${
                      passed
                        ? 'bg-amber-500 dark:bg-amber-400'
                        : isNightUI
                          ? 'bg-slate-700/90 border-t border-slate-600/50'
                          : 'bg-slate-300 border-t border-slate-400/50'
                    }`}
                    style={{ height: `${hPct}%` }}
                  />
                );
              })}
            </div>

            <input
              type="range"
              min={startTime}
              max={endTime}
              step={Math.max(86400000, Math.round(span / 400))}
              value={timelineMs}
              onChange={(e) => onChangeTime(Number(e.target.value))}
              aria-label="City history timeline"
              className="city-slider relative z-10 w-full"
            />
          </div>

          <div className={`mt-0.5 flex justify-between font-mono-code text-[10px] ${subtle}`}>
            <span className="font-bold text-slate-900 dark:text-slate-100">{formatMonthYear(startTime)}</span>
            <span className="hidden sm:inline font-semibold text-slate-800 dark:text-slate-200">Watch the city grow from first commit</span>
            <span className="font-bold text-amber-900 dark:text-amber-300">Present</span>
          </div>
        </div>

        {/* Reset to Present */}
        {!isAtPresent && (
          <button
            type="button"
            onClick={onResetPresent}
            className={`shrink-0 flex items-center gap-1 rounded-xl border border-transparent px-2.5 py-1.5 text-xs font-bold transition cursor-pointer text-slate-800 dark:text-slate-200 ${hoverBg}`}
            title="Jump to present day"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Live</span>
          </button>
        )}
      </div>
    </div>
  );
};
