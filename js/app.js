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
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();

  // Limpiamos el texto para que se pronuncie con pausas naturales y lea bien los negativos
  const langPrefix = lang.slice(0, 2).toLowerCase();
  const cleanText = text
    .replace(/°C/g, langPrefix === 'es' ? ' grados Celsius' : ' degrees Celsius')
    .replace(/-(\d)/g, langPrefix === 'es' ? 'menos $1' : 'minus $1');

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = lang;
  utterance.rate = 0.96; // Ligeramente más pausado para mayor claridad
  utterance.pitch = 1.0; // Tono natural sin distorsión

  const voices = window.speechSynthesis.getVoices();
  const langVoices = voices.filter(v => v.lang.toLowerCase().startsWith(langPrefix));

  // Priorizamos de mejor a peor calidad:
  // 1. Voces Neuronales / Online (Edge / móviles)
  // 2. Voces de Google en la nube (Chrome oficial)
  // 3. Cualquier voz en la nube (!localService) antes que el sintetizador robótico del sistema
  const bestVoice =
    langVoices.find(v => /Natural|Neural|Online/i.test(v.name)) ||
    langVoices.find(v => /Google/i.test(v.name)) ||
    langVoices.find(v => !v.localService) ||
    langVoices[0];

  if (bestVoice) {
    utterance.voice = bestVoice;
  }

  window.speechSynthesis.speak(utterance);
}

