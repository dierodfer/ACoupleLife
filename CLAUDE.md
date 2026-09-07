# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

App web para que una pareja sepa cuánto tiene que transferir cada uno este mes para llegar a
su objetivo de aportación. Sin backend ni base de datos: todos los datos viven en un único
archivo JSON en el Google Drive de la pareja, y todo el cálculo ocurre en el navegador.

Las reglas de negocio y el esquema de datos no viven en un documento aparte: están en el
propio código, como comentarios de `src/lib/tipos.ts` (esquema del `Datos` persistido) y
`src/lib/calculo.ts` (fórmulas y decisiones de diseño). Consultarlos antes de cambiar
cualquier regla de cálculo o el formato del JSON persistido.

Todo el código, comentarios y UI están en español.

## Comandos

```bash
npm run dev         # servidor de desarrollo (Vite)
npm test            # tests de una vez (Vitest)
npm run test:watch  # tests en watch
npm run test:e2e    # build + Playwright: comportamiento de la app instalada (PWA)
npm run lint        # ESLint + SonarJS
npm run typecheck   # tsc -b --noEmit
npm run build       # tsc -b && vite build -> dist/
```

Un solo test o archivo: `npx vitest run src/lib/calculo.test.ts -t "nombre del test"`.

El linter usa **SonarJS**, el mismo motor de reglas que aplica SonarCloud a JS/TS, así que
pasar `npm run lint` en local evita que los problemas aparezcan luego en el análisis remoto.
La configuración (`eslint.config.js`) desactiva dos reglas con su motivo escrito al lado:
`todo-tag` confunde la palabra española «todo» con un marcador TODO, y `redundant-type-aliases`
señala los alias semánticos de `tipos.ts` (`MesKey`, `FechaKey`, `PersonaId`), que existen
para documentar el formato de cada cadena.

## Arquitectura

### Capas, de dentro afuera

1. **`src/lib/`** — lógica pura, sin React ni Drive. Es el núcleo: entra el `Datos` completo
   (el JSON íntegro) y sale un resultado. Con tests (`*.test.ts`).
   - `tipos.ts` — todas las interfaces del dominio y del esquema persistido (`Datos`).
   - `calculo.ts` — solo lectura: deriva resúmenes (`resumenMes`, `resumenAnio`, etc.) a partir
     de `Datos`. La fórmula central: `pendiente = objetivo − gastos − efectivo − transferencias`.
     **Los meses son independientes**: un excedente o déficit nunca se arrastra al mes
     siguiente; el acumulado anual es solo informativo.
   - `mutaciones.ts` — solo escritura: cada función recibe `Datos` y devuelve un `Datos` nuevo
     (inmutable), sin tocar Drive ni el store. La decisión de cuándo guardar vive en la capa
     de arriba (`store`).
   - `esquema.ts` — `datosIniciales` (archivo que crea el primer usuario) y `normalizar`. El
     archivo de Drive es editable a mano y puede venir de una versión anterior del esquema, así
     que `normalizar` no da nada por hecho: cada campo se valida y se rellena con un valor por
     defecto seguro.
   - `fechas.ts` — todo en torno a `MesKey` (`"AAAA-MM"`) y `FechaKey` (`"AAAA-MM-DD"`). El
     formato `AAAA-MM` hace que la comparación lexicográfica ya sea cronológica.

