import { useEffect, useState } from 'react'
import DateNav from '../components/DateNav.jsx'
import {
  currentJornadaKey,
  etDatesForSpanishDate,
  fetchNbaScoreboard,
} from '../api/espn.js'
import {
  dailyStats,
  loadPicks,
  migratePicksToJornada,
  resolveResults,
} from '../data/predictions.js'

const RESULT_LABELS = {
  win: 'Acierto',
  loss: 'Fallo',
  pending: 'Pendiente',
}

// Porcentaje diario con formato español: "66,7 %". Sin partidos decididos
// se muestra "—%" (nunca 0 %, que daría una impresión errónea).
function formatPercent(value) {
  if (typeof value !== 'number') return '—%'
  return `${value.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`
}

function EmptyIcon() {
  return (
    <svg
      className="empty-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="9" y="2.5" width="6" height="4" rx="1.2" />
      <path d="M9 4.5H7A2 2 0 0 0 5 6.5v12A2 2 0 0 0 7 20.5h10a2 2 0 0 0 2-2v-12a2 2 0 0 0-2-2h-2" />
      <path d="M8.5 11h7M8.5 15h4.5" />
    </svg>
  )
}

function HistorialPage() {
  // Fecha seleccionada en el calendario: una jornada NBA (fecha de liga en
  // EE. UU.), igual que en Partidos. Por defecto, la jornada vigente.
  const [selectedDate, setSelectedDate] = useState(() => currentJornadaKey())
  const [picks, setPicks] = useState(loadPicks)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Consulta a ESPN lo mínimo: los partidos de los registros antiguos que
  // falte migrar y los de la jornada seleccionada cuando haya resultados
  // pendientes de resolver. Sin pronósticos no se hace ninguna petición.
  useEffect(() => {
    let active = true

    async function load() {
      const stored = loadPicks()
      if (stored.length === 0) {
        if (active) {
          setPicks([])
          setError(null)
          setLoading(false)
        }
        return
      }

      setLoading(true)
      try {
        let next = stored
        // Partidos ya consultados, por clave de consulta (YYYYMMDD).
        const fetched = new Map()

        // 1) Migración de registros antiguos sin jornada: se consultan sus
        //    fechas españolas en ESPN y se les asigna la jornada real.
        const unmigrated = next.filter((item) => !item.jornada)
        if (unmigrated.length > 0) {
          const queries = [
            ...new Set(
              unmigrated.flatMap((item) => etDatesForSpanishDate(item.date)),
            ),
          ]
          const results = await Promise.all(
            queries.map((dates) => fetchNbaScoreboard(dates)),
          )
          queries.forEach((dates, index) => fetched.set(dates, results[index]))
          next = migratePicksToJornada(next, [...fetched.values()].flat())
        }

        // 2) Partidos de la jornada seleccionada, solo si queda algo por
        //    resolver (las fechas sin pronósticos no generan consultas).
        const visible = next.filter((item) => item.jornada === selectedDate)
        const needsResults = visible.some((item) => item.result === 'pending')
        const queryKey = selectedDate.replace(/-/g, '')
        if (needsResults && !fetched.has(queryKey)) {
          fetched.set(queryKey, await fetchNbaScoreboard(queryKey))
        }

        if (!active) return
        next = resolveResults(next, [...fetched.values()].flat())
        setPicks(next)
        setError(null)
      } catch (err) {
        if (!active) return
        const message =
          err instanceof Error && err.name === 'TimeoutError'
            ? 'ESPN no ha respondido a tiempo. Comprueba tu conexión.'
            : 'ESPN no responde en este momento. Inténtalo de nuevo en unos segundos.'
        setError(message)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [selectedDate, reloadKey])

  const handleRetry = () => setReloadKey((key) => key + 1)

  const handleDateChange = (dateKey) => {
    if (dateKey === selectedDate) return
    setSelectedDate(dateKey)
  }

  const dayPicks = picks.filter((item) => item.jornada === selectedDate)
  const stats = dailyStats(dayPicks)
  const hasPicks = picks.length > 0

  return (
    <section className="section" id="historial">
      <div className="section-head">
        <div>
          <span className="eyebrow">Tus pronósticos</span>
          <h1>Historial de pronósticos</h1>
        </div>
      </div>
      <p className="section-lead">
        Consulta tus pronósticos por jornada NBA (fecha en Estados Unidos),
        con el enfrentamiento, el equipo elegido y el resultado de cada uno.
        Los horarios de los partidos se muestran en hora española.
      </p>

      <DateNav
        value={selectedDate}
        today={currentJornadaKey()}
        onChange={handleDateChange}
      />
      <p className="date-nav-note">
        Las fechas del calendario corresponden a jornadas NBA.
      </p>

      {loading && (
        <div className="state-box" role="status">
          <span className="spinner" aria-hidden="true" />
          <p>Comprobando resultados en ESPN…</p>
        </div>
      )}

      {error && !loading && (
        <div className="state-box state-box--error" role="alert">
          <p className="state-title">No se han podido cargar los resultados</p>
          <p>{error}</p>
          <button type="button" className="retry-button" onClick={handleRetry}>
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && !hasPicks && (
        <div className="state-box">
          <EmptyIcon />
          <p className="state-title">Todavía no hay pronósticos registrados</p>
          <p>
            Elige un equipo en la página de Partidos: aquí verás cada jornada
            con tus pronósticos, el equipo elegido y si acertaste o fallaste
            cuando el partido termine.
          </p>
        </div>
      )}

      {!loading && !error && hasPicks && (
        <>
          <div className="day-stats" role="group" aria-label="Resumen del día">
            <div className="stat-card">
              <span className="stat-label">Pronósticos</span>
              <span className="stat-value">{stats.count}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Aciertos</span>
              <span className="stat-value stat-value--win">{stats.wins}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Fallos</span>
              <span className="stat-value stat-value--loss">{stats.losses}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Pendientes</span>
              <span className="stat-value stat-value--pending">
                {stats.pending}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Porcentaje diario</span>
              <span className="stat-value stat-value--percent">
                {formatPercent(stats.percent)}
              </span>
            </div>
          </div>

          {dayPicks.length > 0 ? (
            <ul className="history-list">
              {dayPicks.map((prediction) => (
                <li
                  key={prediction.id}
                  className={`history-item history-item--${prediction.result}`}
                >
                  <div className="history-match">
                    <strong>
                      {prediction.away} @ {prediction.home}
                    </strong>
                    <span>Ganador elegido: {prediction.pickedWinner}</span>
                  </div>
                  <span
                    className={`result-badge result-badge--${prediction.result}`}
                  >
                    {RESULT_LABELS[prediction.result] ?? 'Pendiente'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="state-box">
              <p className="state-title">No realizaste pronósticos este día</p>
              <p>
                Usa las flechas o el calendario para elegir otra jornada NBA.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default HistorialPage
