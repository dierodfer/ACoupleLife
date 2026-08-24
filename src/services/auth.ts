import type { ClienteToken, RespuestaToken } from './google'

/**
 * Autenticación con Google desde una web estática: sin backend solo cabe el
 * "token flow" de Identity Services, que da un access token de ~1h y ningún
 * refresh token. Para no pedir login en cada visita, la sesión (token, perfil
 * y caducidad) se guarda en `localStorage` y se renueva en silencio antes de
 * caducar; el cómo está detallado junto a `pedirToken` y `recordarSesion`.
 * Guardarla amplía la exposición del token al perfil del navegador del
 * dispositivo.
 *
 * Quien necesite un token debe pedirlo siempre con `tokenValido()`, nunca
 * guardárselo por su cuenta.
 */

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email',
  'profile',
].join(' ')

const CLAVE_SESION = 'acouplelife.sesion'

/** Margen con el que renovamos el token antes de que caduque de verdad. */
const MARGEN_MS = 5 * 60 * 1000

/** Lo que esperamos a una renovación silenciosa antes de darla por perdida. */
const ESPERA_SILENCIOSA_MS = 12_000

export interface Usuario {
  email: string
  nombre: string
}

/** Lo que se guarda entre visitas. El perfil va dentro para arrancar sin red. */
interface Sesion {
  token: string
  /** Momento (ms desde época) en que caduca el access token. */
  caducaEn: number
  usuario: Usuario
}

export class ErrorAuth extends Error {}

let cliente: ClienteToken | null = null
let pendiente: ((respuesta: RespuestaToken) => void) | null = null
/** Renovación silenciosa en curso, para que varias peticiones a la vez compartan una. */
let renovacion: Promise<Sesion> | null = null

function leerSesion(): Sesion | null {
  try {
    const bruto = localStorage.getItem(CLAVE_SESION)
    if (!bruto) return null

    const guardado = JSON.parse(bruto) as Partial<Sesion>
    const usuario = guardado.usuario
    if (typeof guardado.token !== 'string' || typeof guardado.caducaEn !== 'number') return null
    if (typeof usuario?.email !== 'string' || typeof usuario.nombre !== 'string') return null

    return { token: guardado.token, caducaEn: guardado.caducaEn, usuario }
  } catch {
    // JSON corrupto, o un navegador que no deja tocar `localStorage`.
    return null
  }
}

/**
 * Forma que debe tener lo que llega del perfil de Google para poder guardarlo.
 * El nombre admite también la de un email, porque es el sustituto cuando Google
 * no devuelve nombre.
 */
const EMAIL_VALIDO = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,24}$/
const NOMBRE_VALIDO = /^[\p{L}\p{N} .,'@_+-]{1,100}$/u

/**
 * Escribe la sesión en `localStorage`.
 *
 * El email y el nombre salen del JSON de Google, así que se comprueban aquí,
 * en la misma función que escribe y justo antes de hacerlo: es la única forma
 * de que la garantía valga para todos los caminos que llevan a guardar. Si no
 * tienen la forma esperada no se guarda nada; la sesión sigue viva en memoria
 * y solo deja de sobrevivir a una recarga.
 */
function recordarSesion(nueva: Sesion | null): void {
  try {
    if (!nueva) {
      localStorage.removeItem(CLAVE_SESION)
      return
    }

    const { token, caducaEn, usuario } = nueva
    if (!EMAIL_VALIDO.test(usuario.email) || !NOMBRE_VALIDO.test(usuario.nombre)) return

    localStorage.setItem(
      CLAVE_SESION,
      JSON.stringify({
        token,
        caducaEn,
        usuario: { email: usuario.email, nombre: usuario.nombre },
      }),
    )
  } catch {
    // Sin almacenamiento la app sigue funcionando; solo pedirá login más a menudo.
  }
}

let sesion: Sesion | null = leerSesion()

function vigente(s: Sesion | null): s is Sesion {
  return s !== null && Date.now() < s.caducaEn - MARGEN_MS
}

function clientId(): string {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!id) {
    throw new ErrorAuth(
      'Falta VITE_GOOGLE_CLIENT_ID. Copia .env.example a .env y rellena las credenciales de Google.',
    )
  }
  return id
}

function cargarScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existente = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existente) {
      if (existente.dataset.cargado === 'si') resolve()
      else existente.addEventListener('load', () => resolve())
      existente.addEventListener('error', () => reject(new ErrorAuth(`No se pudo cargar ${src}`)))
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.defer = true
    script.addEventListener('load', () => {
      script.dataset.cargado = 'si'
      resolve()
    })
    script.addEventListener('error', () => reject(new ErrorAuth(`No se pudo cargar ${src}`)))
    document.head.appendChild(script)
  })
}

async function asegurarCliente(): Promise<ClienteToken> {
  if (cliente) return cliente

  await cargarScript('https://accounts.google.com/gsi/client')
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) throw new ErrorAuth('Google Identity Services no está disponible.')

  cliente = oauth2.initTokenClient({
    client_id: clientId(),
    scope: SCOPES,
    callback: (respuesta) => pendiente?.(respuesta),
    error_callback: (error) =>
      pendiente?.({ error: error.type ?? 'error', error_description: error.message }),
  })
  return cliente
}

