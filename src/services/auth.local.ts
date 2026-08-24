import type { Usuario } from './auth'

/**
 * Sustituto de `auth.ts` para el modo local (`VITE_MODO_LOCAL=true`, ver
 * `make local`). No hay login real ni ventana de Google: siempre hay una
 * sesión ya abierta con un usuario de pega. Solo exporta lo que `useStore.ts`
 * llama a través de `auth`; `drive.local.ts` no necesita un token.
 */

const USUARIO_LOCAL: Usuario = { email: 'persona1@local.test', nombre: 'Persona 1 (local)' }

export function entrar(): Promise<Usuario> {
  return Promise.resolve(USUARIO_LOCAL)
}

export function reanudarSesion(): Promise<Usuario | null> {
  return Promise.resolve(USUARIO_LOCAL)
}

export function salir(): void {
  // No hay sesión real de Google que cerrar en local.
}
