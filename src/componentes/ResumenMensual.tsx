import { useState } from 'react'
import {
  listaGastosDelMes,
  listaRecurrentesDelMes,
  listaTransferenciasDelMes,
  resumenMes,
} from '../lib/calculo'
import { etiquetaMes, hoyKey, mesDeFecha, partesMes, sumaMeses } from '../lib/fechas'
import { euros, fechaCorta, leeImporte } from '../lib/formato'
import {
  anadirGasto,
  anadirTransferencia,
  eliminarGasto,
  eliminarTransferencia,
  fijarOverrideRecurrente,
} from '../lib/mutaciones'
import type { Datos, PersonaId } from '../lib/tipos'
import { useStore } from '../store/useStore'
import { Boton, Campo, Entrada, Fila, Selector, Tarjeta, Vacio } from './ui'

/**
 * Pantalla principal. Responde a la única pregunta que importa: cuánto tiene que
 * transferir cada uno este mes.
 */
export function ResumenMensual({ datos }: { datos: Datos }) {
  const mes = useStore((s) => s.mes)
  const irAMes = useStore((s) => s.irAMes)
  const resumen = resumenMes(datos, mes)

  const nombre = (id: PersonaId) =>
    datos.personas.find((p) => p.id === id)?.nombre ?? 'Sin nombre'

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex items-center justify-between gap-2">
        <Boton variante="texto" onClick={() => irAMes(sumaMeses(mes, -1))} aria-label="Mes anterior">
          ←
        </Boton>
        <span className="font-medium">{etiquetaMes(mes)}</span>
        <Boton variante="texto" onClick={() => irAMes(sumaMeses(mes, 1))} aria-label="Mes siguiente">
          →
        </Boton>
      </nav>

      <Tarjeta className="text-center">
        <p className="text-sm text-tenue">Total por transferir</p>
        <p
          className={`cifras mt-1 text-4xl font-semibold ${
            resumen.pendiente > 0 ? '' : 'text-positivo'
          }`}
        >
          {euros(resumen.pendiente)}
        </p>
        {resumen.pendiente < 0 && (
          <p className="mt-1 text-xs text-tenue">
            Este mes habéis aportado de más. No se arrastra al mes siguiente.
          </p>
        )}
      </Tarjeta>

      {resumen.porPersona.map((persona) => (
        <Tarjeta key={persona.personaId}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">{nombre(persona.personaId)}</h2>
            <span
              className={`cifras text-xl font-semibold ${
                persona.pendiente > 0 ? '' : 'text-positivo'
              }`}
            >
              {euros(persona.pendiente)}
            </span>
          </div>
          <div className="mt-2 border-t border-borde pt-2">
            <Fila concepto="Objetivo" importe={euros(persona.objetivo)} />
            <Fila concepto="Gastos" importe={`− ${euros(persona.gastos)}`} tono="tenue" />
            <Fila concepto="Efectivo" importe={`− ${euros(persona.efectivo)}`} tono="tenue" />
            <Fila
              concepto="Transferido"
              importe={`− ${euros(persona.transferencias)}`}
              tono="tenue"
            />
            <div className="mt-1 border-t border-borde pt-1">
              <Fila concepto="Por transferir" importe={euros(persona.pendiente)} tono="fuerte" />
            </div>
          </div>
        </Tarjeta>
      ))}

      <Movimientos datos={datos} />
    </div>
  )
}

function Movimientos({ datos }: { datos: Datos }) {
  const mes = useStore((s) => s.mes)
  const aplicar = useStore((s) => s.aplicar)
  const { anio } = partesMes(mes)

  const gastos = listaGastosDelMes(datos, mes)
  const transferencias = listaTransferenciasDelMes(datos, mes)
  const recurrentes = listaRecurrentesDelMes(datos, mes)

  const nombre = (id: PersonaId) =>
    datos.personas.find((p) => p.id === id)?.nombre ?? 'Sin nombre'

  return (
    <>
      <Tarjeta>
        <h3 className="font-medium">Gastos del mes</h3>
        <div className="mt-2">
          {recurrentes.map(({ recurrente, importe }) => (
            <Fila
              key={recurrente.id}
              concepto={
                <>
                  <span className="text-tenue">↻ </span>
                  {recurrente.concepto || 'Recurrente'} · {nombre(recurrente.personaId)}
                </>
              }
              importe={euros(importe)}
              tono={importe === 0 ? 'tenue' : 'normal'}
              accion={<AjusteRecurrente recurrenteId={recurrente.id} importeActual={importe} />}
            />
          ))}
          {gastos.map((gasto) => (
            <Fila
              key={gasto.id}
              concepto={`${fechaCorta(gasto.fecha)} · ${gasto.concepto || 'Gasto'} · ${nombre(gasto.personaId)}`}
              importe={euros(gasto.importe)}
              accion={
                <Boton
                  variante="texto"
                  aria-label="Eliminar gasto"
                  onClick={() => aplicar((d) => eliminarGasto(d, String(anio), gasto.id))}
                >
                  ×
                </Boton>
              }
            />
          ))}
          {gastos.length === 0 && recurrentes.length === 0 && (
            <Vacio>Todavía no hay gastos este mes.</Vacio>
          )}
        </div>
        <FormularioMovimiento datos={datos} tipo="gasto" />
      </Tarjeta>

      <Tarjeta>
        <h3 className="font-medium">Transferencias realizadas</h3>
        <div className="mt-2">
          {transferencias.map((t) => (
            <Fila
              key={t.id}
              concepto={`${fechaCorta(t.fecha)} · ${nombre(t.personaId)}`}
              importe={euros(t.importe)}
              accion={
                <Boton
                  variante="texto"
                  aria-label="Eliminar transferencia"
                  onClick={() => aplicar((d) => eliminarTransferencia(d, String(anio), t.id))}
                >
                  ×
                </Boton>
              }
            />
          ))}
          {transferencias.length === 0 && <Vacio>Ninguna transferencia registrada.</Vacio>}
        </div>
        <FormularioMovimiento datos={datos} tipo="transferencia" />
      </Tarjeta>
    </>
  )
}

