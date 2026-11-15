import type { BuildingArchetype, StyleId } from '../types/city';

export interface LanguageArchitecturalStyle {
  styleId: StyleId;
  styleName: string;
  shortLabel: string;
  archetype: BuildingArchetype;
  description: string;
  badgeColor: string;
  wallColor: string;
  secondaryWall: string;
  roofColor: string;
  accentColor: string;
  pavementColor: string;
  windowTint: string;
  emissiveColor: string;
  metalness: number;
  roughness: number;
  treeVariant: 'oak' | 'cypress' | 'cherry' | 'weeping' | 'pine';
}

export const ARCHITECTURAL_STYLES: Record<StyleId, LanguageArchitecturalStyle> = {
  typescript_glass: {
    styleId: 'typescript_glass',
    styleName: 'Glass & Timber Tech Campus',
    shortLabel: 'Glass & Timber',
    archetype: 'glass_terrace',
    description:
      'Cantilevered glazed towers framed with warm cedar louvers, terraced sky-gardens, and crisp architectural concrete.',
    badgeColor: '#2563eb',
    wallColor: '#dce7f2',
    secondaryWall: '#b9895b',
    roofColor: '#3a556e',
    accentColor: '#3b82f6',
    pavementColor: '#d7dfe8',
    windowTint: '#3a7ca5',
    emissiveColor: '#ffe0a3',
    metalness: 0.28,
    roughness: 0.42,
    treeVariant: 'oak',
  },
  javascript_studio: {
    styleId: 'javascript_studio',
    styleName: 'Sunlit Ochre & Loft Studios',
    shortLabel: 'Sunlit Lofts',
    archetype: 'glass_terrace',
    description:
      'Energetic stepped loft buildings in warm amber brick and sunlit timber with bold studio skylights and corner balconies.',
    badgeColor: '#d97706',
    wallColor: '#f2dfb8',
    secondaryWall: '#d69e4e',
    roofColor: '#4c5764',
    accentColor: '#f59e0b',
    pavementColor: '#e5dcc8',
    windowTint: '#3b647d',
    emissiveColor: '#ffda85',
    metalness: 0.14,
    roughness: 0.62,
    treeVariant: 'oak',
  },
  python_botanical: {
    styleId: 'python_botanical',
    styleName: 'Botanical Atrium & Solarium',
    shortLabel: 'Botanical Atrium',
    archetype: 'botanical_dome',
    description:
      'Classical cream limestone laboratories crowned with verdigris copper domes, glass conservatories, and lush courtyard greenery.',
    badgeColor: '#15803d',
    wallColor: '#eee5d1',
    secondaryWall: '#c9bc9c',
    roofColor: '#4e8a77',
    accentColor: '#22a06b',
    pavementColor: '#dcd9cb',
    windowTint: '#4f8682',
    emissiveColor: '#ffe7ad',
    metalness: 0.18,
    roughness: 0.58,
    treeVariant: 'cypress',
  },
  rust_foundry: {
    styleId: 'rust_foundry',
    styleName: 'Brutalist Corten Foundry',
    shortLabel: 'Corten Foundry',
    archetype: 'corten_foundry',
    description:
      'Precision-engineered weathered corten steel halls with sawtooth skylights, external iron trusses, and warm furnace-lit clerestories.',
    badgeColor: '#c2410c',
    wallColor: '#b85c3a',
    secondaryWall: '#4a4e57',
    roofColor: '#363b42',
    accentColor: '#ea580c',
    pavementColor: '#cfc5bd',
    windowTint: '#42474f',
    emissiveColor: '#ffb35c',
    metalness: 0.42,
    roughness: 0.58,
    treeVariant: 'pine',
  },
  go_nordic: {
    styleId: 'go_nordic',
    styleName: 'Nordic Skybridge Towers',
    shortLabel: 'Nordic Towers',
    archetype: 'nordic_twin',
    description:
      'Minimalist alabaster twin towers linked by concurrent glass skybridges, chamfered facades, and crisp glacier-cyan beacons.',
    badgeColor: '#0891b2',
    wallColor: '#edf3f7',
    secondaryWall: '#a6cad6',
    roofColor: '#4b6878',
    accentColor: '#06b6d4',
    pavementColor: '#dce6ec',
    windowTint: '#3e8ca3',
    emissiveColor: '#c8f4ff',
    metalness: 0.25,
    roughness: 0.36,
    treeVariant: 'pine',
  },
  cpp_monolith: {
    styleId: 'cpp_monolith',
    styleName: 'Granite Civic Monoliths',
    shortLabel: 'Civic Monolith',
    archetype: 'monolith_ziggurat',
    description:
      'Foundational stepped granite ziggurats, classical stone colonnades, and bronze-spired civic vaults built to endure decades.',
    badgeColor: '#475569',
    wallColor: '#c5cbd4',
    secondaryWall: '#848f9e',
    roofColor: '#4b5563',
    accentColor: '#6366f1',
    pavementColor: '#cbd0d8',
    windowTint: '#3c4c63',
    emissiveColor: '#ffdfa8',
    metalness: 0.2,
    roughness: 0.72,
    treeVariant: 'cypress',
  },
  java_artdeco: {
    styleId: 'java_artdeco',
    styleName: 'Art Deco Crown Spires',
    shortLabel: 'Art Deco Spires',
    archetype: 'art_deco_spire',
    description:
      'Enterprise-scale sandstone skyscrapers featuring vertical fluted pilasters, brass setbacks, and illuminated pinnacle crowns.',
    badgeColor: '#b45309',
    wallColor: '#e6d3b3',
    secondaryWall: '#b8945e',
    roofColor: '#3f5a69',
    accentColor: '#d97706',
    pavementColor: '#ddd4c5',
    windowTint: '#2f4e63',
    emissiveColor: '#ffe099',
    metalness: 0.32,
    roughness: 0.46,
    treeVariant: 'oak',
  },
  ruby_oldtown: {
    styleId: 'ruby_oldtown',
    styleName: 'Artisanal Terracotta Quarter',
    shortLabel: 'Old Town Quarter',
    archetype: 'gabled_townhouse',
    description:
      'Warm European plaster townhouses with terracotta pitched roofs, dormer studios, wrought-iron balconies, and lively café awnings.',
    badgeColor: '#dc2626',
    wallColor: '#edd4c8',
    secondaryWall: '#c76152',
    roofColor: '#a84438',
    accentColor: '#e11d48',
    pavementColor: '#dfd1c7',
    windowTint: '#425669',
    emissiveColor: '#ffd996',
    metalness: 0.08,
    roughness: 0.76,
    treeVariant: 'cherry',
  },
  swift_pavilion: {
    styleId: 'swift_pavilion',
    styleName: 'Sculpted Cupertino Pavilions',
    shortLabel: 'Curved Pavilions',
    archetype: 'cupertino_pavilion',
    description:
      'Precision-milled ivory rings and curved glass pavilions wrapped around serene orchard courtyards with warm citrus highlights.',
    badgeColor: '#ea580c',
    wallColor: '#f5f4f0',
    secondaryWall: '#e89566',
    roofColor: '#d8d9de',
    accentColor: '#f97316',
    pavementColor: '#e6e4de',
    windowTint: '#4f7a96',
    emissiveColor: '#ffead1',
    metalness: 0.34,
    roughness: 0.28,
    treeVariant: 'cherry',
  },
  web_canal: {
    styleId: 'web_canal',
    styleName: 'Design Canal Townhouses',
    shortLabel: 'Canal Studios',
    archetype: 'gabled_townhouse',
    description:
      'Expressive narrow Dutch-style gabled design studios painted in pastel coral, mint, and cobalt overlooking bright tiled plazas.',
    badgeColor: '#db2777',
    wallColor: '#f0d8e0',
    secondaryWall: '#7db8b3',
    roofColor: '#485770',
    accentColor: '#ec4899',
    pavementColor: '#e0dce2',
    windowTint: '#3e6d8a',
    emissiveColor: '#ffe4b5',
    metalness: 0.12,
    roughness: 0.65,
    treeVariant: 'cherry',
  },
  devops_port: {
    styleId: 'devops_port',
    styleName: 'Harbor Control & Modular Works',
    shortLabel: 'Logistics Works',
    archetype: 'control_tower',
    description:
      'Tapered operations control towers, rotating telemetry arrays, and ribbed modular container bays keeping the infrastructure humming.',
    badgeColor: '#0f766e',
    wallColor: '#c9d4d6',
    secondaryWall: '#4d666e',
    roofColor: '#37474f',
    accentColor: '#14b8a6',
    pavementColor: '#c7cfd1',
    windowTint: '#2b6b70',
    emissiveColor: '#9cf5e6',
    metalness: 0.44,
    roughness: 0.45,
    treeVariant: 'pine',
  },
  polyglot_library: {
    styleId: 'polyglot_library',
    styleName: 'Scholarly Sandstone Hall',
    shortLabel: 'Library Hall',
    archetype: 'heritage_hall',
    description:
      'Warm sandstone archive pavilions with slate hipped roofs, rooftop reading lanterns, and serene courtyard gardens.',
    badgeColor: '#7c3aed',
    wallColor: '#e6dfd1',
    secondaryWall: '#9a8ba8',
    roofColor: '#4c4b69',
    accentColor: '#8b5cf6',
    pavementColor: '#dbd7d0',
    windowTint: '#485a75',
    emissiveColor: '#ffe3a8',
    metalness: 0.12,
    roughness: 0.7,
    treeVariant: 'oak',
  },
};

