import { useEffect, useState } from 'react'
import PartidosPage from './pages/Partidos.jsx'
import HistorialPage from './pages/Historial.jsx'
import './App.css'

// Rutas de la aplicación: "/" (Partidos) y "/historial". Cualquier otra ruta
// muestra la página de Partidos (el fallback lo resuelve vercel.json).
function getRoute() {
  const path = window.location.pathname.replace(/\/+$/, '')
  return path === '/historial' ? 'historial' : 'partidos'
}

function App() {
  const [route, setRoute] = useState(getRoute)

  // Los botones atrás/adelante del navegador actualizan la página activa.
  useEffect(() => {
    const handlePopState = () => setRoute(getRoute())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Navegación SPA: cambia la URL sin recargar y lleva el scroll al inicio.
  const navigate = (to) => (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }
    event.preventDefault()
    const target = to.replace(/\/+$/, '') || '/'
    if (window.location.pathname !== target) {
      window.history.pushState({}, '', target)
    }
    setRoute(getRoute())
    window.scrollTo(0, 0)
  }

  const isPartidos = route === 'partidos'

  return (
    <div className="app">
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="/" onClick={navigate('/')}>
            <svg
              className="brand-icon"
              viewBox="0 0 32 32"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2.2" />
              <path
                d="M16 3v26M3 16h26M6.5 6.5c3.2 2.6 5 5.7 5 9.5s-1.8 6.9-5 9.5M25.5 6.5c-3.2 2.6-5 5.7-5 9.5s1.8 6.9 5 9.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <span className="brand-text">
              <strong>NBA Stats</strong>
              <small>Análisis personal de la NBA</small>
            </span>
          </a>
          <nav className="main-nav" aria-label="Navegación principal">
            <a
              href="/"
              className={isPartidos ? 'active' : ''}
              aria-current={isPartidos ? 'page' : undefined}
              onClick={navigate('/')}
            >
              Partidos
            </a>
            <a
              href="/historial"
              className={isPartidos ? '' : 'active'}
              aria-current={isPartidos ? undefined : 'page'}
              onClick={navigate('/historial')}
            >
              Historial
            </a>
          </nav>
        </div>
      </header>

      <main className="container page">
        {isPartidos ? <PartidosPage /> : <HistorialPage />}
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <p>
            <strong>NBA Stats</strong> · Proyecto personal de práctica con React
            y Vite.
          </p>
          <p>Proyecto en desarrollo · Sin apuestas ni cuotas.</p>
          <p className="footer-source">Datos de partidos: ESPN</p>
        </div>
      </footer>
    </div>
  )
}

export default App
