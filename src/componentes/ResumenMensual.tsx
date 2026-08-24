import { useState } from 'react'
import {
  baseDelMes,
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
import type { Datos, ResumenPersona } from '../lib/tipos'
import { useStore } from '../store/useStore'
import { Donut, PuntoSerie } from './Donut'
import {
  IconoCerrar,
  IconoCheck,
  IconoChevron,
  IconoDeshacer,
  IconoLapiz,
  IconoMas,
  IconoRepetir,
} from './Iconos'
import { SelectorMes } from './SelectorMes'
import { Boton, EntradaEuros, Fila, FilaLista, Grupo, Tarjeta } from './ui'

/**
 * Pantalla principal. Responde a la única pregunta que importa: cuánto tiene que
 * transferir cada uno este mes.
 */
export function ResumenMensual({ datos }: Readonly<{ datos: Datos }>) {
  const mes = useStore((s) => s.mes)
  const resumen = resumenMes(datos, mes)

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

        <div className="mt-3 border-t border-borde pt-1 text-left">
          <FilaConDesglose
            datos={datos}
            concepto="Objetivo conjunto"
            total={resumen.objetivo}
            porPersona={resumen.porPersona}
            campo="objetivo"
          />
          <FilaConDesglose
            datos={datos}
            concepto="Gastos"
            total={resumen.gastos}
            porPersona={resumen.porPersona}
            campo="gastos"
            signo="− "
            tono="tenue"
          />
          <FilaConDesglose
            datos={datos}
            concepto="Efectivo"
            total={resumen.efectivo}
            porPersona={resumen.porPersona}
            campo="efectivo"
            signo="− "
            tono="tenue"
          />
          <FilaConDesglose
            datos={datos}
            concepto="Transferido"
            total={resumen.transferencias}
            porPersona={resumen.porPersona}
            campo="transferencias"
            signo="− "
            tono="tenue"
          />
        </div>
      </Tarjeta>

      {resumen.porPersona.map((persona) => (
        <DesglosePersona key={persona.personaId} datos={datos} persona={persona} />
      ))}

      <Movimientos datos={datos} />
    </div>
  )
}

/**
 * Fila de la tarjeta del total, desplegable: pulsarla revela cuánto pone cada
 * persona en ese concepto. Cerrada por defecto porque el total ya responde a
 * la pregunta de la pareja; el reparto es la de detalle.
 */
