/**
 * Instalación de la app en el sistema operativo (PWA), pensada sobre todo para
 * Android: allí Chrome deja instalarla desde la propia página, sin tienda.
 *
 * Tres piezas independientes:
 *   - la invitación de instalación: guarda el evento `beforeinstallprompt` que
 *     dispara Chrome cuando la app cumple los requisitos, para poder ofrecer el
 *     botón «Instalar» dentro de Ajustes en vez de esperar al banner del
 *     navegador. Hay que capturarlo en cuanto llega (Chrome lo dispara muy
 *     pronto, antes de que la UI esté montada) y solo se puede usar una vez,
 *     así que vive aquí, en un módulo, y la UI se suscribe con
 *     `useSyncExternalStore`.
 *   - `registrarServiceWorker()`: registra `public/sw.js`, el que hace que la
 *     app arranque sin red una vez instalada.
 *   - el aviso de versión nueva: instalada, la app puede pasar días abierta y
 *     no volver a pasar por el navegador, así que el despliegue nuevo se queda
 *     esperando. Se avisa y se recarga cuando la persona quiere, nunca por
 *     debajo de una pantalla con cambios a medio guardar.
 */

/** El evento no está en la librería estándar: solo existe en Chromium. */
interface EventoInstalacion extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let pendiente: EventoInstalacion | null = null
const suscriptores = new Set<() => void>()

function avisar(): void {
  for (const suscriptor of suscriptores) suscriptor()
}

/**
 * Empieza a escuchar a Chrome. Se llama una sola vez, al arrancar la app,
 * antes del primer render.
 */
export function vigilarInstalacion(): void {
  window.addEventListener('beforeinstallprompt', (evento) => {
    // Sin esto Chrome enseña su propio banner y se queda con el evento.
    evento.preventDefault()
    pendiente = evento as EventoInstalacion
    avisar()
  })

  window.addEventListener('appinstalled', () => {
    pendiente = null
    avisar()
  })
}

/** Para `useSyncExternalStore`: devuelve la función de baja. */
export function suscribirseAInstalacion(alCambiar: () => void): () => void {
  suscriptores.add(alCambiar)
  return () => suscriptores.delete(alCambiar)
}

/** ¿Hay una invitación de instalación viva que podamos lanzar nosotros? */
export function sePuedeInstalar(): boolean {
  return pendiente !== null
}

/**
 * Abre el diálogo de instalación del sistema. Devuelve si la persona aceptó.
 * El evento se consume aunque diga que no: Chrome mandará otro más adelante
 * si sigue cumpliendo los requisitos.
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

/**
 * ¿Se está viendo ya como app instalada? En Android e iOS la ventana no
 * tiene barra de navegador (`standalone`); `navigator.standalone` es la
 * versión antigua de Safari, que no entiende `display-mode`.
 */
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

/** Para `useSyncExternalStore`: devuelve la función de baja. */
export function suscribirseAVersionNueva(alCambiar: () => void): () => void {
  suscriptoresVersion.add(alCambiar)
  return () => suscriptoresVersion.delete(alCambiar)
}

/** ¿Hay una versión ya descargada esperando a que recarguemos? */
export function hayVersionNueva(): boolean {
  return enEspera !== null
}

/**
 * Activa la versión que espera. El service worker responde con `skipWaiting()`
 * y el `controllerchange` de más abajo recarga la página, ya con el código
 * nuevo. No se recarga aquí a mano para no adelantarse al relevo.
 */
export function aplicarVersionNueva(): void {
  enEspera?.postMessage({ tipo: 'ACTIVAR_YA' })
}

/**
 * Un worker en `installed` habiendo ya un controlador es, por definición, una
 * versión nueva esperando: la primera instalación no tiene controlador.
 */
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

/**
 * Registra el service worker. Solo en producción: en desarrollo serviría
 * módulos cacheados por encima de los que acaba de recompilar Vite.
 */
export function registrarServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  // En la primera visita la página empieza sin controlador y lo gana al
  // activarse el service worker (`clients.claim()`). Ese cambio no es un
  // relevo: si se recargara también ahí, cada estreno de la app parpadearía.
  const yaControlada = navigator.serviceWorker.controller !== null

  let recargando = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Solo una vez: el relevo dispara este evento en todas las pestañas.
    if (!yaControlada || recargando) return
    recargando = true
    window.location.reload()
  })

  // Después de `load` para no competir por el ancho de banda del primer pintado.
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL
    navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base })
      .then((registro) => {
        vigilarRelevo(registro)

        // Instalada, la app puede no cerrarse en días y el navegador no vuelve
        // a mirar por su cuenta: al volver a ella se comprueba si hay versión.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void registro.update()
        })
      })
      .catch((error: unknown) => {
        // Sin service worker la app funciona igual: solo pierde el modo sin red.
        console.warn('No se pudo registrar el service worker', error)
      })
  })
}
