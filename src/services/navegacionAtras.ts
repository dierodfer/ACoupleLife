/**
 * El atrás de Android navega el historial del navegador, no la app: con una
 * sola entrada en la pila, el primer atrás cierra la PWA sin avisar. Se
 * blinda con una entrada de más («centinela»): ese atrás se consume como un
 * `popstate` normal y quien escucha decide qué hacer. Ver CLAUDE.md.
 */

function armarCentinela(): void {
  history.pushState({ centinelaAtras: true }, '')
}

export function vigilarAtras(alPulsar: () => void): void {
  armarCentinela()
  window.addEventListener('popstate', () => {
    alPulsar()
    armarCentinela()
  })
}

/** `window.close()` solo cierra una ventana abierta por script, salvo la PWA instalada (`standalone`). */
export function intentarSalir(): void {
  window.close()
}
