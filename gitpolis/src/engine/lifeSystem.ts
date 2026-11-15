import * as THREE from 'three';
import type { CityBlueprint, WeatherMode } from '../types/city';
import type { BuiltBuilding } from './buildingFactory';
import type { BuiltEnvironment } from './environmentFactory';
import { SeededRNG } from './prng';

interface VehicleAgent {
  group: THREE.Group;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  t: number;
  speed: number;
  dir: 1 | -1;
  laneOffset: number;
  isBridge: boolean;
}

interface CitizenAgent {
  mesh: THREE.Group;
  centerX: number;
  centerZ: number;
  halfW: number;
  halfD: number;
  perimeterPos: number;
  speed: number;
  bobPhase: number;
  baseY: number;
  foundedAt: number;
  isPlaza: boolean;
}

interface BoatAgent {
  group: THREE.Group;
  mode: 'canal' | 'harbor';
  param: number;
  speed: number;
  radius: number;
  canalZ: number;
  canalLimit: number;
  dir: 1 | -1;
}

interface BirdAgent {
  group: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  angle: number;
  speed: number;
  radius: number;
  baseY: number;
  flapPhase: number;
}

export class CityLifeSystem {
  readonly root = new THREE.Group();
  private vehicles: VehicleAgent[] = [];
  private citizens: CitizenAgent[] = [];
  private boats: BoatAgent[] = [];
  private birds: BirdAgent[] = [];
  private headlightMat: THREE.MeshStandardMaterial;
  private taillightMat: THREE.MeshStandardMaterial;

  // Rain particle system
  private rainPoints: THREE.Points;
  private rainPositions: Float32Array;
  private rainCount = 1100;
  private rainBounds: number;

  // Firefly / ambient dusk motes
  private motesPoints: THREE.Points;
  private motesPositions: Float32Array;
  private motesBaseY: Float32Array;
  private motesCount = 140;

  constructor(blueprint: CityBlueprint) {
    this.root.name = 'living-town-system';
    const rng = new SeededRNG(blueprint.seed + 777);
    this.rainBounds = blueprint.islandRadius * 1.35;

    this.headlightMat = new THREE.MeshStandardMaterial({
      color: '#fff9e0',
      emissive: '#fff4c2',
      emissiveIntensity: 0.2,
    });
    this.taillightMat = new THREE.MeshStandardMaterial({
      color: '#ef4444',
      emissive: '#ef4444',
      emissiveIntensity: 0.25,
    });

    this.initVehicles(blueprint, rng);
    this.initCitizens(blueprint, rng);
    this.initBoats(blueprint, rng);
    this.initBirds(blueprint, rng);

    const rain = this.createRainSystem(rng);
    this.rainPoints = rain.points;
    this.rainPositions = rain.positions;
    this.root.add(this.rainPoints);

    const motes = this.createMotesSystem(blueprint, rng);
    this.motesPoints = motes.points;
    this.motesPositions = motes.positions;
    this.motesBaseY = motes.baseY;
    this.root.add(this.motesPoints);
  }

