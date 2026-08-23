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
  /**
   * Un punto por persona bajo el nombre del mes: relleno si ya cubrió su
   * objetivo ese mes, hueco si le queda algo por transferir.
   */
  marcas?: { id: string; alDia: boolean }[]
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

/** Punto de liquidación: relleno si está al día, hueco si le falta transferir. */
function estiloMarca(alDia: boolean, seleccionado?: boolean): string {
  if (alDia) return seleccionado ? 'border-white bg-white' : 'border-positivo bg-positivo'
  return seleccionado ? 'border-white/70' : 'border-sutil'
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
        const { seleccionado, enRango, hoy, marcas } = estadoDe(clave)

        return (
          <button
            key={clave}
            type="button"
            aria-current={seleccionado ? 'true' : undefined}
            onClick={() => onTocarMes(clave)}
            className={`relative rounded-fila text-[15px] transition ${
              marcas?.length ? 'pb-3.5 pt-2.5' : 'py-2.5'
            } ${estiloCelda({ seleccionado, enRango, hoy })}`}
          >
            {abreviado}
            {marcas && marcas.length > 0 && (
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-1.5 flex justify-center gap-1"
              >
                {marcas.map((m) => (
                  <span
                    key={m.id}
                    className={`h-1.5 w-1.5 rounded-full border ${estiloMarca(m.alDia, seleccionado)}`}
                  />
                ))}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
