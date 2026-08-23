import type { Datos } from '../lib/tipos'
import { normalizar } from '../lib/esquema'

/**
 * Sustituto de `drive.ts` para el modo local (`VITE_MODO_LOCAL=true`, ver
 * `make local`). En vez de la API de Google Drive, habla con el endpoint que
 * expone el plugin de `vite.config.ts`, que lee y escribe
 * `local-data/cuentas-pareja.json` en disco. Solo funciona bajo `vite dev`.
 *
 * Como solo hay un archivo, no hace falta selector: `elegirArchivo` y
 * `metadatos` devuelven directamente ese único archivo.
 */

const RUTA_API = '/__local-data__'
const ID_LOCAL = 'local'
const NOMBRE_LOCAL = 'cuentas-pareja.json'

export class ErrorDrive extends Error {}

/** Mismo contrato que `ConflictoDrive` de `drive.ts`: alguien más escribió antes. */
export class ConflictoDrive extends Error {
  constructor(public readonly versionRemota: string) {
    super('El archivo local ha cambiado desde la última vez que lo leíste.')
    this.name = 'ConflictoDrive'
  }
}

export interface ArchivoDrive {
  id: string
  nombre: string
  version: string
}

async function leer(): Promise<{ datos: Datos; version: string }> {
  const respuesta = await fetch(RUTA_API)
  if (!respuesta.ok) {
    const { error } = await respuesta.json().catch(() => ({ error: undefined }))
    throw new ErrorDrive(error ?? 'No se pudo leer el archivo local.')
  }
  const { datos, version } = (await respuesta.json()) as { datos: unknown; version: string }
  return { datos: normalizar(datos), version }
}

async function escribir(datos: Datos, versionEsperada?: string): Promise<string> {
  const respuesta = await fetch(RUTA_API, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ datos, versionEsperada }),
  })

  if (respuesta.status === 409) {
    const remoto = await metadatos(ID_LOCAL)
    throw new ConflictoDrive(remoto.version)
  }
  if (!respuesta.ok) throw new ErrorDrive('No se pudo guardar el archivo local.')

  const { version } = (await respuesta.json()) as { version: string }
  return version
}

export async function metadatos(_fileId: string): Promise<ArchivoDrive> {
  const { version } = await leer()
  return { id: ID_LOCAL, nombre: NOMBRE_LOCAL, version }
}

export async function crearArchivo(datos: Datos): Promise<ArchivoDrive> {
  const version = await escribir(datos)
  return { id: ID_LOCAL, nombre: NOMBRE_LOCAL, version }
}

export async function descargar(
  _fileId: string,
): Promise<{ datos: Datos; archivo: ArchivoDrive }> {
  const { datos, version } = await leer()
  return { datos, archivo: { id: ID_LOCAL, nombre: NOMBRE_LOCAL, version } }
}

export async function guardar(
  _fileId: string,
  datos: Datos,
  versionEsperada: string,
): Promise<ArchivoDrive> {
  const version = await escribir(datos, versionEsperada)
  return { id: ID_LOCAL, nombre: NOMBRE_LOCAL, version }
}

/** No aplica en local: no hay Drive real con el que compartir permisos. */
export async function compartirCon(_fileId: string, _email: string): Promise<void> {}

/** Un único archivo local: "elegirlo" es simplemente usarlo, sin selector. */
export async function elegirArchivo(): Promise<string | null> {
  return ID_LOCAL
}
