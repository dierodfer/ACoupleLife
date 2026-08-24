// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Datos } from '../lib/tipos'

/**
 * Tests del guardado en Drive, que es donde vive el riesgo de perder datos:
 * el debounce, la ventana en la que se edita mientras se sube, y el reintento
 * cuando la red falla.
 */

const { auth, drive, ConflictoFalso } = vi.hoisted(() => {
  class ConflictoFalso extends Error {
    constructor(public readonly versionRemota: string) {
      super('El archivo ha cambiado en Drive.')
    }
  }
  return {
    ConflictoFalso,
    auth: {
      entrar: vi.fn(),
      salir: vi.fn(),
      reanudarSesion: vi.fn(),
    },
    drive: {
      ConflictoDrive: ConflictoFalso,
      guardar: vi.fn(),
      metadatos: vi.fn(),
      descargar: vi.fn(),
      crearArchivo: vi.fn(),
      elegirArchivo: vi.fn(),
      compartirCon: vi.fn(),
    },
  }
})

vi.mock('../services/backend', () => ({ auth, drive }))

const { ESPERAS_REINTENTO, useStore } = await import('./useStore')

function datosDe(nombre: string): Datos {
  return {
    version: 1,
    actualizadoEn: '2026-08-17T10:00:00Z',
    actualizadoPor: 'persona1@gmail.com',
    personas: [{ id: 'p1', nombre, email: 'persona1@gmail.com' }],
    recurrentes: [],
    efectivo: [],
    anios: {},
  }
}

/** Deja el store como si ya hubiera un archivo abierto y todo guardado. */
function prepararStore() {
  useStore.setState({
    estado: 'listo',
    usuario: { email: 'persona1@gmail.com', nombre: 'Persona 1' },
    fileId: 'archivo-1',
    version: '10',
    datos: datosDe('Persona 1'),
    sinGuardar: false,
    fallosSeguidos: 0,
    error: null,
  })
}

/** Una subida que no termina hasta que se la resuelve a mano. */
function subidaEnCurso() {
  let resolver!: (valor: { id: string; nombre: string; version: string }) => void
  const promesa = new Promise<{ id: string; nombre: string; version: string }>((r) => {
    resolver = r
  })
  drive.guardar.mockReturnValueOnce(promesa)
  return { resolver, promesa }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  localStorage.clear()
  prepararStore()
})

describe('autoguardado', () => {
  it('sube a Drive tras el debounce, no en cada tecla', async () => {
    drive.guardar.mockResolvedValue({ id: 'archivo-1', nombre: 'x', version: '11' })

    useStore.getState().aplicar(() => datosDe('Editado'))
    expect(useStore.getState().sinGuardar).toBe(true)
    expect(drive.guardar).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(2000)

    expect(drive.guardar).toHaveBeenCalledTimes(1)
    expect(useStore.getState().sinGuardar).toBe(false)
    expect(useStore.getState().version).toBe('11')
  })

  it('reagrupa varias ediciones seguidas en una sola subida', async () => {
    drive.guardar.mockResolvedValue({ id: 'archivo-1', nombre: 'x', version: '11' })

    useStore.getState().aplicar(() => datosDe('A'))
    await vi.advanceTimersByTimeAsync(500)
    useStore.getState().aplicar(() => datosDe('B'))
    await vi.advanceTimersByTimeAsync(500)
    useStore.getState().aplicar(() => datosDe('C'))
    await vi.advanceTimersByTimeAsync(2000)

    expect(drive.guardar).toHaveBeenCalledTimes(1)
  })
})

describe('editar mientras se está subiendo', () => {
  it('no da por guardado lo que no se ha subido', async () => {
    const { resolver } = subidaEnCurso()

    useStore.getState().aplicar(() => datosDe('Primera'))
    await vi.advanceTimersByTimeAsync(2000)
    expect(useStore.getState().estado).toBe('guardando')

    // Llega una edición con la subida a medias.
    useStore.getState().aplicar(() => datosDe('Segunda'))

    resolver({ id: 'archivo-1', nombre: 'x', version: '11' })
    await vi.advanceTimersByTimeAsync(0)

    // Drive confirmó, pero lo confirmado es «Primera»: «Segunda» sigue pendiente.
    expect(useStore.getState().sinGuardar).toBe(true)
  })

  it('acaba subiendo esa edición sin necesidad de tocar nada más', async () => {
    const { resolver } = subidaEnCurso()
    drive.guardar.mockResolvedValue({ id: 'archivo-1', nombre: 'x', version: '12' })

    useStore.getState().aplicar(() => datosDe('Primera'))
    await vi.advanceTimersByTimeAsync(2000)
    useStore.getState().aplicar(() => datosDe('Segunda'))

    resolver({ id: 'archivo-1', nombre: 'x', version: '11' })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(2000)

    expect(drive.guardar).toHaveBeenCalledTimes(2)
    expect(useStore.getState().sinGuardar).toBe(false)
    expect(useStore.getState().datos?.personas[0]?.nombre).toBe('Segunda')
  })

  /**
   * El caso que rompía: el debounce vence *mientras* la subida sigue en vuelo.
   * Antes se salía sin reprogramar, así que esa edición no volvía a intentarse
   * y el autoguardado quedaba parado hasta la siguiente escritura del usuario.
   */
  it('reprograma si el debounce vence con una subida en vuelo', async () => {
    const { resolver } = subidaEnCurso()
    drive.guardar.mockResolvedValue({ id: 'archivo-1', nombre: 'x', version: '12' })

    useStore.getState().aplicar(() => datosDe('Primera'))
    await vi.advanceTimersByTimeAsync(2000)
    expect(useStore.getState().estado).toBe('guardando')

    // Edición nueva y su debounce vencen sin que la primera subida haya vuelto.
    useStore.getState().aplicar(() => datosDe('Segunda'))
    await vi.advanceTimersByTimeAsync(2000)
    expect(drive.guardar).toHaveBeenCalledTimes(1)

    resolver({ id: 'archivo-1', nombre: 'x', version: '11' })
    await vi.advanceTimersByTimeAsync(5000)

    expect(drive.guardar).toHaveBeenCalledTimes(2)
    expect(drive.guardar.mock.calls[1]?.[1]).toMatchObject({
      personas: [expect.objectContaining({ nombre: 'Segunda' })],
    })
    expect(useStore.getState().sinGuardar).toBe(false)
  })
})

