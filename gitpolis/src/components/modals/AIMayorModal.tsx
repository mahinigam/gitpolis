import React, { useState } from 'react';
import {
  Sparkles,
  X,
  KeyRound,
  GitBranch,
  Landmark,
  Calendar,
  Check,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import type { MunicipalDecisionPlan } from '../../domain/decision/types';
import { getStoredGeminiKey, setStoredGeminiKey } from '../../services/gemini';

interface AIMayorModalProps {
  open: boolean;
  isNightUI: boolean;
  username: string;
  plan: MunicipalDecisionPlan | null;
  isLoading: boolean;
  statusMessage?: string;
  onClose: () => void;
  onGeneratePlan: (customKey?: string) => void;
}

export const AIMayorModal: React.FC<AIMayorModalProps> = ({
  open,
  isNightUI,
  username,
  plan,
  isLoading,
  statusMessage,
  onClose,
  onGeneratePlan,
}) => {
  const [keyInput, setKeyInput] = useState(() => getStoredGeminiKey());
  const [activeTab, setActiveTab] = useState<'dossier' | 'chronicles' | 'transit' | 'settings'>('dossier');
  const [savedKeyToast, setSavedKeyToast] = useState(false);

  if (!open) return null;

  const panelClass = isNightUI ? 'glass-panel-dark' : 'glass-panel';
  const divider = isNightUI ? 'border-white/15' : 'border-slate-900/12';
  const cardBg = isNightUI ? 'bg-white/10 border border-white/15' : 'bg-slate-900/[0.05] border border-slate-900/10';
  const hoverBg = isNightUI ? 'hover:bg-white/16 hover:text-white' : 'hover:bg-slate-900/[0.09] hover:text-slate-950';
  const subtle = isNightUI ? 'text-slate-200' : 'text-slate-800 font-medium';

  const handleSaveKey = () => {
    setStoredGeminiKey(keyInput.trim());
    setSavedKeyToast(true);
    setTimeout(() => setSavedKeyToast(false), 2400);
    if (keyInput.trim()) {
      onGeneratePlan(keyInput.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-md p-3 sm:p-5 animate-fade-in">
      <div
        className={`${panelClass} relative flex h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/20 shadow-2xl`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between border-b px-5 py-4 ${divider}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold leading-tight">
                  Google Gemini Decision Engine
                </h2>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-mono-code text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  {plan ? 'Decision Plan Active' : 'Ready'}
                </span>
              </div>
              <p className={`text-xs ${subtle}`}>
                Autonomous Urban Planning & Historical Lore Synthesis for @{username}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl border border-transparent p-2 ${subtle} ${hoverBg} cursor-pointer transition`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className={`flex items-center gap-1 border-b px-5 py-2.5 ${divider}`}>
          <button
            type="button"
            onClick={() => setActiveTab('dossier')}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              activeTab === 'dossier'
                ? 'border-amber-500/50 bg-amber-500/20 text-amber-900 dark:text-amber-200'
                : `border-transparent ${subtle} ${hoverBg}`
            }`}
          >
            <Landmark className="h-3.5 w-3.5 text-amber-500" />
            <span>Civic Dossier</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chronicles')}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              activeTab === 'chronicles'
                ? 'border-amber-500/50 bg-amber-500/20 text-amber-900 dark:text-amber-200'
                : `border-transparent ${subtle} ${hoverBg}`
            }`}
          >
            <Calendar className="h-3.5 w-3.5 text-orange-500" />
            <span>Epoch Chronicles ({plan?.historicalChronicles.length || 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transit')}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              activeTab === 'transit'
                ? 'border-amber-500/50 bg-amber-500/20 text-amber-900 dark:text-amber-200'
                : `border-transparent ${subtle} ${hoverBg}`
            }`}
          >
            <GitBranch className="h-3.5 w-3.5 text-sky-500" />
            <span>Transit Arteries ({plan?.interDistrictConnections.length || 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer ml-auto ${
              activeTab === 'settings'
                ? 'border-amber-500/50 bg-amber-500/20 text-amber-900 dark:text-amber-200'
                : `border-transparent ${subtle} ${hoverBg}`
            }`}
          >
            <KeyRound className="h-3.5 w-3.5 text-emerald-500" />
            <span>API Studio</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="thin-scroll flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-500 shadow-inner animate-pulse">
                <Sparkles className="h-7 w-7 animate-spin" style={{ animationDuration: '4s' }} />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Synthesizing Municipal Master Plan…
                </h3>
                <p className={`mt-1 text-xs font-medium ${subtle}`}>
                  {statusMessage || 'Engaging Gemini 2.0 Flash Decision API with strict structured schema…'}
                </p>
              </div>
            </div>
          ) : !plan && activeTab !== 'settings' ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
                <Sparkles className="h-7 w-7" />
              </div>
              <div className="max-w-md">
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Elevate City with Google Decision Engine
                </h3>
                <p className={`mt-1 text-xs leading-relaxed font-medium ${subtle}`}>
                  Connect a free Google AI Studio API key to empower the autonomous AI Mayor to zone repositories
                  semantically, construct landmark monuments, and build inter-district transit networks.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-amber-500 cursor-pointer transition"
              >
                <KeyRound className="h-4 w-4" />
                Configure Free Google AI Studio Key
              </button>
            </div>
          ) : (
            <>
              {/* Tab 1: Civic Dossier */}
              {activeTab === 'dossier' && plan && (
                <div className="space-y-4 animate-fade-in">
                  <div className={`rounded-3xl p-5 ${cardBg}`}>
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-amber-100 text-amber-950 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-500/50 px-3 py-1 font-mono-code text-[11px] font-bold">
                        {plan.citySummary.developerArchetype.toUpperCase()}
                      </span>
                      <span className="font-mono-code text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        {plan.citySummary.vitalityAssessment}% Vitality Assessment
                      </span>
                    </div>

                    <h1 className="font-display mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                      {plan.citySummary.civicTitle}
                    </h1>
                    <p className="mt-1 font-mono-code text-xs font-bold text-amber-950 dark:text-amber-200 italic">
                      "{plan.citySummary.foundingMotto}"
                    </p>

                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10 text-xs leading-relaxed">
                      <span className="font-bold text-slate-950 dark:text-white">Atmospheric Decision: </span>
                      <span className={subtle}>{plan.citySummary.climateRationale}</span>
                    </div>
                  </div>

                  {/* District Zoning Summary */}
                  <div>
                    <h3 className={`mb-2.5 text-xs font-bold uppercase tracking-wider ${subtle}`}>
                      Autonomous Urban Zoning ({plan.districts.length} Districts)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {plan.districts.map((d) => (
                        <div key={d.repoName} className={`rounded-2xl p-3.5 ${cardBg}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-display text-xs font-bold text-slate-950 dark:text-white truncate">
                              {d.repoName}
                            </span>
                            <span className="font-mono-code text-[10px] font-bold text-amber-900 dark:text-amber-300">
                              {d.civicCritique.prosperityScore}/100 Prosperity
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                            {d.civicCritique.municipalRole}
                          </div>
                          <p className={`mt-1 text-[11px] leading-relaxed line-clamp-2 ${subtle}`}>
                            {d.civicCritique.urbanPlanningRationale}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {d.civicCritique.architecturalFeatures.map((f, i) => (
                              <span
                                key={i}
                                className={`rounded-md px-1.5 py-0.5 font-mono-code text-[9px] font-bold ${
                                  isNightUI
                                    ? 'bg-white/10 text-slate-100 border border-white/20'
                                    : 'bg-slate-100 text-slate-900 border border-slate-300'
                                }`}
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Epoch Chronicles & Landmark Monuments */}
              {activeTab === 'chronicles' && plan && (
                <div className="space-y-3.5 animate-fade-in">
                  <p className={`text-xs ${subtle}`}>
                    Google Gemini Decision Engine evaluated repository telemetry and synthesized these historical epochs,
                    prescribing landmark 3D monuments now standing in the city.
                  </p>
                  <div className="space-y-3">
                    {plan.historicalChronicles.map((ch, idx) => (
                      <div key={idx} className={`rounded-2xl p-4 ${cardBg}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 font-mono-code text-[10px] font-bold text-amber-800 dark:text-amber-300">
                                {idx + 1}
                              </span>
                              <h4 className="font-display text-sm font-bold text-slate-950 dark:text-white">
                                {ch.epochName}
                              </h4>
                            </div>
                            <span className="font-mono-code text-[10.5px] font-bold text-amber-900 dark:text-amber-300">
                              {ch.timeRange}
                            </span>
                          </div>
                          <span className="rounded-full bg-indigo-100 text-indigo-950 border border-indigo-300 dark:bg-indigo-950/80 dark:text-indigo-200 dark:border-indigo-500/50 px-2 py-0.5 font-mono-code text-[10px] font-bold">
                            {ch.monument.monumentType.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>

                        <p className={`mt-2 text-xs leading-relaxed ${subtle}`}>
                          {ch.narrative}
                        </p>

                        <div className={`mt-3 flex items-center gap-2 rounded-xl p-3 border ${
                          isNightUI
                            ? 'bg-amber-950/30 border-amber-500/30 text-slate-100'
                            : 'bg-amber-50 border-amber-300 text-slate-900'
                        }`}>
                          <Landmark className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                          <div className="min-w-0">
                            <div className="font-display text-xs font-bold text-slate-950 dark:text-white">
                              {ch.monument.name}
                            </div>
                            <div className={`text-[10.5px] truncate font-medium ${subtle}`}>{ch.monument.lore}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: Inter-District Transit Network */}
              {activeTab === 'transit' && plan && (
                <div className="space-y-3.5 animate-fade-in">
                  <p className={`text-xs ${subtle}`}>
                    The Decision Engine discovered architectural synergy across these repositories and established glowing
                    3D transit arteries with distinct transit tiers.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {plan.interDistrictConnections.map((conn, idx) => (
                      <div key={idx} className={`rounded-2xl p-3.5 ${cardBg}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-mono-code text-xs font-bold text-slate-950 dark:text-white">
                            {conn.sourceRepo} ⇄ {conn.targetRepo}
                          </span>
                          <span className="rounded-md bg-sky-100 text-sky-950 border border-sky-300 dark:bg-sky-950/80 dark:text-sky-200 dark:border-sky-500/50 px-2 py-0.5 font-mono-code text-[10px] font-bold">
                            {conn.connectionType.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <p className={`mt-2 text-xs leading-relaxed ${subtle}`}>
                          {conn.synergyReason}
                        </p>
                        <div className="mt-2 text-[10px] font-mono-code font-bold text-amber-900 dark:text-amber-300">
                          Traffic Bandwidth: Level {conn.bandwidthWeight}/5
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 4: API Settings */}
              {activeTab === 'settings' && (
                <div className="space-y-4 animate-fade-in">
                  <div className={`rounded-2xl p-4 ${cardBg}`}>
                    <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                      Google AI Studio Free API Key
                    </h3>
                    <p className={`mt-1 text-xs leading-relaxed ${subtle}`}>
                      GitPolis uses the high-performance Gemini 2.0 Flash model via Google AI Studio. Free tier keys allow
                      15 requests per minute with zero billing required.
                    </p>

                    <div className="mt-3.5 flex flex-col sm:flex-row gap-2">
                      <input
                        type="password"
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                        placeholder="AIzaSy••••••••••••••••••••••••••••••"
                        className={`flex-1 rounded-xl border px-3 py-2 font-mono-code text-xs outline-none ${
                          isNightUI
                            ? 'border-white/20 bg-black/60 text-white placeholder:text-slate-400'
                            : 'border-slate-400 bg-white text-slate-950 placeholder:text-slate-500 font-semibold'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={handleSaveKey}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-amber-500 cursor-pointer transition"
                      >
                        <Check className="h-4 w-4" />
                        <span>Save & Generate</span>
                      </button>
                    </div>

                    {savedKeyToast && (
                      <p className="mt-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        API key saved securely to local browser storage.
                      </p>
                    )}

                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-200 dark:border-white/10 text-xs">
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-amber-900 hover:underline font-bold dark:text-amber-300"
                      >
                        Get a Free Google AI Studio Key <ExternalLink className="h-3 w-3" />
                      </a>
                      {plan && (
                        <button
                          type="button"
                          onClick={() => onGeneratePlan(keyInput.trim())}
                          className={`flex items-center gap-1 font-bold ${subtle} ${hoverBg} p-1 rounded-lg cursor-pointer`}
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Re-Plan City
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
