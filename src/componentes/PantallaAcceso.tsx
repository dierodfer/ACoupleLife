import { useState } from 'react'
import { useStore } from '../store/useStore'
import {
  IconoChevron,
  IconoMovimientos,
  IconoObjetivoMensual,
  IconoRecibo,
  LogoGoogleDrive,
} from './Iconos'
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
    Icono: IconoObjetivoMensual,
    tono: 'positivo' as const,
    titulo: 'Objetivo mensual',
    detalle: 'Cada uno tiene su cantidad.',
  },
  {
    Icono: IconoRecibo,
    tono: 'acento' as const,
    titulo: 'Gastos',
    detalle: 'Anotad los gastos del día a día.',
  },
  {
    Icono: IconoMovimientos,
    tono: 'serie-transferido' as const,
    titulo: 'Movimientos',
    detalle: 'Registrad transferencias y ajustes.',
  },
]

const TONO_ICONO = {
  positivo: 'bg-positivo/15 text-positivo',
  acento: 'bg-acento/15 text-acento',
  'serie-transferido': 'bg-serie-transferido/15 text-serie-transferido',
}

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
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col overflow-hidden px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
      <div aria-hidden className="pointer-events-none absolute -left-20 -top-16 h-72 w-72 rounded-full bg-acento/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 -right-16 h-72 w-72 rounded-full bg-serie-gastos/15 blur-3xl" />

      <div className="relative flex flex-1 flex-col justify-center gap-9">
        <header className="flex flex-col gap-3">
          <NotaManuscrita />
          <h1 className="titulo-grande">Cuentas compartidas</h1>
          <p className="text-[17px] text-tenue">
            Un objetivo al mes.
            <br />
            Todos los gastos bajo control.
          </p>
        </header>

        <div className="flex flex-col gap-5">
          {VENTAJAS.map(({ Icono, tono, titulo, detalle }) => (
            <div key={titulo} className="flex items-center gap-4">
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${TONO_ICONO[tono]}`}
              >
                <Icono className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[17px] font-semibold">{titulo}</p>
                <p className="mt-0.5 text-[15px] text-tenue">{detalle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative flex flex-col gap-3 pt-8">
        {error && <Aviso tono="error">{error}</Aviso>}

        <button
          type="button"
          disabled={conectando}
          onClick={() => void conectar()}
          className="flex min-h-[56px] w-full items-center gap-3 rounded-fila bg-acento px-5 text-[17px] font-semibold text-white shadow-lg shadow-acento/25 transition active:opacity-80 disabled:pointer-events-none disabled:opacity-50"
        >
          <LogoGoogleDrive className="h-5 w-5" />
          <span className="flex-1 text-left">
            {conectando ? 'Conectando…' : 'Conectar con Google Drive'}
          </span>
          <IconoChevron className="h-5 w-5 shrink-0" />
        </button>

        <p className="encabezado-grupo px-2 text-center text-tenue">
          Podrás retirar el acceso cuando quieras.
        </p>
      </div>
    </main>
  )
}

/** La coletilla manuscrita de la cabecera, ladeada como una anotación a mano. */
function NotaManuscrita() {
  return (
    <p
      className="self-end text-[15px] italic leading-tight text-tenue"
      style={{ transform: 'rotate(-4deg)' }}
    >
      Más fácil
      <br />
      juntos
    </p>
  )
}

/* ----------------------------------------------------------- Sin archivo */

/**
 * Ya hay sesión pero todavía no hay archivo: hay que decidir si se crea uno
 * nuevo o se abre el que ya tiene la otra persona.
 */
function PantallaOnboarding() {
  const usuario = useStore((s) => s.usuario)
  const error = useStore((s) => s.error)
  const crearArchivo = useStore((s) => s.crearArchivo)
  const conectarArchivo = useStore((s) => s.conectarArchivo)

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
            <Boton variante="principal" className="w-full" onClick={() => void conectarArchivo()}>
              Sí, abrir nuestras cuentas
            </Boton>
          </div>
        </Grupo>

        <Grupo pie="Se creará el archivo en tu Drive. Luego podrás invitar a tu pareja desde Ajustes.">
          <div className="p-4">
            <Boton className="w-full" onClick={() => void crearArchivo()}>
              No, empezar de cero
            </Boton>
          </div>
        </Grupo>
      </div>
    </main>
  )
}
