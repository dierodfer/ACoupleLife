import { useState } from 'react'
import { NOMBRES_MES, etiquetaMes, mesActual, mesKey, partesMes } from '../lib/fechas'
import { euros, leeImporte } from '../lib/formato'
import {
  cambiarEmailPersona,
  cambiarObjetivoMensual,
  eliminarEfectivo,
  eliminarRecurrente,
  fijarExcepcionObjetivo,
  guardarEfectivo,
  guardarRecurrente,
  renombrarPersona,
  type ModoCambioObjetivo,
} from '../lib/mutaciones'
import type { Datos, PersonaId } from '../lib/tipos'
import { useStore } from '../store/useStore'
import { Aviso, Boton, Campo, Entrada, Fila, Selector, Tarjeta, Vacio } from './ui'
import { compartirCon } from '../services/drive'

export function Ajustes({ datos }: { datos: Datos }) {
  return (
    <div className="flex flex-col gap-4">
      <Personas datos={datos} />
      <Objetivos datos={datos} />
      <Efectivos datos={datos} />
      <Recurrentes datos={datos} />
      <Compartir datos={datos} />
    </div>
  )
}

function Personas({ datos }: { datos: Datos }) {
  const aplicar = useStore((s) => s.aplicar)

  return (
    <Tarjeta className="flex flex-col gap-3">
      <h3 className="font-medium">Personas</h3>
      <p className="text-sm text-tenue">
        Cambiar el nombre no afecta al histórico: cada persona se identifica internamente por
        un id fijo.
      </p>
      {datos.personas.map((persona) => (
        <div key={persona.id} className="grid gap-2 sm:grid-cols-2">
          <Campo etiqueta="Nombre">
            <Entrada
              value={persona.nombre}
              onChange={(e) => aplicar((d) => renombrarPersona(d, persona.id, e.target.value))}
            />
          </Campo>
          <Campo etiqueta="Email de Google">
            <Entrada
              type="email"
              value={persona.email}
              placeholder="pareja@gmail.com"
              onChange={(e) => aplicar((d) => cambiarEmailPersona(d, persona.id, e.target.value))}
            />
          </Campo>
        </div>
      ))}
    </Tarjeta>
  )
}

/**
 * Objetivos del año. Al cambiar la regla mensual se pregunta siempre si el
 * cambio debe alcanzar a los meses ya pasados o solo a los que vienen.
 */
function Objetivos({ datos }: { datos: Datos }) {
  const mes = useStore((s) => s.mes)
  const aplicar = useStore((s) => s.aplicar)
  const { anio } = partesMes(mes)
  const [pendienteDeConfirmar, setPendienteDeConfirmar] = useState<{
    personaId: PersonaId
    importe: number
  } | null>(null)

  const anioEnCurso = partesMes(mesActual()).anio === anio
  const mesEnCurso = partesMes(mesActual()).mes

  const confirmar = (modo: ModoCambioObjetivo) => {
    if (!pendienteDeConfirmar) return
    const { personaId, importe } = pendienteDeConfirmar
    aplicar((d) => cambiarObjetivoMensual(d, anio, personaId, importe, modo, mesEnCurso))
    setPendienteDeConfirmar(null)
  }

  return (
    <Tarjeta className="flex flex-col gap-3">
      <h3 className="font-medium">Objetivo mensual · {anio}</h3>

      {datos.personas.map((persona) => {
        const objetivo = datos.anios[String(anio)]?.objetivos[persona.id]
        return (
          <Campo
            key={persona.id}
            etiqueta={persona.nombre}
            ayuda="Importe que esta persona aporta cada mes."
          >
            <Entrada
              type="text"
              inputMode="decimal"
              defaultValue={objetivo?.importeMensual ?? 0}
              key={`${persona.id}-${objetivo?.importeMensual ?? 0}`}
              onBlur={(e) => {
                const importe = leeImporte(e.target.value)
                if (importe === (objetivo?.importeMensual ?? 0)) return

                // Para un año pasado o en enero no hay meses vividos que proteger.
                if (!anioEnCurso || mesEnCurso === 1) {
                  aplicar((d) =>
                    cambiarObjetivoMensual(d, anio, persona.id, importe, 'todoElAnio'),
                  )
                  return
                }
                setPendienteDeConfirmar({ personaId: persona.id, importe })
              }}
            />
          </Campo>
        )
      })}

      {pendienteDeConfirmar && (
        <Aviso>
          <span>
            ¿Aplicar {euros(pendienteDeConfirmar.importe)} desde {NOMBRES_MES[mesEnCurso - 1]}, o
            también a los meses ya pasados de {anio}?
          </span>
          <span className="flex gap-2">
            <Boton variante="principal" onClick={() => confirmar('desdeEsteMes')}>
              Solo desde este mes
            </Boton>
            <Boton onClick={() => confirmar('todoElAnio')}>Todo el año</Boton>
            <Boton variante="texto" onClick={() => setPendienteDeConfirmar(null)}>
              Cancelar
            </Boton>
          </span>
        </Aviso>
      )}

      <ExcepcionesObjetivo datos={datos} anio={anio} />
    </Tarjeta>
  )
}

