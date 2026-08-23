import type { ReactNode } from 'react'

/**
 * Anillo de partes sobre un total, al estilo de los gráficos de iOS: trazo fino,
 * hueco entre tramos y el dato que resume el conjunto en el centro.
 *
 * Los tramos se dibujan con `stroke-dasharray` sobre un mismo círculo, girado
 * un cuarto de vuelta para que el primero arranque arriba. Es la forma de
 * dibujar un donut sin calcular arcos a mano ni cargar una librería de
 * gráficos: el reparto es exactamente proporcional al valor de cada tramo.
 */

const RADIO = 42
const GROSOR = 11
const CIRCUNFERENCIA = 2 * Math.PI * RADIO

/** Separación entre tramos, en unidades del `viewBox`. Equivale a unos 2 px. */
const HUECO = 2.6

/**
 * Longitud mínima de un tramo. Sin ella una aportación de dos euros
 * desaparecería del gráfico; con ella se ve, al precio de un 0,6 % de
 * desviación en el reparto, que a esa escala es menos que el propio hueco.
 */
const MINIMO = 1.6

export interface TramoDonut {
  clave: string
  valor: number
  /** Utilidad de Tailwind con el color del trazo, p. ej. `stroke-serie-gastos`. */
  clase: string
}

/** Tramos visibles ya colocados: cuánto se pinta de cada uno y desde dónde. */
function arcos(tramos: TramoDonut[], base: number) {
  const visibles = tramos.filter((t) => t.valor > 0)
  const hueco = visibles.length > 1 ? HUECO : 0

  let inicio = 0
  return visibles.map((tramo) => {
    const largo = (tramo.valor / base) * CIRCUNFERENCIA
    const colocado = { ...tramo, dibujo: Math.max(largo - hueco, MINIMO), inicio }
    inicio += largo
    return colocado
  })
}

export function Donut({
  tramos,
  base,
  etiqueta,
  children,
}: Readonly<{
  tramos: TramoDonut[]
  /** Total sobre el que se reparte el anillo. Con 0 solo se ve la pista vacía. */
  base: number
  /** Descripción del gráfico para quien no lo ve. */
  etiqueta: string
  /** Contenido del hueco central. */
  children: ReactNode
}>) {
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 100 100" role="img" aria-label={etiqueta} className="h-full w-full">
        <g transform="rotate(-90 50 50)" fill="none" strokeWidth={GROSOR}>
          <circle cx="50" cy="50" r={RADIO} className="stroke-relleno" />
          {base > 0 &&
            arcos(tramos, base).map((a) => (
              <circle
                key={a.clave}
                cx="50"
                cy="50"
                r={RADIO}
                className={`arco ${a.clase}`}
                strokeDasharray={`${a.dibujo} ${CIRCUNFERENCIA - a.dibujo}`}
                strokeDashoffset={-a.inicio}
              />
            ))}
        </g>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-6 text-center">
        {children}
      </div>
    </div>
  )
}

/** Punto de color que une una fila de la leyenda con su tramo del anillo. */
export function PuntoSerie({ clase }: Readonly<{ clase: string }>) {
  return <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${clase}`} />
}
