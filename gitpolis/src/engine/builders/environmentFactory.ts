import * as THREE from 'three';
import type { CityBlueprint, DistrictBlueprint, TreeProp } from '../../domain/city/types';
import { ARCHITECTURAL_STYLES } from '../../domain/city/styles';
import { hashString, SeededRNG } from '../../domain/prng';
import { createDistrictSignTexture, getPlazaTexture, getRoadTexture } from '../materials/textures';

export interface BuiltDistrictGroup {
  district: DistrictBlueprint;
  group: THREE.Group;
  plinth: THREE.Mesh;
  highlightFrame: THREE.Mesh;
  trees: { mesh: THREE.Object3D; foundedAt: number; targetScale: number }[];
}

export interface BuiltEnvironment {
  root: THREE.Group;
  waterMesh: THREE.Mesh;
  skyMesh: THREE.Mesh;
  skyUniforms: {
    uZenithColor: { value: THREE.Color };
    uHorizonColor: { value: THREE.Color };
    uSunColor: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
    uStarAlpha: { value: number };
    uTime: { value: number };
  };
  cloudsGroup: THREE.Group;
  plazaGroup: THREE.Group;
  plazaRings: THREE.Mesh[];
  fountainDrops: THREE.Mesh[];
  districtGroups: Map<string, BuiltDistrictGroup>;
  lampGlobeMaterials: THREE.MeshStandardMaterial[];
  transitGroup: THREE.Group;
}

function createIslandHalfShape(
  radius: number,
  side: 'north' | 'south',
  cutZ: number,
  seed: number
): THREE.Shape {
  const shape = new THREE.Shape();
  const safeCut = Math.max(-radius * 0.82, Math.min(radius * 0.82, cutZ));
  const aCut = Math.asin(safeCut / radius);
  const samples = 52;

  const startAngle = side === 'north' ? aCut : aCut;
  const endAngle = side === 'north' ? -(Math.PI + aCut) : Math.PI - aCut;

  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const a = startAngle + (endAngle - startAngle) * t;
    // Fade organic coastal curvature smoothly to 0 at both canal mouth corners
    const edgeFade = Math.sin(t * Math.PI);
    const wobble =
      1 + edgeFade * (0.045 * Math.sin(a * 3 + seed) + 0.025 * Math.cos(a * 5 - seed * 0.5));
    const r = radius * wobble;
    const x = Math.cos(a) * r;
    const z = i === 0 || i === samples ? safeCut : Math.sin(a) * r;
    pts.push({ x, y: -z }); // Shape Y maps to -Z after rotateX(-PI/2)
  }

  shape.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    shape.lineTo(pts[i].x, pts[i].y);
  }
  shape.closePath();
  return shape;
}

