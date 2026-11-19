// Probabilidades de ganar por partido.
//
// Investigación (NBA Stats v1.1): se buscó una fuente pública y autorizada
// con las probabilidades que muestra Google en sus resultados de búsqueda
// ("win probability" de cada partido). Conclusiones:
//
// - Google no publica ninguna API (ni en developers.google.com ni en sus
//   blogs de desarrolladores) que exponga esas probabilidades: los datos
//   muestran en la tarjeta de resultados de Search proceden de socios con
//   licencia y no hay endpoint documentado ni autorizado para terceros.
// - Extraerlas automáticamente de la página de Google sería scraping y
//   incumpliría sus condiciones de servicio; además existen servicios de
//   pago que lo hacen (SerpAPI, etc.), que quedan fuera de lo permitido.
// - ESPN sí ofrece apuestas (odds de DraftKings) en su API, pero son cuotas
//   de casas de apuestas, no probabilidades de Google, y no procede
//   atribuirlas a Google ni calcular probabilidades propias todavía.
//
// Por tanto, hasta que exista una fuente autorizada conectable, la
// función devuelve `null` y la interfaz muestra "—%" sin datos inventados.
//
// Cuando haya una fuente real, basta con devolver aquí los porcentajes:
//
//   { away: 47.3, home: 52.7, source: '...' }
//
// (porcentajes que suman 100, del equipo visitante y del local) y la
// tarjeta de partidos los pintará automáticamente con la barra proporcional.

/**
 * Porcentajes de victoria de un partido.
 * @param {string} _gameId id del partido en la API de ESPN
 * @returns {{ away: number, home: number, source: string } | null}
 */
export function getWinProbability(_gameId) {
  return null
}
