import { useState } from 'react'
import { aniosConDatos, mesesConMovimientos } from '../lib/calculo'
import { etiquetaMes, mesActual, partesMes, sumaMeses } from '../lib/fechas'
import type { Datos } from '../lib/tipos'
import { useStore } from '../store/useStore'
import { IconoAtras, IconoChevron } from './Iconos'
import { NavegadorAnio, RejillaMeses } from './RejillaMeses'
import { Boton } from './ui'

/**
 * Navegación del mes: flechas para moverse de uno en uno y, al desplegar, el
 * calendario del año. Señala tres cosas distintas: el mes que estás viendo
 * (relleno), el mes en el que estamos de verdad (acento), y los que ya tienen
 * movimientos (punto).
 */
export function SelectorMes({ datos }: { datos: Datos }) {
  const mes = useStore((s) => s.mes)
  const irAMes = useStore((s) => s.irAMes)
  const [abierto, setAbierto] = useState(false)
  const [anioVisible, setAnioVisible] = useState(partesMes(mes).anio)

  const hoy = mesActual()
  const conDatos = mesesConMovimientos(datos, anioVisible)
  const anios = aniosConDatos(datos)

  const alternar = () => {
    setAnioVisible(partesMes(mes).anio)
    setAbierto((v) => !v)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => irAMes(sumaMeses(mes, -1))}
          className="rounded-full p-1.5 text-acento active:opacity-50"
        >
          <IconoAtras className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={alternar}
          aria-expanded={abierto}
          className="flex items-center gap-1 rounded-fila px-2 py-1 text-[17px] font-semibold active:opacity-60"
        >
          {etiquetaMes(mes)}
          <IconoChevron
            className={`h-4 w-4 text-sutil transition-transform ${abierto ? '-rotate-90' : 'rotate-90'}`}
          />
        </button>

        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => irAMes(sumaMeses(mes, 1))}
          className="rounded-full p-1.5 text-acento active:opacity-50"
        >
          <IconoChevron className="h-5 w-5" />
        </button>
      </div>

      {abierto && (
        <div className="rounded-tarjeta bg-superficie p-3">
          <NavegadorAnio anio={anioVisible} onCambiar={setAnioVisible} />

          <div className="mt-3">
            <RejillaMeses
              anio={anioVisible}
              estadoDe={(clave) => ({
                seleccionado: clave === mes,
                hoy: clave === hoy,
                marcado: conDatos.has(clave),
              })}
              onTocarMes={(clave) => {
                irAMes(clave)
                setAbierto(false)
              }}
            />
          </div>

          <p className="mt-3 text-center text-[13px] text-tenue">
            El punto marca los meses con movimientos.
          </p>

          {anios.length > 1 && (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5 border-t border-borde pt-3">
              {anios.map((a) => (
                <Boton
                  key={a}
                  variante={a === anioVisible ? 'principal' : 'suave'}
                  className="cifras px-3 py-1 text-[14px]"
                  onClick={() => setAnioVisible(a)}
                >
                  {a}
                </Boton>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
