import { useState } from 'react'
import {
  baseDelMes,
  listaEfectivoDelMes,
  listaGastosDelMes,
  listaRecurrentesDelMes,
  listaTransferenciasDelMes,
  resumenMes,
} from '../lib/calculo'
import { etiquetaMes } from '../lib/fechas'
import { euros, fechaCorta } from '../lib/formato'
import { nombrePersona } from '../lib/personas'
import type { Datos, MesKey, PersonaId, ResumenPersona } from '../lib/tipos'
import { useStore } from '../store/useStore'
import { Donut, PuntoSerie } from './Donut'
import { IconoCheck, IconoChevron, IconoRepetir } from './Iconos'
import { SelectorMes } from './SelectorMes'
import { Fila, FilaLista, Grupo, Tarjeta } from './ui'

/**
 * Pantalla principal. Responde a la única pregunta que importa: cuánto tiene que
 * transferir cada uno este mes.
 */
export function ResumenMensual({ datos }: Readonly<{ datos: Datos }>) {
  const mes = useStore((s) => s.mes)
  const resumen = resumenMes(datos, mes)

  return (
    <div className="flex flex-col gap-6">
      <SelectorMes datos={datos} />

      <Tarjeta>
        <p className="text-center text-[13px] font-medium uppercase tracking-[0.06em] text-tenue">
          Por transferir
        </p>

        <div className="mt-2 flex">
          {resumen.porPersona.map((persona, i) => (
            <div
              key={persona.personaId}
              className={`min-w-0 flex-1 px-2 text-center ${i > 0 ? 'border-l border-borde' : ''}`}
            >
              <p className="truncate text-[13px] text-tenue">
                {nombrePersona(datos, persona.personaId)}
              </p>
              <PendientePersona persona={persona} />
            </div>
          ))}
        </div>

        {resumen.pendiente < 0 && (
          <p className="mt-3 text-center text-[13px] text-tenue">
            Este mes habéis aportado de más. No se arrastra al siguiente.
          </p>
        )}

        <div className="mt-3 border-t border-borde pt-2 text-left">
          <Fila concepto="Objetivo conjunto" importe={euros(resumen.objetivo)} />
        </div>
      </Tarjeta>

      {resumen.porPersona.map((persona) => (
        <DesglosePersona key={persona.personaId} datos={datos} persona={persona} />
      ))}
    </div>
  )
}

/**
 * La cifra por la que se abre la app: no el total de la pareja, sino lo que
 * le toca a esta persona. Mismo criterio que el centro del anillo de abajo
 * (`CentroDonut`), para que las dos lecturas del mes digan lo mismo.
 */
function PendientePersona({ persona }: Readonly<{ persona: ResumenPersona }>) {
  if (persona.objetivo <= 0) {
    return <p className="mt-1 text-[15px] text-tenue">Sin objetivo</p>
  }

  if (persona.pendiente <= 0) {
    return (
      <p className="mt-1 flex items-center justify-center gap-1 text-positivo">
        <IconoCheck className="h-5 w-5 shrink-0" />
        <span className="text-[15px] font-medium">Al día</span>
      </p>
    )
  }

  const texto = euros(persona.pendiente)
  // A dos columnas por tarjeta hay poco ancho: una cifra de miles con céntimos
  // no cabe al mismo tamaño que una de dos dígitos sin desbordar o cortarse.
  const tamano = tamanoCifra(texto.length)

  return <p className={`cifras mt-1 truncate font-bold leading-none ${tamano}`}>{texto}</p>
}

function tamanoCifra(longitud: number): string {
  if (longitud > 10) return 'text-[18px]'
  if (longitud > 8) return 'text-[22px]'
  return 'text-[26px]'
}

/**
 * Cómo se reparte el anillo. El orden es el mismo que el de la leyenda y el del
 * desglose de la pareja de arriba, para que los tres se lean igual. Las clases
 * van escritas enteras porque Tailwind las busca literalmente en el código: una
 * compuesta al vuelo (`stroke-${...}`) no llegaría a generarse.
 */
