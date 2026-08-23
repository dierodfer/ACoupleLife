import { useState } from 'react'
import { etiquetaMes } from '../lib/fechas'
import { importeEditable, leeImporte } from '../lib/formato'
import { anadirGasto, eliminarRecurrente, guardarRecurrente } from '../lib/mutaciones'
import { personaDeUsuario } from '../lib/personas'
import type { Datos, PersonaId } from '../lib/tipos'
import { useStore } from '../store/useStore'
import { SelectorRangoMeses } from './SelectorRangoMeses'
import { Boton, Campo, ControlSegmentado, Entrada, EntradaEuros, Grupo, Modal, Selector } from './ui'

type Tipo = 'puntual' | 'recurrente'

function tituloModal(editando: boolean, tipo: Tipo): string {
  if (editando) return 'Editar recurrente'
  return tipo === 'recurrente' ? 'Añadir recurrente' : 'Añadir gasto'
}

/** `3 meses ajustados manualmente...`, o `undefined` si no hay ninguno. */
function pieAjustes(editando: boolean, ajustes: number): string | undefined {
  if (!editando || ajustes === 0) return undefined
  const meses = ajustes === 1 ? 'mes ajustado' : 'meses ajustados'
  return `${ajustes} ${meses} manualmente desde la pantalla del mes.`
}

/**
 * Modal único de alta/edición de gasto, compartido por la pantalla principal
 * (alta, puntual o recurrente) y Ajustes (alta o edición de un recurrente).
 * Al ser el mismo componente montado una sola vez en `App.tsx`, se evita
 * duplicar el formulario en dos sitios.
 */
export function ModalGasto({ datos }: Readonly<{ datos: Datos }>) {
  const mes = useStore((s) => s.mes)
  const modalGasto = useStore((s) => s.modalGasto)
  const cerrarModalGasto = useStore((s) => s.cerrarModalGasto)
  const [tipo, setTipo] = useState<Tipo>(modalGasto.tipoInicial)

  const editando = modalGasto.editandoId
    ? datos.recurrentes.find((r) => r.id === modalGasto.editandoId)
    : undefined

  const titulo = tituloModal(Boolean(editando), tipo)
  // Un gasto puntual queda archivado en el mes que se está viendo; un
  // recurrente tiene su propio rango, así que el mes no aplica igual.
  const subtitulo = !editando && tipo === 'puntual' ? etiquetaMes(mes) : undefined

  return (
    <Modal abierto={modalGasto.abierto} onCerrar={cerrarModalGasto} titulo={titulo} subtitulo={subtitulo}>
      <FormularioGasto
        datos={datos}
        editandoId={modalGasto.editandoId}
        tipo={tipo}
        setTipo={setTipo}
      />
    </Modal>
  )
}

function FormularioGasto({
  datos,
  editandoId,
  tipo,
  setTipo,
}: Readonly<{
  datos: Datos
  editandoId: string | null
  tipo: Tipo
  setTipo: (tipo: Tipo) => void
}>) {
  const mes = useStore((s) => s.mes)
  const aplicar = useStore((s) => s.aplicar)
  const cerrarModalGasto = useStore((s) => s.cerrarModalGasto)
  const usuario = useStore((s) => s.usuario)

  const recurrente = editandoId ? datos.recurrentes.find((r) => r.id === editandoId) : undefined
  const editando = Boolean(recurrente)

  const [personaId, setPersonaId] = useState<PersonaId>(
    recurrente?.personaId ?? personaDeUsuario(datos, usuario?.email)?.id ?? datos.personas[0]?.id ?? '',
  )
  const [concepto, setConcepto] = useState(recurrente?.concepto ?? '')
  const [importe, setImporte] = useState(recurrente ? importeEditable(recurrente.importe) : '')
  const [errorImporte, setErrorImporte] = useState(false)
  const [desde, setDesde] = useState(recurrente?.desde ?? mes)
  const [hasta, setHasta] = useState(recurrente?.hasta ?? '')

  const ajustes = recurrente ? Object.keys(recurrente.overrides).length : 0
  const pie = pieAjustes(editando, ajustes)

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

      <Grupo pie={pie}>
        <div className="flex flex-col gap-4 p-4">
          {editando && (
            <Campo etiqueta="Persona" requerido>
              <Selector value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
                {datos.personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
          )}

          <Campo etiqueta="Importe" requerido>
            <EntradaEuros
              valor={importe}
              error={errorImporte}
              autoFocus
              onCambiar={(v) => {
                setImporte(v)
                setErrorImporte(false)
              }}
            />
          </Campo>

          <Campo etiqueta="Concepto">
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
