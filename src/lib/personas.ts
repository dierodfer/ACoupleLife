import type { Datos, PersonaId } from './tipos'

/**
 * Nombre visible de una persona. Estaba repetido en casi todas las pantallas
 * con el mismo texto de reserva, así que vive aquí una sola vez.
 */
export function nombrePersona(datos: Datos, personaId: PersonaId): string {
  return datos.personas.find((p) => p.id === personaId)?.nombre ?? 'Sin nombre'
}
