import { useState } from 'react'
import {
  listaEfectivoDelMes,
  listaGastosDelMes,
  listaRecurrentesDelMes,
  listaTransferenciasDelMes,
} from '../lib/calculo'
import { etiquetaMes, partesMes } from '../lib/fechas'
import { euros, fechaCorta, importeEditable, leeImporte } from '../lib/formato'
import {
  eliminarEfectivo,
  eliminarGasto,
  eliminarTransferencia,
  fijarOverrideRecurrente,
} from '../lib/mutaciones'
import { personaActiva } from '../lib/personas'
import type { Datos, PersonaId } from '../lib/tipos'
import { ETIQUETAS_PESTANA, useStore } from '../store/useStore'
import { IconoCerrar, IconoDeshacer, IconoLapiz, IconoMas, IconoRepetir } from './Iconos'
import {
  Boton,
  CabeceraVolver,
  ControlSegmentado,
  EntradaEuros,
  FilaLista,
  Grupo,
  TituloGrande,
} from './ui'

export function PantallaMovimientos({ datos }: Readonly<{ datos: Datos }>) {
  const mes = useStore((s) => s.mes)
  const usuario = useStore((s) => s.usuario)
  const volver = useStore((s) => s.volver)
  const destino = useStore((s) => s.historial[s.historial.length - 1] ?? 'mes')
  const personaEditada = useStore((s) => s.personaEditada)
  const elegirPersonaEditada = useStore((s) => s.elegirPersonaEditada)

  const personaId = personaActiva(datos, personaEditada, usuario?.email)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <CabeceraVolver destino={ETIQUETAS_PESTANA[destino]} onVolver={volver} />
        <TituloGrande>Movimientos</TituloGrande>
        <p className="px-1 text-[15px] text-tenue">{etiquetaMes(mes)}</p>
      </div>

      {datos.personas.length > 1 && (
        <ControlSegmentado
          valor={personaId}
          onCambiar={elegirPersonaEditada}
          opciones={datos.personas.map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
        />
      )}

      <Gastos datos={datos} personaId={personaId} />
      <Efectivos datos={datos} personaId={personaId} />
      <Transferencias datos={datos} personaId={personaId} />
    </div>
  )
}

function FilaAnadir({ texto, onClick }: Readonly<{ texto: string; onClick: () => void }>) {
  return (
    <FilaLista
      titulo={
        <span className="flex items-center gap-2 text-acento">
          <IconoMas className="h-5 w-5" />
          {texto}
        </span>
      }
      onClick={onClick}
      sinChevron
    />
  )
}

function Gastos({ datos, personaId }: Readonly<{ datos: Datos; personaId: PersonaId }>) {
  const mes = useStore((s) => s.mes)
  const aplicar = useStore((s) => s.aplicar)
  const abrirModalGasto = useStore((s) => s.abrirModalGasto)
  const { anio } = partesMes(mes)

  const gastos = listaGastosDelMes(datos, mes).filter((g) => g.personaId === personaId)
  const recurrentes = listaRecurrentesDelMes(datos, mes).filter(
    ({ recurrente }) => recurrente.personaId === personaId,
  )

  return (
    <Grupo
      titulo="Gastos"
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
          accion={<AjusteRecurrente recurrenteId={recurrente.id} importeActual={importe} />}
        />
      ))}

      {gastos.map((gasto) => (
        <FilaLista
          key={gasto.id}
          titulo={gasto.concepto || 'Gasto'}
          detalle={fechaCorta(gasto.fecha)}
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

      <FilaAnadir texto="Añadir gasto" onClick={() => abrirModalGasto()} />
    </Grupo>
  )
}

function Efectivos({ datos, personaId }: Readonly<{ datos: Datos; personaId: PersonaId }>) {
  const mes = useStore((s) => s.mes)
  const aplicar = useStore((s) => s.aplicar)
  const abrirModalEfectivo = useStore((s) => s.abrirModalEfectivo)

  const vigentes = listaEfectivoDelMes(datos, mes).filter((e) => e.personaId === personaId)

  return (
    <Grupo titulo="Efectivo" pie="Se aporta automáticamente cada mes dentro de su rango.">
      {vigentes.map((e) => (
        <FilaLista
          key={e.id}
          titulo={`${etiquetaMes(e.desde)} – ${e.hasta ? etiquetaMes(e.hasta) : 'sin fin'}`}
          accion={
            <span className="flex items-center gap-1">
              <span className="cifras">{euros(e.importe)}</span>
              <BotonBorrar
                etiqueta="Eliminar efectivo"
                onBorrar={() => aplicar((d) => eliminarEfectivo(d, e.id))}
              />
            </span>
          }
        />
      ))}

      <FilaAnadir texto="Añadir efectivo" onClick={() => abrirModalEfectivo()} />
    </Grupo>
  )
}

function Transferencias({ datos, personaId }: Readonly<{ datos: Datos; personaId: PersonaId }>) {
  const mes = useStore((s) => s.mes)
  const aplicar = useStore((s) => s.aplicar)
  const abrirModalTransferencia = useStore((s) => s.abrirModalTransferencia)
  const { anio } = partesMes(mes)

  const transferencias = listaTransferenciasDelMes(datos, mes).filter(
    (t) => t.personaId === personaId,
  )

  return (
    <Grupo titulo="Transferencias">
      {transferencias.map((t) => (
        <FilaLista
          key={t.id}
          titulo={fechaCorta(t.fecha)}
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

      <FilaAnadir texto="Registrar transferencia" onClick={() => abrirModalTransferencia()} />
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
