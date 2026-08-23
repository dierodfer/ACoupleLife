import { useState } from 'react'
import { etiquetaMes, partesMes } from '../lib/fechas'
import { euros } from '../lib/formato'
import { renombrarPersona } from '../lib/mutaciones'
import { nombrePersona } from '../lib/personas'
import type { Datos } from '../lib/tipos'
import { drive } from '../services/backend'
import { ETIQUETAS_PESTANA, useStore } from '../store/useStore'
import { IconoLapiz, IconoMas, IconoRepetir } from './Iconos'
import {
  Aviso,
  Boton,
  CabeceraVolver,
  Campo,
  ControlSegmentado,
  Entrada,
  FilaLista,
  Grupo,
  TituloGrande,
  Vacio,
} from './ui'

/** `2 meses ajustados`, o `undefined` si no hay ninguno (para no pintar el detalle). */
function pluralMeses(cuantos: number, singular: string, plural: string): string | undefined {
  if (cuantos === 0) return undefined
  return `${cuantos} ${cuantos === 1 ? singular : plural}`
}

export function Ajustes({ datos }: Readonly<{ datos: Datos }>) {
  const volver = useStore((s) => s.volver)
  const destino = useStore((s) => s.historial[s.historial.length - 1] ?? 'mes')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <CabeceraVolver destino={ETIQUETAS_PESTANA[destino]} onVolver={volver} />
        <TituloGrande>Ajustes</TituloGrande>
      </div>

      <Personas datos={datos} />
      <AccesoObjetivos datos={datos} />
      <Recurrentes datos={datos} />
      <Compartir datos={datos} />
      <Apariencia />
      <Sesion />
    </div>
  )
}

/**
 * El objetivo tiene pantalla propia: es la configuración más densa de la app
 * (regla anual más excepciones de cada mes) y no cabe como una tarjeta más.
 */
function AccesoObjetivos({ datos }: Readonly<{ datos: Datos }>) {
  const mes = useStore((s) => s.mes)
  const abrirPestana = useStore((s) => s.abrirPestana)
  const { anio } = partesMes(mes)

  return (
    <Grupo titulo="Aportación">
      {datos.personas.map((persona) => {
        const objetivo = datos.anios[String(anio)]?.objetivos[persona.id]
        const excepciones = Object.keys(objetivo?.excepciones ?? {}).length
        return (
          <FilaLista
            key={persona.id}
            titulo={persona.nombre}
            detalle={pluralMeses(excepciones, 'mes con excepción', 'meses con excepción')}
            valor={`${euros(objetivo?.importeMensual ?? 0)} / mes`}
            onClick={() => abrirPestana('objetivos')}
          />
        )
      })}
      <FilaLista
        titulo={<span className="text-acento">Configurar objetivo de {anio}</span>}
        onClick={() => abrirPestana('objetivos')}
      />
    </Grupo>
  )
}

function Personas({ datos }: Readonly<{ datos: Datos }>) {
  const aplicar = useStore((s) => s.aplicar)

  return (
    <Grupo
      titulo="Personas"
      pie="El nombre puede cambiarse sin afectar al histórico. El email no se escribe a mano: se vincula solo la primera vez que esa persona entra con su cuenta de Google."
    >
      {datos.personas.map((persona) => (
        <div key={persona.id} className="flex flex-col gap-3 border-t border-borde p-4 first:border-t-0">
          <Campo etiqueta="Nombre">
            <Entrada
              value={persona.nombre}
              onChange={(e) => aplicar((d) => renombrarPersona(d, persona.id, e.target.value))}
            />
          </Campo>
          <Campo etiqueta="Cuenta de Google">
            <p className="truncate rounded-fila bg-relleno px-3.5 py-2.5 text-[15px] text-tenue">
              {persona.email || 'Sin vincular todavía'}
            </p>
          </Campo>
        </div>
      ))}
    </Grupo>
  )
}

