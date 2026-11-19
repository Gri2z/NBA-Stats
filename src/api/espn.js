// Acceso a la API pública de ESPN (sin claves ni dependencias).
// ESPN envía cabeceras CORS abiertas, así que el navegador puede consultarla
// directamente desde la aplicación.

const SCOREBOARD_URL =
  'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard'

const REQUEST_TIMEOUT_MS = 10000

// Los datos llegan en UTC; se muestran siempre en hora española.
const TIME_ZONE = 'Europe/Madrid'

const DATE_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

const TIME_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
})

// Fecha (YYYY-MM-DD) en hora española a partir de la fecha ISO de ESPN.
const DATE_KEY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function dateKeyFromISO(date) {
  return DATE_KEY_FORMATTER.format(new Date(date))
}

// ESPN agrupa los partidos por fecha de liga (ET): un partido con fecha
// española D puede estar en el día D o en el D-1 de ESPN. Se devuelven las
// dos claves de consulta (YYYYMMDD) para no perder ninguno.
export function etDatesForSpanishDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const utc = Date.UTC(year, month - 1, day)
  const toQuery = (ms) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '')
  return [toQuery(utc), toQuery(utc - 86400000)]
}

// Estado del partido para la píldora de la tarjeta.
const STATE_LABELS = {
  STATUS_SCHEDULED: 'Programado',
  STATUS_POSTPONED: 'Aplazado',
  STATUS_CANCELED: 'Cancelado',
}

// Etiquetas de cuarto a partir del campo real `period` de ESPN:
// 1-4 son los cuartos y a partir de 5 son prórrogas.
const QUARTER_LABELS = {
  1: '1.er cuarto',
  2: '2.º cuarto',
  3: '3.er cuarto',
  4: '4.º cuarto',
}

function periodLabel(period) {
  if (!Number.isInteger(period) || period < 1) return null
  if (period <= 4) return QUARTER_LABELS[period]
  // 5 = "Prórroga", 6 = "2.ª prórroga", 7 = "3.ª prórroga"...
  return period === 5 ? 'Prórroga' : `${period - 4}.ª prórroga`
}

// Fase en curso traducida al español cuando ESPN no numera el periodo.
const PERIOD_LABELS = {
  STATUS_HALFTIME: 'Descanso',
  STATUS_FIRST_QUARTER: '1.er cuarto',
  STATUS_SECOND_QUARTER: '2.º cuarto',
  STATUS_THIRD_QUARTER: '3.er cuarto',
  STATUS_FOURTH_QUARTER: '4.º cuarto',
  STATUS_OVERTIME: 'Prórroga',
  STATUS_END_OF_PERIOD: 'Fin del periodo',
  STATUS_IN_PROGRESS: 'En directo',
}

// ESPN a veces describe la fase en inglés dentro de `detail`.
const DETAIL_PERIOD_LABELS = {
  '1st Quarter': '1.er cuarto',
  '2nd Quarter': '2.º cuarto',
  '3rd Quarter': '3.er cuarto',
  '4th Quarter': '4.º cuarto',
  Halftime: 'Descanso',
  Overtime: 'Prórroga',
  OT: 'Prórroga',
}

// Un partido finalizado se considera con prórroga si ESPN lo indica en el
// periodo (5 o más) o en el texto del estado ("Final/OT", "Final/2OT"...).
function isFinalWithOvertime(statusType, period) {
  if (Number.isInteger(period) && period > 4) return true
  const text = [statusType?.detail, statusType?.shortDetail, statusType?.altDetail]
    .filter((value) => typeof value === 'string')
    .join(' ')
  return text.includes('OT')
}

function getStatusLabel(statusType, state, period) {
  const name = statusType?.name
  // Aplazados y cancelados se respetan en cualquier estado.
  if (name === 'STATUS_POSTPONED' || name === 'STATUS_CANCELED') {
    return STATE_LABELS[name]
  }
  if (state === 'post') {
    return isFinalWithOvertime(statusType, period) ? 'Final (prórroga)' : 'Final'
  }
  if (state === 'in') return 'En directo'
  return STATE_LABELS[name] ?? 'Programado'
}