/** Meses concretos que rompen la regla general del año. */
function ExcepcionesObjetivo({ datos, anio }: { datos: Datos; anio: number }) {
  const aplicar = useStore((s) => s.aplicar)
  const [personaId, setPersonaId] = useState(datos.personas[0]?.id ?? '')
  const [mes, setMes] = useState(1)
  const [importe, setImporte] = useState('')

  const excepciones = datos.personas.flatMap((p) =>
    Object.entries(datos.anios[String(anio)]?.objetivos[p.id]?.excepciones ?? {}).map(
      ([m, valor]) => ({ persona: p, mes: Number(m), importe: valor }),
    ),
  )

  return (
    <div className="border-t border-borde pt-3">
      <h4 className="text-sm font-medium">Excepciones por mes</h4>
      <div className="mt-1">
        {excepciones.map(({ persona, mes: m, importe: valor }) => (
          <Fila
            key={`${persona.id}-${m}`}
            concepto={`${NOMBRES_MES[m - 1]} · ${persona.nombre}`}
            importe={euros(valor)}
            accion={
              <Boton
                variante="texto"
                aria-label="Quitar excepción"
                onClick={() => aplicar((d) => fijarExcepcionObjetivo(d, anio, persona.id, m, null))}
              >
                ×
              </Boton>
            }
          />
        ))}
        {excepciones.length === 0 && <Vacio>Sin excepciones: todos los meses siguen la regla.</Vacio>}
      </div>

      <form
        className="mt-2 grid grid-cols-3 gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          aplicar((d) => fijarExcepcionObjetivo(d, anio, personaId, mes, leeImporte(importe)))
          setImporte('')
        }}
      >
        <Selector value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
          {datos.personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Selector>
        <Selector value={mes} onChange={(e) => setMes(Number(e.target.value))}>
          {NOMBRES_MES.map((nombre, i) => (
            <option key={nombre} value={i + 1}>
              {nombre}
            </option>
          ))}
        </Selector>
        <Entrada
          type="text"
          inputMode="decimal"
          value={importe}
          placeholder="Importe"
          onChange={(e) => setImporte(e.target.value)}
        />
        <Boton type="submit" className="col-span-3">
          Añadir excepción
        </Boton>
      </form>
    </div>
  )
}

/**
 * Fila de recurrente o efectivo. El rango va en su propia línea: en un móvil no
 * cabe junto al concepto sin truncarlo.
 */
function FilaConRango({
  concepto,
  nota,
  importe,
  desde,
  hasta,
  onHasta,
  onEliminar,
}: {
  concepto: string
  nota?: string
  importe: string
  desde: string
  hasta: string | null
  onHasta: (hasta: string | null) => void
  onEliminar: () => void
}) {
  return (
    <div className="border-b border-borde py-2 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm">{concepto}</span>
        <span className="flex shrink-0 items-center gap-1">
          <span className="cifras text-sm">{importe}</span>
          <Boton variante="texto" aria-label="Eliminar" onClick={onEliminar}>
            ×
          </Boton>
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-tenue">
        <span className="shrink-0">
          {etiquetaMes(desde)} → {hasta ? '' : 'sin fin'}
        </span>
        <Entrada
          type="month"
          aria-label="Fin del rango"
          className="w-40"
          value={hasta ?? ''}
          onChange={(e) => onHasta(e.target.value || null)}
        />
      </div>
      {nota && <p className="mt-1 text-xs text-tenue">{nota}</p>}
    </div>
  )
}

