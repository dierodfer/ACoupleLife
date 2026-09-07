/**
 * Instalación de la app en el sistema operativo (PWA), pensada sobre todo para
 * Android. El evento de instalación y el aviso de versión nueva viven en
 * módulos (no en el store) porque el navegador los dispara antes de que la UI
 * exista; se escuchan desde `main.tsx` y la UI se suscribe con
 * `useSyncExternalStore`.
 */

/** No está en la librería estándar: solo existe en Chromium. */
interface EventoInstalacion extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let pendiente: EventoInstalacion | null = null
const suscriptores = new Set<() => void>()

function avisar(): void {
  for (const suscriptor of suscriptores) suscriptor()
}

export function vigilarInstalacion(): void {
  window.addEventListener('beforeinstallprompt', (evento) => {
    // Sin preventDefault, Chrome enseña su propio banner y se queda el evento.
    evento.preventDefault()
    pendiente = evento as EventoInstalacion
    avisar()
  })

  window.addEventListener('appinstalled', () => {
    pendiente = null
    avisar()
  })
}

export function suscribirseAInstalacion(alCambiar: () => void): () => void {
  suscriptores.add(alCambiar)
  return () => suscriptores.delete(alCambiar)
}

export function sePuedeInstalar(): boolean {
  return pendiente !== null
}

/**
 * El evento se consume aunque la persona decline: Chrome manda otro más
 * adelante si la app sigue cumpliendo los requisitos.
 */
export async function instalar(): Promise<boolean> {
  const evento = pendiente
  if (!evento) return false

  pendiente = null
  avisar()

  await evento.prompt()
  const { outcome } = await evento.userChoice
  return outcome === 'accepted'
}

/** `navigator.standalone` es la versión antigua de Safari, sin `display-mode`. */
export function estaInstalada(): boolean {
  const comoApp = window.matchMedia('(display-mode: standalone)').matches
  const enSafariIOS = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return comoApp || enSafariIOS
}

/* -------------------------------------------------- Versión nueva esperando */

let enEspera: ServiceWorker | null = null
const suscriptoresVersion = new Set<() => void>()

function avisarVersion(): void {
  for (const suscriptor of suscriptoresVersion) suscriptor()
}

export function suscribirseAVersionNueva(alCambiar: () => void): () => void {
  suscriptoresVersion.add(alCambiar)
  return () => suscriptoresVersion.delete(alCambiar)
}

export function hayVersionNueva(): boolean {
  return enEspera !== null
}

/** El service worker responde con `skipWaiting()`; el relevo lo recarga. */
export function aplicarVersionNueva(): void {
  enEspera?.postMessage({ tipo: 'ACTIVAR_YA' })
}

/** Un worker `installed` con controlador ya presente es una versión esperando. */
function vigilarRelevo(registro: ServiceWorkerRegistration): void {
  if (registro.waiting && navigator.serviceWorker.controller) {
    enEspera = registro.waiting
    avisarVersion()
  }

  registro.addEventListener('updatefound', () => {
    const entrante = registro.installing
    if (!entrante) return

    entrante.addEventListener('statechange', () => {
      if (entrante.state === 'installed' && navigator.serviceWorker.controller) {
        enEspera = entrante
        avisarVersion()
      }
    })
  })
}

/** Solo en producción: en `dev` serviría módulos cacheados por encima de Vite. */
export function registrarServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  // `clients.claim()` de la primera instalación también dispara `controllerchange`
  // sin ser un relevo; recargar ahí haría parpadear la app en su estreno.
  const yaControlada = navigator.serviceWorker.controller !== null

  let recargando = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!yaControlada || recargando) return
    recargando = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL
    navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base })
      .then((registro) => {
        vigilarRelevo(registro)

        // Instalada, la app puede pasar días sin cerrarse: al volver, comprueba versión.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void registro.update()
        })
      })
      .catch((error: unknown) => {
        console.warn('No se pudo registrar el service worker', error)
      })
  })
}
