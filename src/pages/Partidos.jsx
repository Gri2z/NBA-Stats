import { useEffect, useState } from 'react'
import { fetchJornada, formatGameLine } from '../api/espn.js'
import { getWinProbability } from '../data/probabilities.js'
import {
  loadPicks,
  removePick,
  resolveResults,
  upsertPick,
} from '../data/predictions.js'

function statusClass(state) {
  if (state === 'in') return 'status-pill status-pill--live'
  if (state === 'post') return 'status-pill status-pill--final'
  return 'status-pill status-pill--scheduled'
}

function scoreClass(team, state) {
  if (state === 'post' && !team.winner) return 'score score--lose'
  return 'score'
}

function formatPercent(value) {
  if (typeof value !== 'number') return '—%'
  return `${value.toLocaleString('es-ES')} %`
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

// Probabilidades de ganar. Sin fuente autorizada disponible, se muestran
// como "—%" (ver src/data/probabilities.js): nunca se inventan datos.
function WinProbabilities({ game }) {
  const probability = getWinProbability(game.id)
  const awayPercent = probability?.away ?? null
  const homePercent = probability?.home ?? null
  const hasData = typeof awayPercent === 'number' && typeof homePercent === 'number'

  return (
    <div className="prob">
      <p className="prob-title">Probabilidades de ganar</p>
      <div className="prob-values">
        <span
          className={`prob-value prob-value--away${hasData ? '' : ' prob-value--empty'}`}
        >
          {formatPercent(awayPercent)}
        </span>
        <span
          className={`prob-value prob-value--home${hasData ? '' : ' prob-value--empty'}`}
        >
          {formatPercent(homePercent)}
        </span>
      </div>
      <div
        className="prob-bar"
        role="img"
        aria-label={
          hasData
            ? `Probabilidad de victoria: ${game.away.name} ${formatPercent(awayPercent)}, ${game.home.name} ${formatPercent(homePercent)}`
            : 'Probabilidades de ganar no disponibles'
        }
      >
        {hasData && (
          <>
            <span
              className="prob-bar-seg prob-bar-seg--away"
              style={{ width: `${awayPercent}%` }}
            />
            <span
              className="prob-bar-seg prob-bar-seg--home"
              style={{ width: `${homePercent}%` }}
            />
          </>
        )}
      </div>
    </div>
  )
}

// Selector de ganador. Solo se puede elegir, cambiar o deseleccionar mientras
// el partido está programado; la elección se guarda en localStorage. Pulsar el
// equipo ya seleccionado la elimina.
function WinnerPicker({ game, pick, onPick }) {
  const locked = game.state !== 'pre'
  const selected = pick ? pick.pickedSide : null

  return (
    <div className="picker">
      <p className="picker-question">¿Quién crees que ganará?</p>
      <div className="picker-options">
        <button
          type="button"
          className={`picker-option${selected === 'away' ? ' is-selected' : ''}`}
          disabled={locked}
          aria-pressed={selected === 'away'}
          onClick={() => onPick('away')}
        >
          {selected === 'away' && (
            <span className="picker-check" aria-hidden="true">
              ✓
            </span>
          )}
          {game.away.name}
        </button>
        <button
          type="button"
          className={`picker-option${selected === 'home' ? ' is-selected' : ''}`}
          disabled={locked}
          aria-pressed={selected === 'home'}
          onClick={() => onPick('home')}
        >
          {selected === 'home' && (
            <span className="picker-check" aria-hidden="true">
              ✓
            </span>
          )}
          {game.home.name}
        </button>
      </div>
      <p className="picker-note">
        {locked
          ? 'Las elecciones están cerradas: el partido ya ha comenzado.'
          : 'Tu elección se guarda en este navegador.'}
      </p>
    </div>
  )
}

// Tarjeta con desplegable. El estado de apertura lo controla la página para
// que solo pueda haber un desplegable abierto a la vez.
function GameCard({ game, pick, open, onToggle, onPick }) {
  const hasScore =
    game.state !== 'pre' &&
    game.home.score !== null &&
    game.away.score !== null
  const panelId = `game-extra-${game.id}`

  return (
    <article
      className={`game-card${game.state === 'in' ? ' game-card--live' : ''}${
        open ? ' game-card--open' : ''
      }`}
    >
      <button
        type="button"
        className="game-card-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="game-card-top">
          <span className="game-tag">NBA</span>
          <span className={statusClass(game.state)}>
            {game.state === 'in' && (
              <span className="live-dot" aria-hidden="true" />
            )}
            {game.statusLabel}
          </span>
        </span>
        <span className="game-time">{formatGameLine(game)}</span>
        <span className="matchup">
          <span className="team">
            <TeamLogo team={game.away} />
            <span className="team-name">{game.away.name}</span>
          </span>
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
          <span className="team">
            <TeamLogo team={game.home} />
            <span className="team-name">{game.home.name}</span>
          </span>
        </span>
        <span className="game-card-hint">
          {open ? 'Ocultar' : 'Ver detalles'}
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </span>
      </button>

      <div className="game-card-extra" id={panelId}>
        <div className="game-card-extra-clip">
          <div className="game-card-extra-body">
            <WinProbabilities game={game} />
            <WinnerPicker game={game} pick={pick} onPick={onPick} />
          </div>
        </div>
      </div>
    </article>
  )
}

function PartidosPage() {
  const [games, setGames] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [picks, setPicks] = useState(loadPicks)
  // Solo un desplegable abierto a la vez (id del partido, o null).
  const [openGameId, setOpenGameId] = useState(null)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        // Consulta la jornada vigente (fecha ET recalculada en cada
        // llamada): el cambio de jornada se detecta en esta misma
        // actualización de 60 s, sin recargar la página.
        const data = await fetchJornada()
        if (!active) return
        setGames(data)
        setError(null)
        // Resuelve con los resultados reales de ESPN las elecciones
        // guardadas cuyo partido ya haya terminado.
        setPicks(resolveResults(loadPicks(), data))
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

  const handleToggle = (gameId) => {
    // Al abrir uno se cierra automáticamente el que estuviera abierto.
    setOpenGameId((current) => (current === gameId ? null : gameId))
  }

  const handlePick = (game, side) => {
    // Sin elecciones ni cambios cuando el partido ya ha comenzado.
    if (game.state !== 'pre') return
    const current = picks.find((item) => item.id === game.id)
    if (current && current.pickedSide === side) {
      // Pulsar el equipo ya elegido deselecciona (y borra el registro).
      setPicks(removePick(game.id))
      return
    }
    setPicks(upsertPick(game, side))
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
          {games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              open={openGameId === game.id}
              onToggle={() => handleToggle(game.id)}
              pick={picks.find((item) => item.id === game.id) ?? null}
              onPick={(side) => handlePick(game, side)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default PartidosPage
