// Penjaga museum + anjing K-9: patroli waypoint, kerucut visi bervolume,
// mesin state patrol -> suspicious (?) -> alert (!) -> search -> patrol,
// plus investigate (terpancing pengalih). Anjing lebih cepat, jangkauan pendek.
import * as THREE from 'three';
import { DETECTION, GUARD_DEFS, DOG_DEF } from './config.js';
import { resolveCircle, lineBlocked } from './level.js';

export const STATE_PATROL = 'patrol';
export const STATE_SUSPICIOUS = 'suspicious';
export const STATE_ALERT = 'alert';
export const STATE_SEARCH = 'search';
export const STATE_INVESTIGATE = 'investigate';

const CONE_COLORS = {
  patrol: 0xffd34d,
  suspicious: 0xff8c1a,
  alert: 0xff2a2a,
  search: 0xff8c1a,
  investigate: 0xffd34d,
};

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Kerucut visi di lantai: segitiga kipas transparan yang mengikuti arah pandang.
function makeConeMesh(range, halfAngle, color) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  const segments = 14;
  for (let i = 0; i <= segments; i += 1) {
    const a = -halfAngle + (2 * halfAngle * i) / segments;
    shape.lineTo(Math.sin(a) * range, -Math.cos(a) * range);
  }
  shape.lineTo(0, 0);
  const geo = new THREE.ShapeGeometry(shape);
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.30,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.06;
  return mesh;
}

function makeGuardBody(color, isDog) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
  if (isDog) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8 }));
    body.position.y = 0.55;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.42), bodyMat);
    head.position.set(0.55, 0.75, 0);
    head.castShadow = true;
    group.add(head);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 4), bodyMat);
    ear.position.set(0.5, 1.05, 0.14);
    group.add(ear);
    const ear2 = ear.clone();
    ear2.position.z = -0.14;
    group.add(ear2);
    for (const [lx, lz] of [[0.35, 0.2], [0.35, -0.2], [-0.35, 0.2], [-0.35, -0.2]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.12), bodyMat);
      leg.position.set(lx, 0.2, lz);
      group.add(leg);
    }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.5, 6), bodyMat);
    tail.position.set(-0.55, 0.75, 0);
    tail.rotation.z = 0.8;
    group.add(tail);
  } else {
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.05, 10), bodyMat);
    torso.position.y = 0.95;
    torso.castShadow = true;
    group.add(torso);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xd9a986, roughness: 0.6 }),
    );
    head.position.y = 1.75;
    head.castShadow = true;
    group.add(head);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.34, 0.16, 12),
      new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.4 }),
    );
    cap.position.y = 1.98;
    group.add(cap);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 12), cap.material);
    brim.position.y = 1.9;
    group.add(brim);
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.5, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.7 }),
    );
    legs.position.y = 0.25;
    group.add(legs);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffe9a8, emissiveIntensity: 1.4 }),
    );
    lamp.position.set(0.35, 1.25, 0.3);
    group.add(lamp);
  }
  // Tanda "?" / "!" di atas kepala.
  const markCanvas = document.createElement('canvas');
  markCanvas.width = 64;
  markCanvas.height = 64;
  const markTex = new THREE.CanvasTexture(markCanvas);
  const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTex, transparent: true, depthTest: false }));
  mark.scale.set(0.9, 0.9, 1);
  mark.position.y = 2.5;
  mark.visible = false;
  group.add(mark);
  return { group, mark, markCanvas, markTex };
}

function drawMark(canvas, tex, char, color) {
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  if (!char) {
    tex.needsUpdate = true;
    return;
  }
  g.font = 'bold 52px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 8;
  g.strokeStyle = '#111111';
  g.strokeText(char, 32, 34);
  g.fillStyle = color;
  g.fillText(char, 32, 34);
  tex.needsUpdate = true;
}