export function createStylizedTree(variant: TreeProp['variant'], seed: number): THREE.Group {
  const rng = new SeededRNG(seed);
  const g = new THREE.Group();

  const trunkMat = new THREE.MeshStandardMaterial({
    color: variant === 'cherry' ? '#614842' : '#6c5442',
    roughness: 0.9,
  });

  if (variant === 'cypress') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.65, 6), trunkMat);
    trunk.position.y = 0.32;
    trunk.castShadow = true;
    g.add(trunk);

    const foliageMat = new THREE.MeshStandardMaterial({
      color: rng.pick(['#3c6e47', '#447a4d', '#346141']),
      roughness: 0.85,
    });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.9, 7), foliageMat);
    cone.position.y = 1.45;
    cone.castShadow = true;
    g.add(cone);
    return g;
  }

  if (variant === 'pine') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.7, 6), trunkMat);
    trunk.position.y = 0.35;
    trunk.castShadow = true;
    g.add(trunk);

    const foliageMat = new THREE.MeshStandardMaterial({
      color: rng.pick(['#2f5d46', '#386b51', '#2b5240']),
      roughness: 0.86,
    });
    for (let i = 0; i < 3; i++) {
      const tier = new THREE.Mesh(
        new THREE.ConeGeometry(0.56 - i * 0.13, 0.78 - i * 0.08, 7),
        foliageMat
      );
      tier.position.y = 0.92 + i * 0.44;
      tier.castShadow = true;
      g.add(tier);
    }
    return g;
  }

  if (variant === 'weeping') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.95, 6), trunkMat);
    trunk.position.y = 0.47;
    trunk.castShadow = true;
    g.add(trunk);

    const foliageMat = new THREE.MeshStandardMaterial({
      color: rng.pick(['#5f8552', '#6d915c', '#54784a']),
      roughness: 0.88,
    });
    const canopy = new THREE.Mesh(new THREE.DodecahedronGeometry(0.68, 1), foliageMat);
    canopy.position.y = 1.25;
    canopy.scale.set(1.15, 0.85, 1.15);
    canopy.castShadow = true;
    g.add(canopy);

    // Drooping vine clusters
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rng.range(0, 0.6);
      const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.08, 0.75, 5), foliageMat);
      drape.position.set(Math.cos(a) * 0.44, 0.86, Math.sin(a) * 0.44);
      g.add(drape);
    }
    return g;
  }

  // Oak or Cherry Blossom
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.85, 6), trunkMat);
  trunk.position.y = 0.42;
  trunk.castShadow = true;
  g.add(trunk);

  const colors =
    variant === 'cherry'
      ? ['#f4b6c2', '#f7cad3', '#eba2b3']
      : ['#4f8a4c', '#5e9b54', '#6ba85d', '#437844'];

  const mat = new THREE.MeshStandardMaterial({
    color: rng.pick(colors),
    roughness: 0.84,
  });

  const puffs = [
    { x: 0, y: 1.26, z: 0, r: 0.52 },
    { x: 0.28, y: 1.08, z: 0.15, r: 0.36 },
    { x: -0.26, y: 1.12, z: -0.14, r: 0.38 },
  ];
  for (const p of puffs) {
    const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(p.r, 0), mat);
    puff.position.set(p.x, p.y, p.z);
    puff.castShadow = true;
    g.add(puff);
  }
  return g;
}

function createStreetLamp(globeMat: THREE.MeshStandardMaterial): THREE.Group {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: '#2b333d', roughness: 0.5, metalness: 0.6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.55, 6), poleMat);
  pole.position.y = 0.775;
  pole.castShadow = true;
  g.add(pole);

  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), globeMat);
  globe.position.y = 1.62;
  g.add(globe);

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.12, 6), poleMat);
  cap.position.y = 1.74;
  g.add(cap);
  return g;
}

function createSkyDome(): {
  mesh: THREE.Mesh;
  uniforms: BuiltEnvironment['skyUniforms'];
} {
  const uniforms = {
    uZenithColor: { value: new THREE.Color('#3b82c4') },
    uHorizonColor: { value: new THREE.Color('#e9eef5') },
    uSunColor: { value: new THREE.Color('#fff2cc') },
    uSunDir: { value: new THREE.Vector3(0.5, 0.65, 0.4).normalize() },
    uStarAlpha: { value: 0.0 },
    uTime: { value: 0.0 },
  };

  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uZenithColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uStarAlpha;
      uniform float uTime;
      varying vec3 vWorldDir;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 col = mix(uHorizonColor, uZenithColor, pow(h, 0.58));

        // Soft atmospheric sun glow halo
        float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
        float sunGlow = pow(sunDot, 12.0) * 0.45 + pow(sunDot, 160.0) * 0.9;
        col += uSunColor * sunGlow * smoothstep(-0.15, 0.25, uSunDir.y);

        // Subtle procedural twinkling night stars
        if (uStarAlpha > 0.01 && dir.y > 0.08) {
          vec3 grid = floor(dir * 165.0);
          float rnd = hash(grid);
          if (rnd > 0.992) {
            float twinkle = 0.65 + 0.35 * sin(uTime * 2.2 + rnd * 120.0);
            col += vec3(0.92, 0.95, 1.0) * uStarAlpha * twinkle * smoothstep(0.08, 0.35, dir.y);
          }
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 20), mat);
  return { mesh, uniforms };
}

