import { useStore } from '../store/useStore'
import { Aviso, Boton, Tarjeta } from './ui'

/**
 * Login y onboarding. El onboarding tiene dos caminos porque el scope
 * `drive.file` solo da acceso a lo que crea la propia app: el primer usuario
 * crea el archivo y el segundo tiene que señalarlo una vez con el selector de
 * Google, aunque ya se lo hayan compartido.
 */
export function PantallaAcceso() {
  const estado = useStore((s) => s.estado)
  const usuario = useStore((s) => s.usuario)
  const error = useStore((s) => s.error)
  const entrar = useStore((s) => s.entrar)
  const crearArchivo = useStore((s) => s.crearArchivo)
  const conectarArchivo = useStore((s) => s.conectarArchivo)

  const cargando = estado === 'cargando'

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <header className="text-center">
        <h1 className="text-2xl font-semibold">Cuentas de pareja</h1>
        <p className="mt-2 text-sm text-tenue">
          ¿Cuánto tengo que transferir este mes?
        </p>
      </header>

      {error && <Aviso tono="error">{error}</Aviso>}

      {estado === 'sinSesion' && (
        <Tarjeta className="flex flex-col gap-4">
          <p className="text-sm text-tenue">
            Los datos se guardan en un archivo de tu propio Google Drive. La aplicación no
            tiene servidor: solo accede al archivo que ella misma crea.
          </p>
          <Boton variante="principal" onClick={() => void entrar()}>
            Entrar con Google
          </Boton>
        </Tarjeta>
      )}

      {(estado === 'sinArchivo' || cargando) && (
        <Tarjeta className="flex flex-col gap-4">
          <div>
            <h2 className="font-medium">Hola{usuario ? `, ${usuario.nombre}` : ''}</h2>
            <p className="mt-1 text-sm text-tenue">
              Si eres la primera persona, crea el archivo. Si tu pareja ya lo creó y te lo
              ha compartido, conéctalo.
            </p>
          </div>

          <Boton variante="principal" disabled={cargando} onClick={() => void crearArchivo()}>
            {cargando ? 'Creando…' : 'Crear archivo nuevo'}
          </Boton>
          <Boton disabled={cargando} onClick={() => void conectarArchivo()}>
            Conectar archivo existente
          </Boton>

          <p className="text-xs text-tenue">
            Al conectar un archivo existente hay que elegirlo una sola vez en el selector de
            Google. Después la aplicación lo recuerda.
          </p>
        </Tarjeta>
      )}
    </main>
  )
}
