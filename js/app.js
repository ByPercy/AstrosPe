import { EarthScene } from "./main.js";

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