export function buildCityEnvironment(blueprint: CityBlueprint): BuiltEnvironment {
  const root = new THREE.Group();
  root.name = 'city-environment';
  const rng = new SeededRNG(blueprint.seed + 99);

  const lampGlobeMaterials: THREE.MeshStandardMaterial[] = [];
  const sharedLampGlobeMat = new THREE.MeshStandardMaterial({
    color: '#fff6d6',
    emissive: '#ffcf6e',
    emissiveIntensity: 0.18,
    roughness: 0.2,
  });
  lampGlobeMaterials.push(sharedLampGlobeMat);

  // 1. Sky Dome
  const sky = createSkyDome();
  root.add(sky.mesh);

  // 2. Sculpted Dual-Bank Island Terrain (North Island & South Waterfront separated by Canal!)
  const R = blueprint.islandRadius;
  const canalHalfW = 3.5;
  const northEdgeZ = blueprint.canalZ - canalHalfW;
  const southEdgeZ = blueprint.canalZ + canalHalfW;

  const landGrassMat = new THREE.MeshStandardMaterial({
    color: '#88ad74',
    roughness: 0.92,
    metalness: 0.02,
  });
  const embankmentMat = new THREE.MeshStandardMaterial({
    color: '#b8b0a0',
    roughness: 0.85,
    metalness: 0.05,
  });
  const terrainHeight = 1.3;
  const bevelThick = 0.22;

  // North main landmass (top face sits cleanly at y = 0.0)
  const northShape = createIslandHalfShape(R, 'north', northEdgeZ, blueprint.seed + 1);
  const northGeo = new THREE.ExtrudeGeometry(northShape, {
    depth: terrainHeight,
    bevelEnabled: true,
    bevelThickness: bevelThick,
    bevelSize: 0.3,
    bevelSegments: 2,
  });
  northGeo.rotateX(-Math.PI / 2);
  const northIsland = new THREE.Mesh(northGeo, [landGrassMat, embankmentMat]);
  northIsland.position.y = -(terrainHeight + bevelThick);
  northIsland.receiveShadow = true;
  root.add(northIsland);

  // South waterfront landmass (top face sits cleanly at y = 0.0)
  const southShape = createIslandHalfShape(R, 'south', southEdgeZ, blueprint.seed + 2);
  const southGeo = new THREE.ExtrudeGeometry(southShape, {
    depth: terrainHeight,
    bevelEnabled: true,
    bevelThickness: bevelThick,
    bevelSize: 0.3,
    bevelSegments: 2,
  });
  southGeo.rotateX(-Math.PI / 2);
  const southIsland = new THREE.Mesh(southGeo, [landGrassMat, embankmentMat]);
  southIsland.position.y = -(terrainHeight + bevelThick);
  southIsland.receiveShadow = true;
  root.add(southIsland);

  // Crisp stone quay edge ledges fitted flush along both canal banks
  const northQuayLen = Math.sqrt(Math.max(100, R * R - northEdgeZ * northEdgeZ)) * 1.98;
  const southQuayLen = Math.sqrt(Math.max(100, R * R - southEdgeZ * southEdgeZ)) * 1.98;
  const quayMat = new THREE.MeshStandardMaterial({ color: '#cec7b8', roughness: 0.78 });
  const northQuay = new THREE.Mesh(new THREE.BoxGeometry(northQuayLen, 0.24, 0.72), quayMat);
  northQuay.position.set(0, 0.04, northEdgeZ - 0.18);
  northQuay.receiveShadow = true;
  root.add(northQuay);

  const southQuay = new THREE.Mesh(new THREE.BoxGeometry(southQuayLen, 0.24, 0.72), quayMat);
  southQuay.position.set(0, 0.04, southEdgeZ + 0.18);
  southQuay.receiveShadow = true;
  root.add(southQuay);

  // 3. Expansive Luminous Ocean & Canal Water Plane
  const waterGeo = new THREE.PlaneGeometry(620, 620, 48, 48);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({
    color: '#3f8ea8',
    roughness: 0.22,
    metalness: 0.32,
    flatShading: false,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = -0.82;
  waterMesh.receiveShadow = true;
  root.add(waterMesh);

  // 4. Road Network & Stone Arched Bridges across the Canal
  const roadBaseTex = getRoadTexture();
  const bridgeStoneMat = new THREE.MeshStandardMaterial({ color: '#d4ccbc', roughness: 0.74 });
  const bridgeRailingMat = new THREE.MeshStandardMaterial({ color: '#46515e', roughness: 0.5, metalness: 0.45 });

  for (const seg of blueprint.roads) {
    const dx = seg.x2 - seg.x1;
    const dz = seg.z2 - seg.z1;
    const length = Math.hypot(dx, dz);
    if (length < 0.2) continue;

    const midX = (seg.x1 + seg.x2) / 2;
    const midZ = (seg.z1 + seg.z2) / 2;
    const angle = Math.atan2(dx, dz);

    const tex = roadBaseTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, Math.max(1, length / 6));

    const roadMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.84,
      metalness: 0.06,
    });

    if (seg.isBridge) {
      // Sculptural Stone Arched Bridge spanning the canal!
      const bridgeGroup = new THREE.Group();
      bridgeGroup.position.set(midX, 0.18, midZ);
      bridgeGroup.rotation.y = angle;

      // Deck
      const deck = new THREE.Mesh(new THREE.BoxGeometry(seg.width, 0.3, length), bridgeStoneMat);
      deck.position.y = 0.08;
      deck.castShadow = true;
      deck.receiveShadow = true;
      bridgeGroup.add(deck);

      // Road surface on top of deck
      const deckRoad = new THREE.Mesh(new THREE.PlaneGeometry(seg.width - 0.55, length), roadMat);
      deckRoad.rotation.x = -Math.PI / 2;
      deckRoad.position.y = 0.25;
      deckRoad.receiveShadow = true;
      bridgeGroup.add(deckRoad);

      // Left & right parapets + stone piers
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.46, length), bridgeStoneMat);
        rail.position.set(side * (seg.width / 2 - 0.12), 0.38, 0);
        rail.castShadow = true;
        bridgeGroup.add(rail);

        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, length), bridgeRailingMat);
        cap.position.set(side * (seg.width / 2 - 0.12), 0.62, 0);
        bridgeGroup.add(cap);

        // Bridge pillar lamps at ends
        for (const zEnd of [-length * 0.42, length * 0.42]) {
          const lamp = createStreetLamp(sharedLampGlobeMat);
          lamp.scale.setScalar(0.8);
          lamp.position.set(side * (seg.width / 2 - 0.12), 0.45, zEnd);
          bridgeGroup.add(lamp);
        }
      }

      // Bridge stone abutments dipping into water
      for (const zPier of [-length * 0.36, 0, length * 0.36]) {
        const pier = new THREE.Mesh(new THREE.BoxGeometry(seg.width + 0.35, 1.35, 0.65), bridgeStoneMat);
        pier.position.set(0, -0.58, zPier);
        bridgeGroup.add(pier);
      }

      root.add(bridgeGroup);
    } else {
      const isHorizontal = Math.abs(dx) > Math.abs(dz);
      const roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(seg.width, length), roadMat);
      roadMesh.rotation.x = -Math.PI / 2;
      roadMesh.rotation.z = -angle;
      roadMesh.position.set(midX, isHorizontal ? 0.045 : 0.056, midZ);
      roadMesh.receiveShadow = true;
      root.add(roadMesh);
    }
  }

  // 5. Central Civic Plaza (GitHub Profile Core Monument at 0, 0)
  const plazaGroup = new THREE.Group();
  plazaGroup.name = 'central-plaza';

  const plazaTex = getPlazaTexture();
  const plazaBase = new THREE.Mesh(
    new THREE.CylinderGeometry(blueprint.plaza.radius, blueprint.plaza.radius + 0.4, 0.45, 36),
    new THREE.MeshStandardMaterial({ map: plazaTex, roughness: 0.72 })
  );
  plazaBase.position.y = 0.22;
  plazaBase.receiveShadow = true;
  plazaGroup.add(plazaBase);

  // Ornamental fountain basin
  const marbleMat = new THREE.MeshStandardMaterial({ color: '#f0ebe1', roughness: 0.42, metalness: 0.08 });
  const brassMat = new THREE.MeshStandardMaterial({ color: '#d4a64e', roughness: 0.28, metalness: 0.76 });
  const fountainWaterMat = new THREE.MeshStandardMaterial({
    color: '#5cc4db',
    roughness: 0.15,
    metalness: 0.25,
    emissive: '#1e6e85',
    emissiveIntensity: 0.2,
  });

  const basinRim = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.28, 10, 32), marbleMat);
  basinRim.rotation.x = Math.PI / 2;
  basinRim.position.y = 0.66;
  basinRim.castShadow = true;
  plazaGroup.add(basinRim);

  const basinWater = new THREE.Mesh(new THREE.CylinderGeometry(3.08, 3.08, 0.26, 28), fountainWaterMat);
  basinWater.position.y = 0.58;
  plazaGroup.add(basinWater);

  // Animated fountain droplets
  const fountainDrops: THREE.Mesh[] = [];
  const dropMat = new THREE.MeshStandardMaterial({ color: '#e0f7ff', roughness: 0.1, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 12; i++) {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 6), dropMat);
    const a = (i / 12) * Math.PI * 2;
    drop.position.set(Math.cos(a) * 1.6, 0.9, Math.sin(a) * 1.6);
    drop.userData.phase = (i / 12) * Math.PI * 2;
    drop.userData.angle = a;
    plazaGroup.add(drop);
    fountainDrops.push(drop);
  }

  // Founder's Monument Spire (height reflects account age, followers & stars!)
  const mh = blueprint.plaza.monumentHeight;
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.85, 1.4, 8), marbleMat);
  plinth.position.y = 1.1;
  plinth.castShadow = true;
  plazaGroup.add(plinth);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.92, mh * 0.72, 8), marbleMat);
  shaft.position.y = 1.8 + (mh * 0.72) / 2;
  shaft.castShadow = true;
  plazaGroup.add(shaft);

  const lanternCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.68, 0),
    new THREE.MeshStandardMaterial({
      color: '#fde68a',
      emissive: '#f59e0b',
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.3,
    })
  );
  lanternCore.position.y = 1.8 + mh * 0.72 + 0.8;
  plazaGroup.add(lanternCore);

  // Orbiting Golden Star Rings around the Civic Spire!
  const plazaRings: THREE.Mesh[] = [];
  for (let i = 0; i < blueprint.plaza.rings; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15 + i * 0.26, 0.055, 8, 28), brassMat);
    ring.position.y = 1.8 + mh * 0.72 + 0.78;
    ring.rotation.x = Math.PI / 3 + i * 0.42;
    ring.rotation.y = i * 0.85;
    plazaGroup.add(ring);
    plazaRings.push(ring);
  }

  // Perimeter plaza trees & streetlamps
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const tx = Math.cos(a) * (blueprint.plaza.radius - 1.3);
    const tz = Math.sin(a) * (blueprint.plaza.radius - 1.3);
    if (i % 2 === 0) {
      const tree = createStylizedTree(i % 4 === 0 ? 'cherry' : 'oak', blueprint.seed + i * 17);
      tree.position.set(tx, 0.44, tz);
      tree.scale.setScalar(0.92);
      plazaGroup.add(tree);
    } else {
      const lamp = createStreetLamp(sharedLampGlobeMat);
      lamp.position.set(tx, 0.44, tz);
      plazaGroup.add(lamp);
    }
  }

  plazaGroup.traverse((o) => {
    o.userData.isPlaza = true;
  });
  root.add(plazaGroup);

  // 6. District Block Plinths, Nameplates, Trees, Streetlamps & Highlight Frames
  const districtGroups = new Map<string, BuiltDistrictGroup>();

  for (const district of blueprint.districts) {
    const style = ARCHITECTURAL_STYLES[district.styleId];
    const dGroup = new THREE.Group();
    dGroup.name = `district:${district.id}`;

    // Sidewalk stone plinth subtly tinted to the repo's language palette
    const plinthColor = new THREE.Color(style.pavementColor);
    if (district.overgrowthLevel > 0.5) {
      plinthColor.lerp(new THREE.Color('#8e9c80'), 0.28);
    }
    const plinthMat = new THREE.MeshStandardMaterial({
      color: plinthColor,
      roughness: 0.82,
      metalness: 0.04,
    });

    const plinthMesh = new THREE.Mesh(
      new THREE.BoxGeometry(district.width, district.plinthHeight, district.depth),
      plinthMat
    );
    plinthMesh.position.set(district.x, district.plinthHeight / 2, district.z);
    plinthMesh.receiveShadow = true;
    plinthMesh.castShadow = true;
    plinthMesh.userData.districtId = district.id;
    dGroup.add(plinthMesh);

    // Subtle colored district curb strip around top edge
    const accentTrimMat = new THREE.MeshStandardMaterial({
      color: style.badgeColor,
      roughness: 0.5,
      metalness: 0.2,
    });
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(district.width + 0.14, 0.09, district.depth + 0.14),
      accentTrimMat
    );
    strip.position.set(district.x, 0.08, district.z);
    strip.userData.districtId = district.id;
    dGroup.add(strip);

    // Selection / Hover luminous ground frame (visible on hover/select)
    const frameGeo = new THREE.RingGeometry(
      Math.max(district.width, district.depth) * 0.56,
      Math.max(district.width, district.depth) * 0.61,
      4
    );
    const frameMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(style.accentColor),
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
    });
    const highlightFrame = new THREE.Mesh(frameGeo, frameMat);
    highlightFrame.rotation.x = -Math.PI / 2;
    highlightFrame.rotation.z = Math.PI / 4;
    highlightFrame.position.set(district.x, district.plinthHeight + 0.06, district.z);
    dGroup.add(highlightFrame);

    // 3D Miniature Architectural District Street Sign Plaque!
    const signTex = createDistrictSignTexture(district.id, district.primaryLanguage, style.badgeColor);
    const signBoard = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 0.85),
      new THREE.MeshBasicMaterial({ map: signTex, transparent: true })
    );
    signBoard.position.set(
      district.x,
      district.plinthHeight + 0.58,
      district.z + district.depth / 2 + 0.18
    );
    signBoard.rotation.x = -0.38;
    signBoard.userData.districtId = district.id;
    dGroup.add(signBoard);

    // Distinct Repo Identity Landmarks on the Block Plinth:
    // 0. High Prosperity Gilded Trim
    if (district.prosperity.prosperityTier === 'gilded') {
      const goldTrimMat = new THREE.MeshStandardMaterial({
        color: '#f59e0b',
        roughness: 0.25,
        metalness: 0.85,
        emissive: '#d97706',
        emissiveIntensity: 0.22,
      });
      const goldCurb = new THREE.Mesh(
        new THREE.BoxGeometry(district.width + 0.22, 0.12, district.depth + 0.22),
        goldTrimMat
      );
      goldCurb.position.set(district.x, district.plinthHeight + 0.02, district.z);
      dGroup.add(goldCurb);
    }

    // 1. Release Milestone Triumphal Archway!
    if (district.hasMilestoneArch) {
      const archMat = new THREE.MeshStandardMaterial({
        color: district.prosperity.prosperityTier === 'gilded' ? '#f59e0b' : '#94a3b8',
        roughness: 0.35,
        metalness: 0.5,
      });
      const archGroup = new THREE.Group();
      for (const sx of [-0.75, 0.75]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.55, 0.22), archMat);
        pillar.position.set(sx, 0.775, 0);
        archGroup.add(pillar);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.25, 0.28), archMat);
      lintel.position.set(0, 1.62, 0);
      archGroup.add(lintel);

      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(0.24, 0.42, 4),
        new THREE.MeshStandardMaterial({ color: '#fbbf24', emissive: '#d97706', emissiveIntensity: 0.5 })
      );
      crown.position.set(0, 1.95, 0);
      crown.rotation.y = Math.PI / 4;
      archGroup.add(crown);

      archGroup.position.set(
        district.x,
        district.plinthHeight,
        district.z + district.depth / 2 - 0.7
      );
      dGroup.add(archGroup);
    }

    // 2. High-Prosperity Downtown Fountain
    if (district.hasFountain) {
      const fountainGroup = new THREE.Group();
      const fountainRim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.95, 0.28, 16),
        new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.3, metalness: 0.2 })
      );
      fountainRim.position.y = 0.14;
      const fountainWater = new THREE.Mesh(
        new THREE.CylinderGeometry(0.78, 0.78, 0.26, 16),
        new THREE.MeshStandardMaterial({
          color: '#38bdf8',
          roughness: 0.1,
          metalness: 0.2,
          emissive: '#0284c7',
          emissiveIntensity: 0.3,
        })
      );
      fountainWater.position.y = 0.16;
      fountainGroup.add(fountainRim, fountainWater);
      fountainGroup.position.set(
        district.x + district.width / 2 - 1.4,
        district.plinthHeight,
        district.z + district.depth / 2 - 1.4
      );
      dGroup.add(fountainGroup);
    }

    // 3. Live Web Deployment / GitHub Pages → Glowing Corner Broadcast Lighthouse Spire!
    if (district.hasLiveBeacon) {
      const spirePole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.08, 2.9, 6),
        new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.6, roughness: 0.3 })
      );
      spirePole.position.set(
        district.x + district.width / 2 - 0.85,
        district.plinthHeight + 1.45,
        district.z - district.depth / 2 + 0.85
      );
      dGroup.add(spirePole);

      const beaconOrb = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshStandardMaterial({
          color: '#38bdf8',
          emissive: '#0ea5e9',
          emissiveIntensity: 1.2,
        })
      );
      beaconOrb.position.set(
        district.x + district.width / 2 - 0.85,
        district.plinthHeight + 2.95,
        district.z - district.depth / 2 + 0.85
      );
      dGroup.add(beaconOrb);
    }

    // 2. Wiki Enabled → Miniature Courtyard Reading Pavilion Kiosk!
    if (district.hasLibraryKiosk) {
      const kiosk = new THREE.Group();
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.5, 0.72, 6),
        new THREE.MeshStandardMaterial({ color: '#efe6d5', roughness: 0.7 })
      );
      base.position.y = 0.36;
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(0.62, 0.52, 6),
        new THREE.MeshStandardMaterial({ color: '#4d7c6f', roughness: 0.55 })
      );
      roof.position.y = 0.96;
      kiosk.add(base, roof);
      kiosk.position.set(
        district.x - district.width / 2 + 0.95,
        district.plinthHeight,
        district.z - district.depth / 2 + 0.95
      );
      dGroup.add(kiosk);
    }

    // 3. Forked Repository → Twin-Pillar Guild Annex Entry Archway!
    if (district.isForkAnnex) {
      const archMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.6, metalness: 0.25 });
      const archGroup = new THREE.Group();
      for (const sx of [-0.65, 0.65]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.35, 0.18), archMat);
        col.position.set(sx, 0.675, 0);
        archGroup.add(col);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.22, 0.24), archMat);
      lintel.position.set(0, 1.42, 0);
      archGroup.add(lintel);
      archGroup.position.set(
        district.x - district.width / 2 + 1.8,
        district.plinthHeight,
        district.z + district.depth / 2 - 0.55
      );
      dGroup.add(archGroup);
    }

    // District streetlamps
    for (const lp of district.lamps) {
      const lamp = createStreetLamp(sharedLampGlobeMat);
      lamp.position.set(lp.x, district.plinthHeight, lp.z);
      dGroup.add(lamp);
    }

    // District trees (stored with foundedAt for time-lapse sprouting!)
    const builtTrees: BuiltDistrictGroup['trees'] = [];
    district.trees.forEach((tr, idx) => {
      const tree = createStylizedTree(tr.variant, hashString(`${district.id}:tree:${idx}`));
      tree.position.set(tr.x, district.plinthHeight, tr.z);
      tree.scale.setScalar(tr.scale);
      tree.rotation.y = (idx * 1.7) % (Math.PI * 2);
      dGroup.add(tree);
      builtTrees.push({ mesh: tree, foundedAt: tr.foundedAt, targetScale: tr.scale });
    });

    root.add(dGroup);
    districtGroups.set(district.id, {
      district,
      group: dGroup,
      plinth: plinthMesh,
      highlightFrame,
      trees: builtTrees,
    });
  }

  // 7. Coastal Parkland Perimeter Trees (gives the island rich natural green framing!)
  const perimeterCount = Math.min(54, Math.max(26, Math.round(R * 0.72)));
  for (let i = 0; i < perimeterCount; i++) {
    const a = (i / perimeterCount) * Math.PI * 2 + rng.range(-0.04, 0.04);
    const rad = R * rng.range(0.84, 0.94);
    const tx = Math.cos(a) * rad;
    const tz = Math.sin(a) * rad;
    // Skip canal band
    if (tz > northEdgeZ - 1.2 && tz < southEdgeZ + 1.2) continue;
    const tree = createStylizedTree(rng.pick(['oak', 'pine', 'cypress', 'oak', 'cherry']), blueprint.seed + i * 31);
    tree.position.set(tx, 0.02, tz);
    tree.scale.setScalar(rng.range(0.9, 1.5));
    root.add(tree);
  }

  // 8. Subtle Elevated Transit Links (glowing parabolic arcs connecting related repos)
  const transitGroup = new THREE.Group();
  transitGroup.name = 'transit-links';
  for (const link of blueprint.transitLinks) {
    const start = new THREE.Vector3(link.x1, 0.8, link.z1);
    const end = new THREE.Vector3(link.x2, 0.8, link.z2);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    mid.y = 4.5 + start.distanceTo(end) * 0.08;
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const pts = curve.getPoints(28);
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(link.color),
      transparent: true,
      opacity: 0.24,
    });
    const arc = new THREE.Line(lineGeo, lineMat);
    transitGroup.add(arc);
  }
  root.add(transitGroup);

  // 9. Soft Volumetric-Style Drifting Clouds
  const cloudsGroup = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.95,
    metalness: 0,
    transparent: true,
    opacity: 0.82,
  });
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Group();
    const puffCount = rng.int(3, 5);
    for (let p = 0; p < puffCount; p++) {
      const r = rng.range(2.2, 4.4);
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), cloudMat);
      puff.position.set(
        (p - puffCount / 2) * rng.range(2.0, 2.8),
        rng.range(-0.4, 0.7),
        rng.range(-1.4, 1.4)
      );
      puff.scale.set(1.2, 0.58, 0.95);
      cloud.add(puff);
    }
    const angle = rng.range(0, Math.PI * 2);
    const dist = rng.range(18, R * 1.45);
    cloud.position.set(Math.cos(angle) * dist, rng.range(28, 42), Math.sin(angle) * dist);
    cloud.userData.speed = rng.range(0.35, 0.85);
    cloud.userData.bound = R * 1.75;
    cloudsGroup.add(cloud);
  }
  root.add(cloudsGroup);

  return {
    root,
    waterMesh,
    skyMesh: sky.mesh,
    skyUniforms: sky.uniforms,
    cloudsGroup,
    plazaGroup,
    plazaRings,
    fountainDrops,
    districtGroups,
    lampGlobeMaterials,
    transitGroup,
  };
}
