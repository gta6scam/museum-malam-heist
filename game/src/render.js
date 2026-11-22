// Renderer Three.js: kamera oblique top-down, pencahayaan kaya
// (ambient + hemisphere + directional berbayang + lampu sorot panggung),
// dan frame yang mengisi penuh layar tanpa pita hitam.
import * as THREE from 'three';
import { ROOM } from './config.js';

export class Renderer3D {
  constructor(canvas) {
    // Tanpa antialias MSAA: di software renderer (SwiftShader) MSAA membuat
    // tiap frame berkali lipat lebih lambat; tepi tetap rapi di resolusi ini.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0a14);
    this.scene.fog = new THREE.Fog(0x0b0a14, 55, 95);

    // Kamera oblique: melihat seluruh aula 44x28 dari atas-depan.
    // Jarak dijaga agar pintu EXIT + titik masuk selatan tetap dalam frame.
    this.camera = new THREE.PerspectiveCamera(48, 1.6, 0.1, 200);
    this.camera.position.set(0, 38, 26);
    this.camera.lookAt(0, 0, -0.5);

    // Cahaya 1: ambient malam biru.
    this.scene.add(new THREE.AmbientLight(0x33406e, 0.85));
    // Cahaya 2: hemisphere langit-langit vs lantai marmer.
    const hemi = new THREE.HemisphereLight(0x8a9ad8, 0x3a2a1a, 0.7);
    this.scene.add(hemi);
    // Cahaya 3: directional bulan lewat jendela atap, berbayang.
    const moon = new THREE.DirectionalLight(0xbfd0ff, 1.1);
    moon.position.set(-14, 26, -10);
    moon.castShadow = true;
    moon.shadow.mapSize.set(512, 512);
    moon.shadow.camera.left = -26;
    moon.shadow.camera.right = 26;
    moon.shadow.camera.top = 18;
    moon.shadow.camera.bottom = -18;
    moon.shadow.camera.far = 70;
    this.scene.add(moon);
    // Cahaya 4: lampu gantung emas di tengah aula (tanpa bayangan:
    // PointLight berbayang merender scene 6x per frame — terlalu berat).
    const chandelier = new THREE.PointLight(0xffc93c, 90, 30, 1.7);
    chandelier.position.set(0, 6.5, 2);
    this.scene.add(chandelier);
    // Cahaya 5: aksen hangat Ruang Firaun.
    const pharaoh = new THREE.PointLight(0xffb020, 55, 20, 1.7);
    pharaoh.position.set(0, 5, -10.5);
    this.scene.add(pharaoh);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Jaga seluruh aula tetap dalam frame di rasio berapa pun.
    const fit = Math.max(1, (ROOM.width / ROOM.depth) / (w / h) * 0.72);
    this.camera.position.set(0, 38 * fit, 26 * fit);
    this.camera.lookAt(0, 0, -0.5);
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
