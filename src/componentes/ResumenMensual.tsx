import { useState } from 'react'
import {
  liquidacionDelMes,
  listaEfectivoDelMes,
  listaGastosDelMes,
  listaRecurrentesDelMes,
  listaTransferenciasDelMes,
  resumenMes,
} from '../lib/calculo'
import { etiquetaMes, partesMes } from '../lib/fechas'
import { euros, fechaCorta, importeEditable, leeImporte } from '../lib/formato'
import { nombrePersona } from '../lib/personas'
import {
  eliminarEfectivo,
  eliminarGasto,
  eliminarTransferencia,
  fijarOverrideRecurrente,
} from '../lib/mutaciones'
import type { Datos } from '../lib/tipos'
import { useStore } from '../store/useStore'
import { IconoCerrar, IconoCheck, IconoDeshacer, IconoLapiz, IconoMas, IconoRepetir } from './Iconos'
import { SelectorMes } from './SelectorMes'
import { Boton, EntradaEuros, Fila, FilaLista, Grupo, Tarjeta } from './ui'

/**
 * Pantalla principal. Responde a la única pregunta que importa: cuánto tiene que
 * transferir cada uno este mes.
 */
export function ResumenMensual({ datos }: Readonly<{ datos: Datos }>) {
  const mes = useStore((s) => s.mes)
  const abrirPestana = useStore((s) => s.abrirPestana)
  const resumen = resumenMes(datos, mes)
  const liquidacion = liquidacionDelMes(datos, mes)

  return (
    <div className="flex flex-col gap-6">
      <SelectorMes datos={datos} />

      <Tarjeta className="text-center">
        <p className="text-[13px] font-medium uppercase tracking-[0.06em] text-tenue">
          Total por transferir
        </p>
        <p
          className={`cifra-heroe cifras mt-1.5 ${resumen.pendiente > 0 ? '' : 'text-positivo'}`}
        >
          {euros(resumen.pendiente)}
        </p>
        {resumen.pendiente < 0 && (
          <p className="mt-1.5 text-[13px] text-tenue">
            Este mes habéis aportado de más. No se arrastra al siguiente.
          </p>
        )}

        <div className="mt-3 border-t border-borde pt-2 text-left">
          <Fila concepto="Objetivo conjunto" importe={euros(resumen.objetivo)} />
          <Fila concepto="Gastos" importe={`− ${euros(resumen.gastos)}`} tono="tenue" />
          <Fila concepto="Efectivo" importe={`− ${euros(resumen.efectivo)}`} tono="tenue" />
          <Fila
            concepto="Transferido"
            importe={`− ${euros(resumen.transferencias)}`}
            tono="tenue"
          />
        </div>
      </Tarjeta>

      {resumen.porPersona.map((persona) => {
        const alDia = liquidacion.find((l) => l.personaId === persona.personaId)?.alDia ?? false
        return (
        <Grupo
          key={persona.personaId}
          titulo={
            <span className="flex items-center gap-1.5">
              {nombrePersona(datos, persona.personaId)}
              {alDia && (
                <span className="inline-flex items-center gap-0.5 text-positivo">
                  <IconoCheck className="h-3.5 w-3.5" />
                  al día
                </span>
              )}
            </span>
          }
        >
          <FilaLista
            titulo="Objetivo"
            valor={euros(persona.objetivo)}
            onClick={() => abrirPestana('objetivos')}
          />
          <FilaLista
            titulo="Gastos"
            detalle={
              persona.gastosRecurrentes > 0 && persona.gastosPuntuales > 0
                ? `${euros(persona.gastosPuntuales)} puntuales · ${euros(persona.gastosRecurrentes)} recurrentes`
                : undefined
            }
            valor={`− ${euros(persona.gastos)}`}
          />
          <FilaLista titulo="Efectivo" valor={`− ${euros(persona.efectivo)}`} />
          <FilaLista titulo="Transferido" valor={`− ${euros(persona.transferencias)}`} />
          <FilaLista
            titulo={<span className="font-semibold">Por transferir</span>}
            accion={
              <span
                className={`cifras font-semibold ${persona.pendiente > 0 ? '' : 'text-positivo'}`}
              >
                {euros(persona.pendiente)}
              </span>
            }
          />
        </Grupo>
        )
      })}

      <Movimientos datos={datos} />
    </div>
  )
}

