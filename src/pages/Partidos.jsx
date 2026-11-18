import { useEffect, useState } from 'react'
import {
  fetchNbaScoreboard,
  formatGameDate,
  formatGameTime,
} from '../api/espn.js'

function statusClass(state) {
  if (state === 'in') return 'status-pill status-pill--live'
  if (state === 'post') return 'status-pill status-pill--final'
  return 'status-pill status-pill--scheduled'
}

function scoreClass(team, state) {
  if (state === 'post' && !team.winner) return 'score score--lose'
  return 'score'
}

function timeLine(game) {
  if (game.state === 'pre') {
    return `${formatGameDate(game.date)} · ${formatGameTime(game.date)} h`
  }
  if (game.state === 'in') {
    return [game.phaseLabel ?? 'En directo', game.clock]
      .filter(Boolean)
      .join(' · ')
  }
  return [game.statusLabel, formatGameDate(game.date)].filter(Boolean).join(' · ')
}

function TeamLogo({ team }) {
  const [src, setSrc] = useState(team.logo)

  if (!src) {
    return <span className="team-badge">{team.abbreviation || 'NBA'}</span>
  }

  return (
    <img
      className="team-logo"
      src={src}
      alt=""
      width="48"
      height="48"
      loading="lazy"
      onError={() => {
        setSrc((current) =>
          current === team.logo ? team.alternateLogo ?? null : null,
        )
      }}
    />
  )
}

function PartidosPage() {
  const [games, setGames] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const data = await fetchNbaScoreboard()
        if (!active) return
        setGames(data)
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
    const intervalId = setInterval(load, 60000)
    return () => {
      active = false
      clearInterval(intervalId)
    }
  }, [reloadKey])

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    setGames(null)
    setReloadKey((key) => key + 1)
  }

  return (
    <section className="section" id="partidos">
      <div className="section-head">
        <div>
          <span className="eyebrow">Calendario de la NBA · Temporada 2026/27</span>
          <h1>Partidos de la NBA</h1>
        </div>
        <span className="source-pill">Datos reales · ESPN</span>
      </div>
      <p className="section-lead">
        Partidos reales obtenidos de ESPN. Los horarios se muestran en hora
        española y el marcador se actualiza automáticamente mientras hay
        partidos en directo.
      </p>

      {loading && games === null && (
        <div className="state-box" role="status">
          <span className="spinner" aria-hidden="true" />
          <p>Cargando partidos de ESPN…</p>
        </div>
      )}

      {error && games === null && (
        <div className="state-box state-box--error" role="alert">
          <p className="state-title">No se han podido cargar los partidos</p>
          <p>{error}</p>
          <button type="button" className="retry-button" onClick={handleRetry}>
            Reintentar
          </button>
        </div>
      )}

      {games !== null && games.length === 0 && !error && (
        <div className="state-box">
          <p>No hay partidos de la NBA programados en este momento.</p>
        </div>
      )}

      {games !== null && games.length > 0 && (
        <div className="games-grid">
          {games.map((game) => {
            const hasScore =
              game.state !== 'pre' &&
              game.home.score !== null &&
              game.away.score !== null

            return (
              <article
                key={game.id}
                className={`game-card${
                  game.state === 'in' ? ' game-card--live' : ''
                }`}
              >
                <div className="game-card-top">
                  <span className="game-tag">NBA</span>
                  <span className={statusClass(game.state)}>
                    {game.state === 'in' && (
                      <span className="live-dot" aria-hidden="true" />
                    )}
                    {game.statusLabel}
                  </span>
                </div>
                <p className="game-time">{timeLine(game)}</p>
                <div className="matchup">
                  <div className="team">
                    <TeamLogo team={game.away} />
                    <span className="team-name">{game.away.name}</span>
                  </div>
                  {hasScore ? (
                    <span
                      className="matchup-score"
                      aria-label={`Marcador: ${game.away.name} ${game.away.score}, ${game.home.name} ${game.home.score}`}
                    >
                      <span className={scoreClass(game.away, game.state)}>
                        {game.away.score}
                      </span>
                      <span className="score-sep" aria-hidden="true">
                        –
                      </span>
                      <span className={scoreClass(game.home, game.state)}>
                        {game.home.score}
                      </span>
                    </span>
                  ) : (
                    <span className="at">@</span>
                  )}
                  <div className="team">
                    <TeamLogo team={game.home} />
                    <span className="team-name">{game.home.name}</span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default PartidosPage
