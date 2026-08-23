import type { Datos } from '../lib/tipos'
import { normalizar, nuevoId } from '../lib/esquema'
import { cargarScript, tokenValido } from './auth'

/**
 * Acceso al archivo JSON compartido en Google Drive.
 *
 * Sobre la concurrencia: Drive API v3 **no** expone `etag` (se eliminó del
 * recurso `files`). El equivalente es `version`, un entero que incrementa en
 * cada modificación. Antes de escribir releemos esa `version` y, si no coincide
 * con la que teníamos, abortamos: es detección de conflicto, no bloqueo, porque
 * la API no ofrece escritura condicional. Para dos usuarios es suficiente.
 */

export const NOMBRE_ARCHIVO = 'cuentas-pareja.json'

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const CAMPOS = 'id,name,version,modifiedTime'

export class ErrorDrive extends Error {}

/** El archivo cambió en Drive desde que lo leímos: hay que recargar antes de guardar. */
export class ConflictoDrive extends Error {
  constructor(public readonly versionRemota: string) {
    super('El archivo ha cambiado en Drive desde la última vez que lo leíste.')
    this.name = 'ConflictoDrive'
  }
}

export interface ArchivoDrive {
  id: string
  nombre: string
  /** Contador de modificaciones de Drive. Se usa para detectar conflictos. */
  version: string
}

interface MetadatosApi {
  id: string
  name: string
  version: string
  modifiedTime: string
}

async function peticion(url: string, opciones: RequestInit = {}): Promise<Response> {
  const token = await tokenValido()
  const respuesta = await fetch(url, {
    ...opciones,
    headers: {
      ...opciones.headers,
      Authorization: `Bearer ${token}`,
    },
  })

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '')
    throw new ErrorDrive(`Drive respondió ${respuesta.status}. ${detalle.slice(0, 300)}`)
  }
  return respuesta
}

export async function metadatos(fileId: string): Promise<ArchivoDrive> {
  const respuesta = await peticion(`${API}/files/${fileId}?fields=${CAMPOS}`)
  const m = (await respuesta.json()) as MetadatosApi
  return { id: m.id, nombre: m.name, version: m.version }
}

/** Crea el archivo (flujo del primer usuario) y devuelve su id y versión. */
export async function crearArchivo(datos: Datos): Promise<ArchivoDrive> {
  const limite = `limite-${nuevoId('m')}`
  const cuerpo = [
    `--${limite}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify({ name: NOMBRE_ARCHIVO, mimeType: 'application/json' }),
    `--${limite}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(datos, null, 2),
    `--${limite}--`,
    '',
  ].join('\r\n')

  const respuesta = await peticion(
    `${UPLOAD}/files?uploadType=multipart&fields=${CAMPOS}`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${limite}` },
      body: cuerpo,
    },
  )

  const m = (await respuesta.json()) as MetadatosApi
  return { id: m.id, nombre: m.name, version: m.version }
}

export async function descargar(
  fileId: string,
): Promise<{ datos: Datos; archivo: ArchivoDrive }> {
  const respuesta = await peticion(`${API}/files/${fileId}?alt=media`)
  const bruto: unknown = await respuesta.json().catch(() => {
    throw new ErrorDrive('El archivo de Drive no contiene un JSON válido.')
  })

  return { datos: normalizar(bruto), archivo: await metadatos(fileId) }
}

/**
 * Guarda el archivo si nadie lo ha tocado mientras tanto.
 *
 * @param versionEsperada la `version` que devolvió la última lectura o escritura.
 * @throws {ConflictoDrive} si la versión remota ya no coincide.
 */
export async function guardar(
  fileId: string,
  datos: Datos,
  versionEsperada: string,
): Promise<ArchivoDrive> {
  const remoto = await metadatos(fileId)
  if (remoto.version !== versionEsperada) throw new ConflictoDrive(remoto.version)

  const respuesta = await peticion(
    `${UPLOAD}/files/${fileId}?uploadType=media&fields=${CAMPOS}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(datos, null, 2),
    },
  )

  const m = (await respuesta.json()) as MetadatosApi
  return { id: m.id, nombre: m.name, version: m.version }
}

/**
 * Da acceso de edición a la otra persona.
 *
 * Con el scope `drive.file` la app no puede tocar archivos ajenos, pero sí
 * gestionar permisos de los que ella misma ha creado, así que el primer usuario
 * puede invitar al segundo desde aquí sin pasar por la web de Drive.
 */
export async function compartirCon(fileId: string, email: string): Promise<void> {
  await peticion(`${API}/files/${fileId}/permissions?sendNotificationEmail=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'writer', type: 'user', emailAddress: email }),
  })
}

/**
 * Selector de Google (flujo del segundo usuario).
 *
 * `drive.file` solo da acceso a lo que ha creado la propia app, así que aunque
 * el archivo esté compartido, el segundo usuario tiene que señalarlo una vez con
 * el Picker para autorizarlo. A partir de ahí el permiso queda concedido.
 */
export async function elegirArchivo(): Promise<string | null> {
  const clave = import.meta.env.VITE_GOOGLE_API_KEY
  if (!clave) {
    throw new ErrorDrive(
      'Falta VITE_GOOGLE_API_KEY, necesaria para el selector de archivos de Google.',
    )
  }

  const token = await tokenValido()
  await cargarScript('https://apis.google.com/js/api.js')
  await new Promise<void>((resolve, reject) => {
    if (!window.gapi) {
      reject(new ErrorDrive('No se pudo cargar el selector de Google.'))
      return
    }
    window.gapi.load('picker', () => resolve())
  })

  const picker = window.google?.picker
  if (!picker) throw new ErrorDrive('No se pudo cargar el selector de Google.')

  return new Promise<string | null>((resolve) => {
    const vista = (etiqueta: string, propios: boolean) => {
      const v = new picker.DocsView(picker.ViewId.DOCS)
        .setMimeTypes('application/json')
        .setOwnedByMe(propios)
      // `setLabel` no está en todas las versiones del Picker; sin él las pestañas
      // salen con el nombre por defecto, que es peor pero no rompe nada.
      v.setLabel?.(etiqueta)
      return v
    }

    new picker.PickerBuilder()
      // El caso habitual es el segundo usuario abriendo lo que le han
      // compartido, y eso no vive en su unidad, así que esa pestaña va primero.
      .addView(vista('Compartido conmigo', false))
      .addView(vista('Mi unidad', true))
      .setOAuthToken(token)
      .setDeveloperKey(clave)
      .setTitle(`Elige ${NOMBRE_ARCHIVO}`)
      .setCallback((datos) => {
        const accion = datos[picker.Response.ACTION]
        if (accion === picker.Action.PICKED) {
          const documentos = datos[picker.Response.DOCUMENTS] as
            | Record<string, string>[]
            | undefined
          resolve(documentos?.[0]?.[picker.Document.ID] ?? null)
        } else if (accion === picker.Action.CANCEL) {
          resolve(null)
        }
      })
      .build()
      .setVisible(true)
  })
}