function Movimientos({ datos }: Readonly<{ datos: Datos }>) {
  const mes = useStore((s) => s.mes)
  const aplicar = useStore((s) => s.aplicar)
  const abrirModalGasto = useStore((s) => s.abrirModalGasto)
  const abrirModalTransferencia = useStore((s) => s.abrirModalTransferencia)
  const { anio } = partesMes(mes)

  const gastos = listaGastosDelMes(datos, mes)
  const transferencias = listaTransferenciasDelMes(datos, mes)
  const recurrentes = listaRecurrentesDelMes(datos, mes)

  return (
    <>
      <Grupo
        titulo="Gastos del mes"
        pie={
          recurrentes.length > 0
            ? 'El icono ↻ abre la edición completa de un recurrente; el lápiz solo ajusta este mes.'
            : undefined
        }
      >
        {recurrentes.map(({ recurrente, importe }) => (
          <FilaLista
            key={recurrente.id}
            titulo={
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  title="Editar el recurrente"
                  aria-label={`Editar ${recurrente.concepto || 'recurrente'}`}
                  onClick={() => abrirModalGasto({ editandoId: recurrente.id })}
                  className="shrink-0 text-sutil transition active:text-acento"
                >
                  <IconoRepetir className="h-4 w-4" />
                </button>
                {recurrente.concepto || 'Recurrente'}
              </span>
            }
            detalle={nombrePersona(datos, recurrente.personaId)}
            accion={
              <span className="flex items-center gap-1">
                <span className={`cifras ${importe === 0 ? 'text-sutil line-through' : ''}`}>
                  {euros(importe)}
                </span>
                <AjusteRecurrente recurrenteId={recurrente.id} importeActual={importe} />
              </span>
            }
          />
        ))}

        {gastos.map((gasto) => (
          <FilaLista
            key={gasto.id}
            titulo={gasto.concepto || 'Gasto'}
            detalle={nombrePersona(datos, gasto.personaId)}
            accion={
              <span className="flex items-center gap-1">
                <span className="cifras">{euros(gasto.importe)}</span>
                <BotonBorrar
                  etiqueta="Eliminar gasto"
                  onBorrar={() => aplicar((d) => eliminarGasto(d, String(anio), gasto.id))}
                />
              </span>
            }
          />
        ))}

        <FilaLista
          titulo={
            <span className="flex items-center gap-2 text-acento">
              <IconoMas className="h-5 w-5" />
              Añadir gasto
            </span>
          }
          onClick={() => abrirModalGasto()}
          sinChevron
        />
      </Grupo>

      <Efectivos datos={datos} />

      <Grupo titulo="Transferencias realizadas">
        {transferencias.map((t) => (
          <FilaLista
            key={t.id}
            titulo={nombrePersona(datos, t.personaId)}
            detalle={fechaCorta(t.fecha)}
            accion={
              <span className="flex items-center gap-1">
                <span className="cifras">{euros(t.importe)}</span>
                <BotonBorrar
                  etiqueta="Eliminar transferencia"
                  onBorrar={() => aplicar((d) => eliminarTransferencia(d, String(anio), t.id))}
                />
              </span>
            }
          />
        ))}

        <FilaLista
          titulo={
            <span className="flex items-center gap-2 text-acento">
              <IconoMas className="h-5 w-5" />
              Registrar transferencia
            </span>
          }
          onClick={() => abrirModalTransferencia()}
          sinChevron
        />
      </Grupo>
    </>
  )
}

/**
 * Efectivo vigente este mes. Aunque se define por rango y no mes a mes, se
 * gestiona desde aquí porque es una aportación más del mes, igual que los
 * gastos y las transferencias.
 */
function Efectivos({ datos }: Readonly<{ datos: Datos }>) {
  const mes = useStore((s) => s.mes)
  const aplicar = useStore((s) => s.aplicar)
  const abrirModalEfectivo = useStore((s) => s.abrirModalEfectivo)

  const vigentes = listaEfectivoDelMes(datos, mes)

  return (
    <Grupo titulo="Efectivo del mes" pie="Se aporta automáticamente cada mes dentro de su rango.">
      {vigentes.map((e) => (
        <FilaLista
          key={e.id}
          titulo={nombrePersona(datos, e.personaId)}
          detalle={`${etiquetaMes(e.desde)} – ${e.hasta ? etiquetaMes(e.hasta) : 'sin fin'}`}
          accion={
            <span className="flex items-center gap-1">
              <span className="cifras">{euros(e.importe)}</span>
              <BotonBorrar
                etiqueta={`Eliminar efectivo de ${nombrePersona(datos, e.personaId)}`}
                onBorrar={() => aplicar((d) => eliminarEfectivo(d, e.id))}
              />
            </span>
          }
        />
      ))}

      <FilaLista
        titulo={
          <span className="flex items-center gap-2 text-acento">
            <IconoMas className="h-5 w-5" />
            Añadir efectivo
          </span>
        }
        onClick={() => abrirModalEfectivo()}
        sinChevron
      />
    </Grupo>
  )
}

function BotonBorrar({ etiqueta, onBorrar }: Readonly<{ etiqueta: string; onBorrar: () => void }>) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      onClick={onBorrar}
      className="rounded-full p-1 text-sutil transition active:text-negativo"
    >
      <IconoCerrar className="h-4 w-4" />
    </button>
  )
}

/**
 * Ajusta un recurrente solo para este mes. Es una única escritura (un override),
 * así que nunca se cuenta el gasto dos veces.
 */
function AjusteRecurrente({
  recurrenteId,
  importeActual,
}: Readonly<{
  recurrenteId: string
  importeActual: number
}>) {
  const mes = useStore((s) => s.mes)
  const aplicar = useStore((s) => s.aplicar)
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(importeEditable(importeActual))

  if (!editando) {
    return (
      <button
        type="button"
        aria-label="Ajustar este mes"
        onClick={() => {
          setValor(importeEditable(importeActual))
          setEditando(true)
        }}
        className="rounded-full p-1 text-sutil transition active:text-acento"
      >
        <IconoLapiz className="h-4 w-4" />
      </button>
    )
  }

  return (
    <span className="flex items-center gap-1">
      <EntradaEuros
        valor={valor}
        autoFocus
        aria-label="Importe solo para este mes"
        className="w-28 px-2 py-1 text-right text-[15px]"
        onCambiar={setValor}
      />
      <Boton
        variante="texto"
        aria-label="Guardar ajuste"
        onClick={() => {
          aplicar((d) => fijarOverrideRecurrente(d, recurrenteId, mes, leeImporte(valor)))
          setEditando(false)
        }}
      >
        OK
      </Boton>
      <button
        type="button"
        title="Volver al importe general"
        aria-label="Volver al importe general"
        onClick={() => {
          aplicar((d) => fijarOverrideRecurrente(d, recurrenteId, mes, null))
          setEditando(false)
        }}
        className="rounded-full p-1 text-sutil active:text-acento"
      >
        <IconoDeshacer className="h-4 w-4" />
      </button>
    </span>
  )
}
