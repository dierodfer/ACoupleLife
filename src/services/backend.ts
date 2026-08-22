import * as authGoogle from './auth'
import * as authLocal from './auth.local'
import * as driveGoogle from './drive'
import * as driveLocal from './drive.local'

/**
 * Punto único de conmutación entre los servicios reales de Google y los
 * locales (`VITE_MODO_LOCAL=true`, activado por `make local`). El resto de
 * la app importa `auth`/`drive` de aquí y no sabe cuál de los dos está
 * activo; los tipos (`Usuario`, `ArchivoDrive`, etc.) siguen viniendo de los
 * módulos reales porque ambas implementaciones comparten forma.
 */
const MODO_LOCAL = import.meta.env.VITE_MODO_LOCAL === 'true'

export const auth = MODO_LOCAL ? authLocal : authGoogle
export const drive = MODO_LOCAL ? driveLocal : driveGoogle
