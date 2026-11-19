import { useEffect, useRef, useState } from 'react'
import {
  WEEKDAY_LETTERS,
  buildMonthGrid,
  formatLongDate,
  formatMonthLabel,
  formatShortDate,
  monthOf,
  shiftDateKey,
  shiftMonth,
} from '../utils/dates.js'

// Iconos de flecha (trazo, como el resto de la interfaz).
function ArrowIcon({ direction }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {direction === 'left' ? <path d="M10 3.5L5.5 8l4.5 4.5" /> : <path d="M6 3.5L10.5 8 6 12.5" />}
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2.2" y="3.4" width="11.6" height="10.4" rx="2" />
      <path d="M2.2 6.6h11.6M5.5 2v2.6M10.5 2v2.6" />
    </svg>
  )
}

// Barra de navegación por fechas (jornadas NBA): día anterior/siguiente,
// botón "Hoy" y calendario desplegable para elegir cualquier fecha. Se usa
// en Partidos y en Historial. `value` es la fecha seleccionada ('YYYY-MM-DD')
// y `today` la jornada vigente (para "Hoy" y el resaltado del día actual).
function DateNav({ value, today, onChange }) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => monthOf(value))
  const pickerRef = useRef(null)

  // El calendario abre siempre en el mes de la fecha seleccionada; mientras
  // está abierto solo cambia de mes el propio usuario.
  const toggleCalendar = () => {
    setViewMonth(monthOf(value))
    setOpen((current) => !current)
  }

  // Cierre del calendario al pulsar fuera o con la tecla Escape.
  useEffect(() => {
    if (!open) return undefined
    const handlePointerDown = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const selectDate = (dateKey) => {
    setOpen(false)
    if (dateKey !== value) onChange(dateKey)
  }

  const weeks = buildMonthGrid(viewMonth.year, viewMonth.month)

  return (
    <div className="date-nav">
      <div className="date-nav-controls">
        <button
          type="button"
          className="date-nav-arrow"
          aria-label="Día anterior"
          onClick={() => selectDate(shiftDateKey(value, -1))}
        >
          <ArrowIcon direction="left" />
        </button>

        <div className="date-nav-picker" ref={pickerRef}>
          <button
            type="button"
            className="date-nav-current"
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label={`Fecha seleccionada: ${formatLongDate(value)}. Abrir calendario`}
            onClick={toggleCalendar}
          >
            <CalendarIcon />
            <span>{formatShortDate(value)}</span>
            <svg
              className={`date-nav-chevron${open ? ' is-open' : ''}`}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>

          {open && (
            <div className="date-calendar" role="dialog" aria-label="Elegir fecha">
              <div className="date-calendar-head">
                <button
                  type="button"
                  className="date-calendar-month-arrow"
                  aria-label="Mes anterior"
                  onClick={() =>
                    setViewMonth((month) => shiftMonth(month.year, month.month, -1))
                  }
                >
                  <ArrowIcon direction="left" />
                </button>
                <span className="date-calendar-month">
                  {formatMonthLabel(viewMonth.year, viewMonth.month)}
                </span>
                <button
                  type="button"
                  className="date-calendar-month-arrow"
                  aria-label="Mes siguiente"
                  onClick={() =>
                    setViewMonth((month) => shiftMonth(month.year, month.month, 1))
                  }
                >
                  <ArrowIcon direction="right" />
                </button>
              </div>

              <div className="date-calendar-grid date-calendar-grid--weekdays" aria-hidden="true">
                {WEEKDAY_LETTERS.map((letter) => (
                  <span key={letter} className="date-calendar-weekday">
                    {letter}
                  </span>
                ))}
              </div>

              <div className="date-calendar-grid">
                {weeks.flat().map((dateKey, index) =>
                  dateKey ? (
                    <button
                      key={dateKey}
                      type="button"
                      className={`date-calendar-day${
                        dateKey === value ? ' is-selected' : ''
                      }${dateKey === today ? ' is-today' : ''}`}
                      aria-pressed={dateKey === value}
                      aria-label={formatLongDate(dateKey)}
                      onClick={() => selectDate(dateKey)}
                    >
                      {Number(dateKey.slice(8, 10))}
                    </button>
                  ) : (
                    <span
                      key={`gap-${index}`}
                      className="date-calendar-day date-calendar-day--gap"
                    />
                  ),
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="date-nav-arrow"
          aria-label="Día siguiente"
          onClick={() => selectDate(shiftDateKey(value, 1))}
        >
          <ArrowIcon direction="right" />
        </button>

        <button
          type="button"
          className="date-nav-today"
          onClick={() => selectDate(today)}
        >
          Hoy
        </button>
      </div>
    </div>
  )
}

export default DateNav