function Recurrentes({ datos }: Readonly<{ datos: Datos }>) {
  const abrirModalGasto = useStore((s) => s.abrirModalGasto)

  return (
    <Grupo
      titulo="Gastos recurrentes"
      pie="Se repiten durante un rango de meses y se calculan a partir de él, sin guardarse mes a mes. Para cambiar el importe de un mes suelto, edítalo desde la pantalla de ese mes."
    >
      {datos.recurrentes.map((r) => {
        const ajustes = Object.keys(r.overrides).length
        const fin = r.hasta ? etiquetaMes(r.hasta) : 'sin fin'
        const ajustados = pluralMeses(ajustes, 'ajustado', 'ajustados')
        const detalle = [`${nombrePersona(datos, r.personaId)} · ${etiquetaMes(r.desde)} – ${fin}`]
        if (ajustados) detalle.push(ajustados)

        return (
          <FilaLista
            key={r.id}
            titulo={
              <span className="flex items-center gap-1.5">
                <IconoRepetir className="h-4 w-4 shrink-0 text-sutil" />
                {r.concepto || 'Recurrente'}
              </span>
            }
            detalle={detalle.join(' · ')}
            accion={
              <span className="flex items-center gap-1">
                <span className="cifras">{euros(r.importe)}</span>
                <button
                  type="button"
                  aria-label={`Editar ${r.concepto || 'recurrente'}`}
                  onClick={() => abrirModalGasto({ editandoId: r.id })}
                  className="rounded-full p-1 text-sutil transition active:text-acento"
                >
                  <IconoLapiz className="h-4 w-4" />
                </button>
              </span>
            }
          />
        )
      })}
      {datos.recurrentes.length === 0 && <Vacio>Sin gastos recurrentes.</Vacio>}

      <FilaLista
        titulo={
          <span className="flex items-center gap-2 text-acento">
            <IconoMas className="h-5 w-5" />
            Añadir recurrente
          </span>
        }
        onClick={() => abrirModalGasto({ tipoInicial: 'recurrente' })}
        sinChevron
      />
    </Grupo>
  )
}

/**
 * Invitar a la otra persona. La app puede dar permisos sobre el archivo que ella
 * misma creó, así que no hace falta pasar por la web de Drive.
 */
function Compartir({ datos }: Readonly<{ datos: Datos }>) {
  const fileId = useStore((s) => s.fileId)
  const usuario = useStore((s) => s.usuario)
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState<'inicial' | 'enviando' | 'hecho' | 'error'>('inicial')
  const [detalle, setDetalle] = useState('')

  // Si ya hay alguien conectado, su email quedó vinculado solo al entrar.
  const otra = datos.personas.find((p) => p.email && p.email !== usuario?.email)

  if (otra) {
    return (
      <Grupo titulo="Compartido con">
        <FilaLista titulo={otra.nombre} detalle={otra.email} />
      </Grupo>
    )
  }

  const invitar = async () => {
    if (!fileId || !email) return
    try {
      setEstado('enviando')
      await drive.compartirCon(fileId, email)
      setEstado('hecho')
    } catch (error) {
      setEstado('error')
      setDetalle(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <Grupo
      titulo="Invitar a tu pareja"
      pie="Le da acceso de edición al archivo. En cuanto entre con esta cuenta, el email queda vinculado a la segunda persona automáticamente."
    >
      <div className="flex flex-col gap-3 p-4">
        <Campo etiqueta="Email de Google">
          <Entrada
            type="email"
            value={email}
            placeholder="pareja@gmail.com"
            onChange={(e) => setEmail(e.target.value)}
          />
        </Campo>

        {estado === 'hecho' && <Aviso>Invitación enviada a {email}.</Aviso>}
        {estado === 'error' && <Aviso tono="error">{detalle}</Aviso>}

        <Boton
          variante="principal"
          disabled={!email || estado === 'enviando'}
          onClick={() => void invitar()}
        >
          {estado === 'enviando' ? 'Enviando…' : 'Invitar'}
        </Boton>
      </div>
    </Grupo>
  )
}

function Apariencia() {
  const tema = useStore((s) => s.tema)
  const setTema = useStore((s) => s.setTema)

  return (
    <Grupo titulo="Apariencia" pie="Se guarda solo en este dispositivo, no en el archivo compartido.">
      <div className="p-4">
        <ControlSegmentado
          valor={tema}
          onCambiar={setTema}
          opciones={[
            { valor: 'claro', etiqueta: 'Claro' },
            { valor: 'oscuro', etiqueta: 'Oscuro' },
          ]}
        />
      </div>
    </Grupo>
  )
}

function Sesion() {
  const salir = useStore((s) => s.salir)
  return (
    <Grupo>
      <FilaLista titulo="Cerrar sesión" destructivo onClick={salir} sinChevron />
    </Grupo>
  )
}