  private initVehicles(blueprint: CityBlueprint, rng: SeededRNG) {
    const carPalette = ['#e05a47', '#3b82f6', '#f59e0b', '#f8fafc', '#10b981', '#64748b', '#e7c68b', '#d946ef'];
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8 });
    const glassMat = new THREE.MeshStandardMaterial({ color: '#8ab4cc', roughness: 0.2, metalness: 0.4 });

    const driveableRoads = blueprint.roads.filter((r) => Math.hypot(r.x2 - r.x1, r.z2 - r.z1) >= 12);
    const maxVehicles = Math.min(34, Math.max(12, driveableRoads.length * 2));

    for (let i = 0; i < maxVehicles; i++) {
      const road = driveableRoads[i % driveableRoads.length];
      if (!road) break;

      const isBus = rng.chance(0.18);
      const car = new THREE.Group();
      const bodyColor = isBus ? '#f59e0b' : rng.pick(carPalette);
      const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.35, metalness: 0.25 });

      const len = isBus ? 1.55 : 0.92;
      const wid = isBus ? 0.54 : 0.46;
      const hgt = isBus ? 0.48 : 0.26;

      const chassis = new THREE.Mesh(new THREE.BoxGeometry(wid, hgt, len), bodyMat);
      chassis.position.y = 0.16 + hgt / 2;
      chassis.castShadow = true;
      car.add(chassis);

      if (!isBus) {
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.84, 0.2, len * 0.52), glassMat);
        cabin.position.set(0, 0.16 + hgt + 0.08, -0.04);
        car.add(cabin);
      } else {
        const windowBand = new THREE.Mesh(new THREE.BoxGeometry(wid + 0.02, 0.16, len * 0.82), glassMat);
        windowBand.position.set(0, 0.46, 0);
        car.add(windowBand);
      }

      // Tiny wheels
      for (const sx of [-wid * 0.48, wid * 0.48]) {
        for (const sz of [-len * 0.3, len * 0.3]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 6), wheelMat);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(sx, 0.1, sz);
          car.add(wheel);
        }
      }

      // Headlights & Taillights
      const hl = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.72, 0.08, 0.05), this.headlightMat);
      hl.position.set(0, 0.24, len / 2 + 0.01);
      car.add(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.72, 0.08, 0.05), this.taillightMat);
      tl.position.set(0, 0.24, -len / 2 - 0.01);
      car.add(tl);

      this.root.add(car);

      const segLen = Math.hypot(road.x2 - road.x1, road.z2 - road.z1);
      const dir: 1 | -1 = rng.chance(0.5) ? 1 : -1;
      this.vehicles.push({
        group: car,
        x1: road.x1,
        z1: road.z1,
        x2: road.x2,
        z2: road.z2,
        t: rng.next(),
        speed: rng.range(3.2, 5.4) / segLen,
        dir,
        laneOffset: 0.72,
        isBridge: Boolean(road.isBridge),
      });
    }
  }

  private initCitizens(blueprint: CityBlueprint, rng: SeededRNG) {
    const coatColors = ['#ef4444', '#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#0f766e', '#f8fafc', '#334155'];
    const headMat = new THREE.MeshStandardMaterial({ color: '#f3d1b0', roughness: 0.7 });

    const makePerson = () => {
      const p = new THREE.Group();
      const coatMat = new THREE.MeshStandardMaterial({ color: rng.pick(coatColors), roughness: 0.75 });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.18, 4, 6), coatMat);
      body.position.y = 0.22;
      body.castShadow = true;
      p.add(body);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), headMat);
      head.position.y = 0.44;
      p.add(head);
      return p;
    };

    // Plaza strolling citizens
    for (let i = 0; i < 14; i++) {
      const p = makePerson();
      this.root.add(p);
      this.citizens.push({
        mesh: p,
        centerX: 0,
        centerZ: 0,
        halfW: rng.range(4.4, 7.2),
        halfD: rng.range(4.4, 7.2),
        perimeterPos: rng.range(0, Math.PI * 2),
        speed: rng.range(0.14, 0.28) * (rng.chance(0.5) ? 1 : -1),
        bobPhase: rng.range(0, Math.PI * 2),
        baseY: 0.46,
        foundedAt: blueprint.plaza.foundedAt,
        isPlaza: true,
      });
    }

    // District sidewalk commuters scaled by district vitality & star popularity!
    for (const d of blueprint.districts) {
      const count = Math.max(2, Math.min(7, Math.round(d.pedestrianDensity * 4.5)));
      for (let i = 0; i < count; i++) {
        const p = makePerson();
        this.root.add(p);
        this.citizens.push({
          mesh: p,
          centerX: d.x,
          centerZ: d.z,
          halfW: d.width / 2 - 0.55,
          halfD: d.depth / 2 - 0.55,
          perimeterPos: rng.range(0, 4),
          speed: rng.range(0.06, 0.13) * (rng.chance(0.5) ? 1 : -1),
          bobPhase: rng.range(0, Math.PI * 2),
          baseY: d.plinthHeight + 0.02,
          foundedAt: d.foundedAt,
          isPlaza: false,
        });
      }
    }
  }

  private initBoats(blueprint: CityBlueprint, rng: SeededRNG) {
    const hullColors = ['#b45309', '#f8fafc', '#1d4ed8', '#be123c', '#0f766e'];
    const sailMat = new THREE.MeshStandardMaterial({ color: '#fdfbf7', roughness: 0.65, side: THREE.DoubleSide });
    const mastMat = new THREE.MeshStandardMaterial({ color: '#785a3a', roughness: 0.8 });

    const makeBoat = (isSailboat: boolean) => {
      const g = new THREE.Group();
      const hullMat = new THREE.MeshStandardMaterial({ color: rng.pick(hullColors), roughness: 0.5 });
      const hull = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.28, 1.85), hullMat);
      hull.position.y = 0.08;
      hull.castShadow = true;
      g.add(hull);

      const bow = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.72, 4), hullMat);
      bow.rotation.x = Math.PI / 2;
      bow.rotation.y = Math.PI / 4;
      bow.scale.set(0.82, 1, 0.5);
      bow.position.set(0, 0.08, 1.24);
      g.add(bow);

      if (isSailboat) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.8, 6), mastMat);
        mast.position.set(0, 1.0, 0.1);
        g.add(mast);

        const sailShape = new THREE.Shape();
        sailShape.moveTo(0, 0);
        sailShape.lineTo(0, 1.45);
        sailShape.lineTo(0.95, 0.15);
        sailShape.closePath();
        const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), sailMat);
        sail.rotation.y = Math.PI / 2;
        sail.position.set(0.02, 0.38, 0.1);
        sail.castShadow = true;
        g.add(sail);
      } else {
        // Canal water taxi cabin
        const cabin = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.34, 0.85),
          new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.4 })
        );
        cabin.position.set(0, 0.34, -0.15);
        g.add(cabin);
      }
      return g;
    };

    const canalSpan = blueprint.islandRadius * 0.92;
    // 3 canal ferry boats gliding smoothly along the central canal
    for (let i = 0; i < 3; i++) {
      const boat = makeBoat(false);
      this.root.add(boat);
      this.boats.push({
        group: boat,
        mode: 'canal',
        param: rng.range(-canalSpan, canalSpan),
        speed: rng.range(1.6, 2.5),
        radius: 0,
        canalZ: blueprint.canalZ + (i === 1 ? 1.15 : -1.15),
        canalLimit: canalSpan,
        dir: i % 2 === 0 ? 1 : -1,
      });
    }

    // 5 harbor sailboats circling gently around the coastal island
    for (let i = 0; i < 5; i++) {
      const boat = makeBoat(true);
      this.root.add(boat);
      this.boats.push({
        group: boat,
        mode: 'harbor',
        param: (i / 5) * Math.PI * 2,
        speed: rng.range(0.035, 0.065) * (i % 2 === 0 ? 1 : -1),
        radius: blueprint.islandRadius + rng.range(7, 17),
        canalZ: blueprint.canalZ,
        canalLimit: canalSpan,
        dir: 1,
      });
    }
  }

  private initBirds(blueprint: CityBlueprint, rng: SeededRNG) {
    const wingGeo = new THREE.BoxGeometry(0.48, 0.03, 0.16);
    const birdMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });

    for (let i = 0; i < 12; i++) {
      const g = new THREE.Group();
      const leftWing = new THREE.Mesh(wingGeo, birdMat);
      leftWing.position.x = -0.22;
      const rightWing = new THREE.Mesh(wingGeo, birdMat);
      rightWing.position.x = 0.22;
      g.add(leftWing, rightWing);
      this.root.add(g);

      this.birds.push({
        group: g,
        leftWing,
        rightWing,
        angle: rng.range(0, Math.PI * 2),
        speed: rng.range(0.18, 0.34),
        radius: rng.range(14, blueprint.islandRadius * 0.85),
        baseY: rng.range(19, 29),
        flapPhase: rng.range(0, Math.PI * 2),
      });
    }
  }

  private createRainSystem(rng: SeededRNG) {
    const positions = new Float32Array(this.rainCount * 3);
    const b = this.rainBounds;
    for (let i = 0; i < this.rainCount; i++) {
      positions[i * 3] = rng.range(-b, b);
      positions[i * 3 + 1] = rng.range(1, 46);
      positions[i * 3 + 2] = rng.range(-b, b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: '#cbd5e1',
      size: 0.36,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    points.visible = false;
    return { points, positions };
  }

  private createMotesSystem(blueprint: CityBlueprint, rng: SeededRNG) {
    const positions = new Float32Array(this.motesCount * 3);
    const baseY = new Float32Array(this.motesCount);
    const r = blueprint.islandRadius * 0.85;
    for (let i = 0; i < this.motesCount; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = Math.sqrt(rng.next()) * r;
      positions[i * 3] = Math.cos(a) * d;
      const y = rng.range(1.2, 10.5);
      positions[i * 3 + 1] = y;
      baseY[i] = y;
      positions[i * 3 + 2] = Math.sin(a) * d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: '#fde68a',
      size: 0.42,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    return { points, positions, baseY };
  }

  update(
    dt: number,
    elapsed: number,
    nightFactor: number,
    weather: WeatherMode,
    timelineMs: number,
    buildings: BuiltBuilding[],
    env: BuiltEnvironment
  ) {
    // Update vehicle lights intensity based on dusk/night
    this.headlightMat.emissiveIntensity = 0.2 + nightFactor * 2.2;
    this.taillightMat.emissiveIntensity = 0.25 + nightFactor * 1.8;

    // 1. Vehicles gliding along avenues & bridges
    for (const v of this.vehicles) {
      v.t += dt * v.speed * v.dir;
      if (v.t > 1) {
        v.t = 1;
        v.dir = -1;
      } else if (v.t < 0) {
        v.t = 0;
        v.dir = 1;
      }

      const dx = v.x2 - v.x1;
      const dz = v.z2 - v.z1;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;
      const side = v.dir === 1 ? v.laneOffset : -v.laneOffset;

      const x = v.x1 + dx * v.t + nx * side;
      const z = v.z1 + dz * v.t + nz * side;
      const y = v.isBridge ? 0.42 : 0.05;

      v.group.position.set(x, y, z);
      v.group.rotation.y = Math.atan2(dx * v.dir, dz * v.dir);
    }

    // 2. Tiny Commuters strolling around plazas & district blocks
    for (const c of this.citizens) {
      const active = timelineMs >= c.foundedAt;
      c.mesh.visible = active;
      if (!active) continue;

      if (c.isPlaza) {
        c.perimeterPos += dt * c.speed;
        const x = Math.cos(c.perimeterPos) * c.halfW;
        const z = Math.sin(c.perimeterPos) * c.halfD;
        const bob = Math.abs(Math.sin(elapsed * 7 + c.bobPhase)) * 0.05;
        c.mesh.position.set(x, c.baseY + bob, z);
        c.mesh.rotation.y = -c.perimeterPos + (c.speed > 0 ? 0 : Math.PI);
      } else {
        c.perimeterPos = (c.perimeterPos + dt * c.speed + 4) % 4;
        const side = Math.floor(c.perimeterPos);
        const f = c.perimeterPos - side;
        let lx = 0;
        let lz = 0;
        let rot = 0;
        if (side === 0) {
          lx = -c.halfW + f * c.halfW * 2;
          lz = c.halfD;
          rot = Math.PI / 2;
        } else if (side === 1) {
          lx = c.halfW;
          lz = c.halfD - f * c.halfD * 2;
          rot = Math.PI;
        } else if (side === 2) {
          lx = c.halfW - f * c.halfW * 2;
          lz = -c.halfD;
          rot = -Math.PI / 2;
        } else {
          lx = -c.halfW;
          lz = -c.halfD + f * c.halfD * 2;
          rot = 0;
        }
        const bob = Math.abs(Math.sin(elapsed * 7.5 + c.bobPhase)) * 0.045;
        c.mesh.position.set(c.centerX + lx, c.baseY + bob, c.centerZ + lz);
        c.mesh.rotation.y = c.speed > 0 ? rot : rot + Math.PI;
      }
    }

    // 3. Canal ferries & harbor sailboats
    for (const b of this.boats) {
      const waveBob = Math.sin(elapsed * 1.9 + b.param) * 0.05;
      const roll = Math.sin(elapsed * 1.4 + b.param * 2) * 0.04;
      if (b.mode === 'canal') {
        b.param += dt * b.speed * b.dir;
        if (b.param > b.canalLimit) {
          b.param = b.canalLimit;
          b.dir = -1;
        } else if (b.param < -b.canalLimit) {
          b.param = -b.canalLimit;
          b.dir = 1;
        }
        b.group.position.set(b.param, -0.78 + waveBob, b.canalZ);
        b.group.rotation.set(0, b.dir === 1 ? Math.PI / 2 : -Math.PI / 2, roll);
      } else {
        b.param += dt * b.speed;
        const x = Math.cos(b.param) * b.radius;
        const z = Math.sin(b.param) * b.radius;
        b.group.position.set(x, -0.78 + waveBob, z);
        b.group.rotation.set(0, -b.param + (b.speed > 0 ? 0 : Math.PI), roll);
      }
    }

    // 4. Soaring seabirds (quietly roost during heavy rain/night)
    const birdsVisible = weather !== 'rain' && nightFactor < 0.72;
    for (const bird of this.birds) {
      bird.group.visible = birdsVisible;
      if (!birdsVisible) continue;
      bird.angle += dt * bird.speed;
      const x = Math.cos(bird.angle) * bird.radius;
      const z = Math.sin(bird.angle) * bird.radius;
      const y = bird.baseY + Math.sin(elapsed * 1.2 + bird.flapPhase) * 1.2;
      bird.group.position.set(x, y, z);
      bird.group.rotation.y = -bird.angle;
      const flap = Math.sin(elapsed * 6.5 + bird.flapPhase) * 0.48;
      bird.leftWing.rotation.z = flap;
      bird.rightWing.rotation.z = -flap;
    }

    // 5. Swiveling Construction Cranes, Radar Dishes & Commit Pulse Beacons
    for (const b of buildings) {
      if (b.craneJib) {
        b.craneJib.rotation.y = Math.sin(elapsed * 0.32 + b.blueprint.seed) * 1.1;
      }
      if (b.radarDish) {
        b.radarDish.rotation.y += dt * 1.15;
      }
      if (b.pulseRing) {
        const cycle = (elapsed * 0.55) % 1;
        b.pulseRing.position.y = 0.25 + cycle * (b.blueprint.height + 1.8);
        const s = 0.92 + cycle * 0.32;
        b.pulseRing.scale.set(s, s, 1);
        const mat = b.pulseRing.material as THREE.MeshBasicMaterial;
        mat.opacity = (1 - cycle) * 0.68;
      }
    }

    // 6. Plaza orbiting star rings, fountain water jets & drifting clouds
    env.plazaRings.forEach((ring, idx) => {
      ring.rotation.z += dt * (0.28 + idx * 0.08) * (idx % 2 === 0 ? 1 : -1);
      ring.rotation.y += dt * 0.16;
    });

    for (const drop of env.fountainDrops) {
      const p = (elapsed * 1.8 + (drop.userData.phase as number)) % 1;
      const a = drop.userData.angle as number;
      const r = 0.4 + p * 2.1;
      const y = 0.72 + Math.sin(p * Math.PI) * 1.65;
      drop.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    }

    for (const cloud of env.cloudsGroup.children) {
      cloud.position.x += dt * (cloud.userData.speed as number);
      const bound = cloud.userData.bound as number;
      if (cloud.position.x > bound) {
        cloud.position.x = -bound;
      }
    }

    // 7. Reactive Weather: Rain Streaks
    this.rainPoints.visible = weather === 'rain';
    if (weather === 'rain') {
      const pos = this.rainPositions;
      const b = this.rainBounds;
      for (let i = 0; i < this.rainCount; i++) {
        pos[i * 3 + 1] -= dt * 34;
        pos[i * 3] -= dt * 4.5;
        if (pos[i * 3 + 1] < 0) {
          pos[i * 3 + 1] = 44 + (i % 5);
          pos[i * 3] = ((i * 73) % (b * 2)) - b;
        }
      }
      (this.rainPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    // 8. Golden Mist / Night Fireflies
    const moteAlpha = Math.max(weather === 'mist' ? 0.55 : 0, nightFactor * 0.72);
    const moteMat = this.motesPoints.material as THREE.PointsMaterial;
    moteMat.opacity = moteAlpha;
    this.motesPoints.visible = moteAlpha > 0.04;
    if (this.motesPoints.visible) {
      const pos = this.motesPositions;
      for (let i = 0; i < this.motesCount; i++) {
        pos[i * 3 + 1] = this.motesBaseY[i] + Math.sin(elapsed * 0.9 + i * 1.3) * 0.65;
      }
      (this.motesPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  }
}