/**
 * Pide un access token a Google.
 *
 * `prompt: 'none'` no enseña nada: o hay permiso concedido y sesión de Google
 * abierta, o falla. `prompt: ''` solo pregunta la primera vez, que es justo lo
 * que quiere el login explícito: quien ya dio permiso entra de un toque, sin
 * repetir la pantalla de consentimiento.
 *
 * El `hint` va solo en la renovación silenciosa, donde es imprescindible para
 * que Google sepa qué cuenta continuar. En el login explícito se omite a
 * propósito: ahí puede estar entrando la otra persona del mismo dispositivo, y
 * la pista la metería en la sesión de quien entró la última vez.
 */
async function pedirToken(silencioso: boolean): Promise<{ token: string; caducaEn: number }> {
  const c = await asegurarCliente()
  const hint = silencioso ? sesion?.usuario.email : undefined

  return new Promise((resolve, reject) => {
    let reloj: ReturnType<typeof setTimeout> | null = null

    const cerrar = () => {
      pendiente = null
      if (reloj) clearTimeout(reloj)
    }

    pendiente = (respuesta) => {
      cerrar()
      if (respuesta.error || !respuesta.access_token) {
        reject(new ErrorAuth(respuesta.error_description ?? respuesta.error ?? 'Acceso denegado'))
        return
      }
      resolve({
        token: respuesta.access_token,
        caducaEn: Date.now() + (respuesta.expires_in ?? 3600) * 1000,
      })
    }

    if (silencioso) {
      reloj = setTimeout(() => {
        cerrar()
        reject(new ErrorAuth('Google no respondió a la renovación de la sesión.'))
      }, ESPERA_SILENCIOSA_MS)
    }

    c.requestAccessToken({ prompt: silencioso ? 'none' : '', hint })
  })
}

/** Único sitio que fija la sesión en memoria y la manda guardar. */
function fijarSesion(token: string, caducaEn: number, usuario: Usuario): Sesion {
  sesion = { token, caducaEn, usuario }
  recordarSesion(sesion)
  return sesion
}

/** Renueva en silencio. Las llamadas simultáneas comparten la misma petición. */
function renovar(): Promise<Sesion> {
  renovacion ??= pedirToken(true)
    // Renovar no cambia de persona: se reaprovecha el perfil que ya teníamos.
    .then(async ({ token, caducaEn }) =>
      fijarSesion(token, caducaEn, sesion?.usuario ?? (await perfil(token))),
    )
    .finally(() => {
      renovacion = null
    })
  return renovacion
}

/** Login explícito. Abre ventana de Google solo si hace falta. */
export async function entrar(): Promise<Usuario> {
  const { token, caducaEn } = await pedirToken(false)
  // Puede ser otra persona la que entra, así que el perfil se relee siempre.
  return fijarSesion(token, caducaEn, await perfil(token)).usuario
}

/**
 * Token vigente, renovándolo en silencio si está a punto de caducar. Todas las
 * llamadas a Drive deben pasar por aquí.
 */
export async function tokenValido(): Promise<string> {
  if (vigente(sesion)) return sesion.token
  return (await renovar()).token
}

/**
 * Da por muerto el token guardado sin cerrar la sesión: la siguiente petición
 * pedirá uno nuevo. Lo usa `drive.ts` cuando Google responde 401, que es como se
 * entera de que un token guardado ya no vale (revocado desde la cuenta, por
 * ejemplo) antes de que le tocara caducar.
 */
export function invalidarToken(): void {
  if (!sesion) return
  sesion = { ...sesion, caducaEn: 0 }
  recordarSesion(sesion)
}

/**
 * Intenta recuperar la sesión al abrir la app, sin molestar al usuario. Con el
 * token todavía vigente ni siquiera se llama a Google: se entra directo.
 */
export async function reanudarSesion(): Promise<Usuario | null> {
  if (!sesion) return null
  if (vigente(sesion)) return sesion.usuario

  try {
    return (await renovar()).usuario
  } catch {
    // La sesión guardada ya no sirve. No se borra: el email sigue valiendo como
    // pista para que el login explícito entre sin elegir cuenta ni repetir permisos.
    return null
  }
}

/** Perfil de Google del dueño de un token concreto. */
async function perfil(acceso: string): Promise<Usuario> {
  const respuesta = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${acceso}` },
  })
  if (!respuesta.ok) throw new ErrorAuth('No se pudo leer el perfil de Google.')

  const datos = (await respuesta.json()) as { email?: unknown; name?: unknown }
  const email = typeof datos.email === 'string' ? datos.email : ''
  return { email, nombre: typeof datos.name === 'string' ? datos.name : email || 'Usuario' }
}

export function salir(): void {
  const actual = sesion?.token
  sesion = null
  recordarSesion(null)
  if (actual) window.google?.accounts?.oauth2?.revoke(actual)
}

export { cargarScript }
