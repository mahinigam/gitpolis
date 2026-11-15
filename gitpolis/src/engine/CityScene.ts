import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type {
  CameraPreset,
  CityBlueprint,
  HoverInfo,
  SelectionState,
  WeatherMode,
} from '../types/city';
import type { MunicipalDecisionPlan } from '../types/decision';
import { createProceduralBuilding, type BuiltBuilding } from './buildingFactory';
import { buildCityEnvironment, type BuiltEnvironment } from './environmentFactory';
import { CityLifeSystem } from './lifeSystem';
import { createHistoricalMonument, createAITransitCorridor } from './aiMunicipalDecorators';

export interface CitySceneCallbacks {
  onHover: (info: HoverInfo | null) => void;
  onSelect: (selection: SelectionState | null) => void;
}

interface CameraFlight {
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startTarget: THREE.Vector3;
  endTarget: THREE.Vector3;
  elapsed: number;
  duration: number;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(t: number): number {
  const c1 = 1.45;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export class CitySceneEngine {
  private container: HTMLElement;
  private callbacks: CitySceneCallbacks;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;

  private sunLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private fog: THREE.FogExp2;

  private blueprint: CityBlueprint | null = null;
  private cityRoot: THREE.Group | null = null;
  private env: BuiltEnvironment | null = null;
  private life: CityLifeSystem | null = null;
  private buildings: BuiltBuilding[] = [];
  private buildingMap = new Map<string, BuiltBuilding>();
  private windowMaterials: THREE.MeshStandardMaterial[] = [];
  private beaconMaterials: THREE.MeshStandardMaterial[] = [];

  // Google Decision Engine layers
  private decisionPlan: MunicipalDecisionPlan | null = null;
  private aiTransitGroup: THREE.Group = new THREE.Group();
  private aiMonumentsGroup: THREE.Group = new THREE.Group();

  // Interactive & atmosphere state
  private timeOfDay = 14.2;
  private targetTimeOfDay = 14.2;
  private weather: WeatherMode = 'clear';
  private timelineMs = Date.now();
  private entranceProgress = 1;
  private autoOrbit = false;
  private showTransitLinks = true;
  private highlightedLanguage: string | null = null;

  private hoveredDistrictId: string | null = null;
  private hoveredBuildingId: string | null = null;
  private selectedState: SelectionState | null = null;

  private flight: CameraFlight | null = null;
  private keysPressed = new Set<string>();

  // Raycasting & pointer tracking
  private raycaster = new THREE.Raycaster();
  private pointerNDC = new THREE.Vector2(-9, -9);
  private pointerDownPos = { x: 0, y: 0 };
  private isPointerDown = false;
  private lastHoverCheck = 0;

  private clock = new THREE.Clock();
  private animId = 0;
  private disposed = false;

  constructor(container: HTMLElement, callbacks: CitySceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // Scene & Fog
    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2('#d7e6f0', 0.0038);
    this.scene.fog = this.fog;

    // Camera
    const aspect = (container.clientWidth || window.innerWidth) / Math.max(1, container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(44, aspect, 0.5, 650);
    this.camera.position.set(52, 42, 58);

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.055;
    this.controls.minPolarAngle = 0.14;
    this.controls.minDistance = 8.5;
    this.controls.maxDistance = 170;
    this.controls.panSpeed = 0.85;
    this.controls.rotateSpeed = 0.72;
    this.controls.zoomSpeed = 0.95;
    this.controls.target.set(0, 2, 2);

    this.controls.addEventListener('start', () => {
      this.flight = null;
    });

    // Lighting Rig
    this.hemiLight = new THREE.HemisphereLight('#d4ecff', '#6a7c5e', 0.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#fff5de', 2.0);
    this.sunLight.position.set(55, 78, 42);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 230;
    const shadowExtent = 84;
    this.sunLight.shadow.camera.left = -shadowExtent;
    this.sunLight.shadow.camera.right = shadowExtent;
    this.sunLight.shadow.camera.top = shadowExtent;
    this.sunLight.shadow.camera.bottom = -shadowExtent;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);

    this.fillLight = new THREE.DirectionalLight('#93c5fd', 0.45);
    this.fillLight.position.set(-45, 32, -50);
    this.scene.add(this.fillLight);

    // Events
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.addEventListener('pointerleave', this.handlePointerLeave);

    this.clock.start();
    this.animate();
  }

  loadBlueprint(blueprint: CityBlueprint) {
    this.clearCurrentCity();
    this.blueprint = blueprint;

    const root = new THREE.Group();
    root.name = 'city-root';

    // 1. Environment (Island, Canal, Bridges, Plaza, District Plinths, Trees, Lamps, Sky, Clouds)
    const env = buildCityEnvironment(blueprint);
    root.add(env.root);

    // 2. Procedural Commit Buildings placed cleanly on their district plinths
    const buildings: BuiltBuilding[] = [];
    const windowMats: THREE.MeshStandardMaterial[] = [];
    const beaconMats: THREE.MeshStandardMaterial[] = [];
    const bMap = new Map<string, BuiltBuilding>();

    for (const district of blueprint.districts) {
      for (const bBlueprint of district.buildings) {
        const built = createProceduralBuilding(bBlueprint);
        built.group.position.y = district.plinthHeight;
        root.add(built.group);
        buildings.push(built);
        bMap.set(bBlueprint.id, built);
        windowMats.push(...built.windowMaterials);
        beaconMats.push(...built.beaconMaterials);
      }
    }

    // 3. Living Town System (Vehicles, Citizens, Harbor Boats, Birds, Cranes, Rain, Motes)
    const life = new CityLifeSystem(blueprint);
    root.add(life.root);

    // 4. Google Decision Engine dynamic layers
    this.aiTransitGroup = new THREE.Group();
    this.aiTransitGroup.name = 'ai-transit-corridors';
    root.add(this.aiTransitGroup);

    this.aiMonumentsGroup = new THREE.Group();
    this.aiMonumentsGroup.name = 'ai-historical-monuments';
    root.add(this.aiMonumentsGroup);

    this.cityRoot = root;
    this.env = env;
    this.life = life;
    this.buildings = buildings;
    this.buildingMap = bMap;
    this.windowMaterials = Array.from(new Set(windowMats));
    this.beaconMaterials = Array.from(new Set(beaconMats));

    this.scene.add(root);

    // Set atmosphere from live GitHub climate
    this.targetTimeOfDay = blueprint.climate.recommendedTimeOfDay;
    this.timeOfDay = blueprint.climate.recommendedTimeOfDay;
    this.weather = blueprint.climate.recommendedWeather;
    this.timelineMs = blueprint.timeline.endTime;
    this.entranceProgress = 0;
    this.selectedState = null;

    // Dynamically adapt camera distance, sky dome, ocean, and shadow bounds for large multi-ring cities!
    const R = blueprint.islandRadius;
    this.controls.maxDistance = Math.max(185, R * 3.1);
    const shadowExt = Math.max(85, R * 1.18);
    this.sunLight.shadow.camera.left = -shadowExt;
    this.sunLight.shadow.camera.right = shadowExt;
    this.sunLight.shadow.camera.top = shadowExt;
    this.sunLight.shadow.camera.bottom = -shadowExt;
    this.sunLight.shadow.camera.far = Math.max(260, R * 4.2);
    this.sunLight.shadow.camera.updateProjectionMatrix();
    if (this.env) {
      const skyScale = Math.max(1, R / 90);
      this.env.skyMesh.scale.setScalar(skyScale);
      const waterScale = Math.max(1, R / 110);
      this.env.waterMesh.scale.set(waterScale, 1, waterScale);
    }
    this.camera.far = Math.max(680, R * 8);
    this.camera.updateProjectionMatrix();

    // Frame the whole coastal city majestically
    const camDist = Math.max(46, R * 1.15);
    this.flyTo(
      new THREE.Vector3(camDist * 0.85, camDist * 0.64, camDist * 0.92),
      new THREE.Vector3(0, 2.5, 4),
      1.15
    );
  }

  private clearCurrentCity() {
    if (this.cityRoot) {
      this.scene.remove(this.cityRoot);
      this.cityRoot.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) {
          (obj as THREE.Mesh).geometry.dispose();
        }
        const mat = (obj as THREE.Mesh).material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => {
            if (!m.userData?.shared) m.dispose();
          });
        } else if (mat && !mat.userData?.shared) {
          mat.dispose();
        }
      });
    }
    this.cityRoot = null;
    this.env = null;
    this.life = null;
    this.decisionPlan = null;
    this.buildings = [];
    this.buildingMap.clear();
    this.windowMaterials = [];
    this.beaconMaterials = [];
  }

  applyDecisionPlan(plan: MunicipalDecisionPlan) {
    this.decisionPlan = plan;

    // Harmonize atmosphere with AI Decision recommendation
    this.targetTimeOfDay = plan.citySummary.suggestedTimeOfDay;
    this.weather = plan.citySummary.suggestedWeather;

    // Reset current dynamic AI groups
    while (this.aiTransitGroup.children.length > 0) {
      const c = this.aiTransitGroup.children[0];
      this.aiTransitGroup.remove(c);
      if ((c as any).geometry) (c as any).geometry.dispose();
    }
    while (this.aiMonumentsGroup.children.length > 0) {
      const c = this.aiMonumentsGroup.children[0];
      this.aiMonumentsGroup.remove(c);
      if ((c as any).geometry) (c as any).geometry.dispose();
    }

    if (!this.blueprint) return;

    // 1. Build Historical Landmark Monuments around the plaza promenade
    const islandR = this.blueprint.islandRadius;
    plan.historicalChronicles.forEach((chronicle, idx) => {
      const monument = createHistoricalMonument(
        chronicle,
        idx,
        plan.historicalChronicles.length,
        islandR
      );
      this.aiMonumentsGroup.add(monument);
    });

    // 2. Build Glowing Inter-District Transit Corridors
    plan.interDistrictConnections.forEach((conn) => {
      const corridor = createAITransitCorridor(conn, this.blueprint!.districts);
      if (corridor) {
        this.aiTransitGroup.add(corridor);
      }
    });

    // 3. Update District Prosperity & Fulfillment based on AI Civic Critique
    for (const dDecision of plan.districts) {
      const dist = this.blueprint.districts.find(
        (x) =>
          x.id.toLowerCase() === dDecision.repoName.toLowerCase() ||
          x.id.toLowerCase().includes(dDecision.repoName.toLowerCase())
      );
      if (dist) {
        dist.prosperity.prosperityScore = dDecision.civicCritique.prosperityScore;
        dist.prosperity.fulfillmentScore = dDecision.civicCritique.fulfillmentScore;
      }
    }
  }

  setTimeOfDay(hours: number) {
    this.targetTimeOfDay = ((hours % 24) + 24) % 24;
  }

  setWeather(weather: WeatherMode) {
    this.weather = weather;
  }

  setTimelineCursor(timestampMs: number) {
    this.timelineMs = timestampMs;
    this.entranceProgress = 1; // manual scrub overrides entrance rise
  }

  setAutoOrbit(enabled: boolean) {
    this.autoOrbit = enabled;
  }

  setShowTransitLinks(show: boolean) {
    this.showTransitLinks = show;
    this.aiTransitGroup.visible = show;
    if (this.env) {
      this.env.transitGroup.visible = show;
    }
  }

  setHighlightedLanguage(language: string | null) {
    this.highlightedLanguage = language;
  }

  setSelection(selection: SelectionState | null, focusCamera = true) {
    this.selectedState = selection;
    if (!focusCamera || !this.blueprint || !selection) return;

    if (selection.type === 'plaza') {
      this.flyTo(new THREE.Vector3(16, 15, 20), new THREE.Vector3(0, 4.5, 0), 1.0);
      return;
    }

    if (selection.type === 'building' && selection.buildingId) {
      const built = this.buildingMap.get(selection.buildingId);
      if (built) {
        const bp = built.blueprint;
        const dist = Math.max(12, bp.height * 1.45 + 6);
        this.flyTo(
          new THREE.Vector3(bp.worldX + dist * 0.72, Math.max(8, bp.height * 0.9 + 5), bp.worldZ + dist * 0.76),
          new THREE.Vector3(bp.worldX, bp.height * 0.48, bp.worldZ),
          0.95
        );
      }
      return;
    }

    if (selection.type === 'district' && selection.districtId) {
      const d = this.blueprint.districts.find((x) => x.id === selection.districtId);
      if (d) {
        this.flyTo(
          new THREE.Vector3(d.x + 17, 16, d.z + 20),
          new THREE.Vector3(d.x, 3.2, d.z),
          1.0
        );
      }
    }
  }

  applyCameraPreset(preset: CameraPreset) {
    if (!this.blueprint) return;
    const R = this.blueprint.islandRadius;
    if (preset === 'overview') {
      this.autoOrbit = false;
      const d = Math.max(46, R * 1.15);
      this.flyTo(new THREE.Vector3(d * 0.85, d * 0.64, d * 0.92), new THREE.Vector3(0, 2.5, 4), 1.0);
    } else if (preset === 'street') {
      this.autoOrbit = false;
      this.flyTo(new THREE.Vector3(14, 7.5, 29), new THREE.Vector3(0, 4.5, -2), 1.1);
    } else if (preset === 'blueprint') {
      this.autoOrbit = false;
      this.flyTo(new THREE.Vector3(0, Math.max(72, R * 1.75), 14), new THREE.Vector3(0, 0, 4), 1.0);
    } else if (preset === 'orbit') {
      this.autoOrbit = !this.autoOrbit;
    }
  }

  flyTo(endPos: THREE.Vector3, endTarget: THREE.Vector3, duration = 1.0) {
    this.flight = {
      startPos: this.camera.position.clone(),
      endPos: endPos.clone(),
      startTarget: this.controls.target.clone(),
      endTarget: endTarget.clone(),
      elapsed: 0,
      duration,
    };
  }

  captureSnapshotDataUrl(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  private updateAtmosphere(dt: number, elapsed: number): number {
    // Smoothly interpolate timeOfDay across shortest circular arc
    let diff = this.targetTimeOfDay - this.timeOfDay;
    if (diff > 12) diff -= 24;
    if (diff < -12) diff += 24;
    this.timeOfDay = (this.timeOfDay + diff * Math.min(1, dt * 4.5) + 24) % 24;

    // Sun angle: 6:00 sunrise, 12:00 zenith, 18:00 sunset
    const sunAngle = ((this.timeOfDay - 6) / 24) * Math.PI * 2;
    const sunElev = Math.sin(sunAngle); // -1 midnight .. +1 noon
    const sunHoriz = Math.cos(sunAngle);

    const sunDir = new THREE.Vector3(sunHoriz * 0.88, Math.max(-0.3, sunElev), 0.42).normalize();
    const lightDist = 92;
    this.sunLight.position.copy(sunDir).multiplyScalar(lightDist);
    if (sunElev < 0.05) {
      // Moon directional rim light at night so silhouettes stay crisp and sculptural!
      this.sunLight.position.set(-45, 58, -32);
    }

    // Compute smooth regime factors
    const dayFactor = THREE.MathUtils.smoothstep(sunElev, -0.08, 0.32);
    const goldenFactor = Math.exp(-Math.pow((sunElev - 0.1) / 0.22, 2));
    const nightFactor = 1 - THREE.MathUtils.smoothstep(sunElev, -0.18, 0.14);

    // Sky & Fog Palette
    const zenithDay = new THREE.Color('#3b86c8');
    const zenithGolden = new THREE.Color('#35527d');
    const zenithNight = new THREE.Color('#0b1326');

    const horizonDay = new THREE.Color('#dcebf7');
    const horizonGolden = new THREE.Color('#f7b278');
    const horizonNight = new THREE.Color('#1a2844');

    const zenith = zenithNight.clone().lerp(zenithDay, dayFactor).lerp(zenithGolden, goldenFactor * 0.72);
    const horizon = horizonNight.clone().lerp(horizonDay, dayFactor).lerp(horizonGolden, goldenFactor * 0.85);

    // Weather adjustments (Rain / Mist)
    if (this.weather === 'rain') {
      zenith.lerp(new THREE.Color('#475569'), 0.62);
      horizon.lerp(new THREE.Color('#7b8a9b'), 0.65);
    } else if (this.weather === 'mist') {
      horizon.lerp(new THREE.Color('#e8dec8'), 0.45 * dayFactor + 0.25);
    }

    // Update sky dome shader uniforms
    if (this.env) {
      this.env.skyUniforms.uZenithColor.value.copy(zenith);
      this.env.skyUniforms.uHorizonColor.value.copy(horizon);
      this.env.skyUniforms.uSunColor.value
        .set('#fff6d6')
        .lerp(new THREE.Color('#ff8e47'), goldenFactor * 0.85);
      this.env.skyUniforms.uSunDir.value.copy(sunDir);
      this.env.skyUniforms.uStarAlpha.value = this.weather === 'rain' ? 0 : nightFactor * 0.95;
      this.env.skyUniforms.uTime.value = elapsed;

      // Water reacts to sky & weather
      const waterMat = this.env.waterMesh.material as THREE.MeshStandardMaterial;
      const waterDay = this.weather === 'rain' ? new THREE.Color('#3b5d6e') : new THREE.Color('#3c90ad');
      const waterGolden = new THREE.Color('#4d778c');
      const waterNight = new THREE.Color('#112238');
      waterMat.color
        .copy(waterNight)
        .lerp(waterDay, dayFactor)
        .lerp(waterGolden, goldenFactor * 0.45);
      waterMat.roughness = this.weather === 'rain' ? 0.34 : 0.2;

      // Streetlamp globes glow warmly at dusk/night
      const lampIntensity = 0.14 + nightFactor * 2.2 + (this.weather === 'rain' ? 0.55 : 0);
      for (const m of this.env.lampGlobeMaterials) {
        m.emissiveIntensity = lampIntensity;
      }

      // Clouds tint with sunset/night
      const cloudColor = new THREE.Color('#ffffff')
        .lerp(new THREE.Color('#ffd3a8'), goldenFactor * 0.65)
        .lerp(new THREE.Color('#2d3a54'), nightFactor * 0.82);
      if (this.weather === 'rain') {
        cloudColor.lerp(new THREE.Color('#64748b'), 0.65);
      }
      this.env.cloudsGroup.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.material && (mesh.material as THREE.MeshStandardMaterial).color) {
          (mesh.material as THREE.MeshStandardMaterial).color.copy(cloudColor);
        }
      });
    }

    // Fog matches horizon seamlessly
    this.fog.color.copy(horizon);
    this.fog.density =
      this.weather === 'mist' ? 0.0072 : this.weather === 'rain' ? 0.0062 : 0.0031 + nightFactor * 0.0014;

    // Directional Sun / Moon Light
    const sunColor = new THREE.Color('#fff5e0')
      .lerp(new THREE.Color('#ff9d54'), goldenFactor * 0.78)
      .lerp(new THREE.Color('#7ca2e0'), nightFactor);
    this.sunLight.color.copy(sunColor);

    const weatherDim = this.weather === 'rain' ? 0.52 : this.weather === 'mist' ? 0.78 : 1.0;
    this.sunLight.intensity = (0.48 + dayFactor * 1.75) * weatherDim;

    // Hemisphere ambient fill
    this.hemiLight.color.copy(horizon).lerp(new THREE.Color('#ffffff'), 0.28);
    this.hemiLight.groundColor
      .set('#5a6b54')
      .lerp(new THREE.Color('#1d2738'), nightFactor * 0.8);
    this.hemiLight.intensity = 0.42 + dayFactor * 0.55;
    this.fillLight.intensity = 0.22 + (1 - nightFactor) * 0.3;

    // Building Windows & Beacons smoothly wake up at dusk/night or during cozy rain!
    const windowGlow = Math.max(
      0.06,
      nightFactor * 1.18 + goldenFactor * 0.38 + (this.weather === 'rain' ? 0.35 : 0)
    );
    for (const mat of this.windowMaterials) {
      mat.emissiveIntensity = windowGlow;
    }
    const beaconGlow = 0.5 + nightFactor * 1.5;
    for (const mat of this.beaconMaterials) {
      mat.emissiveIntensity = beaconGlow;
    }

    return nightFactor;
  }

  private updateTimelineGrowth(dt: number) {
    if (!this.blueprint || !this.env) return;

    // Smooth initial choreographed build-up animation when a new city loads
    if (this.entranceProgress < 1) {
      this.entranceProgress = Math.min(1, this.entranceProgress + dt * 0.85);
    }

    const span = Math.max(1, this.blueprint.timeline.endTime - this.blueprint.timeline.startTime);
    const riseWindow = Math.max(86400000 * 24, span * 0.045);

    // Central Plaza emerges first
    const plazaP = Math.min(
      1,
      Math.max(0, (this.timelineMs - this.blueprint.plaza.foundedAt + riseWindow * 0.8) / riseWindow)
    );
    const plazaScale = Math.max(0.001, easeOutCubic(plazaP * this.entranceProgress));
    this.env.plazaGroup.scale.set(1, plazaScale, 1);

    // Districts plinths & trees
    for (const [id, dGroup] of this.env.districtGroups) {
      const d = dGroup.district;
      const distP = Math.min(1, Math.max(0, (this.timelineMs - d.foundedAt + riseWindow * 0.35) / (riseWindow * 0.65)));
      const effectiveP = distP * Math.min(1, this.entranceProgress * 1.25);

      dGroup.group.visible = effectiveP > 0.01;
      if (dGroup.group.visible) {
        const s = Math.max(0.01, easeOutCubic(effectiveP));
        dGroup.plinth.scale.set(1, s, 1);
      }

      // Highlight ring opacity (hover, selected, or language filter!)
      const isSelected = this.selectedState?.districtId === id;
      const isHovered = this.hoveredDistrictId === id;
      const isLangMatch =
        this.highlightedLanguage !== null &&
        d.languageShares.some((l) => l.language.toLowerCase() === this.highlightedLanguage!.toLowerCase());
      const frameMat = dGroup.highlightFrame.material as THREE.MeshBasicMaterial;
      const targetOpacity = isSelected ? 0.85 : isHovered ? 0.58 : isLangMatch ? 0.5 : 0.0;
      frameMat.opacity += (targetOpacity - frameMat.opacity) * Math.min(1, dt * 10);

      // Sprouting trees
      for (const tr of dGroup.trees) {
        const tp = Math.min(1, Math.max(0, (this.timelineMs - tr.foundedAt) / (riseWindow * 0.7)));
        const ts = tr.targetScale * Math.max(0.001, easeOutBack(tp) * this.entranceProgress);
        tr.mesh.visible = tp > 0.01;
        tr.mesh.scale.setScalar(Math.max(0.001, ts));
      }
    }

    // Individual commit buildings rising out of the ground!
    for (const built of this.buildings) {
      const bp = built.blueprint;
      const bSpan = Math.max(riseWindow * 0.75, bp.completedAt - bp.foundedAt);
      const rawP = Math.min(1, Math.max(0, (this.timelineMs - bp.foundedAt) / bSpan));

      // Stagger entrance slightly by distance from center for a gorgeous ripple rise
      const distNorm = Math.min(1, Math.hypot(bp.worldX, bp.worldZ) / Math.max(1, this.blueprint.islandRadius));
      const entP = Math.min(1, Math.max(0, (this.entranceProgress - distNorm * 0.25) / 0.75));
      const p = rawP * entP;

      built.group.visible = p > 0.01;
      if (!built.group.visible) continue;

      const isSelected = this.selectedState?.buildingId === bp.id;
      const isHovered = this.hoveredBuildingId === bp.id;
      const hoverBoost = isSelected ? 1.04 : isHovered ? 1.025 : 1.0;

      const sy = Math.max(0.01, easeOutBack(p)) * hoverBoost;
      const sxz = (0.72 + 0.28 * easeOutCubic(p)) * (isSelected || isHovered ? 1.03 : 1.0);
      built.group.scale.set(sxz, sy, sxz);
    }
  }

  private updateCameraAndKeyboard(dt: number) {
    // Active fly-to transition
    if (this.flight) {
      this.flight.elapsed += dt;
      const t = Math.min(1, this.flight.elapsed / this.flight.duration);
      const e = easeOutCubic(t);
      this.camera.position.lerpVectors(this.flight.startPos, this.flight.endPos, e);
      this.controls.target.lerpVectors(this.flight.startTarget, this.flight.endTarget, e);
      if (t >= 1) this.flight = null;
    }

    // Optional cinematic auto-orbit
    if (this.autoOrbit && !this.flight && !this.isPointerDown) {
      const offset = this.camera.position.clone().sub(this.controls.target);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.14);
      this.camera.position.copy(this.controls.target).add(offset);
    }

    // WASD / Arrow Free-Fly across the city
    if (this.keysPressed.size > 0) {
      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      const move = new THREE.Vector3();
      const speed = Math.max(14, this.camera.position.y * 0.75) * dt;

      if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) move.add(forward);
      if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) move.sub(forward);
      if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) move.add(right);
      if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) move.sub(right);

      if (move.lengthSq() > 0.0001) {
        this.flight = null;
        move.normalize().multiplyScalar(speed);
        this.camera.position.add(move);
        this.controls.target.add(move);
      }
    }

    this.controls.update();
  }

  private performRaycast(clientX: number, clientY: number): {
    type: 'building' | 'district' | 'plaza' | 'monument' | 'transit_corridor';
    districtId?: string;
    buildingId?: string;
    monumentData?: any;
    transitData?: any;
  } | null {
    if (!this.cityRoot || !this.blueprint) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObjects(this.cityRoot.children, true);

    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj) {
        if (obj.userData?.type === 'monument') {
          return {
            type: 'monument',
            monumentData: obj.userData,
          };
        }
        if (obj.userData?.type === 'transit_corridor') {
          return {
            type: 'transit_corridor',
            transitData: obj.userData,
          };
        }
        if (obj.userData?.buildingId) {
          return {
            type: 'building',
            buildingId: obj.userData.buildingId as string,
            districtId: obj.userData.districtId as string,
          };
        }
        if (obj.userData?.districtId) {
          return {
            type: 'district',
            districtId: obj.userData.districtId as string,
          };
        }
        if (obj.userData?.isPlaza) {
          return { type: 'plaza' };
        }
        obj = obj.parent;
      }
    }
    return null;
  }

  private handlePointerMove = (e: PointerEvent) => {
    if (this.isPointerDown) return;
    const now = performance.now();
    if (now - this.lastHoverCheck < 28) return;
    this.lastHoverCheck = now;

    if (!this.blueprint) return;
    const hit = this.performRaycast(e.clientX, e.clientY);

    if (!hit) {
      if (this.hoveredDistrictId || this.hoveredBuildingId) {
        this.hoveredDistrictId = null;
        this.hoveredBuildingId = null;
        this.renderer.domElement.style.cursor = 'grab';
        this.callbacks.onHover(null);
      }
      return;
    }

    this.renderer.domElement.style.cursor = 'pointer';

    if (hit.type === 'monument' && hit.monumentData) {
      this.callbacks.onHover({
        type: 'plaza',
        screenX: e.clientX,
        screenY: e.clientY,
        title: hit.monumentData.title,
        subtitle: `${hit.monumentData.epoch} • ${hit.monumentData.era}`,
        accentColor: '#f59e0b',
        badges: ['AI Monument', 'Historical Era'],
      });
      return;
    }

    if (hit.type === 'transit_corridor' && hit.transitData) {
      this.callbacks.onHover({
        type: 'plaza',
        screenX: e.clientX,
        screenY: e.clientY,
        title: `${hit.transitData.source} ⇄ ${hit.transitData.target}`,
        subtitle: hit.transitData.reason,
        accentColor: '#38bdf8',
        badges: [hit.transitData.connectionType.replace('_', ' ').toUpperCase(), 'AI Corridor'],
      });
      return;
    }

    if (hit.type === 'building' && hit.buildingId) {
      this.hoveredBuildingId = hit.buildingId;
      this.hoveredDistrictId = hit.districtId ?? null;
      const built = this.buildingMap.get(hit.buildingId);
      const district = this.blueprint.districts.find((d) => d.id === hit.districtId);
      if (built && district) {
        this.callbacks.onHover({
          type: 'building',
          screenX: e.clientX,
          screenY: e.clientY,
          districtId: district.id,
          buildingId: built.blueprint.id,
          title: built.blueprint.name,
          subtitle: `${district.id} • ${built.blueprint.language}`,
          accentColor: district.accentColor,
          badges: [
            `${built.blueprint.floors} floors`,
            `${built.blueprint.commits.length} commits`,
            built.blueprint.dominantCommitType.toUpperCase(),
          ],
        });
      }
      return;
    }

    if (hit.type === 'district' && hit.districtId) {
      this.hoveredBuildingId = null;
      this.hoveredDistrictId = hit.districtId;
      const district = this.blueprint.districts.find((d) => d.id === hit.districtId);
      if (district) {
        this.callbacks.onHover({
          type: 'district',
          screenX: e.clientX,
          screenY: e.clientY,
          districtId: district.id,
          title: district.id,
          subtitle: `${district.styleName} (${district.primaryLanguage})`,
          accentColor: district.accentColor,
          badges: [
            district.estimatedLOC >= 1000
              ? `~${(district.estimatedLOC / 1000).toFixed(1)}k LOC`
              : `~${district.estimatedLOC} LOC`,
            `★ ${district.repo.stargazersCount.toLocaleString()}`,
            `${district.buildings.length} structures`,
            district.vitality,
          ],
        });
      }
      return;
    }

    if (hit.type === 'plaza') {
      this.hoveredBuildingId = null;
      this.hoveredDistrictId = null;
      this.callbacks.onHover({
        type: 'plaza',
        screenX: e.clientX,
        screenY: e.clientY,
        title: `${this.blueprint.cityName} Civic Plaza`,
        subtitle: `@${this.blueprint.profile.login} • Founder's Monument`,
        accentColor: '#d97706',
        badges: [
          `${this.blueprint.profile.followers.toLocaleString()} followers`,
          `${this.blueprint.stats.accountAgeYears} yrs on GitHub`,
        ],
      });
    }
  };

  private handlePointerDown = (e: PointerEvent) => {
    this.isPointerDown = true;
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
    this.renderer.domElement.style.cursor = 'grabbing';
  };

  private handlePointerUp = (e: PointerEvent) => {
    this.isPointerDown = false;
    this.renderer.domElement.style.cursor = 'grab';
    const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    if (dist > 6) return; // was a drag/orbit

    const hit = this.performRaycast(e.clientX, e.clientY);
    if (!hit) {
      this.selectedState = null;
      this.callbacks.onSelect(null);
      return;
    }

    if (hit.type === 'monument' || hit.type === 'transit_corridor') {
      const sel: SelectionState = { type: 'plaza' };
      this.setSelection(sel, true);
      this.callbacks.onSelect(sel);
      return;
    }

    const sel: SelectionState = {
      type: hit.type,
      districtId: hit.districtId,
      buildingId: hit.buildingId,
    };
    this.setSelection(sel, true);
    this.callbacks.onSelect(sel);
  };

  private handlePointerLeave = () => {
    this.isPointerDown = false;
    this.hoveredBuildingId = null;
    this.hoveredDistrictId = null;
    this.callbacks.onHover(null);
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      this.keysPressed.add(e.code);
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keysPressed.delete(e.code);
  };

  private handleResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private animate = () => {
    if (this.disposed) return;
    this.animId = requestAnimationFrame(this.animate);

    const dt = Math.min(0.05, this.clock.getDelta());
    const elapsed = this.clock.elapsedTime;

    const nightFactor = this.updateAtmosphere(dt, elapsed);
    this.updateTimelineGrowth(dt);
    this.updateCameraAndKeyboard(dt);

    if (this.life && this.env) {
      this.life.update(
        dt,
        elapsed,
        nightFactor,
        this.weather,
        this.timelineMs,
        this.buildings,
        this.env
      );
      this.env.transitGroup.visible = this.showTransitLinks;
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.removeEventListener('pointerleave', this.handlePointerLeave);
    this.clearCurrentCity();
    this.controls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
