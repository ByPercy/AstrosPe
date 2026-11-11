import * as THREE from "three"; // <-- 1. ¡Faltaba importar THREE aquí!
import { EarthScene } from "./main.js";
import { getClimateData } from "./api.js";
import { sonificarCoordenadas } from "./audio.js";
import { translations } from "./idioma.js"; // <-- Importamos el diccionario correctamente

export class AppController {
  constructor() {
    this.earth = new EarthScene("canvas-container");
  }

  changeLanguage(lang) {
    const elements = document.querySelectorAll("[data-i18n]");
    elements.forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (translations[lang] && translations[lang][key]) {
        el.innerText = translations[lang][key];
      }
    });
  }

  async startMission() {

    const userGeo = await getUserLocationAndUTC();

    // 2. Inyectamos la hora Local y UTC en la cabecera superior del HUD
    const hudLocal = document.getElementById("hud-time-local");
    const hudUtc = document.getElementById("hud-time-utc");

    if (hudLocal) hudLocal.innerText = `Local: ${userGeo.localTime}`;
    if (hudUtc) hudUtc.innerText = `UTC: ${userGeo.utcTime}`;

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

  // Función para calcular la hora local aproximada de cualquier longitud
  getLocalTime(lon) {
    const totalMinutesOffset = lon * 4; 
    const now = new Date();
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + totalMinutesOffset;
    let localMinutes = (utcMinutes % 1440 + 1440) % 1440;
    const hours = Math.floor(localMinutes / 60);
    const minutes = Math.floor(localMinutes % 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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

       // 2. NUEVO: Calcular y mostrar la hora local en tiempo real
        const horaLocal = this.getLocalTime(zone.lon);
        // Asegúrate de tener un elemento en tu HTML con id="panel-time", o créalo:
        document.getElementById("panel-time").innerText = `🕒${horaLocal}`;

        // 3. NUEVO: Consultar los grados de la NASA automáticamente al abrir la zona
        document.getElementById("panel-temp").innerText = "🌡️";
        
        getClimateData(zone.lat, zone.lon).then(climateData => {
          if (climateData && climateData.length > 0) {
            // Tomamos el último valor de temperatura disponible del arreglo
            const tempActual = climateData[climateData.length - 1];
            document.getElementById("panel-temp").innerText = `🌡️${tempActual} °C`;
          } else {
            document.getElementById("panel-temp").innerText = "🌡️ Datos no disponibles";
          }
        });

        // 4. Configurar el botón de reproducir para llamar a la API
        const btnPlay = document.getElementById("btn-play-zone");
        btnPlay.onclick = () => {
          console.log(`🎵 Sonificando coordenadas de ${zone.name}...`);
          sonificarCoordenadas(zone.lat, zone.lon);
        };
      }
    });
  }
}


// Inicialización del controlador central al cargar la página
const app = new AppController();

// 🌐 Escucha global para cambiar el idioma desde el menú de inicio
document.getElementById("lang-select").addEventListener("change", (event) => {
  const selectedLang = event.target.value; 
  app.changeLanguage(selectedLang);
  console.log("🌐 Idioma cambiado a:", selectedLang);
});

// Función para solicitar ubicación al navegador y calcular la hora UTC/Local del usuario
function getUserLocationAndUTC() {
  return new Promise((resolve) => {
    // 1. Verificamos si el navegador soporta Geolocalización
    if ("geolocation" in navigator) {
      
      // 2. Solicitamos la posición actual
      navigator.geolocation.getCurrentPosition(
        // CASO ÉXITO: El usuario hizo clic en "Permitir"
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          
          // Capturamos la hora UTC del sistema
          const now = new Date();
          const utcHours = String(now.getUTCHours()).padStart(2, '0');
          const utcMinutes = String(now.getUTCMinutes()).padStart(2, '0');
          
          // Capturamos la hora Local del usuario
          const localHours = String(now.getHours()).padStart(2, '0');
          const localMinutes = String(now.getMinutes()).padStart(2, '0');

          resolve({
            localTime: `${localHours}:${localMinutes}`,
            utcTime: `${utcHours}:${utcMinutes}`,
            lat: lat,
            lon: lon,
            success: true
          });
        },
        // CASO ERROR/RECHAZO: El usuario bloqueó la ubicación o falló el GPS
        (error) => {
          console.warn("⚠️ Permiso denegado o error de ubicación:", error.message);
          
          const now = new Date();
          const utcHours = String(now.getUTCHours()).padStart(2, '0');
          const utcMinutes = String(now.getUTCMinutes()).padStart(2, '0');
          const localHours = String(now.getHours()).padStart(2, '0');
          const localMinutes = String(now.getMinutes()).padStart(2, '0');

          // Devolvemos valores de contingencia (Lima por defecto)
          resolve({
            localTime: `${localHours}:${localMinutes}`,
            utcTime: `${utcHours}:${utcMinutes}`,
            lat: -12.0464,
            lon: -77.0428,
            success: false
          });
        },
        { timeout: 8000 } // Máximo 8 segundos de espera
      );

    } else {
      // Navegador antiguo sin soporte
      resolve({ localTime: "--:--", utcTime: "--:--", success: false });
    }
  });
}



document.getElementById("btn-enter").addEventListener("click", () => {
  app.startMission();
});

// Botón de Abortar Misión
document.getElementById("btn-abort").addEventListener("click", () => {
  location.reload(); // Recarga limpia para reiniciar el estado
});