const TRAMOS = [
  { clave: 'gastos', etiqueta: 'Gastos', trazo: 'stroke-serie-gastos', punto: 'bg-serie-gastos' },
  {
    clave: 'efectivo',
    etiqueta: 'Efectivo',
    trazo: 'stroke-serie-efectivo',
    punto: 'bg-serie-efectivo',
  },
  {
    clave: 'transferencias',
    etiqueta: 'Transferido',
    trazo: 'stroke-serie-transferido',
    punto: 'bg-serie-transferido',
  },
] as const

type ClaveTramo = (typeof TRAMOS)[number]['clave']

interface DetalleTramo {
  id: string
  texto: string
  importe: number
  repetido?: boolean
}

function detallesGastos(datos: Datos, mes: MesKey, personaId: PersonaId): DetalleTramo[] {
  const recurrentes = listaRecurrentesDelMes(datos, mes)
    .filter(({ recurrente, importe }) => recurrente.personaId === personaId && importe > 0)
    .map(({ recurrente, importe }) => ({
      id: recurrente.id,
      texto: recurrente.concepto || 'Recurrente',
      importe,
      repetido: true,
    }))

  const puntuales = listaGastosDelMes(datos, mes)
    .filter((g) => g.personaId === personaId)
    .map((g) => ({ id: g.id, texto: g.concepto || 'Gasto', importe: g.importe }))

  return [...recurrentes, ...puntuales]
}

function detallesEfectivo(datos: Datos, mes: MesKey, personaId: PersonaId): DetalleTramo[] {
  return listaEfectivoDelMes(datos, mes)
    .filter((e) => e.personaId === personaId)
    .map((e) => ({
      id: e.id,
      texto: `${etiquetaMes(e.desde)} – ${e.hasta ? etiquetaMes(e.hasta) : 'sin fin'}`,
      importe: e.importe,
    }))
}

function detallesTransferencias(datos: Datos, mes: MesKey, personaId: PersonaId): DetalleTramo[] {
  return listaTransferenciasDelMes(datos, mes)
    .filter((t) => t.personaId === personaId)
    .map((t) => ({ id: t.id, texto: fechaCorta(t.fecha), importe: t.importe }))
}

function detallesDelTramo(
  datos: Datos,
  mes: MesKey,
  personaId: PersonaId,
  clave: ClaveTramo,
): DetalleTramo[] {
  if (clave === 'gastos') return detallesGastos(datos, mes, personaId)
  if (clave === 'efectivo') return detallesEfectivo(datos, mes, personaId)
  return detallesTransferencias(datos, mes, personaId)
}

function EtiquetaTramo({
  punto,
  etiqueta,
  resumen,
  abierto,
}: Readonly<{
  punto: string
  etiqueta: string
  resumen?: string
  abierto?: boolean
}>) {
  return (
    <span className="flex min-w-0 items-center gap-2 truncate text-[15px]">
      <PuntoSerie clase={punto} />
      {abierto !== undefined && (
        <IconoChevron
          className={`h-3.5 w-3.5 shrink-0 text-sutil transition-transform ${
            abierto ? 'rotate-90' : ''
          }`}
        />
      )}
      {etiqueta}
      {resumen && <span className="truncate text-[13px] text-tenue">{resumen}</span>}
    </span>
  )
}

