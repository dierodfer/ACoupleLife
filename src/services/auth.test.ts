// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Usuario } from './auth'
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
  localStorage.setItem(CLAVE, JSON.stringify({ token: 'token-viejo', caducaEn, usuario: USUARIO }))
}

function sesionLeida(): { token: string; caducaEn: number; usuario: Usuario } | null {
  const bruto = localStorage.getItem(CLAVE)
  if (!bruto) return null
  return JSON.parse(bruto) as { token: string; caducaEn: number; usuario: Usuario }
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
  it('entra sin hablar con Google si el token guardado sigue vigente', async () => {
    sesionGuardada(Date.now() + HORA)
    const auth = await cargarAuth()

    expect(await auth.reanudarSesion()).toEqual(USUARIO)
    expect(peticiones).toHaveLength(0)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('renueva en silencio y diciendo qué cuenta cuando el token ha caducado', async () => {
    sesionGuardada(Date.now() - HORA)
    const auth = await cargarAuth()

    expect(await auth.reanudarSesion()).toEqual(USUARIO)
    // Sin `hint` Google no sabe cuál elegir si hay varias cuentas iniciadas, y
    // la renovación silenciosa falla: era el motivo de acabar en el login.
    expect(peticiones).toEqual([{ prompt: 'none', hint: USUARIO.email }])
    expect(sesionLeida()?.token).toBe('token-1')
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
    expect(sesionLeida()?.usuario).toEqual(USUARIO)
  })

  it('salir borra la sesión guardada', async () => {
    sesionGuardada(Date.now() + HORA)
    const auth = await cargarAuth()

    auth.salir()

    expect(sesionLeida()).toBeNull()
    expect(await auth.reanudarSesion()).toBeNull()
  })
})

describe('perfil de Google', () => {
  async function conPerfil(perfil: unknown) {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve(perfil) } as unknown as Response),
      ),
    )
    const auth = await cargarAuth()
    const usuario = await auth.entrar()
    // Lo que se guarda tiene que ser justo lo que se devuelve: no vale que
    // `entrar()` limpie el valor y `recordarSesion` guarde el original sin filtrar.
    expect(sesionLeida()?.usuario).toEqual(usuario)
    return usuario
  }

  it('descarta campos con el tipo equivocado', async () => {
    const usuario = await conPerfil({ email: 12345, name: { objeto: true }, picture: null })
    expect(usuario).toEqual({ email: '', nombre: 'Usuario', foto: undefined })
  })

  it('descarta un email o un nombre con forma inesperada aunque sean texto', async () => {
    // El fallo original solo miraba el tipo: un string con forma de payload
    // (HTML, una etiqueta de script) pasaba igual que un nombre de verdad.
    const usuario = await conPerfil({
      email: 'no es un email',
      name: '<script>alert(1)</script>',
      picture: 'javascript:alert(1)',
    })
    expect(usuario).toEqual({ email: '', nombre: 'Usuario', foto: undefined })
  })

  it('acepta un perfil con forma normal', async () => {
    const usuario = await conPerfil({
      email: 'ana@example.com',
      name: "Ana O'Brien-García",
      picture: 'https://lh3.googleusercontent.com/a/foto.jpg',
    })
    expect(usuario).toEqual({
      email: 'ana@example.com',
      nombre: "Ana O'Brien-García",
      foto: 'https://lh3.googleusercontent.com/a/foto.jpg',
    })
  })

  it('descarta una foto que no sea https', async () => {
    const usuario = await conPerfil({
      email: 'ana@example.com',
      name: 'Ana',
      picture: 'http://sin-cifrar.example.com/foto.jpg',
    })
    expect(usuario.foto).toBeUndefined()
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
    expect(peticiones).toEqual([{ prompt: 'none', hint: USUARIO.email }])
  })
})
