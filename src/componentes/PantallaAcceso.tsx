import { useStore } from '../store/useStore'
import { Aviso, Boton, Grupo } from './ui'

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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-5 py-10">
      <header className="text-center">
        <h1 className="titulo-grande">Cuentas de pareja</h1>
        <p className="mt-2 text-[17px] text-tenue">¿Cuánto tengo que transferir este mes?</p>
      </header>

      {error && <Aviso tono="error">{error}</Aviso>}

      {estado === 'sinSesion' && (
        <div className="flex flex-col gap-4">
          <p className="px-1 text-center text-[15px] text-tenue">
            Los datos se guardan en un archivo de tu propio Google Drive. La aplicación no tiene
            servidor: solo accede al archivo que ella misma crea.
          </p>
          <Boton variante="principal" onClick={() => void entrar()}>
            Entrar con Google
          </Boton>
        </div>
      )}

      {(estado === 'sinArchivo' || cargando) && (
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <h2 className="titulo-pantalla">Hola{usuario ? `, ${usuario.nombre}` : ''}</h2>
            <p className="mt-1 text-[15px] text-tenue">¿Tu pareja ya está usando la aplicación?</p>
          </div>

          <Grupo pie="Google te pedirá que elijas el archivo cuentas-pareja.json una sola vez. Después la aplicación lo recuerda.">
            <div className="p-4">
              <Boton
                variante="principal"
                className="w-full"
                disabled={cargando}
                onClick={() => void conectarArchivo()}
              >
                Sí, abrir nuestras cuentas
              </Boton>
            </div>
          </Grupo>

          <Grupo pie="Se creará el archivo en tu Drive. Luego podrás invitar a tu pareja desde Ajustes.">
            <div className="p-4">
              <Boton className="w-full" disabled={cargando} onClick={() => void crearArchivo()}>
                {cargando ? 'Creando…' : 'No, empezar de cero'}
              </Boton>
            </div>
          </Grupo>
        </div>
      )}
    </main>
  )
}
