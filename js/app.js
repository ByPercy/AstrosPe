import * as THREE from "three"; // <-- 1. ¡Faltaba importar THREE aquí!
import { EarthScene } from "./main.js";
import { getClimateData } from "./api.js";
import { sonificarCoordenadas } from "./audio.js";
import { translations } from "./idioma.js"; // <-- Importamos el diccionario correctamente

// Forzar la carga de voces en Chrome y Edge al iniciar la app
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

export function speakMessage(text, lang = 'es-ES') {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // Cancela locuciones anteriores
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0;   // Velocidad natural
    utterance.pitch = 0.95; // Tono ligeramente más cálido y profesional

    // Obtenemos todas las voces del navegador
    const voices = window.speechSynthesis.getVoices();
    
    // 🌟 FILTRO PRO: Buscamos específicamente voces "Neural", "Natural", "Google" o "Microsoft" en español
    const bestVoice = voices.find(v => 
      v.lang.startsWith('es') && 
      (v.name.includes('Neural') || v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Microsoft'))
    ) || voices.find(v => v.lang.startsWith('es')); // Respaldo a cualquier voz en español

    if (bestVoice) {
      utterance.voice = bestVoice;
      console.log("🎙️ Usando voz IA/Neural de alta calidad:", bestVoice.name);
    }

    window.speechSynthesis.speak(utterance);
  } else {
    console.warn("Tu navegador no soporta síntesis de voz.");
  }
}

export class AppController {
  constructor() {
    this.earth = new EarthScene("canvas-container");
    this.currentLang = "es"; // <-- Asegúrate de tener esto aquí
  }

  changeLanguage(lang) {
    this.currentLang = lang; // <-- Y esto aquí para que guarde el idioma
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
        const zone = clickedMarker.userData; // Recuperamos { name, lat, lon, historicalAvg, impactKey }

        console.log("-->¡Clic detectado en zona:", zone.name);

        // 3. Llamamos a nuestra función dedicada selectZone
        await this.selectZone(zone);
      }
    });
  }

  // NUEVA FUNCIÓN DEDICADA PARA GESTIONAR LA SELECCIÓN DE ZONA Y DATOS CLIMÁTICOS
  async selectZone(zone) {
    // 1. Abrir y llenar el panel HUD básico
    document.getElementById("info-panel").classList.remove("hidden");
    document.getElementById("panel-title").innerText = zone.name;
    document.getElementById("panel-coords").innerText = `Lat: ${zone.lat}, Lon: ${zone.lon}`;

    // 2. Calcular y mostrar la hora local
    const horaLocal = this.getLocalTime(zone.lon);
    const panelTimeEl = document.getElementById("panel-time");
    if (panelTimeEl) panelTimeEl.innerText = `🕒 ${horaLocal}`;

    // 3. Consultar los grados de la NASA automáticamente al abrir la zona
    const panelTempEl = document.getElementById("panel-temp");
    if (panelTempEl) panelTempEl.innerText = "🌡️ Cargando datos...";

    // Limpiamos la anomalía e impacto mientras carga
    const anomalyElement = document.getElementById("panel-anomaly");
    if (anomalyElement) anomalyElement.innerText = "";
    
    const typedTextEl = document.getElementById("typed-text");
    if (typedTextEl) typedTextEl.innerText = "Conectando con la NASA POWER API...";
    
    // 🌟 ACCESIBILIDAD INMEDIATA: Habla al instante del clic del usuario (evita bloqueo del navegador)
    speakMessage(`Zona seleccionada: ${zone.name}. Consultando datos satelitales de la NASA.`, this.currentLang === 'es' ? 'es-ES' : 'en-US');

    let tempActual = 25; 

    getClimateData(zone.lat, zone.lon).then(climateData => {
      if (climateData && climateData.length > 0) {
        tempActual = climateData[climateData.length - 1]; // Asignamos el valor real
        if (panelTempEl) panelTempEl.innerText = `🌡️ ${tempActual} °C`;

        // Cálculo de la anomalía térmica
        if (zone.historicalAvg !== undefined) {
          const anomaly = (tempActual - zone.historicalAvg).toFixed(1);
          const anomalySign = anomaly > 0 ? `+${anomaly}` : anomaly;
          if (anomalyElement) {
            anomalyElement.innerText = `${anomalySign} °C vs hist.`;
            anomalyElement.style.color = anomaly > 0 ? '#ff3366' : '#00ffff';
          }
        }

        // Mensaje directo DENTRO de #typed-text
        let textoImpacto = `Análisis completado para coordenadas (${zone.lat}, ${zone.lon}).`;
        if (zone.impactKey && translations[this.currentLang] && translations[this.currentLang][zone.impactKey]) {
          textoImpacto = translations[this.currentLang][zone.impactKey];
        }
        if (typedTextEl) typedTextEl.innerText = textoImpacto;

      } else {
        if (panelTempEl) panelTempEl.innerText = "🌡️ Datos no disponibles";
        if (typedTextEl) typedTextEl.innerText = "Error: No se pudieron recuperar los registros climáticos.";
      }
    });

    // 4. Configurar el botón de reproducir audio (Sonificación y lectura completa)
    const btnPlay = document.getElementById("btn-play-zone");
    if (btnPlay) {
      btnPlay.onclick = () => {
        console.log(`🎵 Sonificando coordenadas de ${zone.name}...` );
        
        // Reproduce el sintetizador espacial
        sonificarCoordenadas(zone.lat, zone.lon, tempActual);

        // Lee los datos climáticos completos en voz alta al hacer clic en el botón de audio
        const mensajeCompleto = `Región: ${zone.name}. Temperatura actual monitoreada: ${tempActual} grados Celsius.`;
        speakMessage(mensajeCompleto, this.currentLang === 'es' ? 'es-ES' : 'en-US');
      };
    }
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

