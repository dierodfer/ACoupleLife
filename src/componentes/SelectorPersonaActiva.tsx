import type { Datos } from '../lib/tipos'
import { useStore } from '../store/useStore'
import { ControlSegmentado } from './ui'

/**
 * Quién queda preseleccionado al dar de alta un gasto, transferencia o
 * efectivo. Visible en toda la app (montado una sola vez en `App.tsx`) para
 * no tener que elegir persona en cada formulario.
 */
export function SelectorPersonaActiva({ datos }: Readonly<{ datos: Datos }>) {
  const personaActiva = useStore((s) => s.personaActiva)
  const setPersonaActiva = useStore((s) => s.setPersonaActiva)

  if (datos.personas.length < 2) return null

  return (
    <ControlSegmentado
      valor={personaActiva ?? datos.personas[0]?.id ?? ''}
      onCambiar={setPersonaActiva}
      opciones={datos.personas.map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
    />
  )
}
