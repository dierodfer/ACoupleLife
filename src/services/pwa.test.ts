// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  estaInstalada,
  instalar,
  sePuedeInstalar,
  suscribirseAInstalacion,
  vigilarInstalacion,
} from './pwa'

/**
 * La invitación a instalar la app la manda Chrome una sola vez y hay que
 * guardarla al vuelo (ver `pwa.ts`). Como no se ve por ninguna parte hasta que
 * alguien abre Ajustes, se comprueba aquí.
 */

/** El `beforeinstallprompt` de Chrome, con el guion que le marquemos. */
function eventoDeChrome(respuesta: 'accepted' | 'dismissed') {
  const evento = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
  evento.prompt = vi.fn(() => Promise.resolve())
  evento.userChoice = Promise.resolve({ outcome: respuesta })
  return evento
}

// Una sola vez, como en `main.tsx`: son oyentes del `window` para toda la vida
// de la página.
vigilarInstalacion()

beforeEach(() => {
  // `appinstalled` es lo que vacía la invitación guardada: sirve de reinicio.
  window.dispatchEvent(new Event('appinstalled'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('invitación de instalación', () => {
  it('no hay nada que instalar hasta que Chrome lo ofrece', () => {
    expect(sePuedeInstalar()).toBe(false)
  })

  it('guarda la invitación de Chrome y avisa a la interfaz', () => {
    const alCambiar = vi.fn()
    suscribirseAInstalacion(alCambiar)

    window.dispatchEvent(eventoDeChrome('accepted'))

    expect(sePuedeInstalar()).toBe(true)
    expect(alCambiar).toHaveBeenCalled()
  })

  it('se queda con el banner del navegador para poder ofrecerlo desde Ajustes', () => {
    const evento = eventoDeChrome('accepted')
    const evitar = vi.spyOn(evento, 'preventDefault')

    window.dispatchEvent(evento)

    expect(evitar).toHaveBeenCalled()
  })

  it('instalar abre el diálogo del sistema y cuenta si se aceptó', async () => {
    const evento = eventoDeChrome('accepted')
    window.dispatchEvent(evento)

    await expect(instalar()).resolves.toBe(true)
    expect(evento.prompt).toHaveBeenCalled()
  })

  it('la invitación se gasta al usarla: no se puede lanzar dos veces', async () => {
    window.dispatchEvent(eventoDeChrome('dismissed'))

    await expect(instalar()).resolves.toBe(false)
    expect(sePuedeInstalar()).toBe(false)
    await expect(instalar()).resolves.toBe(false)
  })

  it('deja de ofrecerse en cuanto el sistema dice que ya está instalada', () => {
    window.dispatchEvent(eventoDeChrome('accepted'))
    window.dispatchEvent(new Event('appinstalled'))

    expect(sePuedeInstalar()).toBe(false)
  })
})

describe('detección de app instalada', () => {
  /**
   * jsdom no trae `matchMedia`, así que hay que ponerlo a mano; `display-mode`
   * es justo lo que distingue la ventana de la app de una pestaña normal.
   */
  function abrirComo(modo: 'app' | 'pestaña') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (consulta: string) => ({ matches: modo === 'app' && consulta.includes('standalone') }),
    })
  }

  it('abierta en una pestaña normal, no está instalada', () => {
    abrirComo('pestaña')

    expect(estaInstalada()).toBe(false)
  })

  it('abierta desde el icono (sin barra de navegador), sí', () => {
    abrirComo('app')

    expect(estaInstalada()).toBe(true)
  })
})
