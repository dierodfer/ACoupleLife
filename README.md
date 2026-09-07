# ACoupleLife — Cuentas de pareja

Aplicación web para que una pareja sepa **cuánto tiene que transferir cada uno este mes**
para llegar a su objetivo de aportación.

Sin backend y sin base de datos: los datos viven en un único archivo JSON en el Google Drive
de la pareja, y todo el cálculo ocurre en el navegador.

## Cómo funciona

Cada persona tiene un objetivo mensual. De ese objetivo se descuentan sus gastos (puntuales y
recurrentes), el efectivo que aporta y las transferencias que ya ha hecho:

```
objetivo − gastos − efectivo − transferencias = pendiente
```

Los meses son independientes: si un mes se aporta de más, el excedente se muestra pero no se
arrastra al siguiente.

## Puesta en marcha

```bash
npm install
cp .env.example .env   # y rellenar las credenciales de Google
npm run dev
```

### Credenciales de Google

Hace falta un proyecto propio en Google Cloud, con la pantalla de consentimiento en modo
"Externo / En pruebas" y los dos emails de la pareja como usuarios de prueba:

1. **Client ID** de tipo "Aplicación web", con `http://localhost:5173` y
   `https://<usuario>.github.io` como orígenes autorizados de JavaScript → `VITE_GOOGLE_CLIENT_ID`.
2. **Clave de API** restringida a la Picker API, que solo usa el selector de archivos del
   segundo usuario → `VITE_GOOGLE_API_KEY`.

El scope es `drive.file`, así que la aplicación solo puede tocar el archivo que ella misma
crea. Nunca ve el resto del Drive.

## Instalarla en el móvil

La app se puede instalar en el sistema (PWA) y quedarse en la pantalla de inicio con su icono,
sin barra de navegador:

- **Android (Chrome):** al abrirla aparece la opción de instalar; también está el botón
  **Instalar en este dispositivo** en Ajustes → Aplicación, o el menú ⋮ → «Añadir a la pantalla
  de inicio».
- **iPhone (Safari):** botón de compartir → «Añadir a inicio». Safari no permite ofrecerlo desde
  la propia página.

Instalada funciona igual —los datos siguen siendo el archivo de Drive— y arranca sin conexión,
aunque hasta que haya red no podrá leer ni guardar nada.

Los iconos (`public/iconos/`) están generados y versionados; se rehacen con
`node scripts/generar-iconos.mjs` solo si cambia la marca.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Tests de la lógica de cálculo |
| `npm run typecheck` | Comprobación de tipos |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve `dist/` para probar la instalación y el modo sin red |

## Estructura

```
src/lib/          Lógica pura: cálculo, mutaciones, esquema, fechas. Con tests.
src/services/     Google Identity Services y Drive.
src/store/        Estado de la app (Zustand) y guardado en Drive.
src/componentes/  Interfaz.
```

La lógica de `src/lib/` no sabe nada de React ni de Drive: entra el JSON completo y sale el
desglose. Es donde están los tests y donde debería empezar cualquier cambio de reglas.

## Despliegue

`.github/workflows/deploy.yml` ejecuta typecheck, tests y build en cada push y pull request, y
publica en GitHub Pages al llegar a `main`. Las credenciales se leen de los secrets
`GOOGLE_CLIENT_ID` y `GOOGLE_API_KEY` del repositorio.
