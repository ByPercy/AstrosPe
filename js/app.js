import * as THREE from "three"; // <-- 1. ¡Faltaba importar THREE aquí!
import { EarthScene } from "./main.js";
import { getClimateData } from "./api.js";

export class AppController {
  constructor() {
    this.earth = new EarthScene("canvas-container");
  }

  startMission() {
    // 1. Inicializa el mundo 3D en pantalla
    this.earth.init();

    // 2. Ejecuta la animación de la cámara con GSAP
    this.earth.zoomIn();

    // 3. Oculta el menú de inicio y muestra el HUD
    document.getElementById("intro-screen").classList.add("fade-out");
    document.getElementById("hud-overlay").classList.remove("hidden");

    // 4. ¡ACTIVAMOS EL DETECTOR DE CLICS AQUÍ!
    this.setupInteractions(); 

    // 5. Boton Cerrar
    document.getElementById("btn-close-panel").addEventListener("click", () => {
      document.getElementById("info-panel").classList.add("hidden");
    });
  }

  setupInteractions() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    window.addEventListener("click", async (event) => {
      // 1. Detectar coordenadas del clic
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, this.earth.camera);

      // 2. Ver si chocó con algún punto rojo (markerGroup)
      const intersects = raycaster.intersectObjects(this.earth.markerGroup.children);

      if (intersects.length > 0) {
        const clickedMarker = intersects[0].object;
        const zone = clickedMarker.userData; // Recuperamos { name, lat, lon }

        console.log("-->¡Clic detectado en zona:", zone.name);

        // 3. Abrir y llenar el panel HUD en el HTML
        document.getElementById("info-panel").classList.remove("hidden");
        document.getElementById("panel-title").innerText = zone.name;
        document.getElementById("panel-coords").innerText = `Lat: ${zone.lat}, Lon: ${zone.lon}`;

        // 4. Configurar el botón de reproducir para llamar a la API
        const btnPlay = document.getElementById("btn-play-zone");
        btnPlay.onclick = async () => {
          console.log(`🎵 Obteniendo clima de la NASA para ${zone.name}...`);
          const climateData = await getClimateData(zone.lat, zone.lon);
          console.log("¡Datos listos para el audio:", climateData);
          // AQUÍ LUEGO CONECTAREMOS EL AUDIO DE TU COMPAÑERO
        };
      }
    });
  }
}

// Inicialización del controlador central al cargar la página
const app = new AppController();

document.getElementById("btn-enter").addEventListener("click", () => {
  app.startMission();
});

// Botón de Abortar Misión
document.getElementById("btn-abort").addEventListener("click", () => {
  location.reload(); // Recarga limpia para reiniciar el estado
});