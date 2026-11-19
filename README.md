# NBA Stats

Aplicación web personal para consultar partidos de la NBA y el historial de
pronósticos personales.

## Páginas

- `/` — **Partidos**: partidos reales de ESPN con horarios en hora española,
  estados y marcadores; se actualizan automáticamente cada 60 segundos. Cada
  tarjeta es desplegable (acordeón) y muestra las **probabilidades de ganar**
  y el **selector de ganador**: puedes elegir (o cambiar) equipo mientras el
  partido esté programado; al comenzar, la elección queda bloqueada.
- `/historial` — **Historial de pronósticos**: tus elecciones guardadas,
  agrupadas por fecha, con el equipo elegido y el resultado real de ESPN
  (**Acierto** / **Fallo** / **Pendiente**). Los resultados se consultan a la
  API de ESPN por fecha, también para partidos anteriores.

## Tecnologías

- React + Vite
- CSS puro (sin librerías de estilo adicionales)
- Router propio con History API (sin dependencias); `vercel.json` añade el
  fallback de rutas para desplegar en Vercel.

## Desarrollo

```bash
npm install
npm run dev
```

## Notas

- Los partidos se cargan en tiempo real desde la API pública de ESPN
  (sin claves de acceso).
- Las elecciones de ganador se guardan solo en el `localStorage` del
  navegador: no hay cuentas, bases de datos ni sincronización entre
  dispositivos.
- Las probabilidades de ganar muestran "—%": no existe una fuente pública y
  autorizada con las probabilidades que muestra Google (ver
  `src/data/probabilities.js`); el componente ya está preparado para
  conectarse cuando haya una.
- No hay cuotas ni datos de casas de apuestas; el marcador de ESPN incluye
  `odds` de terceros, pero no se muestra ni se usa.
- No incluye apuestas ni cuotas.
