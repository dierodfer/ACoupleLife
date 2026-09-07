/*
 * Service worker de la app instalada (PWA).
 *
 * Dos motivos para tenerlo, los dos de Android/Chrome:
 *   1. Sin un service worker que responda a `fetch`, Chrome no ofrece instalar
 *      la app en el sistema (no dispara `beforeinstallprompt`).
 *   2. Instalada como app, se abre desde el icono sin barra de navegador: si no
 *      hay red, sin caché saldría el dinosaurio en vez de la app.
 *
 * Lo que se cachea es solo el «armazón» (HTML, JS, CSS, iconos), nunca los
 * datos: el JSON vive en Drive y se pide siempre a la red, igual que el login.
 * Por eso este archivo no toca nada que no sea del propio origen.
 *
 * Al cambiar la estrategia o los archivos esenciales hay que subir VERSION:
 * es lo que hace que el navegador tire la caché vieja al activarse.
 */

const VERSION = 'v1'
const CACHE = `acouplelife-${VERSION}`

// La app se publica en un subdirectorio (`/ACoupleLife/`), así que la base sale
// de dónde está este archivo y no de una constante que habría que mantener.
const BASE = new URL('./', self.location.href).pathname
const INDICE = `${BASE}index.html`

/** Lo mínimo para que la app arranque sin red. El resto se cachea al usarse. */
const ESENCIALES = [
  BASE,
  INDICE,
  `${BASE}manifest.webmanifest`,
  `${BASE}favicon.svg`,
  `${BASE}iconos/icono-192.png`,
  `${BASE}iconos/icono-512.png`,
]

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      // `allSettled` y no `addAll`: si un icono falla, la instalación sigue en
      // pie con el HTML cacheado, que es lo que de verdad importa.
      await Promise.allSettled(
        ESENCIALES.map((ruta) => cache.add(new Request(ruta, { cache: 'reload' }))),
      )
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nombres = await caches.keys()
      await Promise.all(
        nombres.filter((n) => n.startsWith('acouplelife-') && n !== CACHE).map((n) => caches.delete(n)),
      )
      await self.clients.claim()
    })(),
  )
})

/**
 * Navegación (abrir la app): primero la red, para que un despliegue nuevo se
 * vea en cuanto haya conexión, y la caché solo como red de seguridad.
 */
async function navegar(peticion) {
  const cache = await caches.open(CACHE)
  try {
    const respuesta = await fetch(peticion)
    if (respuesta.ok) await cache.put(INDICE, respuesta.clone())
    return respuesta
  } catch (error) {
    const guardado = (await cache.match(peticion)) ?? (await cache.match(INDICE))
    if (guardado) return guardado
    throw error
  }
}

/**
 * Recursos del armazón: primero la caché. Los nombres del build llevan hash
 * (`index-a1b2c3.js`), así que una versión cacheada nunca queda desfasada:
 * si el contenido cambia, cambia también la URL.
 */
async function servir(peticion) {
  const cache = await caches.open(CACHE)
  const guardado = await cache.match(peticion)
  if (guardado) return guardado

  const respuesta = await fetch(peticion)
  if (respuesta.ok && respuesta.type === 'basic') await cache.put(peticion, respuesta.clone())
  return respuesta
}

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request
  if (peticion.method !== 'GET') return

  const url = new URL(peticion.url)

  // Google (login, Drive, Picker) y cualquier otro origen: siempre a la red.
  // Cachear una respuesta con token o con datos de la pareja sería guardar en
  // el disco del dispositivo algo que solo debe vivir en memoria.
  if (url.origin !== self.location.origin) return

  // La API del modo local del dev server (ver vite.config.ts) sirve los datos:
  // tampoco se cachea, aunque en desarrollo no haya service worker registrado.
  if (url.pathname.includes('__local-data__')) return

  if (peticion.mode === 'navigate') {
    evento.respondWith(navegar(peticion))
    return
  }

  if (!url.pathname.startsWith(BASE)) return
  evento.respondWith(servir(peticion))
})
