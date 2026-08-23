import type { ClienteToken, RespuestaToken } from './google'

/**
 * Autenticación con Google desde una web estática.
 *
 * Sin backend solo cabe el "token flow" de Google Identity Services: devuelve un
 * access token de ~1 hora y **no** hay refresh token. Por eso el token se
 * renueva de forma silenciosa (`prompt: ''`) cuando le quedan menos de cinco
 * minutos, y quien llame debe pedirlo siempre con `tokenValido()` en vez de
 * guardárselo.
 */

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email',
  'profile',
].join(' ')

/** Margen con el que renovamos el token antes de que caduque de verdad. */
const MARGEN_MS = 5 * 60 * 1000

export interface Usuario {
  email: string
  nombre: string
  foto?: string
}

export class ErrorAuth extends Error {}

let cliente: ClienteToken | null = null
let token: string | null = null
let caducaEn = 0
let pendiente: ((respuesta: RespuestaToken) => void) | null = null

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
 * Pide un access token. Con `silencioso` no se muestra ninguna ventana: si el
 * usuario ya tiene sesión de Google, el token se renueva sin que se entere; si
 * no la tiene, falla y hay que volver a pedirlo de forma interactiva.
 */
async function pedirToken(silencioso: boolean): Promise<string> {
  const c = await asegurarCliente()

  return new Promise<string>((resolve, reject) => {
    pendiente = (respuesta) => {
      pendiente = null
      if (respuesta.error || !respuesta.access_token) {
        reject(new ErrorAuth(respuesta.error_description ?? respuesta.error ?? 'Acceso denegado'))
        return
      }
      token = respuesta.access_token
      caducaEn = Date.now() + (respuesta.expires_in ?? 3600) * 1000
      resolve(token)
    }
    c.requestAccessToken({ prompt: silencioso ? '' : 'consent' })
  })
}

/** Login explícito, con ventana de Google. */
export async function entrar(): Promise<Usuario> {
  await pedirToken(false)
  return datosUsuario()
}

/**
 * Token vigente, renovándolo en silencio si está a punto de caducar. Todas las
 * llamadas a Drive deben pasar por aquí.
 */
export async function tokenValido(): Promise<string> {
  if (token && Date.now() < caducaEn - MARGEN_MS) return token
  return pedirToken(true)
}

/** ¿Hay una sesión utilizable ahora mismo, sin abrir ninguna ventana? */
export function haySesion(): boolean {
  return token !== null && Date.now() < caducaEn
}

/** Intenta recuperar la sesión al abrir la app, sin molestar al usuario. */
export async function reanudarSesion(): Promise<Usuario | null> {
  try {
    await pedirToken(true)
    return await datosUsuario()
  } catch {
    return null
  }
}

export async function datosUsuario(): Promise<Usuario> {
  const acceso = await tokenValido()
  const respuesta = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${acceso}` },
  })
  if (!respuesta.ok) throw new ErrorAuth('No se pudo leer el perfil de Google.')

  const perfil = (await respuesta.json()) as { email?: string; name?: string; picture?: string }
  return {
    email: perfil.email ?? '',
    nombre: perfil.name ?? perfil.email ?? 'Usuario',
    foto: perfil.picture,
  }
}

export function salir(): void {
  const actual = token
  token = null
  caducaEn = 0
  if (actual) window.google?.accounts?.oauth2?.revoke(actual)
}

export { cargarScript }
