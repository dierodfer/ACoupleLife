import { useState } from 'react'
import { liquidacionDelMes } from '../lib/calculo'
import { etiquetaMes, hoyKey, mesDeFecha } from '../lib/fechas'
import { euros, importeEditable, leeImporte } from '../lib/formato'
import { anadirTransferencia } from '../lib/mutaciones'
import { nombrePersona, personaActiva } from '../lib/personas'
import type { Datos, PersonaId } from '../lib/tipos'
import { useStore } from '../store/useStore'
import { IconoCheck } from './Iconos'
import { Boton, Campo, EntradaEuros, Modal } from './ui'

/** Modal de alta de transferencia, siempre para el mes que se está viendo. */
export function ModalTransferencia({ datos }: Readonly<{ datos: Datos }>) {
  const mes = useStore((s) => s.mes)
  const usuario = useStore((s) => s.usuario)
  const personaEditada = useStore((s) => s.personaEditada)
  const abierto = useStore((s) => s.modalTransferencia)
  const cerrar = useStore((s) => s.cerrarModalTransferencia)

  const personaId = personaActiva(datos, personaEditada, usuario?.email)

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      titulo="Añadir transferencia"
      subtitulo={`${etiquetaMes(mes)} · ${nombrePersona(datos, personaId)}`}
    >
      <FormularioTransferencia datos={datos} personaId={personaId} />
    </Modal>
  )
}

function FormularioTransferencia({
  datos,
  personaId,
}: Readonly<{ datos: Datos; personaId: PersonaId }>) {
  const mes = useStore((s) => s.mes)
  const aplicar = useStore((s) => s.aplicar)
  const cerrar = useStore((s) => s.cerrarModalTransferencia)
  const [importe, setImporte] = useState('')
  const [errorImporte, setErrorImporte] = useState(false)
  const [completa, setCompleta] = useState(false)

  const pendiente =
    liquidacionDelMes(datos, mes).find((l) => l.personaId === personaId)?.pendiente ?? 0

  const alternarCompleta = () => {
    const marcar = !completa
    setCompleta(marcar)
    // Marcarla rellena el importe con lo que falta; desmarcarla lo devuelve
    // a manos del usuario en vez de dejar la cifra impuesta.
    setImporte(marcar ? importeEditable(pendiente) : '')
    setErrorImporte(false)
  }

  const guardar = () => {
    const cantidad = leeImporte(importe)
    if (cantidad <= 0) {
      setErrorImporte(true)
      return
    }

    // Hoy si es el mes en curso; si no, el día 1, para no archivarla fuera del mes visto.
    const fecha = mesDeFecha(hoyKey()) === mes ? hoyKey() : `${mes}-01`
    aplicar((d) => anadirTransferencia(d, { personaId, importe: cantidad, fecha }))
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
          disabled={completa}
          autoFocus
          onCambiar={(v) => {
            setImporte(v)
            setErrorImporte(false)
          }}
        />
      </Campo>

      {pendiente > 0 && (
        <button
          type="button"
          aria-pressed={completa}
          onClick={alternarCompleta}
          className="flex items-center gap-2.5 text-left text-[15px] active:opacity-60"
        >
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
              completa ? 'border-acento bg-acento text-white' : 'border-sutil'
            }`}
          >
            {completa && <IconoCheck className="h-4 w-4" />}
          </span>
          <span>
            <span className="block">Marcar como completa</span>
            <span className="block text-[13px] text-tenue">
              Transfiere los {euros(pendiente)} que faltan y queda al día.
            </span>
          </span>
        </button>
      )}

      <Boton type="submit" variante="principal">
        Guardar
      </Boton>
    </form>
  )
}