2. **`src/services/`** — integraciones externas, cada una con su propia advertencia importante:
   - `auth.ts` — Google Identity Services, *token flow* (sin backend, así que no hay refresh
     token: un access token dura ~1h). Todo el que necesite un token debe pedirlo con
     `tokenValido()`, que lo renueva en silencio cuando quedan <5 min, nunca guardarlo.
     En `localStorage` se persisten **solo el token y su caducidad**, para no pasar por Google
     en cada visita. El perfil se queda en memoria a propósito: lo que se escribe en el
     almacenamiento sale de la propia app, nunca del JSON de un servicio externo (Sonar
     `tssecurity:S8475` marca ese flujo, y ni validar por tipo ni por forma lo satisface —
     solo no escribirlo). Como efecto, al arrancar se relee el perfil (una petición, sin
     ventana) y el `hint` de la renovación silenciosa solo existe si ya se leyó en esa
     pestaña. Tiene tests (`auth.test.ts`), porque todo eso ocurre sin interfaz.
   - `drive.ts` — CRUD del archivo JSON en Drive. Drive API v3 no expone `etag`; el control de
     concurrencia usa el campo `version` (entero que Drive incrementa en cada escritura). Es
     **detección de conflicto, no bloqueo**: `guardar()` relee la `version` remota antes de
     escribir y lanza `ConflictoDrive` si no coincide, porque la API no ofrece escritura
     condicional atómica. También gestiona el Google Picker (selección del segundo usuario) y
     compartir el archivo, ambos limitados por el scope `drive.file` (la app solo puede tocar
     lo que ella misma ha creado). Por eso el Picker se construye con `setAppId` (el número de
     proyecto, deducido del client ID): es lo que concede el acceso a un archivo ajeno, y sin
     él la selección funciona pero Drive responde 404 al leerlo.
   - `pwa.ts` — instalación en el sistema operativo, pensada sobre todo para Android. Tres
     cosas, todas con el mismo motivo de vivir en un módulo y no en el store: el navegador
     avisa antes de que la interfaz exista, así que se escucha desde `main.tsx` y la UI se
     suscribe con `useSyncExternalStore`.
     1. Guarda el evento `beforeinstallprompt` de Chrome (llega muy pronto y solo sirve una
        vez) para poder ofrecer «Instalar» desde Ajustes.
     2. Registra `public/sw.js` **solo en producción**: en `dev` serviría módulos cacheados
        por encima de los que Vite acaba de recompilar.
     3. Detecta la versión nueva esperando (`updatefound` → `installed` **con** controlador ya
        presente) y la aplica cuando la persona acepta. La recarga la dispara
        `controllerchange`, ignorando el primer relevo —el `clients.claim()` de la instalación
        inicial, que si no haría parpadear la app en su estreno—.
     Tiene tests (`pwa.test.ts`), y el comportamiento real en `pruebas-e2e/pwa.spec.ts`.

3. **`src/store/useStore.ts`** — el único punto que conecta lib + services + UI, con Zustand.
   - Máquina de estados explícita en `EstadoApp` (`arrancando` → `sinSesion`/`sinArchivo` →
     `cargando` → `listo` ⇄ `guardando`/`conflicto`).
   - `aplicar(mutacion)` es el único camino para modificar `datos`: aplica una función de
     `mutaciones.ts` y programa autoguardado (debounce de 2s vía `programarAutoguardado`).
   - `guardar()` sella (`mutaciones.sellar`) y sube a Drive; si Drive devuelve conflicto, pasa a
     estado `conflicto` y expone `descartarYRecargar` / `sobrescribir` para que la UI decida.

4. **`src/componentes/`** — UI. `App.tsx` es el shell (pestañas Mes/Año/Ajustes + barra de
   estado de guardado/conflicto). Cada pantalla lee `datos` ya cargado del store y llama a
   `aplicar(mutacion)` para escribir.

### Flujo de una escritura

`Componente` → `store.aplicar(mutacionDeLib)` → nuevo `Datos` en memoria + autoguardado
programado → `store.guardar()` → `mutaciones.sellar` → `drive.guardar` (compara `version`) →
éxito actualiza `version` local, o conflicto pasa el store a estado `conflicto`.

### Estilos

Tailwind v4 con tokens de tema en `src/index.css` (`@theme`, con variante `dark` vía
`prefers-color-scheme`): `fondo`, `superficie`, `borde`, `tinta`, `tenue`, `acento`, `positivo`,
`negativo`. Usar estos tokens (`text-tenue`, `bg-superficie`, etc.) en vez de colores sueltos de
Tailwind para que la app respete el tema claro/oscuro automáticamente.

