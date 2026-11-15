import * as THREE from "three"; //herramienta 3D de js, Motor que servira como base para crear el globo terraquio, la luna y estrellas
import { OrbitControls } from "three/addons/controls/OrbitControls.js";//Libreria para Interaccion con el mouse para rotar, acercar y alejar la camara


/**
 * Convierte coordenadas geográficas (latitud y longitud en grados) a coordenadas cartesianas 3D (x, y, z)
 * sobre una esfera de un radio determinado.
 * @param {number} lat - Latitud en grados (-90 a 90)
 * @param {number} lon - Longitud en grados (-180 a 180)
 * @param {number} radius - Distancia desde el centro de la esfera
 * @returns {THREE.Vector3} Posición 3D exacta en la escena
 */
// Función para transformar Lat/Lon en un punto 3D sobre la esfera
function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

////---------------------------------------------------///
///CREACCION DE VARIABLES VACIAS PARA LOS ELEMENTOS 3D///
//---------------------------------------------------///
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
    this.sunLight = null; // <-- Referencia para mover el sol dinámicamente

    //Declaracion de zonas con lantitud y longitud correctas de cada zona
    //La zona Agregada aparecera en el mapa con un punto rojo gracias a la funcion Matematica de main.js
    this.zones = [
      { id: "amazonas", name: "Selva del Amazonas", lat: -3.4653, lon: -62.2159, historicalAvg: 26.5, impactKey: "impact_amazon" },
      { id: "tokyo", name: "Tokio, Japón", lat: 35.6762, lon: 139.6503, historicalAvg: 15.0, impactKey: "impact_tokyo" },
      { id: "sahara", name: "Desierto del Sahara", lat: 23.4162, lon: 25.6628, historicalAvg: 30.0, impactKey: "impact_sahara" },
      { id: "lima", name: "Perú, Lima", lat: -12.1371, lon: -76.9214, historicalAvg: 19.5, impactKey: "impact_lima" },
      { id: "greenland", name: "Groenlandia (Deshielo Polar)", lat: 72.5798, lon: -38.4590, historicalAvg: -10.0, impactKey: "impact_greenland" },
      { id: "antarctica", name: "Antártida (Base McMurdo)", lat: -77.8419, lon: 166.6863, historicalAvg: -20.0, impactKey: "impact_antarctica" },
      { id: "death_valley", name: "Valle de la Muerte, EE.UU.", lat: 36.5323, lon: -116.9325, historicalAvg: 25.0, impactKey: "impact_death" },
      { id: "coral_reef", name: "Gran Barrera de Coral, Australia", lat: -18.2871, lon: 147.6992, historicalAvg: 24.0, impactKey: "impact_coral" },
      { id: "siberia", name: "Siberia (Permafrost Ruso)", lat: 66.4238, lon: 112.4281, historicalAvg: -5.0, impactKey: "impact_siberia" }
    ];
    this.markerGroup = null;

  }

  init() {
    this.scene = new THREE.Scene();//CREACION DEL ESPACIO 3D (EL ESTUDIO DE GRABACION)
    
    //CREACION DE LA CAMARA QUE OBSERVA EL ESPECTADOR
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.z = 50; //DISTANCIA CON EL CENTRO

    //RENDERIZA/DIBUJA LOS GRAFICOS EN EL HTML
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
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

    // Detecta pantallas móviles o dispositivos táctiles
const isMobile =
  window.innerWidth <= 768 || window.matchMedia("(pointer: coarse)").matches;
const scaleFactor = isMobile ? 1.6 : 1.0; // 60% más grande en celular, intacto en PC


    //CREACION DE ASPECTO PUNTOS ROJOS (ZONAS INTERACTIVAS)--
    this.markerGroup = new THREE.Group();
    this.scene.add(this.markerGroup);

    const dotGeometry = new THREE.SphereGeometry(0.12, 16, 16);

    this.zones.forEach(zone => {

      const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const marker = new THREE.Mesh(dotGeometry, dotMaterial);
      marker.scale.setScalar(scaleFactor); // <-- Escala automáticamente en móvil
      
      // La Tierra tiene radio 4, ponemos los puntos en 4.15 para que floten encima
      const position = latLonToVector3(zone.lat, zone.lon, 4.15);
      marker.position.copy(position);

      // Guardamos la info de la zona dentro del objeto 3D
      marker.userData = zone;

      this.markerGroup.add(marker);
    });

    // --- LUZ DINÁMICA DEL SOL ---
    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.6);
    this.scene.add(this.sunLight);
    this.scene.add(new THREE.AmbientLight(0x111122, 0.4));


    // Estrellas
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(5000 * 3);
    for (let i = 0; i < 5000 * 3; i++) starPositions[i] = (Math.random() - 0.5) * 300;
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }));
    this.scene.add(stars);

    this.animate();
  }

  // NUEVO: Actualiza la posición del Sol basándose en la hora UTC real
  updateSunPosition() {
    if (!this.sunLight) return;

    const now = new Date();
    // 1. Longitud solar: a las 12:00 UTC el Sol está en 0°; avanza 15° por hora hacia el oeste
    const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
    let sunLon = (12 - utcHours) * 15;
    if (sunLon > 180) sunLon -= 360;
    if (sunLon < -180) sunLon += 360;

    // 2. Latitud solar (declinación estacional aproximada según el día del año)
    const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 0));
    const dayOfYear = Math.floor((now - startOfYear) / 86400000);
    const sunLat = 23.44 * Math.sin(((360 / 365) * (dayOfYear - 81) * Math.PI) / 180);

    // 3. Colocamos el Sol a distancia 25 en esa dirección exacta
    const sunPos = latLonToVector3(sunLat, sunLon, 25);
    this.sunLight.position.copy(sunPos);
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
    this.updateSunPosition();
    if (this.clouds) this.clouds.rotation.y += 0.0005;
    if (this.moonOrbit) this.moonOrbit.rotation.y += 0.0002;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  updateMarkerClimateColor(zoneId, anomaly) {
    const marker = this.markerGroup.children.find(m => m.userData.id === zoneId);
    if (!marker) return;

    const absDiff = Math.abs(anomaly);
    let hexColor = 0x00ff66; // Verde: clima acorde a la zona

    if (absDiff > 4.5) {
      hexColor = 0xff2244;   // Rojo: anomalía crítica fuera de rango
    } else if (absDiff > 2.0) {
      hexColor = 0xffcc00;   // Amarillo: punto medio / variación moderada
    }

    marker.material.color.setHex(hexColor);
  }

  focusOnZone(zone) {
    this.controls.autoRotate = false;

    // Agranda ligeramente solo el punto seleccionado sin alterar su color de clima
    this.markerGroup.children.forEach((marker) => {
      const isSelected = marker.userData.id === zone.id;
      marker.scale.setScalar(isSelected ? 1.6 : 1.0);
    });

    const camTarget = latLonToVector3(zone.lat, zone.lon, 10.5);
    gsap.to(this.camera.position, {
      x: camTarget.x,
      y: camTarget.y,
      z: camTarget.z,
      duration: 1.4,
      ease: "power2.inOut",
    });
  }

  resetView() {
    this.controls.autoRotate = true;
    this.markerGroup.children.forEach(m => m.scale.setScalar(1.0));

    const dir = this.camera.position.clone().normalize().multiplyScalar(15);
    gsap.to(this.camera.position, {
      x: dir.x,
      y: dir.y,
      z: dir.z,
      duration: 1.2,
      ease: "power2.out",
    });
  }
}