// Utilidades de fecha para el calendario de jornadas NBA.
//
// Regla de fechas de la aplicación: el calendario selecciona jornadas NBA,
// es decir, la fecha de la liga en horario de Estados Unidos
// (America/New_York). ESPN agrupa sus partidos con ese criterio
// (?dates=YYYYMMDD) y la web muestra los horarios en hora española, así que
// un partido de la jornada del jueves puede jugarse a las 02:00 del viernes
// en España. Todas las claves de fecha son 'YYYY-MM-DD'.

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

// Fecha corta para la barra de navegación: "jue, 19 nov 2026".
const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const MONTH_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

// Días de la semana en español (lunes primero, convención española).
export const WEEKDAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function toKey(year, month, day) {
  // Date.UTC normaliza el desbordamiento de días/meses y evita problemas de
  // zona horaria: solo se manipulan claves de fecha, nunca horas locales.
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)
}

// Suma (o resta) días a una clave de fecha, cruzando meses y años.
export function shiftDateKey(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return toKey(year, month, day + days)
}

// Año y mes (1-12) que contienen una clave de fecha.
export function monthOf(dateKey) {
  const [year, month] = dateKey.split('-').map(Number)
  return { year, month }
}

// Mes siguiente (delta 1) o anterior (delta -1), cruzando años.
export function shiftMonth(year, month, delta) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
}

// Rejilla de un mes para el calendario, con los lunes primero. Devuelve las
// semanas como arrays de claves de fecha; los huecos iniciales y finales son
// null para completar las semanas completas.
export function buildMonthGrid(year, month) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  // getUTCDay: 0 = domingo; se convierte a 0 = lunes.
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7

  const cells = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(toKey(year, month, day))
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

// "jueves, 19 de noviembre de 2026".
export function formatLongDate(dateKey) {
  return LONG_DATE_FORMATTER.format(new Date(`${dateKey}T12:00:00`))
}

// "jue, 19 nov 2026": clara y compacta para la barra de fechas.
export function formatShortDate(dateKey) {
  return SHORT_DATE_FORMATTER.format(new Date(`${dateKey}T12:00:00`))
}

// "noviembre de 2026" para la cabecera del calendario.
export function formatMonthLabel(year, month) {
  const label = MONTH_FORMATTER.format(new Date(Date.UTC(year, month - 1, 1)))
  return label.charAt(0).toUpperCase() + label.slice(1)
}
