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

// Fase en curso (cuarto, medio tiempo...) traducida al español.
const PERIOD_LABELS = {
  STATUS_HALFTIME: 'Medio tiempo',
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
  Halftime: 'Medio tiempo',
  Overtime: 'Prórroga',
  OT: 'Prórroga',
}

function getStatusLabel(statusType, state) {
  if (state === 'post') {
    const detail = statusType?.detail
    return typeof detail === 'string' && detail.includes('OT')
      ? 'Final (prórroga)'
      : 'Final'
  }
  if (state === 'in') return 'En directo'
  return STATE_LABELS[statusType?.name] ?? 'Programado'
}

function getPhaseLabel(statusType) {
  if (!statusType) return null
  const { name, detail } = statusType
  if (typeof detail === 'string' && DETAIL_PERIOD_LABELS[detail]) {
    return DETAIL_PERIOD_LABELS[detail]
  }
  return PERIOD_LABELS[name] ?? null
}

// ESPN informa del reloj en segundos restantes del periodo en curso.
function formatClock(seconds) {
  if (typeof seconds !== 'number' || seconds < 0) return null
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60)
  return `${minutes}:${String(remaining).padStart(2, '0')}`
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
  const statusType = competition?.status?.type ?? event?.status?.type ?? null
  const state = statusType?.state ?? 'pre'
  const competitors = competition?.competitors ?? []
  const home = competitors.find((c) => c.homeAway === 'home')
  const away = competitors.find((c) => c.homeAway === 'away')

  return {
    id: event.id,
    date: event.date,
    dateKey: dateKeyFromISO(event.date),
    state,
    statusLabel: getStatusLabel(statusType, state),
    phaseLabel: getPhaseLabel(statusType),
    clock: formatClock(competition?.status?.clock ?? event?.status?.clock ?? null),
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