export class Guard {
  constructor(scene, def, isDog = false) {
    this.def = def;
    this.isDog = isDog;
    this.name = def.name;
    this.x = def.x;
    this.z = def.z;
    this.angle = 0;
    this.speed = def.speed;
    this.range = isDog ? DETECTION.dogRange : DETECTION.guardRange;
    this.halfAngle = isDog ? DETECTION.dogHalfAngle : DETECTION.guardHalfAngle;
    this.state = STATE_PATROL;
    this.waypointIndex = 0;
    this.seeTime = 0;
    this.lastSeenX = def.x;
    this.lastSeenZ = def.z;
    this.searchTimer = 0;
    this.investigateX = 0;
    this.investigateZ = 0;
    this.investigateTimer = 0;
    this.seesPlayer = false;
    const { group, mark, markCanvas, markTex } = makeGuardBody(def.color, isDog);
    this.group = group;
    this.mark = mark;
    this.markCanvas = markCanvas;
    this.markTex = markTex;
    this.group.position.set(this.x, 0, this.z);
    scene.add(this.group);
    this.cone = makeConeMesh(this.range, this.halfAngle, CONE_COLORS.patrol);
    this.coneGroup = new THREE.Group();
    this.coneGroup.add(this.cone);
    scene.add(this.coneGroup);
    this.pulseTime = 0;
    this.updateVisual(0);
  }