export class AppController {
  constructor() {
    this.earth = new EarthScene("canvas-container");
    this.currentLang = "es";
    this.activeZoneId = null; // Evita que respuestas tardías de la API se crucen
    this.setupKeyboardAccessibility();
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

    this.evaluateAllZones(); // <-- Evalúa el clima de las 9 zonas al entrar

    window.appZones = this.earth.zones;

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

  evaluateAllZones() {
    this.earth.zones.forEach(async (zone) => {
      const data = await getClimateData(zone.lat, zone.lon);
      if (data && data.currentTemp !== undefined) {
        const histReal = data.historicalAvg ?? zone.historicalAvg;
        if (histReal !== undefined) {
          const diff = data.currentTemp - histReal;
          this.earth.updateMarkerClimateColor(zone.id, diff);
        }
      }
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

setupKeyboardAccessibility() {
    window.addEventListener("keydown", (e) => {
      // Ignoramos si el usuario está escribiendo o usando Ctrl/Alt
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT") return;

      const key = e.key.toLowerCase();
      const langCode = this.currentLang === "es" ? "es-ES" : "en-US";
      const introScreen = document.getElementById("intro-screen");
      const isIntroVisible = introScreen && !introScreen.classList.contains("fade-out");

      // 1. Si seguimos en la pantalla de portada, Enter inicia la misión
      if (isIntroVisible) {
        if (key === "enter") {
          e.preventDefault();
          this.startMission();
        }
        return;
      }

      // 2. Teclas 1 al 9: seleccionar directamente una de las 9 zonas
      const index = parseInt(e.key, 10) - 1;
      if (index >= 0 && index < this.earth.zones.length) {
        e.preventDefault();
        this.selectZone(this.earth.zones[index]);
        return;
      }

      // 3. Atajos de control rápido
      switch (key) {
        case "s": // Reproducir sonificación del clima de la zona abierta
          e.preventDefault();
          const btnPlay = document.getElementById("btn-play-zone");
          if (btnPlay && !document.getElementById("info-panel").classList.contains("hidden")) {
            btnPlay.click();
          }
          break;

        case "x": // Silenciar voz inmediatamente
          e.preventDefault();
          if ("speechSynthesis" in window) window.speechSynthesis.cancel();
          break;

        case "i": // Cambiar idioma (ES <-> EN)
          e.preventDefault();
          const nextLang = this.currentLang === "es" ? "en" : "es";
          document.getElementById("lang-select").value = nextLang;
          this.changeLanguage(nextLang);
          speakMessage(
            nextLang === "es" ? "Idioma cambiado a español." : "Language changed to English.",
            nextLang === "es" ? "es-ES" : "en-US"
          );
          break;

        case "h": // Ayuda de comandos por voz
          e.preventDefault();
          const ayuda = this.currentLang === "es"
            ? "Controles: números del 1 al 9 para elegir zona. Tecla S para escuchar la sonificación del clima. Tecla I para cambiar idioma. Tecla X para silenciar. Escape para cerrar el panel."
            : "Controls: numbers 1 to 9 to select a zone. Key S to play climate sonification. Key I to switch language. Key X to mute. Escape to close the panel.";
          speakMessage(ayuda, langCode);
          break;

        case "escape": // Cerrar el panel lateral
          e.preventDefault();
          document.getElementById("info-panel").classList.add("hidden");
          if ("speechSynthesis" in window) window.speechSynthesis.cancel();
          break;
      }
    });
  }

  // NUEVA FUNCIÓN DEDICADA PARA GESTIONAR LA SELECCIÓN DE ZONA Y DATOS CLIMÁTICOS
  async selectZone(zone) {

    this.activeZoneId = zone.id; // <-- ESTA LÍNEA ES OBLIGATORIA para que no se trabe
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

    // Callamos cualquier narración anterior si el usuario cambió rápido de zona
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    
    let tempActual = 25; 

    getClimateData(zone.lat, zone.lon).then((climateData) => {
      if (this.activeZoneId !== zone.id) return;

      if (climateData && climateData.currentTemp !== undefined) {
        tempActual = climateData.currentTemp;
        // Usa el promedio histórico real de la NASA (o el de main.js como respaldo)
        const histReal = climateData.historicalAvg ?? zone.historicalAvg;

        if (panelTempEl) panelTempEl.innerText = `🌡️ ${tempActual.toFixed(1)} °C`;

        // Cálculo de la anomalía térmica con datos reales del mes actual
        if (histReal !== undefined) {
          const diff = tempActual - histReal;
          const anomaly = diff.toFixed(1);
          const anomalySign = diff > 0 ? `+${anomaly}` : anomaly;

          this.earth.updateMarkerClimateColor(zone.id, diff);

          if (anomalyElement) {
            anomalyElement.innerText = `${anomalySign} °C vs hist. (${climateData.month})`;
            const absDiff = Math.abs(diff);
            anomalyElement.style.color =
              absDiff > 4.5 ? "#ff2244" : absDiff > 2.0 ? "#ffcc00" : "#00ff66";
          }
        }

        let textoImpacto = this.currentLang === 'es' 
          ? `Análisis completado para coordenadas (${zone.lat}, ${zone.lon}).` 
          : `Analysis completed for coordinates (${zone.lat}, ${zone.lon}).`;

        if (zone.impactKey && translations[this.currentLang] && translations[this.currentLang][zone.impactKey]) {
          textoImpacto = translations[this.currentLang][zone.impactKey];
        }
        if (typedTextEl) typedTextEl.innerText = textoImpacto;

        const langCode = this.currentLang === 'es' ? 'es-ES' : 'en-US';
        const mensajeAccesible = this.currentLang === 'es'
          ? `Zona seleccionada: ${zone.name}. Temperatura actual: ${tempActual} grados Celsius. ${textoImpacto}`
          : `Selected zone: ${zone.name}. Current temperature: ${tempActual} degrees Celsius. ${textoImpacto}`;

        speakMessage(mensajeAccesible, langCode);

      } else {
        if (panelTempEl) panelTempEl.innerText = "🌡️ Datos no disponibles";
        if (typedTextEl) typedTextEl.innerText = "Error: No se pudieron recuperar los registros climáticos.";
      }
    });

    // 4. Configurar el botón de reproducir audio (Sonificación y lectura bilingüe)
    const btnPlay = document.getElementById("btn-play-zone");
    if (btnPlay) {
      btnPlay.onclick = () => {
        // Si la voz estaba leyendo la descripción, la callamos para escuchar limpio el sonido del clima
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }

        console.log(`🎵 Sonificando coordenadas de ${zone.name}...` );
        sonificarCoordenadas(zone.lat, zone.lon, tempActual);
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

