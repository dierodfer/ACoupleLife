import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

/**
 * Genera los iconos PNG de la PWA (`public/iconos/`) con la marca de la app:
 * los dos anillos entrelazados —la pareja— en blanco sobre el azul de acento.
 * Es el mismo dibujo que pinta `MarcaApp` en la pantalla de acceso, con las
 * mismas proporciones, para que el icono de la pantalla de inicio y lo primero
 * que se ve al abrir sean la misma cosa.
 *
 * Los PNG se generan aquí y se suben al repo ya hechos: son parte del build de
 * Vite (`public/` se copia tal cual) y no hace falta ninguna dependencia nueva
 * para compilar la app. Ejecutar `node scripts/generar-iconos.mjs` solo cuando
 * cambie el dibujo o los colores.
 *
 * Android necesita dos familias de icono y no valen la una por la otra:
 *   - `any`      → se pinta tal cual, así que lleva sus propias esquinas redondeadas.
 *   - `maskable` → el sistema le aplica su máscara (círculo, squircle…), así que
 *                  va a sangre y con el dibujo dentro de la zona segura (el 80%
 *                  central: nada importante fuera de un radio de 0.4·lado).
 */

const AZUL = [0x00, 0x69, 0xf0] // --color-acento en claro: oklch(0.556 0.219 259)
const BLANCO = [0xff, 0xff, 0xff]

/** Muestras por lado y píxel: el suavizado de bordes sale de promediarlas. */
const MUESTRAS = 4

/**
 * Los dos anillos, en las coordenadas del SVG de `MarcaApp` (lienzo de 24×24).
 * Copiarlas y no reescalarlas a mano es lo que mantiene el icono idéntico a la
 * marca de la pantalla de acceso.
 */
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
 * tamaño de la marca como fracción del lado del icono (0.5 = la mitad, igual
 * que en la pantalla de acceso).
 */
function sobreLosAnillos(x, y, lado, escala) {
  // Del píxel del icono a las coordenadas del lienzo de 24×24 de la marca.
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
      // El color se promedia solo entre las muestras que caen dentro del icono
      // y la transparencia sale de cuántas eran: el PNG guarda el color sin
      // premultiplicar, y dividirlo también por las de fuera ennegrecería el
      // borde redondeado.
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
  // Esquinas al estilo iOS y marca a media altura, la misma proporción que la
  // pantalla de acceso (36 px de marca en un cuadro de 72).
  { archivo: 'icono-192.png', lado: 192, radio: 0.225, escala: 0.5 },
  { archivo: 'icono-512.png', lado: 512, radio: 0.225, escala: 0.5 },
  // A sangre, porque la máscara del sistema recorta el borde. La marca cabe de
  // sobra en la zona segura: su esquina más lejana queda a 0.26·lado del centro.
  { archivo: 'icono-maskable-192.png', lado: 192, radio: 0, escala: 0.56 },
  { archivo: 'icono-maskable-512.png', lado: 512, radio: 0, escala: 0.56 },
  // iOS redondea el icono por su cuenta, así que este también va a sangre.
  { archivo: 'apple-touch-icon-180.png', lado: 180, radio: 0, escala: 0.52 },
]

mkdirSync(CARPETA, { recursive: true })
for (const { archivo, lado, radio, escala } of ICONOS) {
  writeFileSync(path.join(CARPETA, archivo), png(lado, pintar(lado, { radio, escala })))
  console.log(`✓ public/iconos/${archivo}`)
}
