// Kamera CCTV: terpasang di dinding, menyapu kiri-kanan, kerucut visi merah muda
// di lantai. Bila pencuri masuk kerucut + line-of-sight bersih, alarm naik cepat
// dan kamera berkedip merah.
import * as THREE from 'three';
import { CAMERA_DEFS } from './config.js';
import { lineBlocked } from './level.js';

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class CctvCamera {
  constructor(scene, def) {
    this.def = def;
    this.x = def.x;
    this.z = def.z;
    this.angle = def.baseAngle;
    this.seesPlayer = false;
    this.time = 0;

    // Badan kamera di dinding.
    const group = new THREE.Group();
    const mount = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.3, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.6 }),
    );
    group.add(mount);
    this.head = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.26, 0.9, 10),
      new THREE.MeshStandardMaterial({ color: 0x333338, roughness: 0.35, metalness: 0.7 }),
    );
    body.rotation.x = Math.PI / 2;
    body.castShadow = true;
    this.head.add(body);
    this.lens = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 1.2 }),
    );
    this.lens.position.set(0, 0, 0.5);
    this.head.add(this.lens);
    this.head.position.set(0, 0, 0.3);
    group.add(this.head);
    group.position.set(def.x, 4.4, def.z);
    scene.add(group);
    this.group = group;

    // Kerucut visi di lantai (bentuk kipas, seperti penjaga).
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    const segments = 14;
    for (let i = 0; i <= segments; i += 1) {
      const a = -def.halfAngle + (2 * def.halfAngle * i) / segments;
      shape.lineTo(Math.sin(a) * def.range, -Math.cos(a) * def.range);
    }
    shape.lineTo(0, 0);
    const geo = new THREE.ShapeGeometry(shape);
    this.coneMat = new THREE.MeshBasicMaterial({
      color: 0xff5566, transparent: true, opacity: 0.22,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this.cone = new THREE.Mesh(geo, this.coneMat);
    this.cone.rotation.x = -Math.PI / 2;
    this.coneGroup = new THREE.Group();
    this.coneGroup.add(this.cone);
    this.coneGroup.position.set(def.x, 0.05, def.z);
    scene.add(this.coneGroup);

    // Titik cahaya merah kecil di lantai di bawah kamera.
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.35, 12),
      new THREE.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.5 }),
    );
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(def.x, 0.04, def.z);
    scene.add(dot);
  }

  canSee(px, pz) {
    const dx = px - this.x;
    const dz = pz - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist > this.def.range) return false;
    const targetAngle = Math.atan2(dx, -dz);
    if (Math.abs(angleDiff(targetAngle, this.angle)) > this.def.halfAngle) return false;
    if (lineBlocked(this.x, this.z, px, pz)) return false;
    return true;
  }

  step(dt, player) {
    this.time += dt;
    this.angle = this.def.baseAngle + Math.sin(this.time * this.def.speed) * this.def.sweep;
    this.seesPlayer = player.alive && this.canSee(player.x, player.z);
    this.coneGroup.rotation.y = Math.PI - this.angle;
    this.head.rotation.y = this.angle;
    this.coneMat.opacity = this.seesPlayer ? 0.42 : 0.2;
    this.lens.material.emissiveIntensity = this.seesPlayer ? 3.0 : 1.2;
  }

  reset() {
    this.time = 0;
    this.seesPlayer = false;
  }
}

export class CctvSystem {
  constructor(scene) {
    this.cameras = CAMERA_DEFS.map((def) => new CctvCamera(scene, def));
  }

  step(dt, player) {
    for (const cam of this.cameras) cam.step(dt, player);
  }

  anySeesPlayer() {
    return this.cameras.some((c) => c.seesPlayer);
  }

  reset() {
    for (const cam of this.cameras) cam.reset();
  }
}
