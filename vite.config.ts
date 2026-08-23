import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const CARPETA_LOCAL = 'local-data'
const ARCHIVO_LOCAL = path.join(CARPETA_LOCAL, 'cuentas-pareja.json')
const RUTA_API = '/__local-data__'

/**
 * Sirve `local-data/cuentas-pareja.json` por HTTP mientras corre `vite dev`,
 * para que el modo local (`VITE_MODO_LOCAL=true`, ver `make local` y
 * `src/services/drive.local.ts`) pueda leerlo y escribirlo sin pasar por
 * Google Drive. `configureServer` solo se ejecuta en el dev server: no
 * participa en `vite build`.
 */
function responder(res: ServerResponse, estado: number, cuerpo: unknown): void {
  res.statusCode = estado
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(cuerpo))
}

async function leerArchivo(res: ServerResponse): Promise<void> {
  try {
    const [contenido, info] = await Promise.all([
      readFile(ARCHIVO_LOCAL, 'utf-8'),
      stat(ARCHIVO_LOCAL),
    ])
    const datos: unknown = JSON.parse(contenido)
    responder(res, 200, { datos, version: String(info.mtimeMs) })
  } catch {
    responder(res, 404, { error: `No existe ${ARCHIVO_LOCAL}. Ejecuta "make local".` })
  }
}

/** La versión local es el `mtime` del archivo: cambia con cada escritura. */
async function versionActual(): Promise<string | null> {
  try {
    return String((await stat(ARCHIVO_LOCAL)).mtimeMs)
  } catch {
    return null
  }
}

async function escribirArchivo(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const trozos: Uint8Array[] = []
  for await (const trozo of req) trozos.push(trozo as Uint8Array)
  const { datos, versionEsperada } = JSON.parse(Buffer.concat(trozos).toString('utf-8')) as {
    datos: unknown
    versionEsperada?: string
  }

  // Mismo espíritu que el control de concurrencia de Drive (ver drive.ts):
  // detección de conflicto comparando contra la última versión leída, no
  // bloqueo. Si no se manda versión (primer guardado), se escribe directo.
  const actual = await versionActual()
  if (versionEsperada && actual !== null && actual !== versionEsperada) {
    responder(res, 409, { error: 'conflicto' })
    return
  }

  await mkdir(CARPETA_LOCAL, { recursive: true })
  await writeFile(ARCHIVO_LOCAL, JSON.stringify(datos, null, 2))
  const info = await stat(ARCHIVO_LOCAL)
  responder(res, 200, { version: String(info.mtimeMs) })
}

async function atender(
  metodo: string | undefined,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (metodo === 'GET') return leerArchivo(res)
  if (metodo === 'PUT') return escribirArchivo(req, res)

  res.statusCode = 405
  res.end()
}

function datosLocales(): Plugin {
  return {
    name: 'datos-locales',
    configureServer(server) {
      server.middlewares.use(RUTA_API, (req, res) => {
        void atender(req.method, req, res)
      })
    },
  }
}

// La app se publica en GitHub Pages bajo https://<usuario>.github.io/ACoupleLife/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/ACoupleLife/',
  plugins: [react(), tailwindcss(), datosLocales()],
})
