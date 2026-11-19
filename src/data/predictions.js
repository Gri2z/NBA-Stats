// Almacén de pronósticos (elecciones de ganador) de NBA Stats.
//
// Las elecciones se guardan en el localStorage del navegador: no hay cuentas
// ni bases de datos, y solo están disponibles en el dispositivo donde se
// realizaron. Forma de cada pronóstico:
//
// {
//   id: '401910015',           // id real del partido en la API de ESPN
//   date: '2026-11-19',        // fecha del partido (YYYY-MM-DD, hora española)
//   away: 'Boston Celtics',    // equipo visitante
//   home: 'Denver Nuggets',    // equipo local
//   pickedSide: 'away',        // 'away' | 'home': equipo elegido
//   pickedWinner: '...',       // nombre del equipo elegido como ganador
//   result: 'pending',         // 'pending' | 'win' | 'loss'
// }
//
// 'result' pasa a 'win' o 'loss' cuando ESPN confirma el resultado final
// ('post') y se compara el ganador real con la elección; hasta entonces
// queda en 'pending' (se muestra como "Pendiente" en el Historial).

const STORAGE_KEY = 'nba-stats:picks'

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

// ---------- Lectura y escritura seguras ----------

function isValidPick(pick) {
  return (
    pick !== null &&
    typeof pick === 'object' &&
    typeof pick.id === 'string' &&
    typeof pick.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(pick.date) &&
    typeof pick.away === 'string' &&
    typeof pick.home === 'string' &&
    (pick.pickedSide === 'away' || pick.pickedSide === 'home') &&
    typeof pick.pickedWinner === 'string' &&
    (pick.result === 'pending' || pick.result === 'win' || pick.result === 'loss')
  )
}

export function loadPicks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidPick)
  } catch {
    return []
  }
}

function savePicks(picks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(picks))
  } catch {
    // Sin localStorage disponible (modo privado, cuota llena...): la elección
    // seguirá viva durante esta sesión, pero no se persistirá.
  }
}

// ---------- Elecciones ----------

// Crea o actualiza la elección de ganador para un partido. Solo se debe
// llamar mientras el partido está programado ('pre').
export function upsertPick(game, pickedSide) {
  const picks = loadPicks()
  const team = pickedSide === 'home' ? game.home : game.away
  const pick = {
    id: game.id,
    date: game.dateKey ?? game.date.slice(0, 10),
    away: game.away.name,
    home: game.home.name,
    pickedSide,
    pickedWinner: team.name,
    result: 'pending',
  }
  const next = [...picks.filter((item) => item.id !== game.id), pick]
  savePicks(next)
  return next
}

// ---------- Resolución de resultados con datos de ESPN ----------

// Resultado real de una elección según el partido devuelto por ESPN.
// Solo hay resultado cuando el partido está finalizado ('post').
function resolveResult(pick, game) {
  if (pick.result !== 'pending') return pick.result
  if (!game || game.state !== 'post') return 'pending'

  const { home, away } = game
  let winnerSide = null
  if (home.winner && !away.winner) winnerSide = 'home'
  else if (away.winner && !home.winner) winnerSide = 'away'
  else if (home.score !== null && away.score !== null && home.score !== away.score) {
    winnerSide = home.score > away.score ? 'home' : 'away'
  }
  if (!winnerSide) return 'pending'

  return winnerSide === pick.pickedSide ? 'win' : 'loss'
}

// Actualiza los resultados de las elecciones con los partidos recibidos de
// ESPN. Devuelve la misma lista si nada cambia (para no re-renderizar) y
// persiste los cambios en localStorage.
export function resolveResults(picks, games) {
  if (picks.length === 0) return picks
  const byId = new Map(games.map((game) => [game.id, game]))
  let changed = false
  const next = picks.map((pick) => {
    const result = resolveResult(pick, byId.get(pick.id))
    if (result === pick.result) return pick
    changed = true
    return { ...pick, result }
  })
  if (changed) savePicks(next)
  return changed ? next : picks
}

// ---------- Consulta del historial ----------

// Agrupa los pronósticos por fecha (de la más reciente a la más antigua) y
// calcula el resumen diario: aciertos, fallos y pendientes.
export function groupPredictionsByDate(list) {
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
