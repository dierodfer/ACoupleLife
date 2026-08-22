import { useState } from 'react'
import { leeImporte } from '../lib/formato'
import { anadirGasto, eliminarRecurrente, guardarRecurrente } from '../lib/mutaciones'
import type { Datos, PersonaId } from '../lib/tipos'
import { useStore } from '../store/useStore'
import { SelectorRangoMeses } from './SelectorRangoMeses'
import { Boton, Campo, ControlSegmentado, Entrada, Grupo, Modal, Selector } from './ui'

type Tipo = 'puntual' | 'recurrente'

/**
 * Modal único de alta/edición de gasto, compartido por la pantalla principal
 * (alta, puntual o recurrente) y Ajustes (alta o edición de un recurrente).
 * Al ser el mismo componente montado una sola vez en `App.tsx`, se evita
 * duplicar el formulario en dos sitios.
 */
export function ModalGasto({ datos }: { datos: Datos }) {
  const modalGasto = useStore((s) => s.modalGasto)
  const cerrarModalGasto = useStore((s) => s.cerrarModalGasto)

  const editando = modalGasto.editandoId
    ? datos.recurrentes.find((r) => r.id === modalGasto.editandoId)
    : undefined

  return (
    <Modal
      abierto={modalGasto.abierto}
      onCerrar={cerrarModalGasto}
      titulo={editando ? 'Editar recurrente' : 'Añadir gasto'}
    >
      <FormularioGasto
        datos={datos}
        editandoId={modalGasto.editandoId}
        tipoInicial={modalGasto.tipoInicial}
      />
    </Modal>
  )
}

function FormularioGasto({
  datos,
  editandoId,
  tipoInicial,
}: {
  datos: Datos
  editandoId: string | null
  tipoInicial: Tipo
}) {
  const mes = useStore((s) => s.mes)
  const aplicar = useStore((s) => s.aplicar)
  const cerrarModalGasto = useStore((s) => s.cerrarModalGasto)
  const personaActiva = useStore((s) => s.personaActiva)

  const recurrente = editandoId ? datos.recurrentes.find((r) => r.id === editandoId) : undefined
  const editando = Boolean(recurrente)

  const [tipo, setTipo] = useState<Tipo>(tipoInicial)
  const [personaId, setPersonaId] = useState<PersonaId>(
    recurrente?.personaId ?? personaActiva ?? datos.personas[0]?.id ?? '',
  )
  const [concepto, setConcepto] = useState(recurrente?.concepto ?? '')
  const [importe, setImporte] = useState(recurrente ? String(recurrente.importe) : '')
  const [errorImporte, setErrorImporte] = useState(false)
  const [desde, setDesde] = useState(recurrente?.desde ?? mes)
  const [hasta, setHasta] = useState(recurrente?.hasta ?? '')

  const ajustes = recurrente ? Object.keys(recurrente.overrides).length : 0

  const guardar = () => {
    const cantidad = leeImporte(importe)
    if (cantidad <= 0) {
      setErrorImporte(true)
      return
    }

    if (tipo === 'puntual') {
      aplicar((d) => anadirGasto(d, { personaId, importe: cantidad, fecha: `${mes}-01`, concepto }))
    } else {
      aplicar((d) =>
        guardarRecurrente(d, {
          id: editandoId ?? undefined,
          personaId,
          concepto,
          importe: cantidad,
          desde,
          hasta: hasta || null,
        }),
      )
    }
    cerrarModalGasto()
  }

  const eliminar = () => {
    if (!editandoId) return
    aplicar((d) => eliminarRecurrente(d, editandoId))
    cerrarModalGasto()
  }

  return (
    <form
      className="flex flex-col gap-5 pb-2"
      onSubmit={(e) => {
        e.preventDefault()
        guardar()
      }}
    >
      {!editando && (
        <ControlSegmentado
          valor={tipo}
          onCambiar={setTipo}
          opciones={[
            { valor: 'puntual', etiqueta: 'Puntual' },
            { valor: 'recurrente', etiqueta: 'Recurrente' },
          ]}
        />
      )}

      <Grupo
        pie={
          tipo === 'puntual'
            ? 'Se registra para el mes que estás viendo.'
            : editando && ajustes > 0
              ? `${ajustes} ${ajustes === 1 ? 'mes ajustado' : 'meses ajustados'} manualmente desde la pantalla del mes.`
              : undefined
        }
      >
        <div className="flex flex-col gap-4 p-4">
          {editando && (
            <Campo etiqueta="Persona">
              <Selector value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
                {datos.personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
          )}

          <Campo etiqueta="Importe">
            <Entrada
              type="text"
              inputMode="decimal"
              value={importe}
              error={errorImporte}
              autoFocus
              placeholder="0,00"
              onChange={(e) => {
                setImporte(e.target.value)
                setErrorImporte(false)
              }}
            />
          </Campo>

          <Campo etiqueta="Concepto" ayuda="Opcional">
            <Entrada value={concepto} onChange={(e) => setConcepto(e.target.value)} />
          </Campo>

          {tipo === 'recurrente' && (
            <SelectorRangoMeses
              desde={desde}
              hasta={hasta}
              onCambiar={(nuevoDesde, nuevoHasta) => {
                setDesde(nuevoDesde)
                setHasta(nuevoHasta)
              }}
            />
          )}
        </div>
      </Grupo>

      <div className="flex flex-col gap-2">
        <Boton type="submit" variante="principal">
          Guardar
        </Boton>
        {editando && (
          <Boton type="button" variante="peligro" onClick={eliminar}>
            Eliminar recurrente
          </Boton>
        )}
      </div>
    </form>
  )
}
