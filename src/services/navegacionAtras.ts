/**
 * El botón o gesto «atrás» de Android navega el historial del navegador, no
 * la app: con una sola entrada en la pila, el primer atrás cierra la PWA sin
 * avisar. Se blinda empujando una entrada de más al historial (un
 * «centinela»): ese atrás se consume como un `popstate` normal de la
 * página en vez de salir de golpe, y quien esté escuchando decide qué hacer
 * —cerrar un modal, volver de una subpantalla o preguntar si se quiere
 * salir—. Vive en un módulo aparte, como `pwa.ts`, porque el navegador puede
 * disparar el evento antes de que React esté montado.
 */

function armarCentinela(): void {
  history.pushState({ centinelaAtras: true }, '')
}

/** Un centinela por cada atrás consumido: si no se repusiera, el siguiente saldría sin avisar. */
export function vigilarAtras(alPulsar: () => void): void {
  armarCentinela()
  window.addEventListener('popstate', () => {
    alPulsar()
    armarCentinela()
  })
}

/**
 * No hay forma portable de cerrar una PWA desde JavaScript: los navegadores
 * solo permiten `window.close()` sobre una ventana que el propio script
 * abrió. Chrome hace una excepción con la app instalada (modo `standalone`,
 * sin pestaña que perder), que es el único sitio donde esto tiene efecto; en
 * el resto no pasa nada más y la persona se queda donde estaba.
 */
export function intentarSalir(): void {
  window.close()
}