function FilaConDesglose({
  datos,
  concepto,
  total,
  porPersona,
  campo,
  signo = '',
  tono,
}: Readonly<{
  datos: Datos
  concepto: string
  total: number
  porPersona: ResumenPersona[]
  campo: 'objetivo' | 'gastos' | 'efectivo' | 'transferencias'
  signo?: string
  tono?: 'tenue'
}>) {
  const [abierto, setAbierto] = useState(false)
  const tenue = tono === 'tenue' ? 'text-tenue' : ''

  return (
    <div>
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 py-1.5 text-left active:opacity-60"
      >
        <span className={`flex min-w-0 items-center gap-1 truncate text-[15px] ${tenue}`}>
          <IconoChevron
            className={`h-3.5 w-3.5 shrink-0 text-sutil transition-transform ${abierto ? 'rotate-90' : ''}`}
          />
          {concepto}
        </span>
        <span className={`cifras shrink-0 text-[15px] ${tenue}`}>
          {signo}
          {euros(total)}
        </span>
      </button>

      {abierto && (
        <div className="flex flex-col gap-1 py-1 pl-[1.125rem]">
          {porPersona.map((p) => (
            <div key={p.personaId} className="flex items-center justify-between gap-3 text-[13px] text-tenue">
              <span className="truncate">{nombrePersona(datos, p.personaId)}</span>
              <span className="cifras shrink-0">
                {signo}
                {euros(p[campo])}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Cómo se reparte el anillo. El orden es el mismo que el de la leyenda y el del
 * desglose de la pareja de arriba, para que los tres se lean igual. Las clases
 * van escritas enteras porque Tailwind las busca literalmente en el código: una
 * compuesta al vuelo (`stroke-${...}`) no llegaría a generarse.
 */
const TRAMOS = [
  { clave: 'gastos', etiqueta: 'Gastos', trazo: 'stroke-serie-gastos', punto: 'bg-serie-gastos' },
  {
    clave: 'efectivo',
    etiqueta: 'Efectivo',
    trazo: 'stroke-serie-efectivo',
    punto: 'bg-serie-efectivo',
  },
  {
    clave: 'transferencias',
    etiqueta: 'Transferido',
    trazo: 'stroke-serie-transferido',
    punto: 'bg-serie-transferido',
  },
] as const

/**
 * El mes de una persona en un anillo: cuánto de su objetivo cubre ya cada tipo
 * de aportación y cuánto queda por transferir, que es el hueco sin pintar.
 */
function DesglosePersona({
  datos,
  persona,
}: Readonly<{ datos: Datos; persona: ResumenPersona }>) {
  const abrirPestana = useStore((s) => s.abrirPestana)
  const base = baseDelMes(persona)

  const tramos = TRAMOS.map((t) => ({ clave: t.clave, valor: persona[t.clave], clase: t.trazo }))
  // La leyenda solo lista lo que ya existe este mes: un tipo de aportación sin
  // nada que mostrar no aporta información, y así va apareciendo según se dan
  // de alta gastos, efectivo o transferencias.
  const conMovimiento = TRAMOS.filter((t) => persona[t.clave] > 0)

  return (
    <Grupo titulo={nombrePersona(datos, persona.personaId)}>
      <div className="flex flex-col items-center gap-4 px-4 pb-1 pt-4">
        <Donut tramos={tramos} base={base} etiqueta={etiquetaDonut(datos, persona)}>
          <CentroDonut base={base} pendiente={persona.pendiente} />
        </Donut>

        <div className="w-full">
          {conMovimiento.length === 0 && (
            <p className="py-1.5 text-center text-[13px] text-tenue">Sin movimientos este mes.</p>
          )}
          {conMovimiento.map((t) => (
            <Fila
              key={t.clave}
              concepto={
                <span className="flex items-center gap-2">
                  <PuntoSerie clase={t.punto} />
                  {t.etiqueta}
                  {t.clave === 'gastos' && persona.gastosPuntuales > 0 && persona.gastosRecurrentes > 0 && (
                    <span className="truncate text-[13px] text-tenue">
                      {euros(persona.gastosPuntuales)} + {euros(persona.gastosRecurrentes)} fijos
                    </span>
                  )}
                </span>
              }
              importe={euros(persona[t.clave])}
            />
          ))}
        </div>
      </div>

      <FilaLista
        titulo="Objetivo"
        valor={euros(persona.objetivo)}
        onClick={() => abrirPestana('objetivos')}
      />
    </Grupo>
  )
}

/** El dato que resume el anillo, en su hueco central. */
function CentroDonut({ base, pendiente }: Readonly<{ base: number; pendiente: number }>) {
  if (base === 0) return <span className="text-[15px] text-tenue">Sin objetivo</span>

  if (pendiente <= 0) {
    return (
      <>
        <IconoCheck className="h-7 w-7 text-positivo" />
        <span className="text-[15px] font-medium text-positivo">Al día</span>
      </>
    )
  }

  return (
    <>
      <span className="cifras text-[19px] font-semibold leading-none">{euros(pendiente)}</span>
      <span className="text-[12px] leading-tight text-tenue">por transferir</span>
    </>
  )
}

/** El mismo contenido del anillo, en una frase, para lectores de pantalla. */
function etiquetaDonut(datos: Datos, persona: ResumenPersona): string {
  const partes = TRAMOS.map((t) => `${t.etiqueta} ${euros(persona[t.clave])}`).join(', ')
  const objetivo = `objetivo ${euros(persona.objetivo)}`
  return `${nombrePersona(datos, persona.personaId)}: ${partes}, de un ${objetivo}.`
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
            accion={<AjusteRecurrente recurrenteId={recurrente.id} importeActual={importe} />}
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
      <span className="flex items-center gap-1">
        <span className={`cifras ${importeActual === 0 ? 'text-sutil line-through' : ''}`}>
          {euros(importeActual)}
        </span>
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
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1">
      <EntradaEuros
        name="importe-ajuste"
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
