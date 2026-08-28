import { useState } from 'react'
import { aniosConDatos, liquidacionDelMes } from '../lib/calculo'
import { etiquetaMes, mesActual, partesMes, sumaMeses } from '../lib/fechas'
import type { Datos } from '../lib/tipos'
import { useStore } from '../store/useStore'
import { IconoAtras, IconoChevron } from './Iconos'
import { NavegadorAnio, RejillaMeses } from './RejillaMeses'
import { Boton } from './ui'

/**
 * Navegación del mes con el calendario del año siempre a la vista. Señala tres
 * cosas: el mes que estás viendo (relleno), el mes en el que estamos de verdad
 * (acento) y, con un punto por persona, quién ya ha transferido lo suyo.
 */
export function SelectorMes({ datos }: Readonly<{ datos: Datos }>) {
  const mes = useStore((s) => s.mes)
  const irAMes = useStore((s) => s.irAMes)
  const [anioVisible, setAnioVisible] = useState(partesMes(mes).anio)

  const hoy = mesActual()
  const anios = aniosConDatos(datos)

  return (
    <div className="flex flex-col gap-2">
      {/* Fija arriba al hacer scroll, para no perder de vista qué mes se ve. */}
      <div className="sticky top-0 z-30 -mx-4 flex items-center justify-between gap-2 bg-fondo/85 px-4 py-1.5 backdrop-blur-xl">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => irAMes(sumaMeses(mes, -1))}
          className="rounded-full p-1.5 text-acento active:opacity-50"
        >
          <IconoAtras className="h-5 w-5" />
        </button>

        <span className="text-[17px] font-semibold">{etiquetaMes(mes)}</span>

        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => irAMes(sumaMeses(mes, 1))}
          className="rounded-full p-1.5 text-acento active:opacity-50"
        >
          <IconoChevron className="h-5 w-5" />
        </button>
      </div>

      <div className="rounded-tarjeta bg-superficie p-3">
        <NavegadorAnio anio={anioVisible} onCambiar={setAnioVisible} />

        <div className="mt-3">
          <RejillaMeses
            anio={anioVisible}
            estadoDe={(clave) => ({
              seleccionado: clave === mes,
              hoy: clave === hoy,
              // Solo los meses en los que alguien tenía algo que aportar.
              marcas: liquidacionDelMes(datos, clave)
                .filter((l) => l.conObjetivo)
                .map((l) => ({ id: l.personaId, alDia: l.alDia })),
            })}
            onTocarMes={irAMes}
          />
        </div>

        <p className="mt-3 text-center text-[13px] text-tenue">
          Un punto por persona: relleno si ya ha transferido todo lo suyo.
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
    </div>
  )
}
