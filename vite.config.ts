import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
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
function datosLocales(): Plugin {
  return {
    name: 'datos-locales',
    configureServer(server) {
      server.middlewares.use(RUTA_API, async (req, res) => {
        if (req.method === 'GET') {
          try {
            const [contenido, info] = await Promise.all([
              readFile(ARCHIVO_LOCAL, 'utf-8'),
              stat(ARCHIVO_LOCAL),
            ])
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({ datos: JSON.parse(contenido), version: String(info.mtimeMs) }),
            )
          } catch {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: `No existe ${ARCHIVO_LOCAL}. Ejecuta "make local".` }))
          }
          return
        }

        if (req.method === 'PUT') {
          const trozos: Uint8Array[] = []
          for await (const trozo of req) trozos.push(trozo as Uint8Array)
          const { datos, versionEsperada } = JSON.parse(Buffer.concat(trozos).toString('utf-8'))

          // Mismo espíritu que el control de concurrencia de Drive (ver drive.ts):
          // detección de conflicto comparando contra la última versión leída, no
          // bloqueo. Si no se manda versión (primer guardado), se escribe directo.
          if (versionEsperada) {
            try {
              const actual = await stat(ARCHIVO_LOCAL)
              if (String(actual.mtimeMs) !== versionEsperada) {
                res.statusCode = 409
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'conflicto' }))
                return
              }
            } catch {
              // No había archivo previo con el que comparar: se crea sin más.
            }
          }

          await mkdir(CARPETA_LOCAL, { recursive: true })
          await writeFile(ARCHIVO_LOCAL, JSON.stringify(datos, null, 2))
          const info = await stat(ARCHIVO_LOCAL)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ version: String(info.mtimeMs) }))
          return
        }

        res.statusCode = 405
        res.end()
      })
    },
  }
}

// La app se publica en GitHub Pages bajo https://<usuario>.github.io/ACoupleLife/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/ACoupleLife/',
  plugins: [react(), tailwindcss(), datosLocales()],
})
