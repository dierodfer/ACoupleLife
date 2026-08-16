import { useState } from 'react'
import { resumenAnio } from '../lib/calculo'
import { NOMBRES_MES, partesMes } from '../lib/fechas'
import { euros, eurosRedondos } from '../lib/formato'
import type { Datos, PersonaId } from '../lib/tipos'
import { useStore } from '../store/useStore'
import { Boton, Fila, Tarjeta } from './ui'

/** Estado global del año, con acceso directo al anterior para comparar. */
export function ResumenAnual({ datos }: { datos: Datos }) {
  const mes = useStore((s) => s.mes)
  const irAMes = useStore((s) => s.irAMes)
  const [anio, setAnio] = useState(partesMes(mes).anio)

  const actual = resumenAnio(datos, anio)
  const anterior = resumenAnio(datos, anio - 1)
  const diferencia = actual.objetivo - anterior.objetivo

  const nombre = (id: PersonaId) =>
    datos.personas.find((p) => p.id === id)?.nombre ?? 'Sin nombre'

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex items-center justify-between gap-2">
        <Boton variante="texto" onClick={() => setAnio(anio - 1)} aria-label="Año anterior">
          ←
        </Boton>
        <span className="font-medium">{anio}</span>
        <Boton variante="texto" onClick={() => setAnio(anio + 1)} aria-label="Año siguiente">
          →
        </Boton>
      </nav>

      <Tarjeta>
        <Fila concepto="Objetivo del año" importe={eurosRedondos(actual.objetivo)} tono="fuerte" />
        <Fila concepto="Aportado" importe={eurosRedondos(actual.aportado)} />
        <Fila concepto="Pendiente" importe={eurosRedondos(actual.pendiente)} tono="fuerte" />
      </Tarjeta>

      <Tarjeta>
        <h3 className="font-medium">Por persona</h3>
        <div className="mt-2">
          {actual.pendientePorPersona.map((p) => (
            <Fila
              key={p.personaId}
              concepto={`${nombre(p.personaId)} · aportado ${eurosRedondos(p.aportado)}`}
              importe={eurosRedondos(p.pendiente)}
            />
          ))}
        </div>
      </Tarjeta>

      <Tarjeta>
        <h3 className="font-medium">Comparación con {anio - 1}</h3>
        <div className="mt-2">
          <Fila concepto={`Objetivo ${anio - 1}`} importe={eurosRedondos(anterior.objetivo)} tono="tenue" />
          <Fila concepto={`Objetivo ${anio}`} importe={eurosRedondos(actual.objetivo)} />
          <Fila
            concepto="Evolución"
            importe={`${diferencia >= 0 ? '+' : ''}${eurosRedondos(diferencia)}`}
            tono="fuerte"
          />
        </div>
        <Boton className="mt-3 w-full" onClick={() => setAnio(anio - 1)}>
          Ver {anio - 1}
        </Boton>
      </Tarjeta>

      <Tarjeta>
        <h3 className="font-medium">Mes a mes</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-tenue">
                <th className="py-1 font-medium">Mes</th>
                <th className="py-1 text-right font-medium">Objetivo</th>
                <th className="py-1 text-right font-medium">Aportado</th>
                <th className="py-1 text-right font-medium">Pendiente</th>
              </tr>
            </thead>
            <tbody className="cifras">
              {actual.meses.map((m, i) => (
                <tr key={m.mes} className="border-t border-borde">
                  <td className="py-1.5">
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={() => irAMes(m.mes)}
                    >
                      {NOMBRES_MES[i]}
                    </button>
                  </td>
                  <td className="py-1.5 text-right">{euros(m.objetivo)}</td>
                  <td className="py-1.5 text-right text-tenue">
                    {euros(m.objetivo - m.pendiente)}
                  </td>
                  <td className="py-1.5 text-right font-medium">{euros(m.pendiente)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </div>
  )
}
