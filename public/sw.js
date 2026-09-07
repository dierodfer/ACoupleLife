/*
 * Service worker de la app instalada (PWA). No hace falta para poder
 * instalarla (Chrome ya no lo exige), pero sí para arrancar sin red una vez
 * instalada. Cachea solo el armazón (HTML/JS/CSS/iconos) del propio origen;
 * Google (login, Drive, Picker) va siempre a la red.
 *
 * Al cambiar la estrategia o los archivos esenciales hay que subir VERSION,
 * para que el navegador tire la caché vieja al activarse.
 */

const VERSION = 'v2'
const CACHE = `acouplelife-${VERSION}`

const BASE = new URL('./', self.location.href).pathname
const INDICE = `${BASE}index.html`

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
      // `allSettled`: si un icono falla, la instalación sigue con el HTML cacheado.
      await Promise.allSettled(
        ESENCIALES.map((ruta) => cache.add(new Request(ruta, { cache: 'reload' }))),
      )
    })(),
    // Sin `skipWaiting()` a propósito: la versión nueva espera al aviso de la
    // app (mensaje ACTIVAR_YA), para no cambiar el código bajo una pantalla
    // con cambios a medio guardar en Drive.
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable()
      }

      const nombres = await caches.keys()
      await Promise.all(
        nombres
          .filter((n) => n.startsWith('acouplelife-') && n !== CACHE)
          .map((n) => caches.delete(n)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (evento) => {
  if (evento.data?.tipo === 'ACTIVAR_YA') void self.skipWaiting()
})

/** Navegación: red primero, caché como red de seguridad sin conexión. */
async function navegar(evento) {
  const cache = await caches.open(CACHE)
  try {
    const respuesta = (await evento.preloadResponse) || (await fetch(evento.request))
    if (respuesta.ok) await cache.put(INDICE, respuesta.clone())
    return respuesta
  } catch (error) {
    const guardado = (await cache.match(evento.request)) ?? (await cache.match(INDICE))
    if (guardado) return guardado
    throw error
  }
}

/** Recursos con hash: caché primero, nunca quedan desfasados. */
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

  if (url.origin !== self.location.origin) return
  // Modo local del dev server (ver vite.config.ts): tampoco se cachea.
  if (url.pathname.includes('__local-data__')) return

  if (peticion.mode === 'navigate') {
    evento.respondWith(navegar(evento))
    return
  }

  if (!url.pathname.startsWith(BASE)) return
  evento.respondWith(servir(peticion))
})
