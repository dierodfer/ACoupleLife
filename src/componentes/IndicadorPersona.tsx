import { personaDeUsuario } from '../lib/personas'
import type { Datos } from '../lib/tipos'
import { useStore } from '../store/useStore'

/**
 * A nombre de quién se registran los gastos, transferencias y efectivo. No es
 * una elección: se sabe por la cuenta de Google con la que se ha entrado, la
 * misma que vincula `vincularEmailPersona` al iniciar sesión. Solo informa.
 */
export function IndicadorPersona({ datos }: Readonly<{ datos: Datos }>) {
  const usuario = useStore((s) => s.usuario)

  if (datos.personas.length < 2) return null

  const persona = personaDeUsuario(datos, usuario?.email)
  if (!persona) return null

  return (
    <p className="px-1 text-[13px] text-tenue">
      Registrando como <span className="font-medium text-tinta">{persona.nombre}</span>
    </p>
  )
}