// Fase en curso (cuarto, descanso, prórroga...) a partir de los campos
// reales `period` y `status.type` de ESPN. Solo existe mientras hay partido.
function getPhaseLabel(status, state) {
  if (state !== 'in') return null
  const statusType = status?.type ?? null
  const name = statusType?.name
  const { detail, shortDetail } = statusType ?? {}

  if (name === 'STATUS_HALFTIME' || detail === 'Halftime' || shortDetail === 'Halftime') {
    return 'Descanso'
  }

  // El número de periodo es el dato estructurado: cubre cuartos y prórrogas.
  const fromPeriod = periodLabel(Number(status?.period))
  if (fromPeriod) return fromPeriod

  if (typeof detail === 'string' && DETAIL_PERIOD_LABELS[detail]) {
    return DETAIL_PERIOD_LABELS[detail]
  }
  return PERIOD_LABELS[name] ?? 'En directo'
}

// ESPN informa del reloj en segundos restantes del periodo en curso.
function formatClock(seconds) {
  if (typeof seconds !== 'number' || seconds < 0) return null
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60)
  return `${minutes}:${String(remaining).padStart(2, '0')}`
}

// Describe el estado de un partido a partir del objeto `status` real de ESPN
// (clock, displayClock, period y status.type). Devuelve:
// { state, statusLabel, phaseLabel, clock } — sin inventar ningún dato.
export function describeStatus(status) {
  const statusType = status?.type ?? null
  const state = statusType?.state ?? 'pre'
  return {
    state,
    statusLabel: getStatusLabel(statusType, state, Number(status?.period)),
    phaseLabel: getPhaseLabel(status, state),
    clock: state === 'in' ? formatClock(status?.clock ?? null) : null,
  }
}

function normalizeCompetitor(competitor) {
  const team = competitor?.team ?? {}
  const score = competitor?.score
  const primaryLogo = team.logo ?? team.logoDark ?? null
  const secondaryLogo = team.logoDark ?? team.logo ?? null
  return {
    name: team.displayName ?? 'Por determinar',
    abbreviation: team.abbreviation ?? '',
    logo: primaryLogo,
    alternateLogo: secondaryLogo !== primaryLogo ? secondaryLogo : null,
    score:
      score === null || score === undefined || score === '' ? null : Number(score),
    winner: competitor?.winner === true,
  }
}

function normalizeEvent(event) {
  const competition = event?.competitions?.[0]
  const status = competition?.status ?? event?.status ?? null
  const { state, statusLabel, phaseLabel, clock } = describeStatus(status)
  const competitors = competition?.competitors ?? []
  const home = competitors.find((c) => c.homeAway === 'home')
  const away = competitors.find((c) => c.homeAway === 'away')

  return {
    id: event.id,
    date: event.date,
    dateKey: dateKeyFromISO(event.date),
    state,
    statusLabel,
    phaseLabel,
    clock,
    home: normalizeCompetitor(home),
    away: normalizeCompetitor(away),
  }
}

// Clave de fecha de consulta para ESPN (YYYYMMDD). Solo se aceptan dígitos.
const QUERY_DATE_PATTERN = /^\d{8}$/

// `dates` permite consultar un día concreto (YYYYMMDD); sin parámetro se
// devuelven los partidos del día de liga actual.
export async function fetchNbaScoreboard(dates) {
  if (dates !== undefined && !QUERY_DATE_PATTERN.test(dates)) {
    throw new Error(`Fecha de consulta no válida: ${dates}`)
  }
  const url = dates ? `${SCOREBOARD_URL}?dates=${dates}` : SCOREBOARD_URL
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`ESPN ha respondido con el código ${response.status}`)
  }
  const data = await response.json()
  const events = Array.isArray(data?.events) ? data.events : []
  return events.map(normalizeEvent)
}

