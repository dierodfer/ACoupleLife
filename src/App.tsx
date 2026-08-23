import { useEffect } from 'react'
import { Ajustes } from './componentes/Ajustes'
import { IconoAjustes, IconoAnio, IconoMes, IconoRecargar } from './componentes/Iconos'
import { ModalGasto } from './componentes/ModalGasto'
import { PantallaAcceso } from './componentes/PantallaAcceso'
import { PantallaObjetivos } from './componentes/PantallaObjetivos'
import { ResumenAnual } from './componentes/ResumenAnual'
import { ResumenMensual } from './componentes/ResumenMensual'
import { SelectorPersonaActiva } from './componentes/SelectorPersonaActiva'
import { Aviso, Boton } from './componentes/ui'
import { haceCuanto } from './lib/formato'
import { useStore, type Pestana } from './store/useStore'

const PESTANAS: { clave: Pestana; titulo: string; Icono: typeof IconoMes }[] = [
  { clave: 'mes', titulo: 'Mes', Icono: IconoMes },
  { clave: 'anio', titulo: 'Año', Icono: IconoAnio },
  { clave: 'ajustes', titulo: 'Ajustes', Icono: IconoAjustes },
]

export function App() {
  const estado = useStore((s) => s.estado)
  const datos = useStore((s) => s.datos)
  const arrancar = useStore((s) => s.arrancar)
  const pestana = useStore((s) => s.pestana)
  const setPestana = useStore((s) => s.irAPestana)
  const modalGasto = useStore((s) => s.modalGasto)

  useEffect(() => {
    void arrancar()
  }, [arrancar])

  if (estado === 'arrancando') {
    return <p className="p-6 text-center text-[15px] text-tenue">Cargando…</p>
  }

  if (estado === 'sinSesion' || estado === 'sinArchivo' || !datos) {
    return <PantallaAcceso />
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 px-4 pb-28 pt-3">
      <BarraEstado />
      <SelectorPersonaActiva datos={datos} />

      {pestana === 'mes' && <ResumenMensual datos={datos} />}
      {pestana === 'anio' && <ResumenAnual datos={datos} />}
      {pestana === 'ajustes' && <Ajustes datos={datos} />}
      {pestana === 'objetivos' && <PantallaObjetivos datos={datos} />}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-superficie/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl pb-[env(safe-area-inset-bottom)]">
          {PESTANAS.map(({ clave, titulo, Icono }) => {
            // `objetivos` es una subpantalla de ajustes: mantiene esa pestaña marcada.
            const activa = pestana === clave || (clave === 'ajustes' && pestana === 'objetivos')
            return (
              <button
                key={clave}
                type="button"
                aria-current={activa ? 'page' : undefined}
                onClick={() => setPestana(clave)}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 transition ${
                  activa ? 'text-acento' : 'text-tenue active:opacity-60'
                }`}
              >
                <Icono className="h-6 w-6" />
                <span className="text-[10px] font-medium tracking-tight">{titulo}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <ModalGasto
        key={`${modalGasto.abierto}|${modalGasto.editandoId ?? 'nuevo'}`}
        datos={datos}
      />
    </div>
  )
}

/** Estado del guardado en Drive, incluida la resolución de conflictos. */
function BarraEstado() {
  const estado = useStore((s) => s.estado)
  const datos = useStore((s) => s.datos)
  const usuario = useStore((s) => s.usuario)
  const sinGuardar = useStore((s) => s.sinGuardar)
  const error = useStore((s) => s.error)
  const guardar = useStore((s) => s.guardar)
  const recargar = useStore((s) => s.recargar)
  const descartarYRecargar = useStore((s) => s.descartarYRecargar)
  const sobrescribir = useStore((s) => s.sobrescribir)
  const limpiarError = useStore((s) => s.limpiarError)

  if (estado === 'conflicto') {
    return (
      <Aviso tono="error">
        <span>
          El archivo ha cambiado en Drive desde que lo abriste. Si guardas encima, perderás lo
          que haya hecho la otra persona.
        </span>
        <span className="flex flex-wrap gap-2">
          <Boton variante="principal" onClick={() => void descartarYRecargar()}>
            Recargar
          </Boton>
          <Boton onClick={() => void sobrescribir()}>Guardar encima</Boton>
        </span>
      </Aviso>
    )
  }

  // Quién guardó por última vez, si no has sido tú.
  const otraPersona =
    datos?.actualizadoPor && datos.actualizadoPor !== usuario?.email
      ? (datos.personas.find((p) => p.email === datos.actualizadoPor)?.nombre ??
        datos.actualizadoPor)
      : null

  const ocupado = estado === 'guardando' || estado === 'cargando'

  return (
    <header className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 text-[13px] text-tenue">
        <span className="min-w-0 truncate">
          {estado === 'guardando'
            ? 'Guardando…'
            : estado === 'cargando'
              ? 'Cargando…'
              : sinGuardar
                ? 'Cambios sin guardar'
                : datos?.actualizadoEn
                  ? `Guardado ${haceCuanto(datos.actualizadoEn)}${otraPersona ? ` · ${otraPersona}` : ''}`
                  : 'Todo guardado'}
        </span>

        <span className="flex shrink-0 items-center gap-1">
          {sinGuardar && !ocupado && (
            <Boton variante="texto" className="text-[15px]" onClick={() => void guardar()}>
              Guardar
            </Boton>
          )}
          <button
            type="button"
            disabled={ocupado}
            aria-label="Recargar"
            title="Traer los cambios que haya hecho la otra persona"
            onClick={() => void recargar()}
            className="rounded-full p-1 text-acento transition active:opacity-50 disabled:opacity-35"
          >
            <IconoRecargar className="h-5 w-5" />
          </button>
        </span>
      </div>

      {error && (
        <Aviso
          tono="error"
          accion={
            <Boton variante="texto" className="text-[15px]" onClick={limpiarError}>
              Cerrar
            </Boton>
          }
        >
          {error}
        </Aviso>
      )}
    </header>
  )
}