### PWA (instalable en Android)

Todo lo que hace falta vive en `public/`, que Vite copia tal cual, y en `src/services/pwa.ts`.

**Qué exige hoy Chrome para instalar**: HTTPS y un manifiesto con `name`/`short_name`,
`start_url`, `display` e iconos de 192 y 512. El service worker **ya no es requisito** (Chrome
lo quitó de sus criterios, y Lighthouse eliminó la categoría PWA por lo mismo); aquí existe por
el modo sin red, no por la instalación.

- `manifest.webmanifest` — rutas **relativas** (`id`, `start_url` y `scope` a `"."`, iconos sin
  `/` inicial) para que valgan igual bajo `/ACoupleLife/` en Pages que bajo otro `VITE_BASE`.
  El `id` explícito fija la identidad de la app instalada: si algún día cambia `start_url`,
  Android la seguiría reconociendo como la misma y no como una app nueva.
  Lleva `screenshots` + `description` porque son lo que hace que Android enseñe el diálogo de
  instalación bueno (el de tarjeta con capturas) en vez del banner mínimo; las capturas están
  en `public/capturas/` y las condiciones que Chrome impone —PNG o JPEG, entre 320 y 3840 px,
  lado mayor ≤ 2.3× el menor, misma proporción entre todas las del mismo `form_factor`— las
  vigila `pruebas-e2e/pwa.spec.ts`. Se rehacen abriendo la app en modo local a 412×892.
- `sw.js` — service worker. Cachea solo el armazón del mismo origen; Google (login, Drive,
  Picker) y `__local-data__` van siempre a la red, porque una respuesta con token o con los
  datos de la pareja no debe quedarse en el disco del dispositivo. Navegación con `preload` y
  red primero; recursos con hash, caché primero. **No hace `skipWaiting()` al instalar**: la
  versión nueva espera a que la persona acepte el aviso (mensaje `ACTIVAR_YA`), para no
  cambiar el código por debajo de una pantalla con cambios a medio guardar en Drive. Al
  cambiar la estrategia o los archivos esenciales hay que subir `VERSION`: es lo que tira la
  caché vieja.
- `iconos/` — PNG versionados, generados con `node scripts/generar-iconos.mjs` (dibuja la misma
  marca de dos anillos que `MarcaApp`, sin dependencias). Android necesita las dos familias:
  `any` con sus esquinas ya redondeadas y `maskable` a sangre, con el dibujo dentro del 80%
  central que respeta cualquier máscara del sistema.
- El `<meta name="theme-color">` de `index.html` lo actualiza `lib/tema.ts` al cambiar de tema:
  es el color de la barra de estado con la app instalada, y ahí no llegan ni las variables CSS
  ni `oklch()`.

**Cómo se comprueba** (`npm run test:e2e`, también en CI): Playwright con Chromium sobre el
build, con un servidor estático propio (`pruebas-e2e/servidor.ts`) que puede cambiar el `sw.js`
servido a mitad de prueba para simular un despliegue. Cubre los criterios de instalación, que
los iconos y capturas midan lo que declara el manifiesto, el arranque sin conexión, que no se
cachee nada de otro origen y el aviso de versión nueva de punta a punta. A mano:
`npm run build && npm run preview` (en `dev` el service worker no se registra a propósito).

## Variables de entorno

`VITE_GOOGLE_CLIENT_ID` y `VITE_GOOGLE_API_KEY` (ver `.env.example`). Sin ellas, `auth.ts` y
`drive.elegirArchivo` lanzan un error explícito en vez de fallar en silencio.

## CI/despliegue

`.github/workflows/deploy.yml`: en cada push y PR corre `lint` → `typecheck` → `test` → `build`
(inyectando los secrets `GOOGLE_CLIENT_ID`/`GOOGLE_API_KEY`); al llegar a `main` publica
`dist/` en GitHub Pages.
