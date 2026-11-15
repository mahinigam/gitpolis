/**
 * Procedural 3D Decorators for Google Gemini Decision Engine
 * Creates bespoke Landmark Monuments and Glowing Inter-District Transit Arteries
 */

import * as THREE from 'three';
import type { CityBlueprint, DistrictBlueprint } from '../types/city';
import type { HistoricalChronicle, InterDistrictConnection, TransitType } from '../types/decision';

const TRANSIT_COLORS: Record<TransitType, string> = {
  hyperloop_arterial: '#38bdf8', // radiant cyan electric beam
  waterfront_ferry: '#2dd4bf',   // luminous turquoise water channel
  elevated_rail: '#f59e0b',      // warm amber celestial viaduct
  pedestrian_boulevard: '#10b981', // emerald botanical corridor
};

/**
 * Procedurally generates a bespoke 3D Landmark Monument
 */
export function createHistoricalMonument(
  chronicle: HistoricalChronicle,
  index: number,
  total: number,
  islandRadius: number
): THREE.Group {
  const g = new THREE.Group();
  g.name = `monument-${chronicle.monument.name}`;

  const angle = (index / Math.max(1, total)) * Math.PI * 2 + Math.PI / 4;
  const radius = Math.min(22, Math.max(12, islandRadius * 0.28));
  const posX = Math.cos(angle) * radius;
  const posZ = Math.sin(angle) * radius;

  g.position.set(posX, 0.4, posZ);

  const graniteMat = new THREE.MeshStandardMaterial({
    color: '#262d38',
    roughness: 0.35,
    metalness: 0.7,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: '#f59e0b',
    roughness: 0.25,
    metalness: 0.85,
    emissive: '#d97706',
    emissiveIntensity: 0.35,
  });

  const neonGlowMat = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    roughness: 0.2,
    metalness: 0.9,
    emissive: '#0284c7',
    emissiveIntensity: 0.85,
  });

  // Base plinth
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 0.6, 8), graniteMat);
  plinth.position.y = 0.3;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  g.add(plinth);

  // Plinth ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.12, 8, 24), goldMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.6;
  g.add(ring);

  const type = chronicle.monument.monumentType;

  if (type === 'obelisk') {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.75, 7.5, 4), graniteMat);
    shaft.position.y = 4.35;
    shaft.rotation.y = Math.PI / 4;
    shaft.castShadow = true;
    g.add(shaft);

    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.1, 4), goldMat);
    cap.position.y = 8.65;
    cap.rotation.y = Math.PI / 4;
    g.add(cap);

    // Glowing vertical core fissure
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.08, 6.2, 0.08), neonGlowMat);
    core.position.y = 4.5;
    g.add(core);
  } else if (type === 'triumphal_arch') {
    // Left column
    const colLeft = new THREE.Mesh(new THREE.BoxGeometry(0.65, 5.2, 0.65), graniteMat);
    colLeft.position.set(-1.1, 3.2, 0);
    colLeft.castShadow = true;
    g.add(colLeft);

    // Right column
    const colRight = new THREE.Mesh(new THREE.BoxGeometry(0.65, 5.2, 0.65), graniteMat);
    colRight.position.set(1.1, 3.2, 0);
    colRight.castShadow = true;
    g.add(colRight);

    // Lintel header
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 0.95), graniteMat);
    lintel.position.set(0, 6.25, 0);
    lintel.castShadow = true;
    g.add(lintel);

    // Gold imperial crest
    const crest = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55), goldMat);
    crest.position.set(0, 7.2, 0);
    g.add(crest);
  } else if (type === 'beacon_spire') {
    // Spire needle
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.5, 9.5, 6), graniteMat);
    mast.position.y = 5.35;
    mast.castShadow = true;
    g.add(mast);

    // Three staggered horizontal halo discs
    for (let r = 0; r < 3; r++) {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.8 - r * 0.2, 0.06, 6, 18), goldMat);
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 4.5 + r * 1.8;
      g.add(halo);
    }

    // Glowing pulsating beacon orb
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 12), neonGlowMat);
    orb.position.y = 10.3;
    g.add(orb);
  } else {
    // atrium_dome
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1.7, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      neonGlowMat
    );
    dome.position.y = 0.6;
    g.add(dome);

    const cage = new THREE.Mesh(
      new THREE.SphereGeometry(1.75, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#f59e0b', wireframe: true })
    );
    cage.position.y = 0.6;
    g.add(cage);
  }

  // Attach metadata for raycasting & inspector drawer
  g.userData = {
    type: 'monument',
    title: chronicle.monument.name,
    era: chronicle.timeRange,
    lore: chronicle.narrative,
    epoch: chronicle.epochName,
  };

  return g;
}

/**
 * Procedurally creates glowing 3D transit arteries connecting semantically related repositories
 */
export function createAITransitCorridor(
  connection: InterDistrictConnection,
  districts: DistrictBlueprint[]
): THREE.Group | null {
  const source = districts.find(
    (d) =>
      d.id.toLowerCase() === connection.sourceRepo.toLowerCase() ||
      d.id.toLowerCase().includes(connection.sourceRepo.toLowerCase())
  );
  const target = districts.find(
    (d) =>
      d.id.toLowerCase() === connection.targetRepo.toLowerCase() ||
      d.id.toLowerCase().includes(connection.targetRepo.toLowerCase())
  );

  if (!source || !target || source.id === target.id) return null;

  const g = new THREE.Group();
  g.name = `ai-transit-${source.id}-${target.id}`;

  const start = new THREE.Vector3(source.x, 0.9, source.z);
  const end = new THREE.Vector3(target.x, 0.9, target.z);
  const dist = start.distanceTo(end);

  const mid = start.clone().add(end).multiplyScalar(0.5);
  // Elegant parabolic altitude based on distance
  mid.y = 3.5 + Math.min(14, dist * 0.12);

  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  const color = TRANSIT_COLORS[connection.connectionType] || '#38bdf8';

  // 1. Sleek 3D glowing tube
  const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.08 + connection.bandwidthWeight * 0.025, 6, false);
  const tubeMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.65,
    roughness: 0.25,
    metalness: 0.8,
    transparent: true,
    opacity: 0.75,
  });

  const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
  g.add(tubeMesh);

  // 2. Dual pylon pedestals at start and end
  const pylonMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.5 });
  const pylon1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 1.2, 6), pylonMat);
  pylon1.position.set(start.x, 0.6, start.z);
  g.add(pylon1);

  const pylon2 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 1.2, 6), pylonMat);
  pylon2.position.set(end.x, 0.6, end.z);
  g.add(pylon2);

  g.userData = {
    type: 'transit_corridor',
    source: source.id,
    target: target.id,
    connectionType: connection.connectionType,
    reason: connection.synergyReason,
  };

  return g;
}