  canSee(px, pz) {
    const dx = px - this.x;
    const dz = pz - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist > this.range) return false;
    const targetAngle = Math.atan2(dx, -dz);
    if (Math.abs(angleDiff(targetAngle, this.angle)) > this.halfAngle) return false;
    if (lineBlocked(this.x, this.z, px, pz)) return false;
    return true;
  }

  step(dt, player, spotlightBoost) {
    const range = this.range + (spotlightBoost ? 2 : 0);
    const dx = player.x - this.x;
    const dz = player.z - this.z;
    const dist = Math.hypot(dx, dz);
    const inRange = dist <= range;
    const targetAngle = Math.atan2(dx, -dz);
    const inCone = Math.abs(angleDiff(targetAngle, this.angle)) <= this.halfAngle;
    const blocked = inRange && inCone ? lineBlocked(this.x, this.z, player.x, player.z) : true;
    this.seesPlayer = inRange && inCone && !blocked && player.alive;

    if (this.seesPlayer) {
      this.seeTime += dt;
      this.lastSeenX = player.x;
      this.lastSeenZ = player.z;
    } else {
      this.seeTime = Math.max(0, this.seeTime - dt * 1.5);
    }

    if (this.state !== STATE_INVESTIGATE) {
      if (this.seeTime >= DETECTION.alertTime) this.setState(STATE_ALERT);
      else if (this.seeTime >= DETECTION.suspectTime && this.state === STATE_PATROL) this.setState(STATE_SUSPICIOUS);
    }

    let moveX = 0;
    let moveZ = 0;
    let speed = this.speed;
    if (this.state === STATE_PATROL) {
      const wp = this.def.waypoints[this.waypointIndex];
      moveX = wp[0] - this.x;
      moveZ = wp[1] - this.z;
      const d = Math.hypot(moveX, moveZ);
      if (d < 0.3) {
        this.waypointIndex = (this.waypointIndex + 1) % this.def.waypoints.length;
      } else {
        moveX /= d;
        moveZ /= d;
      }
    } else if (this.state === STATE_SUSPICIOUS) {
      // Mendekat perlahan ke titik terakhir terlihat.
      moveX = this.lastSeenX - this.x;
      moveZ = this.lastSeenZ - this.z;
      const d = Math.hypot(moveX, moveZ);
      if (d < 0.6) {
        this.setState(STATE_SEARCH);
        this.searchTimer = DETECTION.searchSeconds;
      } else {
        moveX /= d;
        moveZ /= d;
        speed = this.speed * 0.7;
      }
    } else if (this.state === STATE_ALERT) {
      moveX = player.x - this.x;
      moveZ = player.z - this.z;
      const d = Math.hypot(moveX, moveZ);
      if (d > 0.01) {
        moveX /= d;
        moveZ /= d;
      }
      speed = this.isDog ? DETECTION.dogChaseSpeed : DETECTION.chaseSpeed;
      if (!this.seesPlayer && this.seeTime <= 0) {
        this.setState(STATE_SEARCH);
        this.searchTimer = DETECTION.searchSeconds;
      }
    } else if (this.state === STATE_SEARCH) {
      this.searchTimer -= dt;
      // Berputar di tempat sambil memindai.
      this.angle += dt * 1.6;
      if (this.searchTimer <= 0) this.setState(STATE_PATROL);
    } else if (this.state === STATE_INVESTIGATE) {
      moveX = this.investigateX - this.x;
      moveZ = this.investigateZ - this.z;
      const d = Math.hypot(moveX, moveZ);
      if (d < 0.5) {
        moveX = 0;
        moveZ = 0;
        this.angle += dt * 1.2;
      } else {
        moveX /= d;
        moveZ /= d;
      }
      this.investigateTimer -= dt;
      if (this.investigateTimer <= 0) this.setState(STATE_PATROL);
    }

    if (moveX !== 0 || moveZ !== 0) {
      const nx = this.x + moveX * speed * dt;
      const nz = this.z + moveZ * speed * dt;
      const fixed = resolveCircle(nx, nz, 0.55);
      this.x = fixed.x;
      this.z = fixed.z;
      this.angle = Math.atan2(moveX, -moveZ);
    }
    this.updateVisual(dt);
  }

  setState(state) {
    if (this.state === state) return;
    this.state = state;
    if (state === STATE_PATROL) this.seeTime = 0;
    this.cone.material.color.set(CONE_COLORS[state] || 0xffd34d);
    if (state === STATE_SUSPICIOUS || state === STATE_SEARCH) {
      drawMark(this.markCanvas, this.markTex, '?', '#ffb020');
      this.mark.visible = true;
    } else if (state === STATE_ALERT) {
      drawMark(this.markCanvas, this.markTex, '!', '#ff2a2a');
      this.mark.visible = true;
    } else {
      drawMark(this.markCanvas, this.markTex, '', '#ffffff');
      this.mark.visible = false;
    }
  }

  lure(x, z, seconds) {
    this.investigateX = x;
    this.investigateZ = z;
    this.investigateTimer = seconds;
    this.seeTime = 0;
    this.setState(STATE_INVESTIGATE);
  }

  reset() {
    this.x = this.def.x;
    this.z = this.def.z;
    this.angle = 0;
    this.waypointIndex = 0;
    this.seeTime = 0;
    this.searchTimer = 0;
    this.investigateTimer = 0;
    this.setState(STATE_PATROL);
    this.group.position.set(this.x, 0, this.z);
    this.updateVisual(0);
  }

  updateVisual(dt) {
    this.pulseTime += dt || 0;
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.angle;
    this.coneGroup.position.set(this.x, 0.06, this.z);
    // Kerucut digambar mengarah +Z lokal; putar (PI - sudut) agar sejajar arah pandang.
    this.coneGroup.rotation.y = Math.PI - this.angle;
    // Kerucut merah berdenyut saat mengejar.
    this.cone.material.opacity = this.state === STATE_ALERT
      ? 0.34 + Math.sin(this.pulseTime * 7) * 0.08
      : 0.28;
  }
}

export class GuardSquad {
  constructor(scene) {
    this.guards = GUARD_DEFS.map((def) => new Guard(scene, def, false));
    this.dog = new Guard(scene, DOG_DEF, true);
    this.all = [...this.guards, this.dog];
  }

  step(dt, player, spotlightBoost) {
    for (const guard of this.all) guard.step(dt, player, spotlightBoost);
  }

  anySeesPlayer() {
    return this.all.some((g) => g.seesPlayer);
  }

  reset() {
    for (const guard of this.all) guard.reset();
  }
}
