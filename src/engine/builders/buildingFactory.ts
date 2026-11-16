import * as THREE from 'three';
import type { BuildingBlueprint } from '../../domain/city/types';
import { ARCHITECTURAL_STYLES } from '../../domain/city/styles';
import { SeededRNG } from '../../domain/prng';
import { getFacadeTextures } from '../materials/textures';

export interface BuiltBuilding {
  group: THREE.Group;
  blueprint: BuildingBlueprint;
  windowMaterials: THREE.MeshStandardMaterial[];
  beaconMaterials: THREE.MeshStandardMaterial[];
  craneJib?: THREE.Object3D;
  radarDish?: THREE.Object3D;
  pulseRing?: THREE.Mesh;
}

const facadeMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
const solidMaterialCache = new Map<string, THREE.MeshStandardMaterial>();

function createTiledFacadeMaterial(
  blueprint: BuildingBlueprint,
  repeatX: number,
  repeatY: number,
  windowMaterials: THREE.MeshStandardMaterial[]
): THREE.MeshStandardMaterial {
  const style = ARCHITECTURAL_STYLES[blueprint.styleId];
  const overgrown = blueprint.overgrowth > 0.5;
  const rx = Math.max(1, Math.min(4, Math.round(repeatX)));
  const ry = Math.max(1, Math.min(6, Math.round(repeatY)));
  const cacheKey = `${blueprint.styleId}:${overgrown ? 'old' : 'fresh'}:${rx}x${ry}`;

  const cached = facadeMaterialCache.get(cacheKey);
  if (cached) {
    if (!windowMaterials.includes(cached)) windowMaterials.push(cached);
    return cached;
  }

  const baseTex = getFacadeTextures(blueprint.styleId, overgrown);

  const map = baseTex.map.clone();
  map.needsUpdate = true;
  map.repeat.set(rx, ry);

  const emissiveMap = baseTex.emissiveMap.clone();
  emissiveMap.needsUpdate = true;
  emissiveMap.repeat.set(rx, ry);

  const mat = new THREE.MeshStandardMaterial({
    map,
    emissiveMap,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.12,
    roughness: overgrown ? Math.min(0.88, style.roughness + 0.18) : style.roughness,
    metalness: overgrown ? style.metalness * 0.65 : style.metalness,
  });
  mat.userData.shared = true;

  facadeMaterialCache.set(cacheKey, mat);
  windowMaterials.push(mat);
  return mat;
}

function makeSolidMat(color: string, roughness = 0.65, metalness = 0.15): THREE.MeshStandardMaterial {
  const key = `${color}:${roughness.toFixed(2)}:${metalness.toFixed(2)}`;
  const cached = solidMaterialCache.get(key);
  if (cached) return cached;
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness,
    metalness,
  });
  mat.userData.shared = true;
  solidMaterialCache.set(key, mat);
  return mat;
}

function makeBeaconMat(color: string, beaconMaterials: THREE.MeshStandardMaterial[]): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.65,
    roughness: 0.25,
    metalness: 0.2,
  });
  beaconMaterials.push(mat);
  return mat;
}

function addBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
  castShadow = true
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createGableRoofGeometry(width: number, height: number, depth: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(0, height);
  shape.lineTo(width / 2, 0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

function addRooftopGarden(parent: THREE.Object3D, w: number, d: number, y: number, rng: SeededRNG) {
  const planterMat = makeSolidMat('#786c5c', 0.82, 0.05);
  const shrubColors = ['#4d854b', '#5d9954', '#3e7342', '#6fa35a'];
  addBox(parent, w * 0.72, 0.14, d * 0.72, 0, y + 0.07, 0, planterMat, false);

  const count = rng.int(3, 6);
  for (let i = 0; i < count; i++) {
    const rad = rng.range(0.18, 0.34);
    const bush = new THREE.Mesh(
      new THREE.DodecahedronGeometry(rad, 0),
      makeSolidMat(rng.pick(shrubColors), 0.85, 0)
    );
    bush.position.set(
      rng.range(-w * 0.26, w * 0.26),
      y + 0.14 + rad * 0.75,
      rng.range(-d * 0.26, d * 0.26)
    );
    bush.scale.set(1, rng.range(0.75, 1.25), 1);
    bush.castShadow = true;
    parent.add(bush);
  }
}

function addOvergrowthMoss(parent: THREE.Object3D, w: number, h: number, d: number, level: number, rng: SeededRNG) {
  if (level < 0.42) return;
  const mossMat = makeSolidMat('#4e7747', 0.9, 0);
  const count = Math.round(level * 7);
  for (let i = 0; i < count; i++) {
    const r = rng.range(0.2, 0.44);
    const tuft = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mossMat);
    const onRoof = rng.chance(0.55);
    if (onRoof) {
      tuft.position.set(
        rng.range(-w * 0.38, w * 0.38),
        h + r * 0.35,
        rng.range(-d * 0.38, d * 0.38)
      );
      tuft.scale.set(1.3, 0.5, 1.2);
    } else {
      const side = rng.int(0, 3);
      const sx = side === 0 ? w / 2 : side === 1 ? -w / 2 : rng.range(-w * 0.4, w * 0.4);
      const sz = side === 2 ? d / 2 : side === 3 ? -d / 2 : rng.range(-d * 0.4, d * 0.4);
      tuft.position.set(sx, rng.range(0.4, Math.min(h * 0.7, 3.6)), sz);
      tuft.scale.set(0.9, 1.4, 0.9);
    }
    parent.add(tuft);
  }
}

function addScaffolding(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  beaconMaterials: THREE.MeshStandardMaterial[]
) {
  const metalPoleMat = makeSolidMat('#94a3b8', 0.45, 0.75);
  const plankMat = makeSolidMat('#ca8a04', 0.82, 0.1);
  const meshNetMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ea580c'),
    roughness: 0.9,
    transparent: true,
    opacity: 0.55,
  });

  const scafH = Math.min(h * 0.88, 8.5);
  const scafW = w * 0.75;
  const frontZ = d / 2 + 0.35;

  // Vertical steel poles
  const poleCount = Math.max(3, Math.floor(scafW / 1.1));
  for (let i = 0; i < poleCount; i++) {
    const px = -scafW / 2 + (scafW / (poleCount - 1)) * i;
    addBox(parent, 0.06, scafH, 0.06, px, scafH / 2, frontZ, metalPoleMat, false);
    addBox(parent, 0.06, scafH, 0.06, px, scafH / 2, frontZ + 0.5, metalPoleMat, false);
  }

  // Horizontal walk planks & safety netting
  const tiers = Math.max(2, Math.floor(scafH / 1.6));
  for (let t = 1; t <= tiers; t++) {
    const py = (scafH / tiers) * t;
    addBox(parent, scafW, 0.08, 0.52, 0, py, frontZ + 0.25, plankMat, false);
    // Orange debris safety net
    addBox(parent, scafW, 0.9, 0.02, 0, py - 0.45, frontZ + 0.51, meshNetMat, false);
  }

  // Blinking hazard beacon on top corner
  const hazardLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    makeBeaconMat('#f97316', beaconMaterials)
  );
  hazardLed.position.set(-scafW / 2, scafH + 0.14, frontZ + 0.5);
  parent.add(hazardLed);
}

