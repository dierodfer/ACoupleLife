import type { Datos, Persona, PersonaId } from './tipos'

/**
 * Nombre visible de una persona. Estaba repetido en casi todas las pantallas
 * con el mismo texto de reserva, así que vive aquí una sola vez.
 */
export function nombrePersona(datos: Datos, personaId: PersonaId): string {
  return datos.personas.find((p) => p.id === personaId)?.nombre ?? 'Sin nombre'
}

/**
 * Qué persona eres, a partir de la cuenta de Google con la que has entrado.
 * No hay elección manual: el email se vincula solo al iniciar sesión
 * (`vincularEmailPersona`), así que esto es la única fuente de verdad.
 */
export function personaDeUsuario(datos: Datos, email: string | undefined): Persona | undefined {
  if (!email) return undefined
  return datos.personas.find((p) => p.email === email)
}
