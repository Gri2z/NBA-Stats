import { useEffect, useState } from 'react'
import {
  etDatesForSpanishDate,
  fetchNbaScoreboard,
} from '../api/espn.js'
import {
  formatDayLabel,
  groupPredictionsByDate,
  loadPicks,
  resolveResults,
} from '../data/predictions.js'

const RESULT_LABELS = {
  win: 'Acierto',
  loss: 'Fallo',
  pending: 'Pendiente',
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
  const [picks, setPicks] = useState(loadPicks)
  const [loading, setLoading] = useState(() => loadPicks().length > 0)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Consulta a ESPN los partidos de cada fecha con pronóstico para saber el
  // resultado real. Si no hay pronósticos, no se hace ninguna petición.
  useEffect(() => {
    let active = true

    async function load() {
      const stored = loadPicks()
      if (stored.length === 0) {
        // Sin pronósticos no hay nada que consultar ni que mostrar.
        if (active) {
          setPicks((current) => (current.length > 0 ? [] : current))
          setError(null)
          setLoading(false)
        }
        return
      }

      setLoading(true)
      try {
        const dateKeys = [...new Set(stored.map((item) => item.date))]
        const queryDates = [
          ...new Set(dateKeys.flatMap((dateKey) => etDatesForSpanishDate(dateKey))),
        ]
        const results = await Promise.all(
          queryDates.map((dates) => fetchNbaScoreboard(dates)),
        )
        if (!active) return
        const games = results.flat()
        setPicks(resolveResults(stored, games))
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
  }, [reloadKey])

  const handleRetry = () => setReloadKey((key) => key + 1)

  const days = groupPredictionsByDate(picks)

  return (
    <section className="section" id="historial">
      <div className="section-head">
        <div>
          <span className="eyebrow">Tus pronósticos</span>
          <h1>Historial de pronósticos</h1>
        </div>
      </div>
      <p className="section-lead">
        Tus pronósticos de partidos de la NBA organizados por fecha, de la más
        reciente a la más antigua, con el equipo elegido como ganador y el
        resultado de cada uno.
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

      {!loading && days.length === 0 && (
        <div className="state-box">
          <EmptyIcon />
          <p className="state-title">Todavía no hay pronósticos registrados</p>
          <p>
            Elige un equipo en la página de Partidos: aquí verás cada fecha con
            tus pronósticos, el equipo elegido y si acertaste o fallaste cuando
            el partido termine.
          </p>
        </div>
      )}

      {!loading && days.length > 0 && (
        <div className="history-days">
          {days.map((day) => (
            <article key={day.date} className="history-day">
              <header className="history-day-head">
                <div>
                  <h2 className="history-day-date">{formatDayLabel(day.date)}</h2>
                  <span className="history-day-count">
                    {day.count > 0
                      ? `${day.count} pronóstico${day.count === 1 ? '' : 's'}`
                      : 'Sin pronósticos'}
                  </span>
                </div>
                <div className="history-day-summary">
                  {day.wins > 0 && (
                    <span className="summary-chip summary-chip--win">
                      {day.wins} acierto{day.wins === 1 ? '' : 's'}
                    </span>
                  )}
                  {day.losses > 0 && (
                    <span className="summary-chip summary-chip--loss">
                      {day.losses} fallo{day.losses === 1 ? '' : 's'}
                    </span>
                  )}
                  {day.pending > 0 && (
                    <span className="summary-chip summary-chip--pending">
                      {day.pending} pendiente{day.pending === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              </header>

              {day.items.length > 0 ? (
                <ul className="history-list">
                  {day.items.map((prediction) => (
                    <li
                      key={prediction.id}
                      className={`history-item history-item--${prediction.result}`}
                    >
                      <div className="history-match">
                        <strong>
                          {prediction.away} @ {prediction.home}
                        </strong>
                        <span>
                          Ganador elegido: {prediction.pickedWinner}
                        </span>
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
                <p className="history-day-empty">
                  Sin pronósticos registrados en esta fecha.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default HistorialPage