export function resolveLanguageStyle(language: string | null | undefined): LanguageArchitecturalStyle {
  const key = (language || '').trim().toLowerCase();

  if (['typescript', 'tsx'].includes(key)) return ARCHITECTURAL_STYLES.typescript_glass;
  if (['javascript', 'jsx', 'coffeescript', 'mdx'].includes(key)) return ARCHITECTURAL_STYLES.javascript_studio;
  if (['python', 'jupyter notebook', 'r', 'julia', 'matlab'].includes(key)) return ARCHITECTURAL_STYLES.python_botanical;
  if (['rust', 'zig', 'nim', 'elixir', 'erlang'].includes(key)) return ARCHITECTURAL_STYLES.rust_foundry;
  if (['go', 'golang', 'dart', 'v'].includes(key)) return ARCHITECTURAL_STYLES.go_nordic;
  if (['c', 'c++', 'assembly', 'cuda', 'glsl', 'hlsl', 'wgsl', 'fortran', 'objective-c', 'objective-c++', 'makefile', 'cmake'].includes(key)) {
    return ARCHITECTURAL_STYLES.cpp_monolith;
  }
  if (['java', 'kotlin', 'c#', 'scala', 'groovy', 'f#', 'clojure', 'haskell', 'ocaml'].includes(key)) {
    return ARCHITECTURAL_STYLES.java_artdeco;
  }
  if (['ruby', 'php', 'perl', 'lua', 'crystal'].includes(key)) return ARCHITECTURAL_STYLES.ruby_oldtown;
  if (['swift'].includes(key)) return ARCHITECTURAL_STYLES.swift_pavilion;
  if (['html', 'css', 'scss', 'sass', 'less', 'vue', 'svelte', 'astro', 'stylus'].includes(key)) {
    return ARCHITECTURAL_STYLES.web_canal;
  }
  if (['shell', 'bash', 'dockerfile', 'hcl', 'nix', 'powershell', 'terraform', 'yaml', 'toml', 'bicep'].includes(key)) {
    return ARCHITECTURAL_STYLES.devops_port;
  }
  return ARCHITECTURAL_STYLES.polyglot_library;
}
