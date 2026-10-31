//no tocar archivo, estamos en proceso de conseguir las apis de la nasa como informacion planetario geografico y climatico
// js/api.js - El especialista en datos climáticos de la NASA

export async function getClimateData(lat, lon) {
  try {
    // Usamos fechas de ejemplo recientes para pedir datos diarios de temperatura (T2M)
    const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M&community=RE&longitude=${lon}&latitude=${lat}&start=20260101&end=20260107&format=JSON`;

    console.log(`📡(waa) Consultando datos a la NASA para [Lat: ${lat}, Lon: ${lon}]...`);

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error en la red de la NASA: ${response.statusText}`);
    }

    const data = await response.json();

    // Extraemos el objeto con los valores diarios de temperatura
    const temperaturesObject = data.properties.parameter.T2M;

    // Convertimos ese objeto en un arreglo simple de números: [22.5, 23.1, 21.0, ...]
    const temperaturesArray = Object.values(temperaturesObject);

    console.log("✅ Datos numéricos obtenidos con éxito:", temperaturesArray);

    return temperaturesArray; // Esto es lo que luego le enviaremos al audio.js

  } catch (error) {
    console.error("❌ Falló la conexión con la API de la NASA:", error);
    return []; // Retornamos un arreglo vacío para que el sistema no se rompa
  }
}