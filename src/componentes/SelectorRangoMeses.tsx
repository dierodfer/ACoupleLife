import { useState } from 'react'
import { comparaMes, etiquetaMes, mesEnRango, partesMes } from '../lib/fechas'
import { IconoChevron } from './Iconos'
import { NavegadorAnio, RejillaMeses } from './RejillaMeses'
import { Boton } from './ui'

/**
 * Selector de rango de meses (desde/hasta) para gastos recurrentes: un único
 * calendario en el que el primer toque marca el inicio y el segundo el fin,
 * en vez de dos campos de mes sueltos. `hasta: ''` representa «sin fin».
 */
export function SelectorRangoMeses({
  desde,
  hasta,
  onCambiar,
}: {
  desde: string
  hasta: string
  onCambiar: (desde: string, hasta: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [anioVisible, setAnioVisible] = useState(partesMes(desde).anio)
  // Durante la selección: null hasta que se toca el primer mes del rango nuevo.
  const [inicioPendiente, setInicioPendiente] = useState<string | null>(null)

  const alternar = () => {
    setAnioVisible(partesMes(desde).anio)
    setInicioPendiente(null)
    setAbierto((v) => !v)
  }

  const completar = (fin: string) => {
    if (!inicioPendiente) return
    const [ini, ultimo] =
      comparaMes(inicioPendiente, fin) <= 0 ? [inicioPendiente, fin] : [fin, inicioPendiente]
    onCambiar(ini, ultimo)
    setInicioPendiente(null)
    setAbierto(false)
  }

  const marcarSinFin = () => {
    if (!inicioPendiente) return
    onCambiar(inicioPendiente, '')
    setInicioPendiente(null)
    setAbierto(false)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium uppercase tracking-[0.05em] text-tenue">Rango</span>

      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between rounded-fila border border-borde bg-superficie px-3.5 py-2.5 text-left text-[17px]"
      >
        {etiquetaMes(desde)} – {hasta ? etiquetaMes(hasta) : 'sin fin'}
        <IconoChevron
          className={`h-4 w-4 text-sutil transition-transform ${abierto ? '-rotate-90' : 'rotate-90'}`}
        />
      </button>

      {abierto && (
        <div className="rounded-tarjeta bg-superficie p-3">
          <NavegadorAnio anio={anioVisible} onCambiar={setAnioVisible} />

          <p className="mt-2 text-center text-[13px] text-tenue">
            {inicioPendiente
              ? `Ahora el mes de fin. Inicio: ${etiquetaMes(inicioPendiente)}.`
              : 'Toca el mes de inicio.'}
          </p>

          <div className="mt-3">
            <RejillaMeses
              anio={anioVisible}
              estadoDe={(clave) => {
                // Antes de tocar nada se resalta el rango guardado; una vez
                // elegido el inicio nuevo, solo se resalta ese inicio.
                if (inicioPendiente) return { seleccionado: clave === inicioPendiente }
                return {
                  seleccionado: clave === desde || clave === hasta,
                  enRango: mesEnRango(clave, desde, hasta || null),
                }
              }}
              onTocarMes={(clave) =>
                inicioPendiente ? completar(clave) : setInicioPendiente(clave)
              }
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-borde pt-2">
            <Boton variante="texto" disabled={!inicioPendiente} onClick={marcarSinFin}>
              Sin fin
            </Boton>
            <Boton variante="texto" onClick={() => setAbierto(false)}>
              Cerrar
            </Boton>
          </div>
        </div>
      )}
    </div>
  )
}
