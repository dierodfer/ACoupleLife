import { intentarSalir } from '../services/navegacionAtras'
import { useStore } from '../store/useStore'
import { Boton, Modal } from './ui'

/** Última pregunta antes de salir: la abre `store.atras()` en la pantalla raíz, sin nada más que cerrar. */
export function ModalConfirmarSalir() {
  const abierto = useStore((s) => s.modalConfirmarSalir)
  const cerrar = useStore((s) => s.cerrarModalConfirmarSalir)

  return (
    <Modal abierto={abierto} onCerrar={cerrar} titulo="¿Salir de la aplicación?">
      <div className="flex flex-col gap-2 pb-2">
        <Boton variante="principal" onClick={intentarSalir}>
          Salir
        </Boton>
        <Boton variante="texto" onClick={cerrar} className="self-center">
          Cancelar
        </Boton>
      </div>
    </Modal>
  )
}
