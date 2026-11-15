import React from 'react';
import type { HoverInfo } from '../types/city';

interface HoverTooltipProps {
  info: HoverInfo | null;
  isNightUI: boolean;
}

export const HoverTooltip: React.FC<HoverTooltipProps> = ({ info, isNightUI }) => {
  if (!info) return null;

  const left = Math.min(window.innerWidth - 260, info.screenX + 16);
  const top = Math.max(62, info.screenY - 12);

  return (
    <div
      className={`pointer-events-none fixed z-40 max-w-[250px] rounded-2xl px-3.5 py-2.5 shadow-xl transition-opacity duration-100 ${
        isNightUI ? 'glass-panel-dark' : 'glass-panel'
      }`}
      style={{ left, top }}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/40"
          style={{ backgroundColor: info.accentColor }}
        />
        <span className="font-display truncate text-xs font-bold text-slate-950 dark:text-white">{info.title}</span>
      </div>
      <p className={`mt-0.5 truncate text-[11px] font-semibold ${isNightUI ? 'text-slate-200' : 'text-slate-800'}`}>
        {info.subtitle}
      </p>
      {info.badges.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {info.badges.map((b, i) => (
            <span
              key={i}
              className={`rounded-md px-1.5 py-0.5 font-mono-code text-[10px] font-bold ${
                isNightUI ? 'bg-white/15 text-slate-100 border border-white/20' : 'bg-slate-100 text-slate-950 border border-slate-300'
              }`}
            >
              {b}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
