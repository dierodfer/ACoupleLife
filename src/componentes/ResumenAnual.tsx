import { useState } from 'react'
import { liquidacionDelMes, resumenAnio } from '../lib/calculo'
import { NOMBRES_MES, etiquetaMes, mesActual, mesKey, partesMes } from '../lib/fechas'
import { euros, eurosRedondos } from '../lib/formato'
import { nombrePersona } from '../lib/personas'
import type { Datos, MesKey } from '../lib/tipos'
import { useStore } from '../store/useStore'
import { NavegadorAnio } from './RejillaMeses'
import { Fila, FilaLista, Grupo, Tarjeta, TituloGrande } from './ui'

const ABREVIADOS = NOMBRES_MES.map((n) => n.slice(0, 3))

/** Estado global del año, con un calendario para bajar al detalle de un mes. */
export function ResumenAnual({ datos }: Readonly<{ datos: Datos }>) {
  const mes = useStore((s) => s.mes)
  const [anio, setAnio] = useState(partesMes(mes).anio)
  const [seleccionado, setSeleccionado] = useState<MesKey | null>(null)

  const actual = resumenAnio(datos, anio)

  return (
    <div className="flex flex-col gap-6">
      <TituloGrande>{anio}</TituloGrande>

      <div className="rounded-tarjeta bg-superficie px-3 py-2">
        <NavegadorAnio
          anio={anio}
          onCambiar={(a) => {
            setAnio(a)
            setSeleccionado(null)
          }}
        />
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

      <Calendario
        datos={datos}
        anio={anio}
        resumen={actual}
        seleccionado={seleccionado}
        onSeleccionar={setSeleccionado}
      />
    </div>
  )
}

/**
 * Los doce meses del año con su objetivo. Al tocar uno se abre su desglose
 * debajo, en lugar de saltar directamente a la pantalla del mes: así se puede
 * comparar meses sin salir del año.
 */
function Calendario({
  datos,
  anio,
  resumen,
  seleccionado,
  onSeleccionar,
}: Readonly<{
  datos: Datos
  anio: number
  resumen: ReturnType<typeof resumenAnio>
  seleccionado: MesKey | null
  onSeleccionar: (mes: MesKey | null) => void
}>) {
  const verMes = useStore((s) => s.verMes)
  const hoy = mesActual()

  const detalle = seleccionado ? resumen.meses.find((m) => m.mes === seleccionado) : undefined

  return (
    <div className="flex flex-col gap-3">
      <h2 className="encabezado-grupo px-4 font-medium uppercase tracking-[0.06em] text-tenue">
        Mes a mes
      </h2>

      <div className="grid grid-cols-3 gap-2">
        {resumen.meses.map((m, i) => {
          const clave = mesKey(anio, i + 1)
          const esSeleccionado = clave === seleccionado
          const marcas = liquidacionDelMes(datos, clave).filter((l) => l.conObjetivo)

          return (
            <button
              key={clave}
              type="button"
              aria-pressed={esSeleccionado}
              onClick={() => onSeleccionar(esSeleccionado ? null : clave)}
              className={`flex flex-col items-center gap-0.5 rounded-tarjeta px-1 py-2.5 transition ${
                esSeleccionado
                  ? 'bg-acento text-white'
                  : 'bg-superficie text-tinta active:bg-relleno'
              }`}
            >
              <span
                className={`text-[13px] ${
                  clave === hoy && !esSeleccionado ? 'font-semibold text-acento' : ''
                }`}
              >
                {ABREVIADOS[i]}
              </span>
              <span className="cifras text-[15px] font-semibold">
                {eurosRedondos(m.objetivo)}
              </span>
              <span aria-hidden className="mt-0.5 flex h-1.5 items-center gap-1">
                {marcas.map((l) => (
                  <span
                    key={l.personaId}
                    className={`h-1.5 w-1.5 rounded-full border ${estiloPunto(
                      l.alDia,
                      esSeleccionado,
                    )}`}
                  />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      {detalle && (
        <Grupo titulo={etiquetaMes(detalle.mes)}>
          {detalle.porPersona.map((p) => (
            <FilaLista
              key={p.personaId}
              titulo={nombrePersona(datos, p.personaId)}
              detalle={`Objetivo ${euros(p.objetivo)} · gastos ${euros(p.gastos)} · efectivo ${euros(
                p.efectivo,
              )} · transferido ${euros(p.transferencias)}`}
              accion={
                <span className={`cifras font-semibold ${p.pendiente > 0 ? '' : 'text-positivo'}`}>
                  {euros(p.pendiente)}
                </span>
              }
            />
          ))}
          <FilaLista
            titulo={<span className="font-semibold">Total por transferir</span>}
            accion={
              <span
                className={`cifras font-semibold ${detalle.pendiente > 0 ? '' : 'text-positivo'}`}
              >
                {euros(detalle.pendiente)}
              </span>
            }
          />
          <FilaLista
            titulo={<span className="text-acento">Abrir {etiquetaMes(detalle.mes)}</span>}
            onClick={() => verMes(detalle.mes)}
          />
        </Grupo>
      )}
    </div>
  )
}

/** Punto de liquidación dentro de la celda del mes. */
function estiloPunto(alDia: boolean, seleccionado: boolean): string {
  if (alDia) return seleccionado ? 'border-white bg-white' : 'border-positivo bg-positivo'
  return seleccionado ? 'border-white/70' : 'border-sutil'
}
