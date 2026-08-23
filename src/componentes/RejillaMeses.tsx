import { NOMBRES_MES, mesKey } from '../lib/fechas'
import type { MesKey } from '../lib/tipos'
import { IconoAtras, IconoChevron } from './Iconos'

const ABREVIADOS = NOMBRES_MES.map((n) => n.slice(0, 3))

/** Cómo se pinta un mes concreto de la rejilla. */
export interface EstadoMes {
  /** Extremo de la selección: relleno sólido de acento. */
  seleccionado?: boolean
  /** Dentro del rango elegido: relleno suave. */
  enRango?: boolean
  /** El mes real en el que estamos: aro de acento. */
  hoy?: boolean
  /** Tiene movimientos registrados: punto bajo el nombre. */
  marcado?: boolean
}

/** Cabecera «← año →», compartida por todas las pantallas con navegación anual. */
export function NavegadorAnio({
  anio,
  onCambiar,
}: Readonly<{
  anio: number
  onCambiar: (anio: number) => void
}>) {
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        aria-label="Año anterior"
        onClick={() => onCambiar(anio - 1)}
        className="rounded-full p-1.5 text-acento active:opacity-50"
      >
        <IconoAtras className="h-5 w-5" />
      </button>
      <span className="cifras text-[17px] font-semibold">{anio}</span>
      <button
        type="button"
        aria-label="Año siguiente"
        onClick={() => onCambiar(anio + 1)}
        className="rounded-full p-1.5 text-acento active:opacity-50"
      >
        <IconoChevron className="h-5 w-5" />
      </button>
    </div>
  )
}

/** Prioridad de los estados de una celda: seleccionado gana a todo lo demás. */
function estiloCelda({ seleccionado, enRango, hoy }: EstadoMes): string {
  if (seleccionado) return 'bg-acento font-semibold text-white'
  if (enRango) return 'bg-acento/12 text-acento'
  if (hoy) return 'font-semibold text-acento'
  return 'text-tinta active:bg-relleno'
}

/**
 * Rejilla de los doce meses de un año. La usan el selector de mes de la
 * pantalla principal y el de rango de los gastos recurrentes; cada uno decide
 * cómo se pinta cada celda con `estadoDe`.
 */
export function RejillaMeses({
  anio,
  estadoDe,
  onTocarMes,
}: Readonly<{
  anio: number
  estadoDe: (mes: MesKey) => EstadoMes
  onTocarMes: (mes: MesKey) => void
}>) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {ABREVIADOS.map((abreviado, i) => {
        const clave = mesKey(anio, i + 1)
        const { seleccionado, enRango, hoy, marcado } = estadoDe(clave)

        return (
          <button
            key={clave}
            type="button"
            aria-current={seleccionado ? 'true' : undefined}
            onClick={() => onTocarMes(clave)}
            className={`relative rounded-fila py-2.5 text-[15px] transition ${estiloCelda({
              seleccionado,
              enRango,
              hoy,
            })}`}
          >
            {abreviado}
            {marcado && (
              <span
                aria-hidden
                className={`absolute inset-x-0 bottom-1.5 mx-auto h-1 w-1 rounded-full ${
                  seleccionado ? 'bg-white' : 'bg-acento'
                }`}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