function addObservationSpire(
  parent: THREE.Object3D,
  topY: number,
  w: number,
  d: number,
  beaconMaterials: THREE.MeshStandardMaterial[]
) {
  const goldMat = makeSolidMat('#d97706', 0.28, 0.85);
  const glassBalustradeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#bae6fd'),
    roughness: 0.1,
    metalness: 0.4,
    transparent: true,
    opacity: 0.65,
  });

  // Elevated observation deck
  const deckSize = Math.min(w, d) * 0.58;
  addBox(parent, deckSize, 0.18, deckSize, 0, topY + 0.09, 0, goldMat, true);
  addBox(parent, deckSize + 0.04, 0.36, deckSize + 0.04, 0, topY + 0.32, 0, glassBalustradeMat, false);

  // Slender golden telecommunications needle
  const spireMast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 2.8, 8), goldMat);
  spireMast.position.set(0, topY + 1.48, 0);
  spireMast.castShadow = true;
  parent.add(spireMast);

  // Ultra-bright aerial pinnacle beacon
  const pinnacle = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 12, 12),
    makeBeaconMat('#fbbf24', beaconMaterials)
  );
  pinnacle.position.set(0, topY + 2.9, 0);
  parent.add(pinnacle);
}

function addDomainFeature(
  parent: THREE.Object3D,
  topY: number,
  w: number,
  d: number,
  feature: string,
  beaconMaterials: THREE.MeshStandardMaterial[]
) {
  // 1. AI & Neural Systems: Holographic Telemetry Dome & Fiber Spire
  if (feature.includes('Neural') || feature.includes('Holographic')) {
    const domeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#c084fc'),
      emissive: new THREE.Color('#9333ea'),
      emissiveIntensity: 0.45,
      roughness: 0.2,
      metalness: 0.6,
      transparent: true,
      opacity: 0.82,
    });
    const rad = Math.min(w, d) * 0.32;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(rad, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.position.set(0, topY, 0);
    dome.castShadow = true;
    parent.add(dome);

    const haloGeo = new THREE.TorusGeometry(rad * 1.15, 0.035, 8, 24);
    const haloMat = makeBeaconMat('#c084fc', beaconMaterials);
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, topY + rad * 0.55, 0);
    parent.add(halo);
  }

  // 2. Systems & Cloud: Modular Container Bays & Heavy Telemetry
  else if (feature.includes('Logistics') || feature.includes('Container')) {
    const colors = ['#0284c7', '#0d9488', '#ea580c', '#334155'];
    const bayW = Math.min(1.8, w * 0.38);
    const bayH = 0.55;
    const bayD = Math.min(3.2, d * 0.55);

    for (let i = 0; i < 2; i++) {
      const cMat = makeSolidMat(colors[i % colors.length], 0.5, 0.4);
      addBox(parent, bayW, bayH, bayD, (i === 0 ? -1 : 1) * (bayW * 0.55), topY + bayH / 2, 0, cMat, true);
    }
  }

  // 3. Web & Frontend: Sunlit Terrace Cafe Pergola
  else if (feature.includes('Canal') || feature.includes('Awnings')) {
    const awningMat = makeSolidMat('#ec4899', 0.6, 0.1);
    const canopyW = w * 0.68;
    const canopyD = d * 0.45;
    addBox(parent, canopyW, 0.08, canopyD, 0, topY + 0.65, 0, awningMat, false);

    const legMat = makeSolidMat('#475569', 0.4, 0.6);
    addBox(parent, 0.05, 0.65, 0.05, -canopyW / 2 + 0.1, topY + 0.32, -canopyD / 2 + 0.1, legMat, false);
    addBox(parent, 0.05, 0.65, 0.05, canopyW / 2 - 0.1, topY + 0.32, -canopyD / 2 + 0.1, legMat, false);
    addBox(parent, 0.05, 0.65, 0.05, -canopyW / 2 + 0.1, topY + 0.32, canopyD / 2 - 0.1, legMat, false);
    addBox(parent, 0.05, 0.65, 0.05, canopyW / 2 - 0.1, topY + 0.32, canopyD / 2 - 0.1, legMat, false);
  }

  // 4. Mobile: Sculpted Cupertino Halo Ring
  else if (feature.includes('Cupertino') || feature.includes('Minimalist')) {
    const ringRad = Math.min(w, d) * 0.36;
    const ivoryMat = makeSolidMat('#f8fafc', 0.25, 0.35);
    const torus = new THREE.Mesh(new THREE.TorusGeometry(ringRad, 0.12, 12, 32), ivoryMat);
    torus.rotation.x = Math.PI / 2;
    torus.position.set(0, topY + 0.38, 0);
    torus.castShadow = true;
    parent.add(torus);
  }

  // 5. Data Science: Astronomical Observatory Telescope Dome & Solar Cells
  else if (feature.includes('Astronomical') || feature.includes('Solar')) {
    const domeRad = Math.min(w, d) * 0.28;
    const domeMat = makeSolidMat('#e2e8f0', 0.3, 0.5);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(domeRad, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.position.set(-w * 0.14, topY, 0);
    dome.castShadow = true;
    parent.add(dome);

    // Tilted solar panels
    const solarMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1e3a8a'),
      emissive: new THREE.Color('#1d4ed8'),
      emissiveIntensity: 0.18,
      roughness: 0.2,
      metalness: 0.8,
    });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w * 0.35, 0.04, d * 0.28), solarMat);
    panel.position.set(w * 0.22, topY + 0.18, 0);
    panel.rotation.x = 0.28;
    panel.castShadow = true;
    parent.add(panel);
  }

  // 6. Security & Crypto: Granite Bastion Corner Buttresses
  else if (feature.includes('Bastion') || feature.includes('Vault')) {
    const graniteMat = makeSolidMat('#64748b', 0.8, 0.25);
    const pylonW = Math.min(0.75, w * 0.22);
    const pylonH = 1.4;
    addBox(parent, pylonW, pylonH, pylonW, -w / 2 + pylonW / 2, topY + pylonH / 2, -d / 2 + pylonW / 2, graniteMat, true);
    addBox(parent, pylonW, pylonH, pylonW, w / 2 - pylonW / 2, topY + pylonH / 2, -d / 2 + pylonW / 2, graniteMat, true);

    const redBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), makeBeaconMat('#ef4444', beaconMaterials));
    redBeacon.position.set(-w / 2 + pylonW / 2, topY + pylonH + 0.12, -d / 2 + pylonW / 2);
    parent.add(redBeacon);
  }

  // 7. Gaming & Graphics: Kinetic Neon Spire
  else if (feature.includes('Neon') || feature.includes('Prismatic')) {
    const neonGeo = new THREE.OctahedronGeometry(0.38, 0);
    const neonMat = makeBeaconMat('#a855f7', beaconMaterials);
    const crystal = new THREE.Mesh(neonGeo, neonMat);
    crystal.position.set(0, topY + 0.85, 0);
    crystal.rotation.y = Math.PI / 4;
    parent.add(crystal);
  }

  // 8. Tooling & CLI: Brick Clocktower Lantern
  else if (feature.includes('Clocktower') || feature.includes('Foundry')) {
    const towerH = 1.6;
    const towerW = Math.min(1.4, w * 0.34);
    const brickMat = makeSolidMat('#b45309', 0.72, 0.2);
    addBox(parent, towerW, towerH, towerW, 0, topY + towerH / 2, 0, brickMat, true);

    const roofMat = makeSolidMat('#334155', 0.5, 0.4);
    const pyramid = new THREE.Mesh(new THREE.ConeGeometry(towerW * 0.75, 0.75, 4), roofMat);
    pyramid.position.set(0, topY + towerH + 0.38, 0);
    pyramid.rotation.y = Math.PI / 4;
    parent.add(pyramid);
  }
}

