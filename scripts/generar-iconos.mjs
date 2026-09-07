import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

/**
 * Genera los iconos PNG de la PWA (`public/iconos/`): los dos anillos
 * entrelazados de `MarcaApp` (pantalla de acceso), en blanco sobre el azul de
 * acento. Se suben al repo ya generados; solo hay que volver a ejecutar este
 * script si cambia el dibujo o los colores.
 *
 * Android necesita dos familias de icono:
 *   - `any`      → esquinas ya redondeadas, se pinta tal cual.
 *   - `maskable` → a sangre; el sistema aplica su propia máscara y recorta el
 *                  20% exterior, así que el dibujo se queda dentro del 80% central.
 */

const AZUL = [0x00, 0x69, 0xf0] // --color-acento en claro: oklch(0.556 0.219 259)
const BLANCO = [0xff, 0xff, 0xff]

/** Muestras por lado y píxel: el suavizado de bordes sale de promediarlas. */
const MUESTRAS = 4

/** Los dos anillos, en las coordenadas del SVG de `MarcaApp` (lienzo 24×24). */
const LIENZO_MARCA = 24
const ANILLOS = [
  { cx: 9, cy: 12, r: 5.25 },
  { cx: 15, cy: 12, r: 5.25 },
]
const GROSOR = 1.75

/**
 * Cobertura del cuadrado (con esquinas redondeadas) en un punto: 1 dentro,
 * 0 fuera. `radio` es la fracción del lado que se redondea; 0 deja el cuadrado
 * a sangre, que es lo que quiere un icono `maskable`.
 */
function dentroDelFondo(x, y, lado, radio) {
  const r = lado * radio
  const dx = Math.abs(x - lado / 2) - (lado / 2 - r)
  const dy = Math.abs(y - lado / 2) - (lado / 2 - r)
  if (dx <= 0 || dy <= 0) return true
  return dx * dx + dy * dy <= r * r
}

/**
 * ¿Cae el punto sobre el trazo de alguno de los dos anillos? `escala` es el
 * tamaño de la marca como fracción del lado del icono.
 */
function sobreLosAnillos(x, y, lado, escala) {
  const marca = lado * escala
  const u = ((x - (lado - marca) / 2) / marca) * LIENZO_MARCA
  const v = ((y - (lado - marca) / 2) / marca) * LIENZO_MARCA

  return ANILLOS.some(
    ({ cx, cy, r }) => Math.abs(Math.hypot(u - cx, v - cy) - r) <= GROSOR / 2,
  )
}

/** Píxeles RGBA del icono, promediando `MUESTRAS²` muestras por píxel. */
function pintar(lado, { radio, escala }) {
  const pixeles = Buffer.alloc(lado * lado * 4)
  const total = MUESTRAS * MUESTRAS

  for (let fila = 0; fila < lado; fila++) {
    for (let columna = 0; columna < lado; columna++) {
      let [r, g, b, cubiertas] = [0, 0, 0, 0]

      for (let sy = 0; sy < MUESTRAS; sy++) {
        for (let sx = 0; sx < MUESTRAS; sx++) {
          const x = columna + (sx + 0.5) / MUESTRAS
          const y = fila + (sy + 0.5) / MUESTRAS
          if (!dentroDelFondo(x, y, lado, radio)) continue

          const color = sobreLosAnillos(x, y, lado, escala) ? BLANCO : AZUL
          r += color[0]
          g += color[1]
          b += color[2]
          cubiertas++
        }
      }

      const i = (fila * lado + columna) * 4
      // Promediar el color solo entre las muestras cubiertas evita ennegrecer
      // el borde redondeado (el PNG no lleva el color premultiplicado).
      if (cubiertas > 0) {
        pixeles[i] = Math.round(r / cubiertas)
        pixeles[i + 1] = Math.round(g / cubiertas)
        pixeles[i + 2] = Math.round(b / cubiertas)
      }
      pixeles[i + 3] = Math.round((cubiertas / total) * 255)
    }
  }

  return pixeles
}

/* ------------------------------------------------------------------- PNG */

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(datos) {
  let c = 0xffffffff
  for (const byte of datos) c = TABLA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function trozo(tipo, datos) {
  const longitud = Buffer.alloc(4)
  longitud.writeUInt32BE(datos.length)
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(cuerpo))
  return Buffer.concat([longitud, cuerpo, crc])
}

/** PNG de color verdadero con alfa (tipo 6), sin filtros por línea. */
function png(lado, pixeles) {
  const cabecera = Buffer.alloc(13)
  cabecera.writeUInt32BE(lado, 0)
  cabecera.writeUInt32BE(lado, 4)
  cabecera[8] = 8 // bits por canal
  cabecera[9] = 6 // RGBA
  cabecera[10] = 0
  cabecera[11] = 0
  cabecera[12] = 0

  const bytesPorFila = lado * 4
  const crudo = Buffer.alloc((bytesPorFila + 1) * lado)
  for (let fila = 0; fila < lado; fila++) {
    crudo[fila * (bytesPorFila + 1)] = 0 // filtro «ninguno»
    pixeles.copy(crudo, fila * (bytesPorFila + 1) + 1, fila * bytesPorFila, (fila + 1) * bytesPorFila)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', cabecera),
    trozo('IDAT', deflateSync(crudo, { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ])
}

/* ------------------------------------------------------------------ Salida */

const CARPETA = path.join(process.cwd(), 'public', 'iconos')

const ICONOS = [
  { archivo: 'icono-192.png', lado: 192, radio: 0.225, escala: 0.5 },
  { archivo: 'icono-512.png', lado: 512, radio: 0.225, escala: 0.5 },
  // maskable y apple-touch-icon van a sangre: iOS y la máscara de Android recortan el borde.
  { archivo: 'icono-maskable-192.png', lado: 192, radio: 0, escala: 0.56 },
  { archivo: 'icono-maskable-512.png', lado: 512, radio: 0, escala: 0.56 },
  { archivo: 'apple-touch-icon-180.png', lado: 180, radio: 0, escala: 0.52 },
]

mkdirSync(CARPETA, { recursive: true })
for (const { archivo, lado, radio, escala } of ICONOS) {
  writeFileSync(path.join(CARPETA, archivo), png(lado, pintar(lado, { radio, escala })))
  console.log(`✓ public/iconos/${archivo}`)
}