export function formatGameDate(date) {
  return DATE_FORMATTER.format(new Date(date))
}

export function formatGameTime(date) {
  return TIME_FORMATTER.format(new Date(date))
}

// Línea de estado de la tarjeta: horario (pre), periodo y reloj (en juego)
// o resultado final (post). Usa solo los datos reales ya normalizados.
export function formatGameLine(game) {
  if (game.state === 'pre') {
    return `${formatGameDate(game.date)} · ${formatGameTime(game.date)} h`
  }
  if (game.state === 'in') {
    const phase = game.phaseLabel ?? 'En directo'
    // En el descanso solo se muestra "Descanso" (el reloj no aporta nada).
    if (phase === 'Descanso') return 'Descanso'
    return [phase, game.clock].filter(Boolean).join(' · ')
  }
  return [game.statusLabel, formatGameDate(game.date)].filter(Boolean).join(' · ')
}

// ---------- Jornada actual (fechas de liga en horario ET) ----------

// La NBA organiza cada jornada en horario del este de EE. UU.
// (America/New_York); la web muestra todo en hora española.
const ET_TIME_ZONE = 'America/New_York'

const ET_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: ET_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const ET_HOUR_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: ET_TIME_ZONE,
  hour: '2-digit',
  hourCycle: 'h23',
})

// Tras la medianoche ET aún pueden estar en juego partidos de la jornada
// anterior (finales tardíos y prórrogas rara vez pasan de las 03:30 ET):
// hasta las 04:00 ET se consulta también la jornada anterior.
const ET_JORNADA_GRACE_HOUR = 4

// Claves de consulta (YYYYMMDD) de la jornada vigente para ESPN:
// - hoy ET siempre;
// - ayer ET solo durante la ventana de madrugada (00:00–04:00 ET).
export function jornadaDateKeys(now = new Date()) {
  const today = ET_DATE_FORMATTER.format(now) // 'YYYY-MM-DD' en ET
  const hour = Number(ET_HOUR_FORMATTER.format(now))
  const todayQuery = today.replace(/-/g, '')
  if (hour >= ET_JORNADA_GRACE_HOUR) return [todayQuery]

  const [year, month, day] = today.split('-').map(Number)
  const yesterdayMs = Date.UTC(year, month - 1, day) - 86400000
  const yesterdayQuery = new Date(yesterdayMs).toISOString().slice(0, 10).replace(/-/g, '')
  return [todayQuery, yesterdayQuery]
}

// Combina la jornada de hoy con los partidos de la jornada anterior que
// siguen en juego: los finalizados de ayer se descartan (no se arrastran
// partidos de jornadas cerradas) y los que siguen en directo se conservan
// (el cambio de fecha nunca elimina partidos en curso).
export function mergeJornadaGames(todayGames, yesterdayGames) {
  if (!Array.isArray(yesterdayGames) || yesterdayGames.length === 0) {
    return todayGames
  }
  const seen = new Set(todayGames.map((game) => game.id))
  const extra = yesterdayGames.filter(
    (game) => game.state === 'in' && !seen.has(game.id),
  )
  if (extra.length === 0) return todayGames
  return [...todayGames, ...extra].sort((a, b) => a.date.localeCompare(b.date))
}

// Partidos de la jornada vigente. Se recalcula la fecha en cada consulta,
// de modo que el cambio de jornada se detecta con la actualización
// automática (60 s) sin recargar la página.
export async function fetchJornada() {
  const [todayKey, yesterdayKey] = jornadaDateKeys()
  const todayGames = await fetchNbaScoreboard(todayKey)
  if (!yesterdayKey) return todayGames
  // Si la consulta de la jornada anterior falla, se mantiene la de hoy.
  const yesterdayGames = await fetchNbaScoreboard(yesterdayKey).catch(() => null)
  return mergeJornadaGames(todayGames, yesterdayGames)
}
