import { useState } from 'react'
import { resumenAnio } from '../lib/calculo'
import { NOMBRES_MES, mesActual, mesKey, partesMes } from '../lib/fechas'
import { euros, eurosRedondos } from '../lib/formato'
import { nombrePersona } from '../lib/personas'
import type { Datos } from '../lib/tipos'
import { useStore } from '../store/useStore'
import { NavegadorAnio } from './RejillaMeses'
import { Fila, FilaLista, Grupo, Tarjeta, TituloGrande } from './ui'

/** Estado global del año, con acceso directo al anterior para comparar. */
export function ResumenAnual({ datos }: Readonly<{ datos: Datos }>) {
  const mes = useStore((s) => s.mes)
  const verMes = useStore((s) => s.verMes)
  const [anio, setAnio] = useState(partesMes(mes).anio)

  const actual = resumenAnio(datos, anio)
  const anterior = resumenAnio(datos, anio - 1)
  const diferencia = actual.objetivo - anterior.objetivo
  const hoy = mesActual()

  return (
    <div className="flex flex-col gap-6">
      <TituloGrande>{anio}</TituloGrande>

      <div className="rounded-tarjeta bg-superficie px-3 py-2">
        <NavegadorAnio anio={anio} onCambiar={setAnio} />
      </div>

      <Tarjeta className="text-center">
        <p className="text-[13px] font-medium uppercase tracking-[0.06em] text-tenue">
          Pendiente del año
        </p>
        <p className={`cifra-heroe cifras mt-1.5 ${actual.pendiente > 0 ? '' : 'text-positivo'}`}>
          {eurosRedondos(actual.pendiente)}
        </p>
        <div className="mt-3 border-t border-borde pt-2 text-left">
          <Fila concepto="Objetivo del año" importe={eurosRedondos(actual.objetivo)} />
          <Fila concepto="Aportado" importe={eurosRedondos(actual.aportado)} tono="tenue" />
        </div>
      </Tarjeta>

      <Grupo titulo="Por persona">
        {actual.pendientePorPersona.map((p) => (
          <FilaLista
            key={p.personaId}
            titulo={nombrePersona(datos, p.personaId)}
            detalle={`Aportado ${eurosRedondos(p.aportado)} de ${eurosRedondos(p.objetivo)}`}
            valor={eurosRedondos(p.pendiente)}
          />
        ))}
      </Grupo>

      <Grupo titulo={`Comparación con ${anio - 1}`}>
        <FilaLista titulo={`Objetivo ${anio - 1}`} valor={eurosRedondos(anterior.objetivo)} />
        <FilaLista titulo={`Objetivo ${anio}`} valor={eurosRedondos(actual.objetivo)} />
        <FilaLista
          titulo={<span className="font-semibold">Evolución</span>}
          accion={
            <span className={`cifras font-semibold ${diferencia >= 0 ? 'text-positivo' : ''}`}>
              {diferencia >= 0 ? '+' : ''}
              {eurosRedondos(diferencia)}
            </span>
          }
        />
        <FilaLista
          titulo={<span className="text-acento">Ver {anio - 1}</span>}
          onClick={() => setAnio(anio - 1)}
          sinChevron
        />
      </Grupo>

      <Grupo titulo="Mes a mes" pie="Toca un mes para abrirlo y ver su desglose por persona.">
        {actual.meses.map((m, i) => {
          const clave = mesKey(anio, i + 1)
          return (
            <FilaLista
              key={m.mes}
              titulo={
                <span className={clave === hoy ? 'font-semibold text-acento' : undefined}>
                  {NOMBRES_MES[i]}
                </span>
              }
              detalle={`Objetivo ${euros(m.objetivo)} · aportado ${euros(m.objetivo - m.pendiente)}`}
              valor={euros(m.pendiente)}
              onClick={() => verMes(m.mes)}
            />
          )
        })}
      </Grupo>
    </div>
  )
}
