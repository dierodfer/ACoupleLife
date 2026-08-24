import type { ClienteToken, RespuestaToken } from './google'

/**
 * Autenticación con Google desde una web estática: sin backend solo cabe el
 * "token flow" de Identity Services, que da un access token de ~1h y ningún
 * refresh token. Para no pedir login en cada visita se guarda el token y su
 * caducidad en `localStorage`, y se renueva en silencio antes de caducar; el
 * cómo está detallado junto a `pedirToken`. Guardarlo amplía la exposición del
 * token al perfil del navegador del dispositivo.
 *
 * El perfil de Google **no** se guarda, solo vive en memoria: lo único que se
 * escribe en el almacenamiento sale de la propia app (el token que devuelve
 * Google Identity Services y una marca de tiempo), nunca del JSON de un
 * servicio externo. Ver `recordarSesion`.
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

/** Lo que sobrevive entre visitas. Nada de esto viene de un servicio externo. */
interface Sesion {
  token: string
  /** Momento (ms desde época) en que caduca el access token. */
  caducaEn: number
}

export class ErrorAuth extends Error {}

let cliente: ClienteToken | null = null
let pendiente: ((respuesta: RespuestaToken) => void) | null = null
/** Renovación silenciosa en curso, para que varias peticiones a la vez compartan una. */
let renovacion: Promise<string> | null = null

function leerSesion(): Sesion | null {
  try {
    const bruto = localStorage.getItem(CLAVE_SESION)
    if (!bruto) return null

    const guardado = JSON.parse(bruto) as Partial<Sesion>
    if (typeof guardado.token !== 'string' || typeof guardado.caducaEn !== 'number') return null

    return { token: guardado.token, caducaEn: guardado.caducaEn }
  } catch {
    // JSON corrupto, o un navegador que no deja tocar `localStorage`.
    return null
  }
}

/**
 * Escribe la sesión en `localStorage`: solo el token, que devuelve Google
 * Identity Services, y una marca de tiempo calculada aquí. El perfil se queda
 * fuera a propósito — es lo único que sale del JSON de un servicio externo, y
 * no tiene por qué acabar en el almacenamiento del navegador para que la
 * sesión sobreviva a una recarga.
 */
function recordarSesion(nueva: Sesion | null): void {
  try {
    if (nueva) {
      localStorage.setItem(
        CLAVE_SESION,
        JSON.stringify({ token: nueva.token, caducaEn: nueva.caducaEn }),
      )
    } else {
      localStorage.removeItem(CLAVE_SESION)
    }
  } catch {
    // Sin almacenamiento la app sigue funcionando; solo pedirá login más a menudo.
  }
}

let sesion: Sesion | null = leerSesion()

/**
 * Perfil de quien tiene la sesión abierta. Solo en memoria, así que se relee
 * al arrancar; a cambio, sirve de `hint` mientras la pestaña siga viva.
 */
let usuario: Usuario | null = null

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
 * El `hint` va solo en la renovación silenciosa, donde le dice a Google qué
 * cuenta continuar si hay varias iniciadas. Solo lo hay si ya se ha leído el
 * perfil en esta pestaña: recién abierta la app no se sabe todavía, y entonces
 * Google resuelve solo si no hay ambigüedad. En el login explícito se omite a
 * propósito, porque ahí puede estar entrando la otra persona del dispositivo.
 */
async function pedirToken(silencioso: boolean): Promise<{ token: string; caducaEn: number }> {
  const c = await asegurarCliente()
  const hint = silencioso ? usuario?.email : undefined

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
function fijarSesion(token: string, caducaEn: number): string {
  sesion = { token, caducaEn }
  recordarSesion(sesion)
  return token
}

/** Renueva en silencio. Las llamadas simultáneas comparten la misma petición. */
function renovar(): Promise<string> {
  renovacion ??= pedirToken(true)
    .then(({ token, caducaEn }) => fijarSesion(token, caducaEn))
    .finally(() => {
      renovacion = null
    })
  return renovacion
}

/** Login explícito. Abre ventana de Google solo si hace falta. */
export async function entrar(): Promise<Usuario> {
  const { token, caducaEn } = await pedirToken(false)
  fijarSesion(token, caducaEn)
  // Puede ser otra persona la que entra, así que el perfil se relee siempre.
  usuario = await perfil(token)
  return usuario
}

/**
 * Token vigente, renovándolo en silencio si está a punto de caducar. Todas las
 * llamadas a Drive deben pasar por aquí.
 */
export async function tokenValido(): Promise<string> {
  if (vigente(sesion)) return sesion.token
  return renovar()
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
 * Intenta recuperar la sesión al abrir la app, sin molestar al usuario: si el
 * token guardado sigue vigente no se pasa por Google, y si no, se renueva en
 * silencio. Como el perfil no se guarda, se relee — una petición a Google, sin
 * ninguna ventana ni interrupción.
 */
export async function reanudarSesion(): Promise<Usuario | null> {
  if (!sesion) return null

  try {
    const token = await tokenValido()
    usuario ??= await perfil(token)
    return usuario
  } catch {
    // Ni el token guardado servía ni se pudo renovar: toca login explícito.
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
  usuario = null
  recordarSesion(null)
  if (actual) window.google?.accounts?.oauth2?.revoke(actual)
}

export { cargarScript }
