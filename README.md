# NBA Stats

Aplicación web personal para consultar partidos de la NBA y el historial de
pronósticos personales.

## Páginas

- `/` — **Partidos**: partidos reales de ESPN con horarios en hora española,
  estados y marcadores; se actualizan automáticamente cada 60 segundos.
- `/historial` — **Historial de pronósticos**: estructura preparada para el
  sistema de pronósticos (agrupada por fecha). De momento muestra un estado
  vacío porque el sistema aún no está implementado.

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
- No hay cuentas de usuario, bases de datos ni servicios externos.
- No incluye apuestas ni cuotas.
