import * as THREE from "three";
import { EarthScene } from "./main.js";
import { getClimateData } from "./api.js";
import { sonificarCoordenadas, detenerSonificacion } from "./audio.js";
import { translations } from "./idioma.js";

// Forzar la carga de voces en Chrome y Edge al iniciar la app
if ("speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

export function speakMessage(text, lang = "es-ES") {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const langPrefix = lang.slice(0, 2).toLowerCase();
  const cleanText = text
    .replace(/°C/g, langPrefix === "es" ? " grados Celsius" : " degrees Celsius")
    .replace(/-(\d)/g, langPrefix === "es" ? "menos $1" : "minus $1");

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = lang;
  utterance.rate = 0.96;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const langVoices = voices.filter((v) =>
    v.lang.toLowerCase().startsWith(langPrefix)
  );

  const bestVoice =
    langVoices.find((v) => /Natural|Neural|Online/i.test(v.name)) ||
    langVoices.find((v) => /Google/i.test(v.name)) ||
    langVoices.find((v) => !v.localService) ||
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
    this.activeZoneId = null;
    this.started = false;
    this.introAudio = null;
    this.introPlayed = false;
    this._unlockAudioHandler = null;

    this.earth.init();
    this.setupKeyboardAccessibility();
  }

  changeLanguage(lang) {
    this.currentLang = lang;
    const elements = document.querySelectorAll("[data-i18n]");
    elements.forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (translations[lang] && translations[lang][key]) {
        el.innerText = translations[lang][key];
      }
    });

    // Si seguimos en la pantalla inicial, reinicia el MP3 de bienvenida en el nuevo idioma
    const introScreen = document.getElementById("intro-screen");
    if (introScreen && !introScreen.classList.contains("fade-out")) {
      this.stopIntroAudio();
      this.introPlayed = false;
      this.playIntroAudio();
    }
  }

  playIntroAudio() {
    if (this.introPlayed) return;

    const src =
      this.currentLang === "es"
        ? "./assets/Audio/Español.mp3"
        : "./assets/Audio/English.mp3";
    this.stopIntroAudio();
    this.introAudio = new Audio(src);
    this.introAudio.volume = 0.9;

    this.introAudio
      .play()
      .then(() => {
        this.introPlayed = true;
      })
      .catch(() => {
        this._unlockAudioHandler = (e) => {
          // Si hizo clic en "Viajar a la Tierra" o presionó Enter, no disparamos el intro
          if (e.target?.closest?.("#btn-enter") || e.key === "Enter") return;
          if (!this.introPlayed) {
            this.playIntroAudio();
          }
        };
        window.addEventListener("click", this._unlockAudioHandler, { once: true });
        window.addEventListener("keydown", this._unlockAudioHandler, { once: true });
      });
  }

  stopIntroAudio() {
    if (this._unlockAudioHandler) {
      window.removeEventListener("click", this._unlockAudioHandler);
      window.removeEventListener("keydown", this._unlockAudioHandler);
      this._unlockAudioHandler = null;
    }
    if (this.introAudio) {
      this.introAudio.pause();
      this.introAudio.currentTime = 0;
      this.introAudio = null;
    }
  }

  async startMission() {
    if (this.started) return;
    this.started = true;
    
    //CORTA EL AUDIO DE BIENVENIDA SI ESTÁ SONANDO
    this.introPlayed = true;
    this.stopIntroAudio();

    const userGeo = await getUserLocationAndUTC();

    const hudLocal = document.getElementById("hud-time-local");
    const hudUtc = document.getElementById("hud-time-utc");

    if (hudLocal) hudLocal.innerText = `Local: ${userGeo.localTime}`;
    if (hudUtc) hudUtc.innerText = `UTC: ${userGeo.utcTime}`;

    this.evaluateAllZones();

    window.appZones = this.earth.zones;

    this.earth.zoomIn();

    document.getElementById("intro-screen").classList.add("fade-out");
    document.getElementById("hud-overlay").classList.remove("hidden");

    this.setupInteractions();

    document.getElementById("btn-close-panel").addEventListener("click", () => {
      document.getElementById("info-panel").classList.add("hidden");
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      detenerSonificacion();
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

  getLocalTime(lon) {
    const totalMinutesOffset = lon * 4;
    const now = new Date();
    const utcMinutes =
      now.getUTCHours() * 60 + now.getUTCMinutes() + totalMinutesOffset;
    let localMinutes = ((utcMinutes % 1440) + 1440) % 1440;
    const hours = Math.floor(localMinutes / 60);
    const minutes = Math.floor(localMinutes % 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  setupInteractions() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    window.addEventListener("click", async (event) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, this.earth.camera);

      const intersects = raycaster.intersectObjects(
        this.earth.markerGroup.children
      );

      if (intersects.length > 0) {
        const clickedMarker = intersects[0].object;
        const zone = clickedMarker.userData;
        console.log("-->¡Clic detectado en zona:", zone.name);
        await this.selectZone(zone);
      }
    });
  }

  setupKeyboardAccessibility() {
    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT") return;

      const key = e.key.toLowerCase();
      const langCode = this.currentLang === "es" ? "es-ES" : "en-US";
      const introScreen = document.getElementById("intro-screen");
      const isIntroVisible =
        introScreen && !introScreen.classList.contains("fade-out");

      if (isIntroVisible) {
        if (key === "enter") {
          e.preventDefault();
          this.startMission();
          return;
        }
        // Permite cambiar de idioma (I) o silenciar (X) también en la pantalla inicial
        if (key !== "i" && key !== "x" && key !== "h") {
          return;
        }
      }

      const index = parseInt(e.key, 10) - 1;
      if (index >= 0 && index < this.earth.zones.length) {
        e.preventDefault();
        this.selectZone(this.earth.zones[index]);
        return;
      }

      switch (key) {
        case "s": {
          e.preventDefault();
          const btnPlay = document.getElementById("btn-play-zone");
          if (
            btnPlay &&
            !document.getElementById("info-panel").classList.contains("hidden")
          ) {
            btnPlay.click();
          }
          break;
        }

        case "x":
          e.preventDefault();
          this.stopIntroAudio();
          if ("speechSynthesis" in window) window.speechSynthesis.cancel();
          detenerSonificacion();
          break;

        case "i": {
          e.preventDefault();
          const nextLang = this.currentLang === "es" ? "en" : "es";
          document.getElementById("lang-select").value = nextLang;
          this.changeLanguage(nextLang);

          // Solo usa voz sintética dentro del globo (en la portada suena el MP3)
          if (!isIntroVisible) {
            speakMessage(
              nextLang === "es"
                ? "Idioma cambiado a español."
                : "Language changed to English.",
              nextLang === "es" ? "es-ES" : "en-US"
            );
          }
          break;
        }

        case "h": {
          e.preventDefault();
          this.stopIntroAudio();
          detenerSonificacion();

          // En la pantalla inicial repite el MP3 de bienvenida con los controles
          if (isIntroVisible) {
            this.introPlayed = false;
            this.playIntroAudio();
            return;
          }

          const ayuda =
            this.currentLang === "es"
              ? "Controles: números del 1 al 9 para elegir zona. Tecla S para escuchar la sonificación del clima. Tecla I para cambiar idioma. Tecla X para silenciar. Escape para cerrar el panel."
              : "Controls: numbers 1 to 9 to select a zone. Key S to play climate sonification. Key I to switch language. Key X to mute. Escape to close the panel.";
          speakMessage(ayuda, langCode);
          break;
        }

        case "escape":
          e.preventDefault();
          document.getElementById("info-panel").classList.add("hidden");
          if ("speechSynthesis" in window) window.speechSynthesis.cancel();
          detenerSonificacion();
          break;
      }
    });
  }

  async selectZone(zone) {
    this.activeZoneId = zone.id;

    document.getElementById("info-panel").classList.remove("hidden");
    document.getElementById("panel-title").innerText = zone.name;
    document.getElementById(
      "panel-coords"
    ).innerText = `Lat: ${zone.lat}, Lon: ${zone.lon}`;

    const horaLocal = this.getLocalTime(zone.lon);
    const panelTimeEl = document.getElementById("panel-time");
    if (panelTimeEl) panelTimeEl.innerText = `🕒 ${horaLocal}`;

    const panelTempEl = document.getElementById("panel-temp");
    if (panelTempEl) panelTempEl.innerText = "🌡️ Cargando datos...";

    const anomalyElement = document.getElementById("panel-anomaly");
    if (anomalyElement) anomalyElement.innerText = "";

    const typedTextEl = document.getElementById("typed-text");
    if (typedTextEl)
      typedTextEl.innerText = "Conectando con la NASA POWER API...";

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    detenerSonificacion();

    let tempActual = 25;
    let historialActual = [25];
    let diffActual = 0;

    // Único manejador limpio del botón Play / tecla S
    const btnPlay = document.getElementById("btn-play-zone");
    if (btnPlay) {
      btnPlay.onclick = () => {
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
        console.log(
          `🎵 Sonificando 7 días de ${zone.name}...`,
          historialActual,
          "Diff:",
          diffActual
        );
        sonificarCoordenadas(zone.lat, zone.lon, historialActual, diffActual);
      };
    }

    getClimateData(zone.lat, zone.lon).then((climateData) => {
      if (this.activeZoneId !== zone.id) return;

      const tempVal = Array.isArray(climateData)
        ? climateData[climateData.length - 1]
        : climateData?.currentTemp;

      if (climateData && tempVal !== undefined) {
        tempActual = Number(tempVal);

        // Detecta automáticamente si climateData incluye el arreglo de 7 días
        const diasArray = Array.isArray(climateData)
          ? climateData
          : Object.values(climateData).find(
              (v) => Array.isArray(v) && v.length > 1
            );

        historialActual = diasArray || [];

        if (panelTempEl)
          panelTempEl.innerText = `🌡️ ${tempActual.toFixed(1)} °C`;

        const histAvg = climateData.historicalAvg ?? zone.historicalAvg;
        if (histAvg !== undefined) {
          diffActual = Number((tempActual - histAvg).toFixed(1));
          const anomalySign = diffActual > 0 ? `+${diffActual}` : diffActual;

          this.earth.updateMarkerClimateColor(zone.id, diffActual);

          if (anomalyElement) {
            anomalyElement.innerText = `${anomalySign} °C vs hist.`;
            const absDiff = Math.abs(diffActual);
            anomalyElement.style.color =
              absDiff > 4.5 ? "#ff2244" : absDiff > 2.0 ? "#ffcc00" : "#00ff66";
          }
        }

        let textoImpacto =
          this.currentLang === "es"
            ? `Análisis completado para coordenadas (${zone.lat}, ${zone.lon}).`
            : `Analysis completed for coordinates (${zone.lat}, ${zone.lon}).`;

        if (
          zone.impactKey &&
          translations[this.currentLang] &&
          translations[this.currentLang][zone.impactKey]
        ) {
          textoImpacto = translations[this.currentLang][zone.impactKey];
        }
        if (typedTextEl) typedTextEl.innerText = textoImpacto;

        const langCode = this.currentLang === "es" ? "es-ES" : "en-US";
        const mensajeAccesible =
          this.currentLang === "es"
            ? `Zona seleccionada: ${zone.name}. Temperatura actual: ${tempActual.toFixed(1)} grados Celsius. ${textoImpacto}`
            : `Selected zone: ${zone.name}. Current temperature: ${tempActual.toFixed(1)} degrees Celsius. ${textoImpacto}`;

        speakMessage(mensajeAccesible, langCode);
      } else {
        if (panelTempEl) panelTempEl.innerText = "🌡️ Datos no disponibles";
        if (typedTextEl)
          typedTextEl.innerText =
            "Error: No se pudieron recuperar los registros climáticos.";
      }
    });
  }
}

