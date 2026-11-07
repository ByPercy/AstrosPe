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

    function sonarDigito(digito, tiempoInicio, duracion = 0.35) {
    const ctx = getAudio();
    const oscilador = ctx.createOscillator();
    const volumen = ctx.createGain();

    oscilador.type = "sine";
    oscilador.frequency.value = digitoANota(digito);

    volumen.gain.setValueAtTime(0, tiempoInicio);
    volumen.gain.linearRampToValueAtTime(0.3, tiempoInicio + 0.05);
    volumen.gain.exponentialRampToValueAtTime(0.001, tiempoInicio + duracion);

    oscilador.connect(volumen);
    volumen.connect(ctx.destination);

    oscilador.start(tiempoInicio);
    oscilador.stop(tiempoInicio + duracion);
    }

    export function sonificarCoordenadas(lat, lon) {
    const ctx = getAudio();
    let tiempo = ctx.currentTime + 0.1;

    const digitosLat = String(lat).replace("-", "").replace(".", "").split("").map(Number);
    const digitosLon = String(lon).replace("-", "").replace(".", "").split("").map(Number);

    digitosLat.forEach((digito) => {
        sonarDigito(digito, tiempo);
        tiempo += 0.4;
    });

    tiempo += 0.8;

    digitosLon.forEach((digito) => {
        sonarDigito(digito, tiempo);
        tiempo += 0.4;
    });
    }

    export function sonificarTemperaturas(temperaturasArray) {
    const ctx = getAudio();
    let tiempo = ctx.currentTime + 0.1;

    temperaturasArray.forEach((temp) => {
        const digitos = String(temp).replace("-", "").replace(".", "").split("").map(Number);
        digitos.forEach((digito) => {
        sonarDigito(digito, tiempo);
        tiempo += 0.4;
        });
        tiempo += 0.6;
    });
    }