/**
 * Ajusta un recurrente solo para este mes. Es una única escritura (un override),
 * así que nunca se cuenta el gasto dos veces.
 */
function AjusteRecurrente({
  recurrenteId,
  importeActual,
}: {
  recurrenteId: string
  importeActual: number
}) {
  const mes = useStore((s) => s.mes)
  const aplicar = useStore((s) => s.aplicar)
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(String(importeActual))

  if (!editando) {
    return (
      <Boton
        variante="texto"
        aria-label="Ajustar este mes"
        onClick={() => {
          setValor(String(importeActual))
          setEditando(true)
        }}
      >
        ✎
      </Boton>
    )
  }

  return (
    <span className="flex items-center gap-1">
      <Entrada
        type="text"
        inputMode="decimal"
        value={valor}
        autoFocus
        className="w-20"
        onChange={(e) => setValor(e.target.value)}
      />
      <Boton
        variante="texto"
        onClick={() => {
          aplicar((d) => fijarOverrideRecurrente(d, recurrenteId, mes, leeImporte(valor)))
          setEditando(false)
        }}
      >
        ✓
      </Boton>
      <Boton
        variante="texto"
        title="Volver al importe general"
        onClick={() => {
          aplicar((d) => fijarOverrideRecurrente(d, recurrenteId, mes, null))
          setEditando(false)
        }}
      >
        ↺
      </Boton>
    </span>
  )
}

function FormularioMovimiento({
  datos,
  tipo,
}: {
  datos: Datos
  tipo: 'gasto' | 'transferencia'
}) {
  const mes = useStore((s) => s.mes)
  const aplicar = useStore((s) => s.aplicar)
  const [abierto, setAbierto] = useState(false)

  const primeraPersona = datos.personas[0]?.id ?? ''
  // Por defecto, hoy si estamos en el mes en curso; si no, el día 1 del mes que se mira.
  const fechaPorDefecto = mesDeFecha(hoyKey()) === mes ? hoyKey() : `${mes}-01`

  const [personaId, setPersonaId] = useState(primeraPersona)
  const [importe, setImporte] = useState('')
  const [concepto, setConcepto] = useState('')
  const [fecha, setFecha] = useState(fechaPorDefecto)

  if (!abierto) {
    return (
      <Boton className="mt-3 w-full" onClick={() => setAbierto(true)}>
        {tipo === 'gasto' ? 'Añadir gasto' : 'Registrar transferencia'}
      </Boton>
    )
  }

  const guardar = () => {
    const cantidad = leeImporte(importe)
    if (cantidad <= 0) return

    aplicar((d) =>
      tipo === 'gasto'
        ? anadirGasto(d, { personaId, importe: cantidad, fecha, concepto })
        : anadirTransferencia(d, { personaId, importe: cantidad, fecha }),
    )

    setImporte('')
    setConcepto('')
    setAbierto(false)
  }

  return (
    <form
      className="mt-3 flex flex-col gap-3 border-t border-borde pt-3"
      onSubmit={(e) => {
        e.preventDefault()
        guardar()
      }}
    >
      <Campo etiqueta="Persona">
        <Selector value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
          {datos.personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Selector>
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Importe">
          <Entrada
            type="text"
            inputMode="decimal"
            value={importe}
            autoFocus
            placeholder="0,00"
            onChange={(e) => setImporte(e.target.value)}
          />
        </Campo>
        <Campo etiqueta="Fecha">
          <Entrada type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Campo>
      </div>

      {tipo === 'gasto' && (
        <Campo etiqueta="Concepto" ayuda="Opcional">
          <Entrada value={concepto} onChange={(e) => setConcepto(e.target.value)} />
        </Campo>
      )}

      <div className="flex gap-2">
        <Boton type="submit" variante="principal" className="flex-1">
          Guardar
        </Boton>
        <Boton type="button" onClick={() => setAbierto(false)}>
          Cancelar
        </Boton>
      </div>

      {mesDeFecha(fecha) !== mes && (
        <p className="text-xs text-tenue">
          Esta fecha es de {etiquetaMes(mesDeFecha(fecha))}: el movimiento se guardará en ese mes.
        </p>
      )}
    </form>
  )
}
