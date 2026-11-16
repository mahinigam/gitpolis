import React, { useState } from 'react';
import { X, Download, Star, Building2, Code2, Layers, Check } from 'lucide-react';
import type { CityBlueprint } from '../../domain/city/types';

interface PostcardModalProps {
  blueprint: CityBlueprint;
  snapshotDataUrl: string | null;
  onClose: () => void;
}

function fmtLOC(loc: number): string {
  if (loc >= 1_000_000) return `${(loc / 1_000_000).toFixed(2)}M`;
  if (loc >= 1_000) return `${(loc / 1_000).toFixed(1)}k`;
  return loc.toLocaleString();
}

export const PostcardModal: React.FC<PostcardModalProps> = ({
  blueprint,
  snapshotDataUrl,
  onClose,
}) => {
  const [downloaded, setDownloaded] = useState(false);

  const handleDownloadPostcard = async () => {
    if (!snapshotDataUrl) return;
    const img = new Image();
    img.src = snapshotDataUrl;
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    const w = 1400;
    const imgH = 780;
    const footerH = 190;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = imgH + footerH;
    const ctx = canvas.getContext('2d')!;

    // Warm archival postcard cream stock
    ctx.fillStyle = '#faf7f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw 3D city screenshot cleanly cropped to cover top frame
    const pad = 28;
    const frameW = w - pad * 2;
    const frameH = imgH - pad;
    const scale = Math.max(frameW / img.width, frameH / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const drawX = pad + (frameW - drawW) / 2;
    const drawY = pad + (frameH - drawH) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(pad, pad, frameW, frameH, 20);
    ctx.clip();
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();

    // Footer typographic plaque
    const fy = imgH + 46;
    ctx.fillStyle = '#18202c';
    ctx.font = '700 40px "Space Grotesk", sans-serif';
    ctx.fillText(blueprint.cityName, pad + 8, fy);

    ctx.fillStyle = '#b45309';
    ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`@${blueprint.profile.login}  •  ${blueprint.citySubtitle}`, pad + 8, fy + 34);

    // Language color strip
    let lx = pad + 8;
    const barY = fy + 58;
    const barW = 540;
    for (const l of blueprint.stats.languageBreakdown.slice(0, 6)) {
      const segW = Math.max(10, (l.percentage / 100) * barW);
      ctx.fillStyle = l.color;
      ctx.fillRect(lx, barY, segW, 10);
      lx += segW + 2;
    }

    ctx.fillStyle = '#64748b';
    ctx.font = '500 15px "JetBrains Mono", monospace';
    const langLabels = blueprint.stats.languageBreakdown
      .slice(0, 4)
      .map((l) => `${l.language} ${Math.round(l.percentage)}%`)
      .join('   •   ');
    ctx.fillText(langLabels, pad + 8, barY + 34);

    // Right stats column
    const statsText = [
      `${blueprint.districts.length} REPO DISTRICTS`,
      `${blueprint.stats.totalBuildings} COMMIT STRUCTURES`,
      `~${fmtLOC(blueprint.stats.totalEstimatedLOC)} LINES OF CODE`,
      `${blueprint.stats.totalStars.toLocaleString()} GITHUB STARS`,
    ];
    ctx.textAlign = 'right';
    ctx.fillStyle = '#334155';
    ctx.font = '600 17px "JetBrains Mono", monospace';
    statsText.forEach((line, idx) => {
      ctx.fillText(line, w - pad - 8, fy - 4 + idx * 28);
    });

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 13px "JetBrains Mono", monospace';
    ctx.fillText('GENERATED WITH GITPOLIS', w - pad - 8, barY + 34);

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `gitpolis-${blueprint.profile.login}.png`;
    a.click();
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/25 bg-[#faf7f0] text-slate-900 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-slate-900/70 p-2 text-white backdrop-blur hover:bg-slate-900 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Live 3D Frame */}
        <div className="p-4 pb-0">
          <div className="overflow-hidden rounded-2xl bg-slate-900 shadow-inner aspect-[16/9]">
            {snapshotDataUrl ? (
              <img
                src={snapshotDataUrl}
                alt={blueprint.cityName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Capturing city vista…
              </div>
            )}
          </div>
        </div>

        {/* Archival Postcard Plaque */}
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 font-mono-code text-[10.5px] font-bold uppercase tracking-wider text-amber-800">
                  GitPolis Architectural Postcard
                </span>
              </div>
              <h2 className="font-display mt-1.5 text-2xl font-bold tracking-tight">
                {blueprint.cityName}
              </h2>
              <p className="text-xs font-medium text-slate-600">
                @{blueprint.profile.login} • {blueprint.citySubtitle}
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadPostcard}
              className="flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow transition hover:bg-amber-600 cursor-pointer"
            >
              {downloaded ? <Check className="h-4 w-4 text-emerald-400" /> : <Download className="h-4 w-4" />}
              {downloaded ? 'Saved Postcard PNG' : 'Download Postcard PNG'}
            </button>
          </div>

          {/* Stats Strip */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-2xl bg-slate-900/[0.04] p-2.5">
              <div className="flex items-center gap-1 text-[10.5px] text-slate-500">
                <Layers className="h-3 w-3" /> Repo Districts
              </div>
              <div className="mt-0.5 font-mono-code text-sm font-bold">{blueprint.districts.length}</div>
            </div>
            <div className="rounded-2xl bg-slate-900/[0.04] p-2.5">
              <div className="flex items-center gap-1 text-[10.5px] text-slate-500">
                <Building2 className="h-3 w-3" /> Structures
              </div>
              <div className="mt-0.5 font-mono-code text-sm font-bold">{blueprint.stats.totalBuildings}</div>
            </div>
            <div className="rounded-2xl bg-slate-900/[0.04] p-2.5">
              <div className="flex items-center gap-1 text-[10.5px] text-slate-500">
                <Code2 className="h-3 w-3" /> Est. LOC
              </div>
              <div className="mt-0.5 font-mono-code text-sm font-bold">
                ~{fmtLOC(blueprint.stats.totalEstimatedLOC)}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-900/[0.04] p-2.5">
              <div className="flex items-center gap-1 text-[10.5px] text-slate-500">
                <Star className="h-3 w-3 text-amber-500" /> Stars
              </div>
              <div className="mt-0.5 font-mono-code text-sm font-bold">
                {blueprint.stats.totalStars.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Language Skyline Bar */}
          <div className="mt-4">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-200">
              {blueprint.stats.languageBreakdown.map((l) => (
                <div
                  key={l.language}
                  style={{ width: `${Math.max(3, l.percentage)}%`, backgroundColor: l.color }}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
              {blueprint.stats.languageBreakdown.slice(0, 6).map((l) => (
                <span key={l.language} className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                  <span className="font-semibold">{l.language}</span>
                  <span className="font-mono-code text-[10px] text-slate-400">{Math.round(l.percentage)}%</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