function buildTowerCrane(height: number): { root: THREE.Group; jib: THREE.Group } {
  const root = new THREE.Group();
  const yellowMat = makeSolidMat('#eab308', 0.42, 0.35);
  const darkMat = makeSolidMat('#334155', 0.5, 0.55);

  const mastH = Math.min(3.6, Math.max(1.9, height * 0.28));
  // Mast tower
  addBox(root, 0.24, mastH, 0.24, 0, mastH / 2, 0, yellowMat);
  // Operator cab
  addBox(root, 0.44, 0.36, 0.44, 0.14, mastH - 0.15, 0, darkMat);

  // Rotating jib group
  const jib = new THREE.Group();
  jib.position.set(0, mastH + 0.08, 0);

  // Main boom
  addBox(jib, 3.4, 0.16, 0.18, 1.15, 0.08, 0, yellowMat);
  // Counterweight arm + concrete block
  addBox(jib, 1.15, 0.16, 0.18, -0.58, 0.08, 0, yellowMat);
  addBox(jib, 0.46, 0.34, 0.34, -0.95, 0.08, 0, darkMat);
  // Top apex mast
  const apex = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.65, 4), yellowMat);
  apex.position.set(0, 0.44, 0);
  jib.add(apex);

  // Hanging cable + hook
  addBox(jib, 0.04, 1.15, 0.04, 2.25, -0.58, 0, darkMat, false);
  addBox(jib, 0.22, 0.14, 0.22, 2.25, -1.16, 0, yellowMat, false);

  root.add(jib);
  return { root, jib };
}

