import { useState } from 'react'
import { etiquetaMes } from '../lib/fechas'
import { leeImporte } from '../lib/formato'
import { guardarEfectivo } from '../lib/mutaciones'
import { personaDeUsuario } from '../lib/personas'
import type { Datos } from '../lib/tipos'
import { useStore } from '../store/useStore'
import { SelectorRangoMeses } from './SelectorRangoMeses'
import { Boton, Campo, EntradaEuros, Modal } from './ui'

/** Modal de alta de efectivo, con «desde» precargado en el mes que se está viendo. */
export function ModalEfectivo({ datos }: Readonly<{ datos: Datos }>) {
  const mes = useStore((s) => s.mes)
  const abierto = useStore((s) => s.modalEfectivo)
  const cerrar = useStore((s) => s.cerrarModalEfectivo)

  return (
    <Modal abierto={abierto} onCerrar={cerrar} titulo="Añadir efectivo" subtitulo={etiquetaMes(mes)}>
      <FormularioEfectivo datos={datos} />
    </Modal>
  )
}

function FormularioEfectivo({ datos }: Readonly<{ datos: Datos }>) {
  const mes = useStore((s) => s.mes)
  const aplicar = useStore((s) => s.aplicar)
  const usuario = useStore((s) => s.usuario)
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
    const personaId = personaDeUsuario(datos, usuario?.email)?.id ?? datos.personas[0]?.id ?? ''
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
