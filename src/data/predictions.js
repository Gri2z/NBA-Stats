// Repositorio de pronósticos personales de NBA Stats.
//
// IMPORTANTE: el sistema de creación y guardado de pronósticos todavía no está
// implementado. El array permanece vacío a propósito: no se muestran datos
// ficticios. Cuando exista el sistema, habrá que rellenar este array (o
// sustituirlo por la fuente real) respetando la forma de cada pronóstico:
//
// {
//   id: 'p-1',                    // identificador único
//   gameId: '401910015',          // id del partido en la API de ESPN
//   date: '2026-11-19',           // fecha del partido (YYYY-MM-DD, hora española)
//   away: 'Boston Celtics',       // equipo visitante
//   home: 'Denver Nuggets',       // equipo local
//   pickedWinner: '...',          // equipo elegido como ganador
//   result: 'pending',            // 'pending' | 'win' | 'loss'
// }
//
// 'result' pasa a 'win' o 'loss' cuando el partido termina y se compara el
// ganador real con el equipo elegido; hasta entonces queda en 'pending'
// (se muestra como "Pendiente" en la página de Historial).

export const predictions = []

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

// Agrupa los pronósticos por fecha (de la más reciente a la más antigua) y
// calcula el resumen diario: aciertos, fallos y pendientes.
export function groupPredictionsByDate(list = predictions) {
  const byDate = new Map()

  for (const prediction of list) {
    const items = byDate.get(prediction.date)
    if (items) {
      items.push(prediction)
    } else {
      byDate.set(prediction.date, [prediction])
    }
  }

  return [...byDate.entries()]
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .map(([date, items]) => ({
      date,
      items,
      count: items.length,
      wins: items.filter((item) => item.result === 'win').length,
      losses: items.filter((item) => item.result === 'loss').length,
      pending: items.filter((item) => item.result === 'pending').length,
    }))
}

// Fecha legible en español: "jueves, 19 de noviembre de 2026".
export function formatDayLabel(date) {
  return DAY_LABEL_FORMATTER.format(new Date(`${date}T12:00:00`))
}
