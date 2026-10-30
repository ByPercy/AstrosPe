import * as THREE from "three"; //herramienta 3D de js
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

//Export para que "app.js" pueda llamar a este archivo
export class EarthScene {
  constructor(containerId) {
    this.container = document.getElementById(containerId); //captura el ID del contenedor HTML "canvas-container"
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.earth = null;
    this.clouds = null;
    this.moonOrbit = null;
  }

  init() {
    this.scene = new THREE.Scene();//CREACION DEL ESPACIO 3D (EL ESTUDIO DE GRABACION)
    
    //CREACION DE LA CAMARA QUE OBSERVA EL ESPECTADOR
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.z = 50; //DISTANCIA CON EL CENTRO

    //RENDERIZA/DIBUJA LOS GRAFICOS EN EL HTML
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

    //DOCUMENTEN CRJOOOOOOOOO//
    // ---CARGA DE TEXTURAS DE GLOBO TERRAQUIO ---
    //TRAE EL PLANO DE LA TIERRA Y LUNA DE INTERNET MEDIANTE LOS LINK HTTPS
    const textureLoader = new THREE.TextureLoader();
    const mapDay = textureLoader.load("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg");
    const mapNight = textureLoader.load("https://unpkg.com/three-globe/example/img/earth-night.jpg");
    const mapClouds = textureLoader.load("https://threejs.org/examples/textures/planets/earth_clouds_1024.png");
    const moonTexture = textureLoader.load("https://threejs.org/examples/textures/planets/moon_1024.jpg");

    //Gente Este es el Globo Terraquio
    const earthMaterial = new THREE.MeshPhongMaterial({
      map: mapDay,
      emissiveMap: mapNight,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.8,
      shininess: 5,
    });
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(4, 64, 64), earthMaterial);
    this.scene.add(this.earth);//MUESTRA EL RESULTADO FINAL DE LA CONVINACION DE TODOS

    // Luna
    this.moonOrbit = new THREE.Group();
    this.scene.add(this.moonOrbit);
    const moonMaterial = new THREE.MeshPhongMaterial({ map: moonTexture, shininess: 0 });
    const moon = new THREE.Mesh(new THREE.SphereGeometry(1.365, 64, 64), moonMaterial);
    moon.position.set(25, 0, -10);
    this.moonOrbit.add(moon);

    // Nubes
    this.clouds = new THREE.Mesh(
      new THREE.SphereGeometry(4.2, 64, 64),
      new THREE.MeshPhongMaterial({
        map: mapClouds,
        emissiveMap: mapClouds,
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