function Efectivos({ datos }: { datos: Datos }) {
  const aplicar = useStore((s) => s.aplicar)
  const [personaId, setPersonaId] = useState(datos.personas[0]?.id ?? '')
  const [importe, setImporte] = useState('')
  const [desde, setDesde] = useState(mesKey(new Date().getFullYear(), 1))

  const nombre = (id: PersonaId) => datos.personas.find((p) => p.id === id)?.nombre ?? '—'

  return (
    <Tarjeta className="flex flex-col gap-3">
      <h3 className="font-medium">Efectivo mensual</h3>
      <p className="text-sm text-tenue">
        Se considera aportado automáticamente cada mes dentro de su rango. Deja el fin vacío
        para que siga indefinidamente, también en años futuros.
      </p>

      <div>
        {datos.efectivo.map((e) => (
          <FilaConRango
            key={e.id}
            concepto={nombre(e.personaId)}
            importe={euros(e.importe)}
            desde={e.desde}
            hasta={e.hasta}
            onHasta={(hasta) => aplicar((d) => guardarEfectivo(d, { ...e, hasta }))}
            onEliminar={() => aplicar((d) => eliminarEfectivo(d, e.id))}
          />
        ))}
        {datos.efectivo.length === 0 && <Vacio>Nadie aporta efectivo por ahora.</Vacio>}
      </div>

      <form
        className="grid grid-cols-3 gap-2 border-t border-borde pt-3"
        onSubmit={(ev) => {
          ev.preventDefault()
          const cantidad = leeImporte(importe)
          if (cantidad <= 0) return
          aplicar((d) => guardarEfectivo(d, { personaId, importe: cantidad, desde, hasta: null }))
          setImporte('')
        }}
      >
        <Selector value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
          {datos.personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Selector>
        <Entrada
          type="text"
          inputMode="decimal"
          value={importe}
          placeholder="Importe"
          onChange={(e) => setImporte(e.target.value)}
        />
        <Entrada type="month" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <Boton type="submit" className="col-span-3">
          Añadir efectivo
        </Boton>
      </form>
    </Tarjeta>
  )
}

function Recurrentes({ datos }: { datos: Datos }) {
  const aplicar = useStore((s) => s.aplicar)
  const [personaId, setPersonaId] = useState(datos.personas[0]?.id ?? '')
  const [concepto, setConcepto] = useState('')
  const [importe, setImporte] = useState('')
  const [desde, setDesde] = useState(mesKey(new Date().getFullYear(), 1))

  const nombre = (id: PersonaId) => datos.personas.find((p) => p.id === id)?.nombre ?? '—'

  return (
    <Tarjeta className="flex flex-col gap-3">
      <h3 className="font-medium">Gastos recurrentes</h3>
      <p className="text-sm text-tenue">
        No se guardan mes a mes: se calculan a partir del rango. Para cambiar el importe de un
        mes suelto, edítalo desde la pantalla de ese mes.
      </p>

      <div>
        {datos.recurrentes.map((r) => {
          const ajustes = Object.keys(r.overrides).length
          return (
            <FilaConRango
              key={r.id}
              concepto={`${r.concepto || 'Recurrente'} · ${nombre(r.personaId)}`}
              nota={
                ajustes > 0
                  ? `${ajustes} ${ajustes === 1 ? 'mes ajustado' : 'meses ajustados'}`
                  : undefined
              }
              importe={euros(r.importe)}
              desde={r.desde}
              hasta={r.hasta}
              onHasta={(hasta) => aplicar((d) => guardarRecurrente(d, { ...r, hasta }))}
              onEliminar={() => aplicar((d) => eliminarRecurrente(d, r.id))}
            />
          )
        })}
        {datos.recurrentes.length === 0 && <Vacio>Sin gastos recurrentes.</Vacio>}
      </div>

      <form
        className="grid grid-cols-2 gap-2 border-t border-borde pt-3"
        onSubmit={(ev) => {
          ev.preventDefault()
          const cantidad = leeImporte(importe)
          if (cantidad <= 0) return
          aplicar((d) =>
            guardarRecurrente(d, { personaId, concepto, importe: cantidad, desde, hasta: null }),
          )
          setConcepto('')
          setImporte('')
        }}
      >
        <Selector value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
          {datos.personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Selector>
        <Entrada
          value={concepto}
          placeholder="Concepto"
          onChange={(e) => setConcepto(e.target.value)}
        />
        <Entrada
          type="text"
          inputMode="decimal"
          value={importe}
          placeholder="Importe"
          onChange={(e) => setImporte(e.target.value)}
        />
        <Entrada type="month" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <Boton type="submit" className="col-span-2">
          Añadir recurrente
        </Boton>
      </form>
    </Tarjeta>
  )
}

/**
 * Invitar a la otra persona. La app puede dar permisos sobre el archivo que ella
 * misma creó, así que no hace falta pasar por la web de Drive.
 */
function Compartir({ datos }: { datos: Datos }) {
  const fileId = useStore((s) => s.fileId)
  const usuario = useStore((s) => s.usuario)
  const [estado, setEstado] = useState<'inicial' | 'enviando' | 'hecho' | 'error'>('inicial')
  const [detalle, setDetalle] = useState('')

  const otra = datos.personas.find((p) => p.email && p.email !== usuario?.email)

  const invitar = async () => {
    if (!fileId || !otra?.email) return
    try {
      setEstado('enviando')
      await compartirCon(fileId, otra.email)
      setEstado('hecho')
    } catch (error) {
      setEstado('error')
      setDetalle(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <Tarjeta className="flex flex-col gap-3">
      <h3 className="font-medium">Compartir el archivo</h3>
      <p className="text-sm text-tenue">
        Da acceso de edición al archivo de Drive. La otra persona, además, tendrá que
        conectarlo una vez desde su móvil con el selector de Google.
      </p>

      {!otra?.email && (
        <Aviso>Rellena antes el email de Google de la otra persona.</Aviso>
      )}
      {estado === 'hecho' && <Aviso>Invitación enviada a {otra?.email}.</Aviso>}
      {estado === 'error' && <Aviso tono="error">{detalle}</Aviso>}

      <Boton
        variante="principal"
        disabled={!otra?.email || estado === 'enviando'}
        onClick={() => void invitar()}
      >
        {estado === 'enviando' ? 'Enviando…' : `Invitar a ${otra?.email ?? '…'}`}
      </Boton>
    </Tarjeta>
  )
}