export function createProceduralBuilding(blueprint: BuildingBlueprint): BuiltBuilding {
  const rng = new SeededRNG(blueprint.seed);
  const style = ARCHITECTURAL_STYLES[blueprint.styleId];
  const group = new THREE.Group();
  group.name = `building:${blueprint.id}`;

  const windowMaterials: THREE.MeshStandardMaterial[] = [];
  const beaconMaterials: THREE.MeshStandardMaterial[] = [];

  const { width: w, depth: d, height: h, archetype } = blueprint;

  const secondaryMat = makeSolidMat(style.secondaryWall, 0.62, style.metalness * 0.8);
  const roofMat = makeSolidMat(style.roofColor, 0.56, Math.min(0.6, style.metalness + 0.15));
  const trimMat = makeSolidMat('#eceae4', 0.55, 0.15);
  const darkMetalMat = makeSolidMat('#303842', 0.44, 0.62);
  const brassMat = makeSolidMat('#cfa255', 0.32, 0.72);
  const glassMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(style.windowTint),
    roughness: 0.16,
    metalness: 0.45,
    transparent: true,
    opacity: 0.78,
  });

  const mainFacadeMat = createTiledFacadeMaterial(blueprint, w / 2.2, h / 3.4, windowMaterials);

  let topY = h;
  let radarDish: THREE.Object3D | undefined;

  switch (archetype) {
    case 'glass_terrace': {
      // Modern TypeScript / JavaScript Glass & Timber Campus
      const podiumH = Math.min(1.5, h * 0.22);
      addBox(group, w * 1.02, podiumH, d * 1.02, 0, podiumH / 2, 0, secondaryMat);
      addBox(group, w * 1.05, 0.14, d * 1.05, 0, podiumH + 0.05, 0, trimMat);

      const midH = (h - podiumH) * 0.66;
      addBox(group, w * 0.92, midH, d * 0.92, 0, podiumH + midH / 2, 0, mainFacadeMat);

      // Horizontal cantilevered floor slabs + timber louver fins
      const slabCount = Math.max(2, Math.floor(midH / 1.4));
      for (let i = 1; i <= slabCount; i++) {
        const sy = podiumH + (midH * i) / slabCount;
        addBox(group, w * 0.98, 0.1, d * 0.98, 0, sy, 0, trimMat, false);
      }

      // Warm cedar vertical fins on one corner
      const finSide = rng.chance(0.5) ? 1 : -1;
      for (let f = -1; f <= 1; f++) {
        addBox(
          group,
          0.11,
          midH * 0.9,
          0.16,
          finSide * (w * 0.47),
          podiumH + midH * 0.5,
          f * (d * 0.24),
          secondaryMat,
          false
        );
      }

      // Asymmetric upper terraced setback
      const upperH = h - podiumH - midH;
      const offX = rng.range(-w * 0.12, w * 0.12);
      const offZ = rng.range(-d * 0.12, d * 0.12);
      const upperW = w * 0.64;
      const upperD = d * 0.64;
      const upperFacade = createTiledFacadeMaterial(blueprint, upperW / 2.2, upperH / 3.2, windowMaterials);
      addBox(group, upperW, upperH, upperD, offX, podiumH + midH + upperH / 2, offZ, upperFacade);
      addBox(group, upperW + 0.18, 0.16, upperD + 0.18, offX, h + 0.08, offZ, roofMat);

      // Rooftop pergola & garden terrace
      addRooftopGarden(group, upperW * 0.85, upperD * 0.85, h + 0.14, rng);
      topY = h + 0.35;
      break;
    }

    case 'botanical_dome': {
      // Python Botanical Atrium & Solarium
      const baseH = h * 0.68;
      addBox(group, w * 0.98, 0.45, d * 0.98, 0, 0.225, 0, secondaryMat);
      addBox(group, w * 0.9, baseH, d * 0.9, 0, 0.4 + baseH / 2, 0, mainFacadeMat);
      addBox(group, w * 0.98, 0.2, d * 0.98, 0, 0.4 + baseH + 0.1, 0, trimMat);

      // Classical portico columns along front facade
      const colCount = 4;
      for (let i = 0; i < colCount; i++) {
        const cx = -w * 0.34 + (w * 0.68 * i) / (colCount - 1);
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, Math.min(2.2, baseH * 0.5), 8), trimMat);
        col.position.set(cx, 0.4 + Math.min(1.1, baseH * 0.25), d * 0.49);
        col.castShadow = true;
        group.add(col);
      }

      // Octagonal drum + ribbed copper/glass botanical dome!
      const drumH = h * 0.16;
      const domeRadius = Math.min(w, d) * 0.36;
      const drumY = 0.4 + baseH + 0.2;
      const drum = new THREE.Mesh(
        new THREE.CylinderGeometry(domeRadius * 1.04, domeRadius * 1.08, drumH, 10),
        secondaryMat
      );
      drum.position.set(0, drumY + drumH / 2, 0);
      drum.castShadow = true;
      group.add(drum);

      const domeGeo = new THREE.SphereGeometry(domeRadius, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const dome = new THREE.Mesh(domeGeo, rng.chance(0.55) ? roofMat : glassMat);
      dome.position.set(0, drumY + drumH, 0);
      dome.scale.set(1, 1.12, 1);
      dome.castShadow = true;
      group.add(dome);

      // Brass cupola lantern at top of dome
      const lanternY = drumY + drumH + domeRadius * 1.1;
      const lantern = new THREE.Mesh(
        new THREE.CylinderGeometry(domeRadius * 0.24, domeRadius * 0.28, 0.42, 8),
        makeBeaconMat(style.emissiveColor, beaconMaterials)
      );
      lantern.position.set(0, lanternY + 0.18, 0);
      group.add(lantern);

      const cap = new THREE.Mesh(new THREE.ConeGeometry(domeRadius * 0.3, 0.4, 8), roofMat);
      cap.position.set(0, lanternY + 0.56, 0);
      group.add(cap);

      topY = lanternY + 0.78;
      break;
    }

    case 'corten_foundry': {
      // Rust Brutalist Corten Steel Foundry
      const plinthH = 0.65;
      addBox(group, w * 1.04, plinthH, d * 1.04, 0, plinthH / 2, 0, darkMetalMat);

      const mainH = h * 0.74;
      addBox(group, w * 0.94, mainH, d * 0.94, 0, plinthH + mainH / 2, 0, mainFacadeMat);

      // External dark-steel structural exo-frame columns
      const corners = [
        [-w * 0.48, -d * 0.48],
        [w * 0.48, -d * 0.48],
        [-w * 0.48, d * 0.48],
        [w * 0.48, d * 0.48],
      ];
      for (const [cx, cz] of corners) {
        addBox(group, 0.2, mainH + 0.4, 0.2, cx, plinthH + mainH / 2, cz, darkMetalMat);
      }
      // Horizontal heavy steel truss belt
      addBox(group, w * 1.0, 0.24, d * 1.0, 0, plinthH + mainH * 0.55, 0, darkMetalMat);

      // Sawtooth industrial roof bays!
      const roofBaseY = plinthH + mainH;
      const bayCount = 3;
      const bayW = (w * 0.9) / bayCount;
      const toothH = Math.min(1.5, h * 0.18);
      const sawShape = new THREE.Shape();
      sawShape.moveTo(-bayW / 2, 0);
      sawShape.lineTo(-bayW / 2, toothH);
      sawShape.lineTo(bayW / 2, 0);
      sawShape.closePath();
      const sawGeo = new THREE.ExtrudeGeometry(sawShape, { depth: d * 0.88, bevelEnabled: false });
      sawGeo.translate(0, 0, -(d * 0.88) / 2);

      for (let i = 0; i < bayCount; i++) {
        const bx = -w * 0.45 + bayW * (i + 0.5);
        const saw = new THREE.Mesh(sawGeo, roofMat);
        saw.position.set(bx, roofBaseY, 0);
        saw.castShadow = true;
        group.add(saw);
      }

      // Twin foundry smokestacks / thermal vents with warm amber rim
      const stackH = Math.min(3.2, h * 0.34);
      for (let s = 0; s < 2; s++) {
        const stack = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.22, stackH, 10),
          darkMetalMat
        );
        stack.position.set(w * 0.28, roofBaseY + stackH / 2, (s === 0 ? -1 : 1) * d * 0.22);
        stack.castShadow = true;
        group.add(stack);

        const rim = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.18, 0.12, 10),
          makeBeaconMat('#f97316', beaconMaterials)
        );
        rim.position.set(w * 0.28, roofBaseY + stackH, (s === 0 ? -1 : 1) * d * 0.22);
        group.add(rim);
      }

      topY = roofBaseY + toothH;
      break;
    }

    case 'nordic_twin': {
      // Go Minimalist Nordic Twin Towers + Concurrent Skybridge!
      const podiumH = Math.min(1.4, h * 0.18);
      addBox(group, w * 0.98, podiumH, d * 0.92, 0, podiumH / 2, 0, secondaryMat);

      const towerW = w * 0.41;
      const towerD = d * 0.78;
      const hA = h - podiumH;
      const hB = (h - podiumH) * rng.range(0.74, 0.92);

      const matA = createTiledFacadeMaterial(blueprint, towerW / 1.8, hA / 3.2, windowMaterials);
      const matB = createTiledFacadeMaterial(blueprint, towerW / 1.8, hB / 3.2, windowMaterials);

      addBox(group, towerW, hA, towerD, -w * 0.26, podiumH + hA / 2, 0, matA);
      addBox(group, towerW, hB, towerD, w * 0.26, podiumH + hB / 2, 0, matB);

      // Glowing skybridge connecting the twin towers (representing goroutines/channels!)
      const bridgeY = podiumH + hB * 0.62;
      addBox(group, w * 0.3, 0.62, towerD * 0.46, 0, bridgeY, 0, glassMat);
      addBox(group, w * 0.34, 0.1, towerD * 0.52, 0, bridgeY + 0.34, 0, trimMat, false);
      addBox(group, w * 0.34, 0.1, towerD * 0.52, 0, bridgeY - 0.34, 0, trimMat, false);

      // Floating minimalist roof halo & cyan beacon stripe
      addBox(group, towerW + 0.16, 0.16, towerD + 0.16, -w * 0.26, h + 0.08, 0, roofMat);
      const beacon = new THREE.Mesh(
        new THREE.BoxGeometry(towerW * 0.85, 0.12, towerD * 0.85),
        makeBeaconMat('#22d3ee', beaconMaterials)
      );
      beacon.position.set(-w * 0.26, h + 0.2, 0);
      group.add(beacon);

      addBox(group, towerW + 0.14, 0.14, towerD + 0.14, w * 0.26, podiumH + hB + 0.07, 0, roofMat);
      topY = h + 0.3;
      break;
    }

    case 'monolith_ziggurat': {
      // C / C++ Monumental Stepped Granite Ziggurat
      const tiers = h > 8 ? 4 : 3;
      let currY = 0;
      let currW = w * 0.98;
      let currD = d * 0.98;

      for (let t = 0; t < tiers; t++) {
        const frac = t === 0 ? 0.42 : t === 1 ? 0.3 : t === 2 ? 0.18 : 0.1;
        const th = h * frac;
        const tierMat =
          t === 0
            ? createTiledFacadeMaterial(blueprint, currW / 2.2, th / 3.0, windowMaterials)
            : createTiledFacadeMaterial(blueprint, currW / 2.0, th / 3.0, windowMaterials);

        addBox(group, currW, th, currD, 0, currY + th / 2, 0, tierMat);
        // Heavy carved stone cornice ledge
        addBox(group, currW + 0.16, 0.18, currD + 0.16, 0, currY + th, 0, secondaryMat);

        if (t === 0) {
          // Ground colonnade pillars
          const cols = 4;
          for (let i = 0; i < cols; i++) {
            const px = -currW * 0.38 + (currW * 0.76 * i) / (cols - 1);
            const pillar = new THREE.Mesh(
              new THREE.CylinderGeometry(0.11, 0.13, Math.min(2.2, th * 0.7), 8),
              secondaryMat
            );
            pillar.position.set(px, Math.min(1.1, th * 0.35), currD / 2 + 0.12);
            pillar.castShadow = true;
            group.add(pillar);
          }
        }

        currY += th;
        currW *= 0.76;
        currD *= 0.76;
      }

      // Stepped bronze obelisk crown
      const obelisk = new THREE.Mesh(new THREE.ConeGeometry(Math.min(currW, currD) * 0.32, 1.35, 4), brassMat);
      obelisk.position.set(0, currY + 0.68, 0);
      obelisk.rotation.y = Math.PI / 4;
      obelisk.castShadow = true;
      group.add(obelisk);
      topY = currY + 1.35;
      break;
    }

    case 'art_deco_spire': {
      // Java / Kotlin / C# Art Deco Crown Skyscraper
      const h1 = h * 0.52;
      const h2 = h * 0.28;
      const h3 = h * 0.2;

      addBox(group, w * 0.96, h1, d * 0.96, 0, h1 / 2, 0, mainFacadeMat);
      // Vertical Art Deco corner pilasters
      const pOffsets = [
        [-w * 0.46, -d * 0.46],
        [w * 0.46, -d * 0.46],
        [-w * 0.46, d * 0.46],
        [w * 0.46, d * 0.46],
      ];
      for (const [px, pz] of pOffsets) {
        addBox(group, 0.24, h1 + 0.45, 0.24, px, (h1 + 0.45) / 2, pz, secondaryMat);
      }

      const mat2 = createTiledFacadeMaterial(blueprint, (w * 0.74) / 2, h2 / 3, windowMaterials);
      addBox(group, w * 0.74, h2, d * 0.74, 0, h1 + h2 / 2, 0, mat2);
      addBox(group, w * 0.78, 0.14, d * 0.78, 0, h1 + h2, 0, brassMat);

      const mat3 = createTiledFacadeMaterial(blueprint, (w * 0.5) / 2, h3 / 2.8, windowMaterials);
      addBox(group, w * 0.5, h3, d * 0.5, 0, h1 + h2 + h3 / 2, 0, mat3);

      // Illuminated Art Deco Crown + Needle Spire
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(Math.min(w, d) * 0.12, Math.min(w, d) * 0.28, 0.85, 8),
        brassMat
      );
      crown.position.set(0, h + 0.42, 0);
      group.add(crown);

      const glowBand = new THREE.Mesh(
        new THREE.CylinderGeometry(Math.min(w, d) * 0.24, Math.min(w, d) * 0.24, 0.18, 8),
        makeBeaconMat('#fbbf24', beaconMaterials)
      );
      glowBand.position.set(0, h + 0.16, 0);
      group.add(glowBand);

      const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 1.8, 6), brassMat);
      needle.position.set(0, h + 1.65, 0);
      group.add(needle);

      topY = h + 2.55;
      break;
    }

    case 'gabled_townhouse': {
      // Ruby / PHP / Web Canal European Townhouse
      const wallH = h * 0.76;
      const roofH = Math.min(2.4, Math.max(1.1, h * 0.28));

      addBox(group, w * 0.92, wallH, d * 0.9, 0, wallH / 2, 0, mainFacadeMat);

      // Ground-floor café/studio awning!
      const awningMat = makeSolidMat(style.accentColor, 0.72, 0.05);
      const awning = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 0.1, 0.58), awningMat);
      awning.position.set(0, 1.05, d * 0.45 + 0.22);
      awning.rotation.x = 0.32;
      awning.castShadow = true;
      group.add(awning);

      // Pitched Gable Roof with overhanging eaves
      const gableGeo = createGableRoofGeometry(w * 1.04, roofH, d * 0.98);
      const roofMesh = new THREE.Mesh(gableGeo, roofMat);
      roofMesh.position.set(0, wallH, 0);
      roofMesh.castShadow = true;
      roofMesh.receiveShadow = true;
      group.add(roofMesh);

      // Cozy dormer window projection & chimney
      addBox(group, w * 0.28, roofH * 0.48, 0.55, w * 0.14, wallH + roofH * 0.35, d * 0.32, trimMat);
      addBox(group, 0.32, roofH * 0.85, 0.32, -w * 0.24, wallH + roofH * 0.62, -d * 0.2, secondaryMat);

      topY = wallH + roofH;
      break;
    }

    case 'cupertino_pavilion': {
      // Swift Sculpted Curved Pavilion
      const radius = Math.min(w, d) * 0.46;
      const floors = Math.max(2, Math.min(6, Math.round(h / 1.4)));
      const floorH = h / floors;

      const curvedMat = createTiledFacadeMaterial(blueprint, 4, Math.max(1, floors / 2), windowMaterials);

      for (let i = 0; i < floors; i++) {
        const r = radius * (i === floors - 1 ? 0.86 : 1.0);
        const core = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.92, floorH * 0.82, 20), curvedMat);
        core.position.set(0, i * floorH + floorH * 0.45, 0);
        core.castShadow = true;
        core.receiveShadow = true;
        group.add(core);

        // Sleek cantilevered ivory fin ring
        const slab = new THREE.Mesh(
          new THREE.CylinderGeometry(r * 1.06, r * 1.06, floorH * 0.18, 24),
          trimMat
        );
        slab.position.set(0, (i + 1) * floorH - floorH * 0.08, 0);
        slab.castShadow = true;
        group.add(slab);
      }

      // Warm citrus/amber skylight atrium ring on roof
      const skylight = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.48, 0.1, 8, 20),
        makeBeaconMat('#fb923c', beaconMaterials)
      );
      skylight.rotation.x = Math.PI / 2;
      skylight.position.set(0, h + 0.08, 0);
      group.add(skylight);

      topY = h + 0.22;
      break;
    }

    case 'control_tower': {
      // Shell / Docker / DevOps Harbor Control Tower & Modular Container Works
      const baseH = Math.min(2.2, h * 0.34);
      // Stacked ribbed modular container bays
      addBox(group, w * 0.96, baseH * 0.55, d * 0.9, 0, baseH * 0.275, 0, secondaryMat);
      addBox(group, w * 0.52, baseH * 0.45, d * 0.72, -w * 0.2, baseH * 0.77, 0, makeSolidMat(style.accentColor, 0.5, 0.4));

      // Tapered operations shaft rising above
      const shaftH = Math.max(2.0, h - baseH - 1.1);
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(Math.min(w, d) * 0.22, Math.min(w, d) * 0.3, shaftH, 8),
        mainFacadeMat
      );
      shaft.position.set(w * 0.14, baseH + shaftH / 2, 0);
      shaft.castShadow = true;
      group.add(shaft);

      // Angled panoramic observation control cab
      const cabY = baseH + shaftH;
      const cab = new THREE.Mesh(
        new THREE.CylinderGeometry(Math.min(w, d) * 0.42, Math.min(w, d) * 0.3, 0.95, 8),
        glassMat
      );
      cab.position.set(w * 0.14, cabY + 0.47, 0);
      cab.castShadow = true;
      group.add(cab);

      const cabRoof = new THREE.Mesh(
        new THREE.CylinderGeometry(Math.min(w, d) * 0.46, Math.min(w, d) * 0.46, 0.18, 8),
        roofMat
      );
      cabRoof.position.set(w * 0.14, cabY + 1.02, 0);
      group.add(cabRoof);

      // Rotating telemetry radar dish!
      const radarGroup = new THREE.Group();
      radarGroup.position.set(w * 0.14, cabY + 1.32, 0);
      addBox(radarGroup, 0.08, 0.45, 0.08, 0, 0, 0, darkMetalMat, false);
      const dish = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.08), trimMat);
      dish.position.set(0, 0.22, 0);
      radarGroup.add(dish);
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 8, 8),
        makeBeaconMat('#14b8a6', beaconMaterials)
      );
      tip.position.set(0, 0.46, 0);
      radarGroup.add(tip);
      group.add(radarGroup);
      radarDish = radarGroup;

      topY = cabY + 1.65;
      break;
    }

    case 'heritage_hall':
    default: {
      // Scholarly Sandstone Library / Archive Hall
      const wallH = h * 0.78;
      const roofH = Math.min(2.1, h * 0.28);

      addBox(group, w * 0.94, wallH, d * 0.94, 0, wallH / 2, 0, mainFacadeMat);
      addBox(group, w * 1.0, 0.18, d * 1.0, 0, wallH + 0.08, 0, trimMat);

      // Steep slate hipped roof (4-sided pyramid)
      const hipRoof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(w, d) * 0.72, roofH, 4),
        roofMat
      );
      hipRoof.position.set(0, wallH + 0.16 + roofH / 2, 0);
      hipRoof.rotation.y = Math.PI / 4;
      hipRoof.castShadow = true;
      group.add(hipRoof);

      // Rooftop glowing reading lantern skylight
      const lantern = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.26, 0.45, d * 0.26),
        makeBeaconMat('#fde68a', beaconMaterials)
      );
      lantern.position.set(0, wallH + roofH * 0.92, 0);
      group.add(lantern);

      topY = wallH + roofH + 0.25;
      break;
    }
  }

  // Commit DNA Architectural Embellishments!
  if (blueprint.dominantCommitType === 'release' || blueprint.prestige > 0.65) {
    // Golden celebratory pinnacle beacon for star landmarks & release clusters
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.3, 6), brassMat);
    mast.position.set(0, topY + 0.65, 0);
    group.add(mast);

    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 10),
      makeBeaconMat('#fbbf24', beaconMaterials)
    );
    orb.position.set(0, topY + 1.32, 0);
    group.add(orb);
  } else if (blueprint.dominantCommitType === 'fix') {
    // Rooftop maintenance mechanical housing + amber beacon
    addBox(group, 0.55, 0.35, 0.55, w * 0.18, topY + 0.12, -d * 0.16, darkMetalMat, false);
    const fixLed = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 8),
      makeBeaconMat('#f59e0b', beaconMaterials)
    );
    fixLed.position.set(w * 0.18, topY + 0.38, -d * 0.16);
    group.add(fixLed);
  } else if (blueprint.dominantCommitType === 'docs' || blueprint.dominantCommitType === 'test') {
    // Golden clock face medallion mounted on front upper facade
    const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 14), brassMat);
    clock.rotation.x = Math.PI / 2;
    clock.position.set(0, Math.min(h * 0.82, topY - 0.8), d * 0.48);
    group.add(clock);
  }

  // Scaffolding when building has issue burden or active reconstruction
  if (blueprint.hasScaffolding) {
    addScaffolding(group, w, h, d, beaconMaterials);
  }

  // Gilded Observation Spire for prestigious / high-star landmarks
  if (blueprint.isObservationSpire) {
    addObservationSpire(group, topY, w, d, beaconMaterials);
  }

  // Specialized Domain Feature (AI dome, cloud bays, web pergolas, etc.)
  if (blueprint.domainFeature) {
    addDomainFeature(group, topY, w, d, blueprint.domainFeature, beaconMaterials);
  }

  // Organic overgrowth / creeping moss on dormant & archived buildings
  addOvergrowthMoss(group, w, h, d, blueprint.overgrowth, rng);

  // Active construction crane on recently pushed buildings!
  let craneJib: THREE.Object3D | undefined;
  if (blueprint.hasCrane) {
    const crane = buildTowerCrane(h);
    crane.root.position.set(w * 0.16, topY - 0.1, -d * 0.12);
    group.add(crane.root);
    craneJib = crane.jib;
  }

  // Rising glowing commit-pulse ring on the most recently updated building in the city!
  let pulseRing: THREE.Mesh | undefined;
  if (blueprint.hasPulseBeacon) {
    const ringGeo = new THREE.RingGeometry(Math.max(w, d) * 0.56, Math.max(w, d) * 0.68, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(style.accentColor),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72,
    });
    pulseRing = new THREE.Mesh(ringGeo, ringMat);
    pulseRing.rotation.x = -Math.PI / 2;
    pulseRing.position.set(0, 0.15, 0);
    group.add(pulseRing);
  }

  // Tag all descendant meshes with building & district IDs for crisp raycasting!
  group.traverse((obj) => {
    obj.userData.buildingId = blueprint.id;
    obj.userData.districtId = blueprint.districtId;
  });

  group.position.set(blueprint.worldX, 0, blueprint.worldZ);
  group.rotation.y = blueprint.rotation;

  return {
    group,
    blueprint,
    windowMaterials,
    beaconMaterials,
    craneJib,
    radarDish,
    pulseRing,
  };
}
