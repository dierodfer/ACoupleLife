import { useState } from 'react'
import { objetivoDelMes } from '../lib/calculo'
import { etiquetaMes, partesMes } from '../lib/fechas'
import { importeEditable, leeImporte } from '../lib/formato'
import { fijarExcepcionObjetivo } from '../lib/mutaciones'
import { nombrePersona } from '../lib/personas'
import type { Datos, PersonaId } from '../lib/tipos'
import { useStore } from '../store/useStore'
import { IconoDeshacer } from './Iconos'
import { Boton, Campo, EntradaEuros, Modal } from './ui'

/**
 * Modal para cambiar el objetivo de un mes concreto, de cualquiera de las dos
 * personas, sin tener que ir a la pantalla de Objetivo. Se abre desde «Por
 * transferir»; guarda como excepción de ese mes (`fijarExcepcionObjetivo`), no
 * toca la regla general del año.
 */
export function ModalObjetivo({ datos }: Readonly<{ datos: Datos }>) {
  const mes = useStore((s) => s.mes)
  const personaId = useStore((s) => s.modalObjetivo)
  const cerrar = useStore((s) => s.cerrarModalObjetivo)

  return (
    <Modal
      abierto={personaId !== null}
      onCerrar={cerrar}
      titulo="Objetivo del mes"
      subtitulo={personaId ? `${etiquetaMes(mes)} · ${nombrePersona(datos, personaId)}` : undefined}
    >
      {personaId && <FormularioObjetivo datos={datos} personaId={personaId} />}
    </Modal>
  )
}

function FormularioObjetivo({
  datos,
  personaId,
}: Readonly<{ datos: Datos; personaId: PersonaId }>) {
  const mes = useStore((s) => s.mes)
  const aplicar = useStore((s) => s.aplicar)
  const cerrar = useStore((s) => s.cerrarModalObjetivo)

  const { anio, mes: mesDelAnio } = partesMes(mes)
  const efectivo = objetivoDelMes(datos, personaId, mes)
  const esExcepcion =
    (datos.anios[String(anio)]?.objetivos[personaId]?.excepciones ?? {})[String(mesDelAnio)] !==
    undefined

  const [valor, setValor] = useState(importeEditable(efectivo))

  const guardar = () => {
    aplicar((d) => fijarExcepcionObjetivo(d, anio, personaId, mesDelAnio, leeImporte(valor)))
    cerrar()
  }

  const quitarExcepcion = () => {
    aplicar((d) => fijarExcepcionObjetivo(d, anio, personaId, mesDelAnio, null))
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
      <Campo etiqueta="Objetivo" requerido>
        <EntradaEuros name="objetivo" valor={valor} autoFocus onCambiar={setValor} />
      </Campo>

      <Boton type="submit" variante="principal">
        Guardar
      </Boton>

      {esExcepcion && (
        <Boton variante="texto" type="button" onClick={quitarExcepcion} className="self-center">
          <IconoDeshacer className="h-4 w-4" />
          Volver a la regla general de {anio}
        </Boton>
      )}
    </form>
  )
}
