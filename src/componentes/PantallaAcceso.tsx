import { useState } from 'react'
import { useStore } from '../store/useStore'
import { IconoCandado, IconoNube, IconoPersonas, LogoGoogleDrive } from './Iconos'
import { Aviso, Boton, Grupo } from './ui'

/**
 * Login y onboarding. El onboarding tiene dos caminos porque el scope
 * `drive.file` solo da acceso a lo que crea la propia app: el primer usuario
 * crea el archivo y el segundo tiene que señalarlo una vez con el selector de
 * Google, aunque ya se lo hayan compartido.
 */
export function PantallaAcceso() {
  const estado = useStore((s) => s.estado)

  return estado === 'sinSesion' ? <PantallaConectar /> : <PantallaOnboarding />
}

/* ------------------------------------------------------------ Sin sesión */

const VENTAJAS = [
  {
    Icono: IconoNube,
    titulo: 'Tus datos, en tu Drive',
    detalle: 'Todo vive en un único archivo JSON de vuestro Google Drive. No hay servidor ni base de datos.',
  },
  {
    Icono: IconoCandado,
    titulo: 'Acceso mínimo',
    detalle: 'La aplicación solo puede abrir el archivo que ella misma crea; el resto de tu Drive queda fuera.',
  },
  {
    Icono: IconoPersonas,
    titulo: 'A dos manos',
    detalle: 'Compartís el mismo archivo y cada uno ve al momento lo que ha apuntado la otra persona.',
  },
]

/**
 * Primera pantalla de todas: presenta la aplicación y conecta con Drive. Es la
 * única puerta de entrada, así que explica antes de pedir el permiso, no
 * después: quien llega aquí todavía no sabe qué va a autorizar.
 */
function PantallaConectar() {
  const error = useStore((s) => s.error)
  const entrar = useStore((s) => s.entrar)
  // Google abre su ventana de permisos y puede tardar: mientras tanto el botón
  // se bloquea para no lanzar dos peticiones de token seguidas.
  const [conectando, setConectando] = useState(false)

  async function conectar() {
    setConectando(true)
    try {
      await entrar()
    } finally {
      setConectando(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="flex flex-1 flex-col justify-center gap-8">
        <header className="flex flex-col items-center text-center">
          <MarcaApp />
          <h1 className="titulo-grande mt-5">Cuentas de pareja</h1>
          <p className="mt-2 text-[17px] text-tenue">¿Cuánto tengo que transferir este mes?</p>
        </header>

        <Grupo>
          {VENTAJAS.map(({ Icono, titulo, detalle }) => (
            <div
              key={titulo}
              className="relative flex items-start gap-3 px-4 py-3 after:absolute after:left-4 after:right-0 after:top-0 after:h-px after:bg-borde first:after:hidden"
            >
              <Icono className="mt-0.5 h-5 w-5 shrink-0 text-acento" />
              <div className="min-w-0">
                <p className="text-[15px] font-medium">{titulo}</p>
                <p className="mt-0.5 text-[13px] text-tenue">{detalle}</p>
              </div>
            </div>
          ))}
        </Grupo>
      </div>

      <div className="flex flex-col gap-3">
        {error && <Aviso tono="error">{error}</Aviso>}

        <button
          type="button"
          disabled={conectando}
          onClick={() => void conectar()}
          className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-fila border border-borde bg-superficie px-4 text-[17px] font-medium text-tinta shadow-sm transition active:opacity-70 disabled:pointer-events-none disabled:opacity-50"
        >
          <LogoGoogleDrive className="h-5 w-5" />
          {conectando ? 'Conectando…' : 'Conectar con Google Drive'}
        </button>

        <p className="encabezado-grupo px-2 text-center text-tenue">
          Se abrirá una ventana de Google para que autorices el acceso. Puedes retirarlo cuando
          quieras desde tu cuenta.
        </p>
      </div>
    </main>
  )
}

/** Icono de la aplicación: dos anillos entrelazados, la pareja. */
function MarcaApp() {
  return (
    <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[22px] bg-acento shadow-lg shadow-acento/25">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth={1.75}
        aria-hidden
        className="h-9 w-9"
      >
        <circle cx="9" cy="12" r="5.25" />
        <circle cx="15" cy="12" r="5.25" />
      </svg>
    </div>
  )
}

/* ----------------------------------------------------------- Sin archivo */

/**
 * Ya hay sesión pero todavía no hay archivo: hay que decidir si se crea uno
 * nuevo o se abre el que ya tiene la otra persona.
 */
function PantallaOnboarding() {
  const estado = useStore((s) => s.estado)
  const usuario = useStore((s) => s.usuario)
  const error = useStore((s) => s.error)
  const crearArchivo = useStore((s) => s.crearArchivo)
  const conectarArchivo = useStore((s) => s.conectarArchivo)

  const cargando = estado === 'cargando'

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-5 py-10">
      <div className="text-center">
        <h1 className="titulo-grande">Hola{usuario ? `, ${usuario.nombre}` : ''}</h1>
        <p className="mt-2 text-[17px] text-tenue">¿Tu pareja ya está usando la aplicación?</p>
      </div>

      {error && <Aviso tono="error">{error}</Aviso>}

      <div className="flex flex-col gap-6">
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
    </main>
  )
}
