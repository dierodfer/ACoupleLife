import { useEffect } from 'react'
import { Ajustes } from './componentes/Ajustes'
import { IconoAjustes, IconoAnio, IconoMes, IconoRecargar } from './componentes/Iconos'
import { IndicadorPersona } from './componentes/IndicadorPersona'
import { ModalEfectivo } from './componentes/ModalEfectivo'
import { ModalGasto } from './componentes/ModalGasto'
import { ModalTransferencia } from './componentes/ModalTransferencia'
import { PantallaAcceso } from './componentes/PantallaAcceso'
import { PantallaMovimientos } from './componentes/PantallaMovimientos'
import { PantallaObjetivos } from './componentes/PantallaObjetivos'
import { ResumenAnual } from './componentes/ResumenAnual'
import { ResumenMensual } from './componentes/ResumenMensual'
import { Aviso, Boton } from './componentes/ui'
import { haceCuanto } from './lib/formato'
import type { Datos } from './lib/tipos'
import type { Usuario } from './services/auth'
import { useStore, type EstadoApp, type Pestana } from './store/useStore'

const PESTANAS: { clave: Pestana; titulo: string; Icono: typeof IconoMes }[] = [
  { clave: 'mes', titulo: 'Mes', Icono: IconoMes },
  { clave: 'anio', titulo: 'Año', Icono: IconoAnio },
  { clave: 'ajustes', titulo: 'Ajustes', Icono: IconoAjustes },
]

/** Subpantallas sin botón propio: marcan activa la pestaña de la que cuelgan. */
const PESTANA_PADRE: Partial<Record<Pestana, Pestana>> = {
  objetivos: 'ajustes',
  movimientos: 'mes',
}

export function App() {
  const estado = useStore((s) => s.estado)
  const datos = useStore((s) => s.datos)
  const arrancar = useStore((s) => s.arrancar)
  const pestana = useStore((s) => s.pestana)
  const setPestana = useStore((s) => s.irAPestana)
  const modalGasto = useStore((s) => s.modalGasto)
  const modalTransferencia = useStore((s) => s.modalTransferencia)
  const modalEfectivo = useStore((s) => s.modalEfectivo)

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
      <IndicadorPersona datos={datos} />

      {pestana === 'mes' && <ResumenMensual datos={datos} />}
      {pestana === 'anio' && <ResumenAnual datos={datos} />}
      {pestana === 'ajustes' && <Ajustes datos={datos} />}
      {pestana === 'objetivos' && <PantallaObjetivos datos={datos} />}
      {pestana === 'movimientos' && <PantallaMovimientos datos={datos} />}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-superficie/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl pb-[env(safe-area-inset-bottom)]">
          {PESTANAS.map(({ clave, titulo, Icono }) => {
            const activa = clave === (PESTANA_PADRE[pestana] ?? pestana)
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
      <ModalTransferencia key={`transferencia|${modalTransferencia}`} datos={datos} />
      <ModalEfectivo key={`efectivo|${modalEfectivo}`} datos={datos} />
    </div>
  )
}

/**
 * Rótulo de la barra de estado. Cuando lo último guardado es de la otra
 * persona se dice quién fue: en un archivo a dos manos, importa.
 */
function textoGuardado(
  estado: EstadoApp,
  sinGuardar: boolean,
  datos: Datos | null,
  usuario: Usuario | null,
): string {
  if (estado === 'guardando') return 'Guardando…'
  if (estado === 'cargando') return 'Cargando…'
  if (sinGuardar) return 'Cambios sin guardar'
  if (!datos?.actualizadoEn) return 'Todo guardado'

  const ajena =
    datos.actualizadoPor && datos.actualizadoPor !== usuario?.email
      ? (datos.personas.find((p) => p.email === datos.actualizadoPor)?.nombre ??
        datos.actualizadoPor)
      : null

  const cuando = haceCuanto(datos.actualizadoEn)
  return ajena ? `Guardado ${cuando} · ${ajena}` : `Guardado ${cuando}`
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

  const ocupado = estado === 'guardando' || estado === 'cargando'

  return (
    <header className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 text-[13px] text-tenue">
        <span className="min-w-0 truncate">{textoGuardado(estado, sinGuardar, datos, usuario)}</span>

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
