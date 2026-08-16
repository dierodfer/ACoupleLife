import { useEffect, useState } from 'react'
import { Ajustes } from './componentes/Ajustes'
import { PantallaAcceso } from './componentes/PantallaAcceso'
import { ResumenAnual } from './componentes/ResumenAnual'
import { ResumenMensual } from './componentes/ResumenMensual'
import { Aviso, Boton } from './componentes/ui'
import { useStore } from './store/useStore'

type Pestana = 'mes' | 'anio' | 'ajustes'

export function App() {
  const estado = useStore((s) => s.estado)
  const datos = useStore((s) => s.datos)
  const arrancar = useStore((s) => s.arrancar)
  const [pestana, setPestana] = useState<Pestana>('mes')

  useEffect(() => {
    void arrancar()
  }, [arrancar])

  if (estado === 'arrancando') {
    return <p className="p-6 text-center text-sm text-tenue">Cargando…</p>
  }

  if (estado === 'sinSesion' || estado === 'sinArchivo' || !datos) {
    return <PantallaAcceso />
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-4 pb-24">
      <BarraEstado />

      {pestana === 'mes' && <ResumenMensual datos={datos} />}
      {pestana === 'anio' && <ResumenAnual datos={datos} />}
      {pestana === 'ajustes' && <Ajustes datos={datos} />}

      <nav className="fixed inset-x-0 bottom-0 border-t border-borde bg-superficie">
        <div className="mx-auto flex max-w-2xl">
          {(
            [
              ['mes', 'Mes'],
              ['anio', 'Año'],
              ['ajustes', 'Ajustes'],
            ] as const
          ).map(([clave, titulo]) => (
            <button
              key={clave}
              type="button"
              onClick={() => setPestana(clave)}
              className={`flex-1 py-3 text-sm ${
                pestana === clave ? 'font-semibold text-acento' : 'text-tenue'
              }`}
            >
              {titulo}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

/** Estado del guardado en Drive, incluida la resolución de conflictos. */
function BarraEstado() {
  const estado = useStore((s) => s.estado)
  const sinGuardar = useStore((s) => s.sinGuardar)
  const error = useStore((s) => s.error)
  const guardar = useStore((s) => s.guardar)
  const descartarYRecargar = useStore((s) => s.descartarYRecargar)
  const sobrescribir = useStore((s) => s.sobrescribir)
  const limpiarError = useStore((s) => s.limpiarError)
  const salir = useStore((s) => s.salir)

  if (estado === 'conflicto') {
    return (
      <Aviso tono="error">
        <span>
          El archivo ha cambiado en Drive desde que lo abriste. Si guardas encima, perderás lo
          que haya hecho la otra persona.
        </span>
        <span className="flex gap-2">
          <Boton variante="principal" onClick={() => void descartarYRecargar()}>
            Recargar y perder mis cambios
          </Boton>
          <Boton onClick={() => void sobrescribir()}>Guardar encima</Boton>
        </span>
      </Aviso>
    )
  }

  return (
    <header className="flex items-center justify-between gap-2 text-xs text-tenue">
      <span>
        {estado === 'guardando'
          ? 'Guardando en Drive…'
          : sinGuardar
            ? 'Cambios sin guardar'
            : 'Todo guardado'}
      </span>
      <span className="flex items-center gap-2">
        {sinGuardar && estado !== 'guardando' && (
          <Boton variante="texto" onClick={() => void guardar()}>
            Guardar ahora
          </Boton>
        )}
        {error && (
          <Boton variante="texto" onClick={limpiarError} title={error}>
            ⚠ Ver error
          </Boton>
        )}
        <Boton variante="texto" onClick={salir}>
          Salir
        </Boton>
      </span>
    </header>
  )
}