const app = new AppController();

document.getElementById("lang-select").addEventListener("change", (event) => {
  const selectedLang = event.target.value;
  app.changeLanguage(selectedLang);
  console.log("🌐 Idioma cambiado a:", selectedLang);
});

function getUserLocationAndUTC() {
  return new Promise((resolve) => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;

          const now = new Date();
          const utcHours = String(now.getUTCHours()).padStart(2, "0");
          const utcMinutes = String(now.getUTCMinutes()).padStart(2, "0");
          const localHours = String(now.getHours()).padStart(2, "0");
          const localMinutes = String(now.getMinutes()).padStart(2, "0");

          resolve({
            localTime: `${localHours}:${localMinutes}`,
            utcTime: `${utcHours}:${utcMinutes}`,
            lat: lat,
            lon: lon,
            success: true,
          });
        },
        (error) => {
          console.warn(
            "⚠️ Permiso denegado o error de ubicación:",
            error.message
          );

          const now = new Date();
          const utcHours = String(now.getUTCHours()).padStart(2, "0");
          const utcMinutes = String(now.getUTCMinutes()).padStart(2, "0");
          const localHours = String(now.getHours()).padStart(2, "0");
          const localMinutes = String(now.getMinutes()).padStart(2, "0");

          resolve({
            localTime: `${localHours}:${localMinutes}`,
            utcTime: `${utcHours}:${utcMinutes}`,
            lat: -12.0464,
            lon: -77.0428,
            success: false,
          });
        },
        { timeout: 8000 }
      );
    } else {
      resolve({ localTime: "--:--", utcTime: "--:--", success: false });
    }
  });
}

document.getElementById("btn-enter").addEventListener("click", () => {
  app.startMission();
});

document.getElementById("btn-abort").addEventListener("click", () => {
  location.reload();
});

window.addEventListener("DOMContentLoaded", () => {
  app.playIntroAudio();
});