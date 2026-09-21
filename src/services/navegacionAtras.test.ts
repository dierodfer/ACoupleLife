// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { intentarSalir, vigilarAtras } from './navegacionAtras'

// Como en pwa.test.ts: se vigila una sola vez para todo el archivo, igual que
// `main.tsx` lo hace una sola vez para toda la app.
const empujar = vi.spyOn(history, 'pushState')
const alPulsar = vi.fn()
vigilarAtras(alPulsar)

describe('centinela de atrás', () => {
  it('arma una entrada de más al empezar a vigilar', () => {
    expect(empujar).toHaveBeenCalledTimes(1)
  })

  it('avisa a quien escucha y vuelve a armar el centinela en cada atrás', () => {
    empujar.mockClear()
    alPulsar.mockClear()

    window.dispatchEvent(new PopStateEvent('popstate'))

    expect(alPulsar).toHaveBeenCalledTimes(1)
    expect(empujar).toHaveBeenCalledTimes(1)
  })
})

describe('intentarSalir', () => {
  it('pide al navegador que cierre la ventana', () => {
    const cerrar = vi.spyOn(window, 'close').mockImplementation(() => {})

    intentarSalir()

    expect(cerrar).toHaveBeenCalled()
  })
})
