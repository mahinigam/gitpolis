import * as THREE from 'three';
import type { StyleId } from '../../domain/city/types';
import { ARCHITECTURAL_STYLES } from '../../domain/city/styles';
import { hashString, SeededRNG } from '../../domain/prng';

export interface FacadeTextureSet {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
}

const facadeCache = new Map<string, FacadeTextureSet>();
let roadTextureCache: THREE.CanvasTexture | null = null;
let plazaTextureCache: THREE.CanvasTexture | null = null;

function adjustHex(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  hsl.l = Math.max(0.05, Math.min(0.96, hsl.l + amount));
  c.setHSL(hsl.h, hsl.s, hsl.l);
  return `#${c.getHexString()}`;
}

export function getFacadeTextures(styleId: StyleId, overgrown = false): FacadeTextureSet {
  const key = `${styleId}:${overgrown ? 'old' : 'fresh'}`;
  const existing = facadeCache.get(key);
  if (existing) return existing;

  const style = ARCHITECTURAL_STYLES[styleId];
  const rng = new SeededRNG(hashString(`tex:${key}`));

  const size = 512;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const ctx = albedoCanvas.getContext('2d')!;

  const emissiveCanvas = document.createElement('canvas');
  emissiveCanvas.width = size;
  emissiveCanvas.height = size;
  const ectx = emissiveCanvas.getContext('2d')!;

  // Base wall color (slightly patinated & muted if overgrown/heritage)
  const baseColor = new THREE.Color(style.wallColor);
  if (overgrown) {
    baseColor.lerp(new THREE.Color('#9e9a87'), 0.28);
  }
  ctx.fillStyle = `#${baseColor.getHexString()}`;
  ctx.fillRect(0, 0, size, size);

  // Dark emissive base
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, size, size);

  // Subtle architectural surface texture (masonry / corten ribs / timber / limestone)
  for (let i = 0; i < 600; i++) {
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    const w = rng.range(4, 24);
    const h = rng.range(2, 10);
    ctx.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.045)' : 'rgba(20,25,35,0.045)';
    ctx.fillRect(x, y, w, h);
  }

  // Style-specific cladding pattern
  if (styleId === 'rust_foundry') {
    // Vertical ribbed corten steel panels & rivet horizontal bands
    ctx.fillStyle = 'rgba(42, 22, 14, 0.14)';
    for (let x = 0; x < size; x += 16) {
      ctx.fillRect(x, 0, 3, size);
    }
    ctx.fillStyle = 'rgba(255, 160, 100, 0.08)';
    for (let x = 3; x < size; x += 16) {
      ctx.fillRect(x, 0, 2, size);
    }
  } else if (styleId === 'typescript_glass' || styleId === 'go_nordic' || styleId === 'swift_pavilion') {
    // Sleek curtain-wall floor spandrels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    for (let y = 0; y < size; y += 64) {
      ctx.fillRect(0, y, size, 6);
    }
  } else if (styleId === 'java_artdeco' || styleId === 'cpp_monolith') {
    // Fluted vertical stone pilasters
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    for (let x = 0; x < size; x += 64) {
      ctx.fillRect(x + 2, 0, 10, size);
    }
    ctx.fillStyle = 'rgba(30, 28, 24, 0.1)';
    for (let x = 0; x < size; x += 64) {
      ctx.fillRect(x + 12, 0, 3, size);
    }
  } else if (styleId === 'ruby_oldtown' || styleId === 'web_canal') {
    // Subtle plaster / brick courses
    ctx.fillStyle = 'rgba(70, 40, 30, 0.06)';
    for (let y = 0; y < size; y += 16) {
      ctx.fillRect(0, y, size, 1.5);
    }
  }

  // Draw Architectural Window Grid
  const cols =
    styleId === 'typescript_glass' || styleId === 'swift_pavilion'
      ? 6
      : styleId === 'rust_foundry'
        ? 4
        : styleId === 'go_nordic'
          ? 5
          : 4;
  const rows = 8;
  const cellW = size / cols;
  const cellH = size / rows;

  const winBase = style.windowTint;
  const winHighlight = adjustHex(winBase, 0.16);
  const frameColor = adjustHex(style.secondaryWall, -0.15);

  for (let r = 0; r < rows; r++) {
    // Horizontal floor slab / cornice band
    ctx.fillStyle = 'rgba(25, 32, 42, 0.14)';
    ctx.fillRect(0, r * cellH, size, 4);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fillRect(0, r * cellH + 4, size, 2);

    for (let c = 0; c < cols; c++) {
      const padX =
        styleId === 'typescript_glass' || styleId === 'swift_pavilion'
          ? cellW * 0.1
          : styleId === 'rust_foundry'
            ? cellW * 0.16
            : cellW * 0.22;
      const padY = styleId === 'typescript_glass' ? cellH * 0.14 : cellH * 0.2;

      const wx = c * cellW + padX;
      const wy = r * cellH + padY;
      const ww = cellW - padX * 2;
      const wh = cellH - padY * 2;

      // Window frame shadow
      ctx.fillStyle = frameColor;
      ctx.fillRect(wx - 2.5, wy - 2.5, ww + 5, wh + 5);

      // Arched top for Python Botanical / Old Town
      const isArched = styleId === 'python_botanical' || styleId === 'ruby_oldtown';

      // Glass gradient
      const grad = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
      grad.addColorStop(0, winHighlight);
      grad.addColorStop(0.55, winBase);
      grad.addColorStop(1, adjustHex(winBase, -0.12));

      ctx.fillStyle = grad;
      if (isArched) {
        ctx.beginPath();
        const rad = ww / 2;
        ctx.arc(wx + rad, wy + rad * 0.65, rad, Math.PI, 0);
        ctx.lineTo(wx + ww, wy + wh);
        ctx.lineTo(wx, wy + wh);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(wx, wy, ww, wh);
      }

      // Subtle diagonal glass sky reflection
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.beginPath();
      ctx.moveTo(wx + 2, wy + 2);
      ctx.lineTo(wx + ww * 0.65, wy + 2);
      ctx.lineTo(wx + 2, wy + wh * 0.65);
      ctx.closePath();
      ctx.fill();

      // Mullion crossbar
      ctx.fillStyle = 'rgba(240, 244, 248, 0.28)';
      ctx.fillRect(wx + ww * 0.5 - 1, wy, 2, wh);
      if (styleId === 'rust_foundry' || styleId === 'python_botanical') {
        ctx.fillRect(wx, wy + wh * 0.5 - 1, ww, 2);
      }

      // Window sill
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(wx - 3, wy + wh + 1, ww + 6, 3);

      // Emissive interior lighting (natural organic occupancy — ~58% lit, dimmer if overgrown)
      const litChance = overgrown ? 0.3 : 0.62;
      if (rng.chance(litChance)) {
        const warmth = rng.next();
        let lightColor = style.emissiveColor;
        if (warmth < 0.25) lightColor = '#ffd58a';
        else if (warmth < 0.5) lightColor = '#ffe9bd';
        else if (warmth < 0.72) lightColor = '#ffbe73';
        else if (styleId === 'go_nordic' || styleId === 'devops_port') lightColor = '#b9f3ff';
        else lightColor = '#fff2d6';

        ectx.fillStyle = lightColor;
        const eGrad = ectx.createLinearGradient(wx, wy, wx, wy + wh);
        eGrad.addColorStop(0, lightColor);
        eGrad.addColorStop(1, adjustHex(lightColor, -0.18));
        ectx.fillStyle = eGrad;
        ectx.fillRect(wx + 2, wy + 2, ww - 4, wh - 4);
      }
    }
  }

  // Organic creeping ivy / moss patches along lower walls for dormant/heritage buildings!
  if (overgrown) {
    for (let i = 0; i < 48; i++) {
      const mx = rng.range(0, size);
      const my = rng.range(size * 0.5, size);
      const mr = rng.range(6, 22);
      ctx.fillStyle = rng.chance(0.5) ? 'rgba(84, 118, 72, 0.36)' : 'rgba(65, 96, 58, 0.28)';
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  const emissiveMap = new THREE.CanvasTexture(emissiveCanvas);
  emissiveMap.wrapS = THREE.RepeatWrapping;
  emissiveMap.wrapT = THREE.RepeatWrapping;
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.anisotropy = 4;

  const result = { map, emissiveMap };
  facadeCache.set(key, result);
  return result;
}

export function getRoadTexture(): THREE.CanvasTexture {
  if (roadTextureCache) return roadTextureCache;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const rng = new SeededRNG(4211);

  // Warm charcoal architectural asphalt
  ctx.fillStyle = '#474f59';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle asphalt grain
  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(rng.range(0, 256), rng.range(0, 256), 2, 2);
  }

  // Sidewalk curb lines
  ctx.fillStyle = '#9aa3ad';
  ctx.fillRect(0, 0, 14, 256);
  ctx.fillRect(242, 0, 14, 256);

  // Subtle white edge lane stripes
  ctx.fillStyle = 'rgba(241, 245, 249, 0.35)';
  ctx.fillRect(20, 0, 3, 256);
  ctx.fillRect(233, 0, 3, 256);

  // Warm cream dashed centerline
  ctx.fillStyle = 'rgba(248, 242, 224, 0.72)';
  for (let y = 12; y < 256; y += 44) {
    ctx.fillRect(125, y, 6, 22);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  roadTextureCache = tex;
  return tex;
}

export function getPlazaTexture(): THREE.CanvasTexture {
  if (plazaTextureCache) return plazaTextureCache;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#e7dfd0';
  ctx.fillRect(0, 0, 512, 512);

  // Concentric travertine stone rings
  const cx = 256;
  const cy = 256;
  const radii = [240, 210, 175, 138, 100, 62];
  radii.forEach((r, idx) => {
    ctx.strokeStyle = idx % 2 === 0 ? 'rgba(130, 118, 98, 0.32)' : 'rgba(186, 152, 92, 0.35)';
    ctx.lineWidth = idx === 0 ? 5 : 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Radial paving lines
  ctx.strokeStyle = 'rgba(120, 110, 95, 0.22)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 58, cy + Math.sin(a) * 58);
    ctx.lineTo(cx + Math.cos(a) * 244, cy + Math.sin(a) * 244);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  plazaTextureCache = tex;
  return tex;
}

/**
 * Creates a crisp miniature architectural district street nameplate texture
 */
export function createDistrictSignTexture(
  repoName: string,
  language: string,
  accentHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Rounded dark architectural bronze plaque
  ctx.fillStyle = '#1b2430';
  ctx.beginPath();
  ctx.roundRect(8, 10, 496, 108, 22);
  ctx.fill();

  // Accent stripe on left
  ctx.fillStyle = accentHex;
  ctx.beginPath();
  ctx.roundRect(8, 10, 22, 108, [22, 0, 0, 22]);
  ctx.fill();

  // Border highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(10, 12, 492, 104, 20);
  ctx.stroke();

  // Repo name
  const displayName = repoName.length > 18 ? `${repoName.slice(0, 17)}…` : repoName;
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 40px "Space Grotesk", "Plus Jakarta Sans", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(displayName, 46, 52);

  // Language sub-label
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '500 22px "JetBrains Mono", monospace';
  ctx.fillText(language.toUpperCase(), 46, 94);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
