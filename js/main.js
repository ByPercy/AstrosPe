import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export class EarthScene {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.earth = null;
    this.clouds = null;
    this.moonOrbit = null;
  }

  init() {
    this.scene = new THREE.Scene();
    
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.z = 50;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enablePan = false;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 30;
    this.controls.enabled = false;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.5;

    // --- CARGA DE TEXTURAS Y OBJETOS CELESTIALES ---
    const textureLoader = new THREE.TextureLoader();
    const mapDay = textureLoader.load("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg");
    const mapNight = textureLoader.load("https://unpkg.com/three-globe/example/img/earth-night.jpg");
    const mapClouds = textureLoader.load("https://unpkg.com/three-globe/example/img/earth-clouds.png");
    const moonTexture = textureLoader.load("https://threejs.org/examples/textures/planets/moon_1024.jpg");

    // Tierra
    const earthMaterial = new THREE.MeshPhongMaterial({
      map: mapDay,
      emissiveMap: mapNight,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.8,
      shininess: 5,
    });
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(5, 64, 64), earthMaterial);
    this.scene.add(this.earth);

    // Luna
    this.moonOrbit = new THREE.Group();
    this.scene.add(this.moonOrbit);
    const moonMaterial = new THREE.MeshPhongMaterial({ map: moonTexture, shininess: 0 });
    const moon = new THREE.Mesh(new THREE.SphereGeometry(1.365, 64, 64), moonMaterial);
    moon.position.set(25, 0, -10);
    this.moonOrbit.add(moon);

    // Nubes
    this.clouds = new THREE.Mesh(
      new THREE.SphereGeometry(5.05, 64, 64),
      new THREE.MeshPhongMaterial({
        map: mapClouds,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
      })
    );
    this.scene.add(this.clouds);

    // Luces
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    sunLight.position.set(20, 0, 0);
    this.scene.add(sunLight);
    this.scene.add(new THREE.AmbientLight(0x111122, 0.2));

    // Estrellas
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(5000 * 3);
    for (let i = 0; i < 5000 * 3; i++) starPositions[i] = (Math.random() - 0.5) * 300;
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }));
    this.scene.add(stars);

    this.animate();
  }

  zoomIn() {
    gsap.to(this.camera.position, {
      z: 15,
      duration: 2,
      ease: "power2.out",
      onComplete: () => {
        this.controls.enabled = true;
      },
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    if (this.clouds) this.clouds.rotation.y += 0.0005;
    if (this.moonOrbit) this.moonOrbit.rotation.y += 0.0002;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}