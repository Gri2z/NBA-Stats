// Almacén de pronósticos (elecciones de ganador) de NBA Stats.
//
// Las elecciones se guardan en el localStorage del navegador: no hay cuentas
// ni bases de datos, y solo están disponibles en el dispositivo donde se
// realizaron. Forma de cada pronóstico:
//
// {
//   id: '401910015',           // id real del partido en la API de ESPN
//   date: '2026-11-19',        // fecha del partido (YYYY-MM-DD, hora española)
//   jornada: '2026-11-19',     // jornada NBA (fecha de liga en EE. UU.)
//   away: 'Boston Celtics',    // equipo visitante
//   home: 'Denver Nuggets',    // equipo local
//   pickedSide: 'away',        // 'away' | 'home': equipo elegido
//   pickedWinner: '...',       // nombre del equipo elegido como ganador
//   result: 'pending',         // 'pending' | 'win' | 'loss'
// }
//
// 'jornada' es la clave del calendario (fecha de la jornada NBA en horario
// de Estados Unidos). Los registros antiguos, creados antes del calendario,
// no la llevan: se completa con migratePicksToJornada() al consultar el
// Historial, sin perder ningún dato.
//
// 'result' pasa a 'win' o 'loss' cuando ESPN confirma el resultado final
// ('post') y se compara el ganador real con la elección; hasta entonces
// queda en 'pending' (se muestra como "Pendiente" en el Historial).

const STORAGE_KEY = 'nba-stats:picks'

const JORNADA_PATTERN = /^\d{4}-\d{2}-\d{2}$/

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
    // Un registro sin jornada válida se conserva; solo se descarta el campo
    // para que la migración pueda completarlo más adelante.
    return parsed.filter(isValidPick).map((pick) =>
      typeof pick.jornada === 'string' && JORNADA_PATTERN.test(pick.jornada)
        ? pick
        : { ...pick, jornada: undefined },
    )
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
    // Jornada NBA (fecha de liga en EE. UU.): la clave del calendario. Los
    // partidos normalizados la traen sellada desde la consulta a ESPN.
    jornada: game.jornadaKey ?? game.dateKey ?? game.date.slice(0, 10),
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

// Elimina la elección de un partido (deselección) y la borra del
// localStorage. Las demás elecciones quedan intactas. Solo se debe llamar
// mientras el partido está programado ('pre').
export function removePick(gameId) {
  const picks = loadPicks()
  const next = picks.filter((item) => item.id !== gameId)
  if (next.length !== picks.length) savePicks(next)
  return next
}

// ---------- Migración de registros antiguos ----------

// Asigna la jornada NBA a los registros creados antes del calendario, usando
// los partidos recibidos de ESPN (se consultan las fechas españolas de esos
// registros). Si un partido no aparece, se conserva la fecha española como
// jornada aproximada: nunca se pierde ningún registro. Devuelve la misma
// lista si nada cambia y persiste los cambios.
export function migratePicksToJornada(picks, games) {
  const byId = new Map(games.map((game) => [game.id, game]))
  let changed = false
  const next = picks.map((pick) => {
    if (pick.jornada) return pick
    changed = true
    const jornada = byId.get(pick.id)?.jornadaKey ?? pick.date
    return { ...pick, jornada }
  })
  if (changed) savePicks(next)
  return changed ? next : picks
}

// ---------- Estadísticas diarias ----------

// Resumen de los pronósticos de una jornada. El porcentaje de acierto solo
// cuenta los partidos decididos: aciertos / (aciertos + fallos) × 100; los
// pendientes no entran en el denominador. Sin partidos decididos se
// devuelve null (se muestra "—%" para no dar una impresión errónea).
export function dailyStats(items) {
  const wins = items.filter((item) => item.result === 'win').length
  const losses = items.filter((item) => item.result === 'loss').length
  const pending = items.filter((item) => item.result === 'pending').length
  const decided = wins + losses
  return {
    count: items.length,
    wins,
    losses,
    pending,
    percent: decided > 0 ? (wins / decided) * 100 : null,
  }
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
