//no tocar archivo, estamos en proceso de conseguir las apis de la nasa como informacion planetario geografico y climatico
// js/api.js - El especialista en datos climáticos de la NASA
// js/api.js - Consulta rápida (7 días recientes + promedio histórico real del mes)

// js/api.js - Consulta temperatura reciente y climatología histórica real de la NASA

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function formatDateYYYYMMDD(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export async function getClimateData(lat, lon) {
  try {
    // Calculamos una ventana reciente segura (de hace 10 días a hace 4 días)
    // para evitar el desfase de 2-5 días que tiene el satélite al publicar datos
    const endDate = new Date();
    endDate.setUTCDate(endDate.getUTCDate() - 4);

    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - 10);

    const startStr = formatDateYYYYMMDD(startDate);
    const endStr = formatDateYYYYMMDD(endDate);
    const currentMonthKey = MONTHS[endDate.getUTCMonth()]; // Ej: "NOV"

    const dailyUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M&community=RE&longitude=${lon}&latitude=${lat}&start=${startStr}&end=${endStr}&format=JSON`;
    const climUrl = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M&community=RE&longitude=${lon}&latitude=${lat}&format=JSON`;

    const [dailyRes, climRes] = await Promise.all([
      fetch(dailyUrl),
      fetch(climUrl)
    ]);

    if (!dailyRes.ok || !climRes.ok) {
      throw new Error("Error en la respuesta de NASA POWER API");
    }

    const [dailyData, climData] = await Promise.all([
      dailyRes.json(),
      climRes.json()
    ]);

    // Filtramos valores válidos (la NASA usa -999 cuando falta un dato)
    const rawTemps = Object.values(dailyData.properties.parameter.T2M);
    const validTemps = rawTemps.filter((val) => typeof val === "number" && val > -900);

    if (!validTemps.length) return null;

    const currentTemp = validTemps[validTemps.length - 1];
    const historicalAvg = climData.properties.parameter.T2M[currentMonthKey];

    return {
      currentTemp,
      historicalAvg,
      month: currentMonthKey,
      temperatures: validTemps
    };
  } catch (error) {
    console.error("❌ Falló la conexión con la API de la NASA:", error);
    return null;
  }
}