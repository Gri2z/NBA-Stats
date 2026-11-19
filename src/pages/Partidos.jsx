import { useEffect, useRef, useState } from 'react'
import DateNav from '../components/DateNav.jsx'
import {
  currentJornadaKey,
  fetchNbaScoreboard,
  formatGameLine,
  jornadaRefreshPlan,
} from '../api/espn.js'
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
  // Fecha seleccionada en el calendario: una jornada NBA (fecha de liga en
  // EE. UU.). Por defecto, la jornada vigente.
  const [selectedDate, setSelectedDate] = useState(() => currentJornadaKey())
  const [games, setGames] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [picks, setPicks] = useState(loadPicks)
  // Solo un desplegable abierto a la vez (id del partido, o null).
  const [openGameId, setOpenGameId] = useState(null)
  // ¿Debe la selección seguir a la jornada vigente? Solo mientras el usuario
  // no elija una fecha a mano (una fecha manual no se cambia sola jamás).
  const followsCurrentRef = useRef(true)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        // Partidos reales de la jornada seleccionada (?dates=YYYYMMDD); la
        // clave del calendario es 'YYYY-MM-DD' y ESPN espera solo dígitos.
        const data = await fetchNbaScoreboard(selectedDate.replace(/-/g, ''))
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

    // Actualización automática cada 60 s para la jornada vigente; las fechas
    // pasadas no se refrescan (datos estables) y las futuras, cuando
    // corresponda. En cada tick se comprueba si ha cambiado la jornada.
    const intervalId = setInterval(() => {
      const { current, pollMs } = jornadaRefreshPlan(selectedDate)
      if (followsCurrentRef.current && current !== selectedDate) {
        // Nueva jornada vigente: se actualiza sola la fecha seleccionada
        // (solo si el usuario no ha elegido otra a mano).
        setGames(null)
        setLoading(true)
        setError(null)
        setOpenGameId(null)
        setSelectedDate(current)
        return
      }
      if (pollMs !== null) load()
    }, 60000)

    return () => {
      active = false
      clearInterval(intervalId)
    }
  }, [selectedDate, reloadKey])

  const handleDateChange = (dateKey) => {
    // Elegir la jornada vigente (o "Hoy") reanuda el seguimiento automático;
    // cualquier otra fecha deja de seguirla para no cambiar la elección.
    followsCurrentRef.current = dateKey === currentJornadaKey()
    if (dateKey === selectedDate) return
    setGames(null)
    setLoading(true)
    setError(null)
    setOpenGameId(null)
    setSelectedDate(dateKey)
  }

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
        Partidos reales obtenidos de ESPN. Elige una fecha para ver su jornada:
        cada fecha del calendario es una jornada NBA (según la fecha en
        Estados Unidos) y los horarios se muestran en hora española, así que
        algún partido puede aparecer de madrugada del día siguiente. El
        marcador se actualiza automáticamente mientras hay partidos en directo.
      </p>

      <DateNav
        value={selectedDate}
        today={currentJornadaKey()}
        onChange={handleDateChange}
      />
      <p className="date-nav-note">
        Las fechas del calendario corresponden a jornadas NBA; los horarios de
        los partidos se muestran en hora española.
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
          <p>No hay partidos de la NBA programados en esta jornada.</p>
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
