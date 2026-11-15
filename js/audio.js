// js/audio.js - Motor de sonificación con 3 beats rítmicos distintos según el semáforo climático

let audioContext = null;
let activeNodes = [];

function getAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
}


export function detenerSonificacion() {
  activeNodes.forEach((node) => {
    try {
      node.stop();
      node.disconnect();
    } catch (_) {}
  });
  activeNodes = [];
}

function digitoANota(digito, modo = "normal") {
  // Escala mayor armónica para Verde/Amarillo; escala menor tensa para Rojo
  const notasNormales = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];
  const notasAlerta   = [146.83, 155.56, 174.61, 196.00, 207.65, 233.08, 261.63, 293.66, 311.13, 349.23];
  return (modo === "critical" ? notasAlerta : notasNormales)[digito] || 261.63;
}

// 🥁 Sintetizador de bombo (Kick) para el beat de alerta roja
function tocarBombo(ctx, tiempo) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, tiempo);
  osc.frequency.exponentialRampToValueAtTime(42, tiempo + 0.14);

  gain.gain.setValueAtTime(0.55, tiempo);
  gain.gain.exponentialRampToValueAtTime(0.001, tiempo + 0.16);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(tiempo);
  osc.stop(tiempo + 0.16);
  activeNodes.push(osc);
}

// 🥢 Sintetizador de platillo (Hi-Hat) con ruido blanco
function tocarPlatillo(ctx, tiempo) {
  const bufferSize = ctx.sampleRate * 0.05;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 6500;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.18, tiempo);
  gain.gain.exponentialRampToValueAtTime(0.001, tiempo + 0.05);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(tiempo);
  noise.stop(tiempo + 0.05);
  activeNodes.push(noise);
}

function sonarPaso(ctx, digito, tiempo, estadoAlerta, index) {
  const freq = digitoANota(digito, estadoAlerta);

  if (estadoAlerta === "critical") {
    // 🔴 ROJO: Beat de emergencia (Bombo en pares, platillo en impares + sinte con caída de tono)
    if (index % 2 === 0) {
      tocarBombo(ctx, tiempo);
    } else {
      tocarPlatillo(ctx, tiempo);
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq * 1.15, tiempo);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.85, tiempo + 0.18); // Efecto sirena/tensión

    gain.gain.setValueAtTime(0.26, tiempo);
    gain.gain.exponentialRampToValueAtTime(0.001, tiempo + 0.19);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(tiempo);
    osc.stop(tiempo + 0.19);
    activeNodes.push(osc);

  } else if (estadoAlerta === "warning") {
    // 🟡 AMARILLO: Beat de radar/sonar (doble pulso "bip-bip" sincopado)
    [0, 0.12].forEach((offset, pulso) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(pulso === 0 ? freq : freq * 1.25, tiempo + offset);

      gain.gain.setValueAtTime(0.25, tiempo + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, tiempo + offset + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(tiempo + offset);
      osc.stop(tiempo + offset + 0.09);
      activeNodes.push(osc);
    });

  } else {
    // 🟢 VERDE: Beat ambiental relajado con acorde armónico suave
    const osc = ctx.createOscillator();
    const armonico = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, tiempo);

    armonico.type = "sine";
    armonico.frequency.setValueAtTime(freq * 1.5, tiempo); // Quinta justa dulce

    gain.gain.setValueAtTime(0, tiempo);
    gain.gain.linearRampToValueAtTime(0.22, tiempo + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, tiempo + 0.38);

    osc.connect(gain);
    armonico.connect(gain);
    gain.connect(ctx.destination);

    osc.start(tiempo);
    osc.stop(tiempo + 0.38);
    armonico.start(tiempo);
    armonico.stop(tiempo + 0.38);
    activeNodes.push(osc, armonico);
  }
}

// Convierte cada temperatura real (-45°C a +45°C) en una frecuencia musical (180 Hz a 820 Hz)
function tempAFrecuencia(temp) {
  const clamped = Math.max(-45, Math.min(45, temp));
  return 180 + ((clamped + 45) / 90) * 640;
}

export function sonificarCoordenadas(lat, lon, historialTemps = [], anomaly = 0) {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  detenerSonificacion();
  const ctx = getAudio();
  let tiempo = ctx.currentTime + 0.05;

  const absDiff = Math.abs(anomaly);
  let estadoAlerta = "normal";
  let paso = 0.42;

  if (absDiff > 4.5) {
    estadoAlerta = "critical";
    paso = 0.21;
  } else if (absDiff > 2.0) {
    estadoAlerta = "warning";
    paso = 0.32;
  }

  // Si llegó el arreglo de 7 días de la NASA, sonifica la evolución real de la semana
  if (Array.isArray(historialTemps) && historialTemps.length > 0) {
    console.log(`🎵 Sonificando 7 días NASA [${estadoAlerta.toUpperCase()}]:`, historialTemps);
    historialTemps.forEach((temp, i) => {
      // Mapeamos la temperatura a un índice 0-9 para reutilizar tu sonarPaso
      const indiceEscala = Math.max(0, Math.min(9, Math.round(((temp + 40) / 85) * 9)));
      sonarPaso(ctx, indiceEscala, tiempo, estadoAlerta, i);
      tiempo += paso;
    });
    return;
  }

  // Respaldo: si no hay arreglo de días, sonifica los dígitos de latitud y longitud
  const digitosLat = String(Number(lat).toFixed(2)).replace("-", "").replace(".", "").split("").map(Number);
  const digitosLon = String(Number(lon).toFixed(2)).replace("-", "").replace(".", "").split("").map(Number);

  digitosLat.forEach((digito, i) => {
    sonarPaso(ctx, digito, tiempo, estadoAlerta, i);
    tiempo += paso;
  });

  tiempo += estadoAlerta === "critical" ? 0.30 : 0.60;

  digitosLon.forEach((digito, i) => {
    sonarPaso(ctx, digito, tiempo, estadoAlerta, i);
    tiempo += paso;
  });
}