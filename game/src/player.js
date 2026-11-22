// Pencuri: sosok terang (jaket cyan + topi) dengan cincin hijau terang di bawah
// kaki dan panah kecil di atas kepala — selalu mudah ditemukan di frame.
// Gerak WASD/panah, Shift mengendap (lebih pelan, lebih sulit terlihat).
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { resolveCircle } from './level.js';

export class Thief {
  constructor(scene) {
    this.x = PLAYER.startX;
    this.z = PLAYER.startZ;
    this.angle = PLAYER.startAngle;
    this.alive = true;
    this.moving = false;
    this.sneaking = false;
    this.stepPhase = 0;

    const group = new THREE.Group();
    // Jaket cyan terang + celana gelap + topi fedora.
    const jacket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.42, 0.85, 10),
      new THREE.MeshStandardMaterial({ color: 0x19c2d8, roughness: 0.5, emissive: 0x0a5a68, emissiveIntensity: 0.55 }),
    );
    jacket.position.y = 0.95;
    jacket.castShadow = true;
    group.add(jacket);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xe8b98a, roughness: 0.6 }),
    );
    head.position.y = 1.62;
    head.castShadow = true;
    group.add(head);
    const hatTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.24, 0.22, 10),
      new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.35 }),
    );
    hatTop.position.y = 1.88;
    group.add(hatTop);
    const hatBrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.05, 12),
      hatTop.material,
    );
    hatBrim.position.y = 1.78;
    group.add(hatBrim);
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.55, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x22222a, roughness: 0.7 }),
    );
    legs.position.y = 0.28;
    group.add(legs);
    // Tas rampasan di punggung.
    const bag = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.5, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.8 }),
    );
    bag.position.set(0, 1.05, -0.32);
    group.add(bag);
    // Cincin hijau terang di bawah kaki.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.88, 24),
      new THREE.MeshBasicMaterial({ color: 0x2dff7a, transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);
    this.ring = ring;
    // Panah kecil di atas kepala.
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 0.55, 4),
      new THREE.MeshBasicMaterial({ color: 0x39ff88 }),
    );
    arrow.rotation.x = Math.PI;
    arrow.position.y = 2.45;
    group.add(arrow);
    this.arrow = arrow;
    this.group = group;
    scene.add(group);
    this.updateVisual(0);
  }

  step(dt, move, sound) {
    if (!this.alive) return;
    this.sneaking = move.sneaking;
    const speed = move.sneaking ? PLAYER.sneakSpeed : PLAYER.speed;
    this.moving = move.x !== 0 || move.z !== 0;
    if (this.moving) {
      const nx = this.x + move.x * speed * dt;
      const nz = this.z + move.z * speed * dt;
      const fixed = resolveCircle(nx, nz, PLAYER.radius);
      this.x = fixed.x;
      this.z = fixed.z;
      this.angle = Math.atan2(move.x, -move.z);
      this.stepPhase += dt * (move.sneaking ? 5 : 9);
      if (sound) sound.step(this.stepPhase);
    }
    this.updateVisual(dt);
  }

  updateVisual(dt) {
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.angle;
    // Bobbing ringan saat berjalan; cincin berdenyut.
    const bob = this.moving ? Math.abs(Math.sin(this.stepPhase)) * 0.06 : 0;
    this.group.position.y = bob;
    const pulse = 0.85 + Math.sin(this.stepPhase * 0.5 + (dt || 0)) * 0.1;
    this.ring.material.opacity = 0.75 + pulse * 0.15;
    this.ring.scale.setScalar(1 + Math.sin(this.stepPhase) * 0.04);
    this.arrow.position.y = 2.45 + Math.sin(this.stepPhase * 0.7) * 0.08;
  }

  reset() {
    this.x = PLAYER.startX;
    this.z = PLAYER.startZ;
    this.angle = PLAYER.startAngle;
    this.alive = true;
    this.moving = false;
    this.updateVisual(0);
  }
}