describe('fallo de red', () => {
  it('reintenta solo, con esperas crecientes', async () => {
    drive.guardar.mockRejectedValue(new Error('Fallo de red'))

    useStore.getState().aplicar(() => datosDe('Editado'))
    await vi.advanceTimersByTimeAsync(2000)
    expect(drive.guardar).toHaveBeenCalledTimes(1)
    expect(useStore.getState().sinGuardar).toBe(true)

    await vi.advanceTimersByTimeAsync(ESPERAS_REINTENTO[0]!)
    expect(drive.guardar).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(ESPERAS_REINTENTO[1]!)
    expect(drive.guardar).toHaveBeenCalledTimes(3)
  })

  it('deja de reintentar en cuanto uno sale bien', async () => {
    drive.guardar.mockRejectedValueOnce(new Error('Fallo de red'))
    drive.guardar.mockResolvedValue({ id: 'archivo-1', nombre: 'x', version: '11' })

    useStore.getState().aplicar(() => datosDe('Editado'))
    await vi.advanceTimersByTimeAsync(2000)
    await vi.advanceTimersByTimeAsync(ESPERAS_REINTENTO[0]!)

    expect(drive.guardar).toHaveBeenCalledTimes(2)
    expect(useStore.getState().sinGuardar).toBe(false)
    expect(useStore.getState().error).toBeNull()

    // Sin más reintentos colgando.
    await vi.advanceTimersByTimeAsync(60_000)
    expect(drive.guardar).toHaveBeenCalledTimes(2)
  })

  it('conserva el mensaje de error para poder mostrarlo', async () => {
    drive.guardar.mockRejectedValue(new Error('Drive respondió 500'))

    useStore.getState().aplicar(() => datosDe('Editado'))
    await vi.advanceTimersByTimeAsync(2000)

    expect(useStore.getState().estado).toBe('listo')
    expect(useStore.getState().error).toContain('500')
  })
})

describe('conflicto', () => {
  it('pasa a estado de conflicto y no reintenta por su cuenta', async () => {
    drive.guardar.mockRejectedValue(new ConflictoFalso('99'))

    useStore.getState().aplicar(() => datosDe('Editado'))
    await vi.advanceTimersByTimeAsync(2000)

    expect(useStore.getState().estado).toBe('conflicto')
    expect(drive.guardar).toHaveBeenCalledTimes(1)

    // Reintentar solo pisaría lo que haya hecho la otra persona.
    await vi.advanceTimersByTimeAsync(60_000)
    expect(drive.guardar).toHaveBeenCalledTimes(1)
  })

  it('descartar y recargar no vuelve a subir lo descartado', async () => {
    drive.guardar.mockRejectedValueOnce(new ConflictoFalso('99'))
    drive.descargar.mockResolvedValue({
      datos: datosDe('Version remota'),
      archivo: { id: 'archivo-1', nombre: 'x', version: '99' },
    })

    useStore.getState().aplicar(() => datosDe('Mio'))
    await vi.advanceTimersByTimeAsync(2000)
    expect(useStore.getState().estado).toBe('conflicto')

    await useStore.getState().descartarYRecargar()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(useStore.getState().datos?.personas[0]?.nombre).toBe('Version remota')
    expect(useStore.getState().sinGuardar).toBe(false)
    expect(drive.guardar).toHaveBeenCalledTimes(1)
  })
})

describe('cerrar sesión', () => {
  it('cancela el guardado pendiente en vez de dispararlo con la sesión cerrada', async () => {
    useStore.getState().aplicar(() => datosDe('Editado'))
    useStore.getState().salir()

    await vi.advanceTimersByTimeAsync(60_000)

    expect(drive.guardar).not.toHaveBeenCalled()
    expect(useStore.getState().estado).toBe('sinSesion')
  })
})
