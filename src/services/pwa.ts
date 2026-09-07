/**
 * Instalación de la app en el sistema operativo (PWA), pensada sobre todo para
 * Android: allí Chrome deja instalarla desde la propia página, sin tienda.
 *
 * Dos piezas independientes:
 *   - `registrarServiceWorker()`: registra `public/sw.js`, que es el que hace
 *     que la app se pueda instalar y que arranque sin red.
 *   - el resto: guarda el evento `beforeinstallprompt` que dispara Chrome
 *     cuando la app cumple los requisitos, para poder ofrecer el botón
 *     «Instalar» dentro de Ajustes en vez de esperar al banner del navegador.
 *
 * El evento hay que capturarlo en cuanto llega (Chrome lo dispara muy pronto,
 * antes de que la UI esté montada) y solo se puede usar una vez, así que vive
 * aquí, en un módulo, y la UI se suscribe con `useSyncExternalStore`.
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

/**
 * Registra el service worker. Solo en producción: en desarrollo serviría
 * módulos cacheados por encima de los que acaba de recompilar Vite.
 */
export function registrarServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  // Después de `load` para no competir por el ancho de banda del primer pintado.
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((error: unknown) => {
      // Sin service worker la app funciona igual: solo pierde el modo sin red.
      console.warn('No se pudo registrar el service worker', error)
    })
  })
}
