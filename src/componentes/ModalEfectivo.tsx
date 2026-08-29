import { useState } from 'react'
import { etiquetaMes } from '../lib/fechas'
import { leeImporte } from '../lib/formato'
import { guardarEfectivo } from '../lib/mutaciones'
import { nombrePersona, personaActiva } from '../lib/personas'
import type { Datos, PersonaId } from '../lib/tipos'
import { useStore } from '../store/useStore'
import { SelectorRangoMeses } from './SelectorRangoMeses'
import { Boton, Campo, EntradaEuros, Modal } from './ui'

/** Modal de alta de efectivo, con «desde» precargado en el mes que se está viendo. */
export function ModalEfectivo({ datos }: Readonly<{ datos: Datos }>) {
  const mes = useStore((s) => s.mes)
  const usuario = useStore((s) => s.usuario)
  const personaEditada = useStore((s) => s.personaEditada)
  const abierto = useStore((s) => s.modalEfectivo)
  const cerrar = useStore((s) => s.cerrarModalEfectivo)

  const personaId = personaActiva(datos, personaEditada, usuario?.email)

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      titulo="Añadir efectivo"
      subtitulo={`${etiquetaMes(mes)} · ${nombrePersona(datos, personaId)}`}
    >
      <FormularioEfectivo personaId={personaId} />
    </Modal>
  )
}

function FormularioEfectivo({ personaId }: Readonly<{ personaId: PersonaId }>) {
  const mes = useStore((s) => s.mes)
  const aplicar = useStore((s) => s.aplicar)
  const cerrar = useStore((s) => s.cerrarModalEfectivo)
  const [importe, setImporte] = useState('')
  const [errorImporte, setErrorImporte] = useState(false)
  const [desde, setDesde] = useState(mes)
  const [hasta, setHasta] = useState('')

  const guardar = () => {
    const cantidad = leeImporte(importe)
    if (cantidad <= 0) {
      setErrorImporte(true)
      return
    }
    aplicar((d) => guardarEfectivo(d, { personaId, importe: cantidad, desde, hasta: hasta || null }))
    cerrar()
  }

  return (
    <form
      className="flex flex-col gap-4 pb-2"
      onSubmit={(e) => {
        e.preventDefault()
        guardar()
      }}
    >
      <Campo etiqueta="Importe" requerido>
        <EntradaEuros
          name="importe"
          valor={importe}
          error={errorImporte}
          autoFocus
          onCambiar={(v) => {
            setImporte(v)
            setErrorImporte(false)
          }}
        />
      </Campo>

      <SelectorRangoMeses
        desde={desde}
        hasta={hasta}
        onCambiar={(nuevoDesde, nuevoHasta) => {
          setDesde(nuevoDesde)
          setHasta(nuevoHasta)
        }}
      />

      <Boton type="submit" variante="principal">
        Guardar
      </Boton>
    </form>
  )
}
