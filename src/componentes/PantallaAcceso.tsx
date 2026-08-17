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
            <p className="mt-1 text-sm text-tenue">¿Tu pareja ya está usando la aplicación?</p>
          </div>

          <div className="flex flex-col gap-2">
            <Boton variante="principal" disabled={cargando} onClick={() => void conectarArchivo()}>
              Sí, abrir nuestras cuentas
            </Boton>
            <p className="text-xs text-tenue">
              Google te pedirá que elijas el archivo <strong>cuentas-pareja.json</strong> una
              sola vez. Después la aplicación lo recuerda.
            </p>
          </div>

          <div className="flex flex-col gap-2 border-t border-borde pt-4">
            <Boton disabled={cargando} onClick={() => void crearArchivo()}>
              {cargando ? 'Creando…' : 'No, empezar de cero'}
            </Boton>
            <p className="text-xs text-tenue">
              Se creará el archivo en tu Drive. Luego podrás invitar a tu pareja desde
              Ajustes.
            </p>
          </div>
        </Tarjeta>
      )}
    </main>
  )
}
