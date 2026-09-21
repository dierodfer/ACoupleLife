import { intentarSalir } from '../services/navegacionAtras'
import { useStore } from '../store/useStore'
import { Boton, Modal } from './ui'

/**
 * Última pregunta antes de salir: la abre `atras()` (`store/useStore.ts`) al
 * pulsar el botón atrás del sistema en la pantalla raíz, sin nada más que
 * cerrar. Vive fuera de `Pantallas`, junto al resto de la app, porque puede
 * saltar también antes de haber iniciado sesión.
 */
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
