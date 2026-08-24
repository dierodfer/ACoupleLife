// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RespuestaToken } from './google'

/**
 * Tests de la continuidad de la sesión: qué hace la app al abrirse según lo que
 * quede guardado. Es donde se decide si hay que volver a pasar por Google o no,
 * y no se ve a simple vista porque casi todo ocurre sin interfaz.
 */

const USUARIO = { email: 'ana@example.com', nombre: 'Ana' }
const CLAVE = 'acouplelife.sesion'
const HORA = 60 * 60 * 1000

interface OpcionesToken {
  prompt?: string
  hint?: string
}

/** Lo que hará el falso Google cuando le pidan un token. */
type Respuesta = 'concede' | 'rechaza' | 'calla'

let peticiones: OpcionesToken[] = []
let respuesta: Respuesta = 'concede'

/** Google Identity Services de pega, con el guion que marque `respuesta`. */
function instalarGoogle() {
  let alConceder: ((r: RespuestaToken) => void) | undefined
  let alFallar: ((e: { type?: string; message?: string }) => void) | undefined

  window.google = {
    accounts: {
      oauth2: {
        initTokenClient: (config) => {
          alConceder = config.callback
          alFallar = config.error_callback
          return {
            requestAccessToken: (opciones = {}) => {
              peticiones.push(opciones)
              if (respuesta === 'concede') {
                alConceder?.({ access_token: `token-${peticiones.length}`, expires_in: 3600 })
              } else if (respuesta === 'rechaza') {
                alFallar?.({ type: 'popup_failed_to_open', message: 'sin sesión de Google' })
              }
              // 'calla': ni una cosa ni la otra, como el iframe silencioso que
              // bloquea un navegador con las cookies de terceros cortadas.
            },
          }
        },
        revoke: vi.fn(),
      },
    },
  }
}

/** Sesión ya guardada de una visita anterior, con el token vivo o caducado. */
function sesionGuardada(caducaEn: number) {
  localStorage.setItem(CLAVE, JSON.stringify({ token: 'token-viejo', caducaEn }))
}

function sesionLeida(): Record<string, unknown> | null {
  const bruto = localStorage.getItem(CLAVE)
  if (!bruto) return null
  return JSON.parse(bruto) as Record<string, unknown>
}

/** El módulo lee `localStorage` al importarse, así que cada test parte de cero. */
async function cargarAuth() {
  vi.resetModules()
  return import('./auth')
}

beforeEach(() => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'cliente-de-prueba')
  localStorage.clear()
  peticiones = []
  respuesta = 'concede'

  // `cargarScript` espera al `load` del script de Google, que en jsdom no llega
  // nunca: lo damos por cargado de antemano.
  document.head.innerHTML =
    '<script src="https://accounts.google.com/gsi/client" data-cargado="si"></script>'
  instalarGoogle()

  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ email: USUARIO.email, name: USUARIO.nombre }),
      } as Response),
    ),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('reanudar sesión', () => {
  it('con el token guardado vigente no pasa por Google, solo relee el perfil', async () => {
    sesionGuardada(Date.now() + HORA)
    const auth = await cargarAuth()

    expect(await auth.reanudarSesion()).toEqual(USUARIO)
    // Ninguna petición de token: ni ventana, ni renovación, ni interrupción.
    expect(peticiones).toHaveLength(0)
    // El perfil no se guarda, así que se pide de nuevo (una llamada, sin UI).
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('renueva en silencio cuando el token guardado ha caducado', async () => {
    sesionGuardada(Date.now() - HORA)
    const auth = await cargarAuth()

    expect(await auth.reanudarSesion()).toEqual(USUARIO)
    // Recién abierta la app no hay perfil en memoria todavía, así que tampoco
    // `hint`: Google resuelve solo si no hay varias cuentas iniciadas.
    expect(peticiones).toEqual([{ prompt: 'none', hint: undefined }])
    expect(sesionLeida()?.token).toBe('token-1')
  })

  it('una vez leído el perfil, las renovaciones ya dicen qué cuenta', async () => {
    const auth = await cargarAuth()
    await auth.entrar()

    auth.invalidarToken()
    await auth.tokenValido()

    expect(peticiones[1]).toEqual({ prompt: 'none', hint: USUARIO.email })
  })

  it('no pide nada si no hay sesión guardada', async () => {
    const auth = await cargarAuth()

    expect(await auth.reanudarSesion()).toBeNull()
    expect(peticiones).toHaveLength(0)
  })

  it('devuelve al login si la renovación silenciosa falla', async () => {
    sesionGuardada(Date.now() - HORA)
    respuesta = 'rechaza'
    const auth = await cargarAuth()

    expect(await auth.reanudarSesion()).toBeNull()

    // El login que viene después entra sin repetir la pantalla de permisos, y
    // sin pista de cuenta: ahí puede estar entrando la otra persona.
    respuesta = 'concede'
    expect(await auth.entrar()).toEqual(USUARIO)
    expect(peticiones[1]).toEqual({ prompt: '', hint: undefined })
  })

  it('no se queda colgada si Google no contesta a la renovación', async () => {
    vi.useFakeTimers()
    try {
      sesionGuardada(Date.now() - HORA)
      respuesta = 'calla'
      const auth = await cargarAuth()

      const espera = auth.reanudarSesion()
      await vi.advanceTimersByTimeAsync(15_000)

      expect(await espera).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('entrar y salir', () => {
  it('no fuerza la pantalla de consentimiento en el primer login', async () => {
    const auth = await cargarAuth()

    expect(await auth.entrar()).toEqual(USUARIO)
    // `prompt: ''` pregunta solo la primera vez; 'consent' la repetiría siempre.
    expect(peticiones).toEqual([{ prompt: '', hint: undefined }])
    expect(sesionLeida()?.token).toBe('token-1')
  })

  it('salir borra la sesión guardada', async () => {
    sesionGuardada(Date.now() + HORA)
    const auth = await cargarAuth()

    auth.salir()

    expect(sesionLeida()).toBeNull()
    expect(await auth.reanudarSesion()).toBeNull()
  })
})

describe('lo que llega a localStorage', () => {
  it('usa el perfil en memoria, pero guarda solo el token y su caducidad', async () => {
    const auth = await cargarAuth()
    const usuario = await auth.entrar()
    const guardado = localStorage.getItem(CLAVE) ?? ''

    expect(usuario).toEqual(USUARIO)
    expect(Object.keys(JSON.parse(guardado) as object)).toEqual(['token', 'caducaEn'])
    expect(guardado).not.toContain(USUARIO.email)
  })
})

describe('token vigente', () => {
  it('reutiliza el guardado sin pedir otro', async () => {
    sesionGuardada(Date.now() + HORA)
    const auth = await cargarAuth()

    expect(await auth.tokenValido()).toBe('token-viejo')
    expect(peticiones).toHaveLength(0)
  })

  it('una sola renovación aunque varias peticiones la pidan a la vez', async () => {
    sesionGuardada(Date.now() - HORA)
    const auth = await cargarAuth()

    const [a, b, c] = await Promise.all([auth.tokenValido(), auth.tokenValido(), auth.tokenValido()])

    expect([a, b, c]).toEqual(['token-1', 'token-1', 'token-1'])
    expect(peticiones).toHaveLength(1)
  })

  it('tras invalidar el token pide uno nuevo', async () => {
    sesionGuardada(Date.now() + HORA)
    const auth = await cargarAuth()

    auth.invalidarToken()

    expect(await auth.tokenValido()).toBe('token-1')
    expect(peticiones).toEqual([{ prompt: 'none', hint: undefined }])
  })
})