function FilaTramo({
  punto,
  etiqueta,
  total,
  resumen,
  detalles,
}: Readonly<{
  punto: string
  etiqueta: string
  total: number
  resumen?: string
  detalles: DetalleTramo[]
}>) {
  const [abierto, setAbierto] = useState(false)

  if (detalles.length <= 1) {
    return (
      <Fila
        concepto={<EtiquetaTramo punto={punto} etiqueta={etiqueta} resumen={resumen} />}
        importe={euros(total)}
      />
    )
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 py-1.5 text-left active:opacity-60"
      >
        <EtiquetaTramo punto={punto} etiqueta={etiqueta} resumen={resumen} abierto={abierto} />
        <span className="cifras shrink-0 text-[15px]">{euros(total)}</span>
      </button>

      {abierto && (
        <div className="flex flex-col gap-1 py-1 pl-[1.125rem]">
          {detalles.map((d) => (
            <div key={d.id} className="flex items-center gap-2 text-[13px] text-tenue">
              {d.repetido && <IconoRepetir className="h-3 w-3 shrink-0" />}
              <span className="min-w-0 flex-1 truncate">{d.texto}</span>
              <span className="cifras shrink-0">{euros(d.importe)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function resumenGastos(persona: ResumenPersona): string | undefined {
  if (persona.gastosPuntuales <= 0 || persona.gastosRecurrentes <= 0) return undefined
  return `${euros(persona.gastosPuntuales)} + ${euros(persona.gastosRecurrentes)} fijos`
}

/**
 * El mes de una persona en un anillo: cuánto de su objetivo cubre ya cada tipo
 * de aportación y cuánto queda por transferir, que es el hueco sin pintar.
 */
function DesglosePersona({
  datos,
  persona,
}: Readonly<{ datos: Datos; persona: ResumenPersona }>) {
  const mes = useStore((s) => s.mes)
  const abrirPestana = useStore((s) => s.abrirPestana)
  const editarMovimientos = useStore((s) => s.editarMovimientos)
  const base = baseDelMes(persona)

  const tramos = TRAMOS.map((t) => ({ clave: t.clave, valor: persona[t.clave], clase: t.trazo }))
  // La leyenda solo lista lo que ya existe este mes: un tipo de aportación sin
  // nada que mostrar no aporta información, y así va apareciendo según se dan
  // de alta gastos, efectivo o transferencias.
  const conMovimiento = TRAMOS.filter((t) => persona[t.clave] > 0)

  return (
    <Grupo titulo={nombrePersona(datos, persona.personaId)}>
      <div className="flex flex-col items-center gap-4 px-4 pb-1 pt-4">
        <Donut tramos={tramos} base={base} etiqueta={etiquetaDonut(datos, persona)}>
          <CentroDonut
            base={base}
            objetivo={persona.objetivo}
            pendiente={persona.pendiente}
          />
        </Donut>

        <div className="w-full">
          {conMovimiento.length === 0 && (
            <p className="py-1.5 text-center text-[13px] text-tenue">Sin movimientos este mes.</p>
          )}
          {conMovimiento.map((t) => (
            <FilaTramo
              key={t.clave}
              punto={t.punto}
              etiqueta={t.etiqueta}
              total={persona[t.clave]}
              resumen={t.clave === 'gastos' ? resumenGastos(persona) : undefined}
              detalles={detallesDelTramo(datos, mes, persona.personaId, t.clave)}
            />
          ))}
        </div>
      </div>

      <FilaLista
        titulo="Objetivo"
        valor={euros(persona.objetivo)}
        onClick={() => abrirPestana('objetivos')}
      />

      <FilaLista
        titulo="Movimientos"
        detalle="Gastos, efectivo y transferencias"
        onClick={() => editarMovimientos(persona.personaId)}
      />
    </Grupo>
  )
}

/** El dato que resume el anillo, en su hueco central. */
function CentroDonut({
  base,
  objetivo,
  pendiente,
}: Readonly<{ base: number; objetivo: number; pendiente: number }>) {
  if (base === 0) return <span className="text-[15px] text-tenue">Sin objetivo</span>

  if (pendiente <= 0) {
    return (
      <>
        <IconoCheck className="h-6 w-6 text-positivo" />
        <span className="text-[15px] font-medium leading-none text-positivo">Al día</span>
        <span className="cifras text-[12px] leading-tight text-tenue">{euros(objetivo)}</span>
      </>
    )
  }

  return (
    <>
      <span className="cifras text-[19px] font-semibold leading-none">{euros(pendiente)}</span>
      <span className="text-[12px] leading-tight text-tenue">por transferir</span>
      <span className="cifras text-[11px] leading-tight text-sutil">de {euros(objetivo)}</span>
    </>
  )
}

/** El mismo contenido del anillo, en una frase, para lectores de pantalla. */
function etiquetaDonut(datos: Datos, persona: ResumenPersona): string {
  const partes = TRAMOS.map((t) => `${t.etiqueta} ${euros(persona[t.clave])}`).join(', ')
  const objetivo = `objetivo ${euros(persona.objetivo)}`
  return `${nombrePersona(datos, persona.personaId)}: ${partes}, de un ${objetivo}.`
}
