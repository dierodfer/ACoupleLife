import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import path from 'node:path'
import { extname } from 'node:path'

/**
 * Servidor estático mínimo sobre `dist/` para las pruebas de PWA.
 *
 * `vite preview` valdría para casi todo, pero no para la prueba del aviso de
 * versión nueva: hace falta poder cambiar lo que se sirve (el `sw.js`) con el
 * navegador ya abierto, que es exactamente lo que pasa en un despliegue.
 *
 * Sirve en `127.0.0.1`, que el navegador considera contexto seguro: sin eso no
 * habría service worker que probar.
 */

const RAIZ = path.join(process.cwd(), 'dist')
const BASE = '/ACoupleLife/'

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

export interface ServidorPruebas {
  url: string
  /** Texto que se añade al `sw.js` servido, para simular un despliegue nuevo. */
  parcheSw: string
  cerrar: () => Promise<void>
}

export async function levantarServidor(): Promise<ServidorPruebas> {
  if (!existsSync(path.join(RAIZ, 'index.html'))) {
    throw new Error('No hay dist/: ejecuta "npm run build" antes de las pruebas e2e.')
  }

  const estado = { parcheSw: '' }

  const servidor: Server = createServer((peticion, respuesta) => {
    const ruta = new URL(peticion.url ?? '/', 'http://127.0.0.1').pathname
    const relativa = ruta.startsWith(BASE) ? ruta.slice(BASE.length) : ruta.slice(1)
    const archivo = path.join(RAIZ, relativa || 'index.html')

    // Ni salirse de dist/ ni servir un directorio como si fuera un archivo.
    if (!archivo.startsWith(RAIZ) || !existsSync(archivo)) {
      respuesta.statusCode = 404
      respuesta.end('no está')
      return
    }

    const tipo = TIPOS[extname(archivo)] ?? 'application/octet-stream'
    respuesta.setHeader('Content-Type', tipo)
    // Sin caché de navegador: la caché que se mide en estas pruebas es la del
    // service worker, no la del HTTP.
    respuesta.setHeader('Cache-Control', 'no-store')

    if (relativa === 'sw.js' && estado.parcheSw) {
      respuesta.end(`${readFileSync(archivo, 'utf-8')}\n${estado.parcheSw}\n`)
      return
    }

    createReadStream(archivo).pipe(respuesta)
  })

  await new Promise<void>((listo) => servidor.listen(0, '127.0.0.1', listo))
  const direccion = servidor.address()
  if (typeof direccion === 'string' || direccion === null) throw new Error('Sin puerto')

  return {
    url: `http://127.0.0.1:${String(direccion.port)}${BASE}`,
    get parcheSw() {
      return estado.parcheSw
    },
    set parcheSw(texto: string) {
      estado.parcheSw = texto
    },
    cerrar: () =>
      new Promise<void>((listo, fallo) => {
        servidor.close((error) => {
          if (error) fallo(error)
          else listo()
        })
      }),
  }
}
