// Loot & alat heist: 3 artefak di pedestal, pintu EXIT, dan koin pengalih (Q).
// Ambil loot dengan E di dekat pedestal. EXIT terkunci sampai 3/3 loot.
// Koin pengalih: dilempar ke depan pemain, memancing penjaga + anjing ke titik itu.
import * as THREE from 'three';
import { LOOT_DEFS, EXIT_DEF, TOOLS } from './config.js';

export class LootSystem {
  constructor(scene) {
    this.scene = scene;
    this.taken = new Set();
    this.decoys = [];
    this.decoyMeshes = [];
    this.exitOpen = false;
  }

  nearestLoot(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const loot of LOOT_DEFS) {
      if (this.taken.has(loot.id)) continue;
      const d = Math.hypot(loot.x - x, loot.z - z);
      if (d < bestD) {
        bestD = d;
        best = loot;
      }
    }
    return best === null ? null : { loot: best, dist: bestD };
  }

  tryPickup(x, z) {
    const near = this.nearestLoot(x, z);
    if (near && near.dist < 2.1) {
      this.taken.add(near.loot.id);
      return near.loot;
    }
    return null;
  }

  get count() {
    return this.taken.size;
  }

  get allTaken() {
    return this.taken.size >= LOOT_DEFS.length;
  }

  nearExit(x, z) {
    return Math.hypot(EXIT_DEF.x - x, EXIT_DEF.z - z) < 2.4;
  }

  // Lempar koin pengalih ke arah hadap pemain; kembalikan titik jatuhnya.
  throwDecoy(x, z, angle) {
    const tx = x + Math.sin(angle) * TOOLS.decoyRange;
    const tz = z - Math.cos(angle) * TOOLS.decoyRange;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.06, 12),
      new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.2, emissive: 0xaa8800, emissiveIntensity: 0.5 }),
    );
    mesh.position.set(tx, 0.12, tz);
    this.scene.add(mesh);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.7, 20),
      new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(tx, 0.06, tz);
    this.scene.add(ring);
    this.decoys.push({ x: tx, z: tz, mesh, ring, ttl: TOOLS.decoyInvestigateSeconds + 1 });
    this.decoyMeshes.push(mesh, ring);
    return { x: tx, z: tz };
  }

  step(dt) {
    for (let i = this.decoys.length - 1; i >= 0; i -= 1) {
      const decoy = this.decoys[i];
      decoy.ttl -= dt;
      decoy.mesh.rotation.y += dt * 6;
      decoy.ring.material.opacity = Math.max(0, Math.min(0.7, decoy.ttl * 0.3));
      if (decoy.ttl <= 0) {
        this.scene.remove(decoy.mesh);
        this.scene.remove(decoy.ring);
        this.decoys.splice(i, 1);
      }
    }
  }

  reset(level) {
    this.taken.clear();
    for (const decoy of this.decoys) {
      this.scene.remove(decoy.mesh);
      this.scene.remove(decoy.ring);
    }
    this.decoys = [];
    this.exitOpen = false;
    if (level) {
      for (const loot of LOOT_DEFS) {
        const entry = level.lootMeshes.get(loot.id);
        if (entry) {
          entry.mesh.visible = true;
          entry.glow.intensity = 14;
        }
      }
      level.setExitOpen(false);
    }
  }
}
