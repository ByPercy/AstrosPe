let audioContext = null;

function getAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
}

function digitoANota(digito) {
  const notas = {
    0: 196.00,
    1: 220.00,
    2: 261.63,
    3: 293.66,
    4: 329.63,
    5: 392.00,
    6: 440.00,
    7: 523.25,
    8: 587.33,
    9: 659.25
  };
  return notas[digito] || 261.63;
}

// 🌟 Sistema de 3 identidades sonoras según el clima
function sonarDigito(digito, tiempoInicio, duracion = 0.35, categoria = 'medio') {
  const ctx = getAudio();
  const oscilador = ctx.createOscillator();
  const volumen = ctx.createGain();

  // Configuración de onda según la categoría climática
  if (categoria === 'bajo') {
    oscilador.type = "sine"; // Cristalino, puro, frío
    oscilador.frequency.value = digitoANota(digito) * 1.15;
  } else if (categoria === 'alto') {
    oscilador.type = "sawtooth"; // Tenso, metálico, calor extremo
    oscilador.frequency.value = digitoANota(digito) * 0.9;
  } else {
    oscilador.type = "triangle"; // Equilibrado / Medio
    oscilador.frequency.value = digitoANota(digito);
  }

  volumen.gain.setValueAtTime(0, tiempoInicio);
  volumen.gain.linearRampToValueAtTime(categoria === 'alto' ? 0.4 : 0.3, tiempoInicio + 0.05);
  volumen.gain.exponentialRampToValueAtTime(0.001, tiempoInicio + duracion);

  oscilador.connect(volumen);
  volumen.connect(ctx.destination);

  oscilador.start(tiempoInicio);
  oscilador.stop(tiempoInicio + duracion);

  // 🔴 EFECTO EXTRA PARA CLIMA ALTO: Sub-bajo profundo de alerta
  if (categoria === 'alto') {
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = "triangle";
    subOsc.frequency.value = 55; // Frecuencia grave tensa
    subGain.gain.setValueAtTime(0, tiempoInicio);
    subGain.gain.linearRampToValueAtTime(0.4, tiempoInicio + 0.05);
    subGain.gain.exponentialRampToValueAtTime(0.001, tiempoInicio + duracion);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(tiempoInicio);
    subOsc.stop(tiempoInicio + duracion);
  }

  // 🔵 EFECTO EXTRA PARA CLIMA BAJO: Armónico cristalino superior
  if (categoria === 'bajo') {
    const highOsc = ctx.createOscillator();
    const highGain = ctx.createGain();
    highOsc.type = "sine";
    highOsc.frequency.value = digitoANota(digito) * 2;
    highGain.gain.setValueAtTime(0, tiempoInicio);
    highGain.gain.linearRampToValueAtTime(0.12, tiempoInicio + 0.05);
    highGain.gain.exponentialRampToValueAtTime(0.001, tiempoInicio + duracion * 0.7);
    highOsc.connect(highGain);
    highGain.connect(ctx.destination);
    highOsc.start(tiempoInicio);
    highOsc.stop(tiempoInicio + duracion * 0.7);
  }
}

export function sonificarCoordenadas(lat, lon, temperatura = 20) {
  const ctx = getAudio();
  let tiempo = ctx.currentTime + 0.1;

  // Clasificamos automáticamente el clima en 3 niveles
  let categoria = 'medio';
  if (temperatura < 15) {
    categoria = 'bajo';     // Frío
  } else if (temperatura > 28) {
    categoria = 'alto';     // Calor / Alerta
  }

  const digitosLat = String(lat).replace("-", "").replace(".", "").split("").map(Number);
  const digitosLon = String(lon).replace("-", "").replace(".", "").split("").map(Number);

  digitosLat.forEach((digito) => {
    sonarDigito(digito, tiempo, 0.35, categoria);
    tiempo += 0.4;
  });

  tiempo += 0.8;

  digitosLon.forEach((digito) => {
    sonarDigito(digito, tiempo, 0.35, categoria);
    tiempo += 0.4;
  });
}