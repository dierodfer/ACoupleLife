import type { Usuario } from './auth'

/**
 * Sustituto de `auth.ts` para el modo local (`VITE_MODO_LOCAL=true`, ver
 * `make local`). No hay login real ni ventana de Google: siempre hay una
 * sesión ya abierta con un usuario de pega, y el "token" es un valor fijo
 * que `drive.local.ts` ni siquiera usa.
 */

const USUARIO_LOCAL: Usuario = { email: 'persona1@local.test', nombre: 'Persona 1 (local)' }

export function entrar(): Promise<Usuario> {
  return Promise.resolve(USUARIO_LOCAL)
}

export function tokenValido(): Promise<string> {
  return Promise.resolve('token-local')
}

export function haySesion(): boolean {
  return true
}

export function reanudarSesion(): Promise<Usuario | null> {
  return Promise.resolve(USUARIO_LOCAL)
}

export function datosUsuario(): Promise<Usuario> {
  return Promise.resolve(USUARIO_LOCAL)
}

export function salir(): void {
  // No hay sesión real de Google que cerrar en local.
}
