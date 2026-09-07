import { createReadStream, readFileSync, readdirSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import path, { extname } from 'node:path'

/**
 * Servidor estático mínimo sobre `dist/`. `vite preview` no vale para la
 * prueba del aviso de versión nueva: hace falta poder cambiar el `sw.js`
 * servido con el navegador ya abierto, simulando un despliegue.
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

/**
 * Índice de lo que hay en `dist/` al arrancar: ruta pedida → archivo real. La
 * ruta de la petición solo se usa como clave de búsqueda aquí, nunca para
 * componer un nombre de archivo, así que no hay forma de salir de `dist/`.
 */
function indexar(carpeta: string, prefijo = ''): Map<string, string> {
  const archivos = new Map<string, string>()

  for (const entrada of readdirSync(carpeta, { withFileTypes: true })) {
    const absoluta = path.join(carpeta, entrada.name)
    if (entrada.isDirectory()) {
      for (const [clave, valor] of indexar(absoluta, `${prefijo}${entrada.name}/`)) {
        archivos.set(clave, valor)
      }
    } else {
      archivos.set(`${prefijo}${entrada.name}`, absoluta)
    }
  }

  return archivos
}

export interface ServidorPruebas {
  url: string
  /** Texto que se añade al `sw.js` servido, para simular un despliegue nuevo. */
  parcheSw: string
  cerrar: () => Promise<void>
}

export async function levantarServidor(): Promise<ServidorPruebas> {
  const archivos = indexar(RAIZ)
  if (!archivos.has('index.html')) {
    throw new Error('No hay dist/: ejecuta "npm run build" antes de las pruebas e2e.')
  }

  const estado = { parcheSw: '' }

  const servidor: Server = createServer((peticion, respuesta) => {
    const ruta = new URL(peticion.url ?? '/', 'http://127.0.0.1').pathname
    const pedida = ruta.startsWith(BASE) ? ruta.slice(BASE.length) : ruta.slice(1)
    const archivo = archivos.get(pedida || 'index.html')

    if (archivo === undefined) {
      respuesta.statusCode = 404
      respuesta.end('no está')
      return
    }

    respuesta.setHeader('Content-Type', TIPOS[extname(archivo)] ?? 'application/octet-stream')
    respuesta.setHeader('Cache-Control', 'no-store')

    if (pedida === 'sw.js' && estado.parcheSw) {
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
