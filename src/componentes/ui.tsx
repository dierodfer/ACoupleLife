import { useLayoutEffect, useRef, useState } from 'react'
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'
import { combinaPartes, formateaPartes, partesImporte } from '../lib/formato'
import { IconoAtras, IconoCerrar, IconoChevron, IconoInfo } from './Iconos'

/**
 * Primitivas de interfaz al estilo de iOS: listas agrupadas insertadas,
 * separadores finos sangrados, control segmentado y hoja inferior. Tailwind
 * puro sobre los tokens de `index.css`, sin dependencias extra.
 */

function clases(...partes: (string | false | undefined)[]): string {
  return partes.filter(Boolean).join(' ')
}

/* ---------------------------------------------------------------- Botones */

type VarianteBoton = 'principal' | 'suave' | 'texto' | 'peligro'

const VARIANTES: Record<VarianteBoton, string> = {
  principal: 'bg-acento text-white active:opacity-80',
  suave: 'bg-relleno text-acento active:opacity-70',
  texto: 'text-acento active:opacity-50',
  peligro: 'text-negativo active:opacity-50',
}

export function Boton({
  variante = 'suave',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBoton }) {
  const soloTexto = variante === 'texto' || variante === 'peligro'
  return (
    <button
      {...props}
      className={clases(
        'inline-flex items-center justify-center gap-1.5 rounded-fila text-[17px] font-medium transition',
        soloTexto ? 'px-1 py-1' : 'px-4 py-2.5',
        'disabled:pointer-events-none disabled:opacity-35',
        VARIANTES[variante],
        className,
      )}
    />
  )
}

/* ------------------------------------------------------ Títulos y cabecera */

/** Título grande de iOS, el que encabeza una pantalla al empezar a leerla. */
export function TituloGrande({ children, accion }: Readonly<{ children: ReactNode; accion?: ReactNode }>) {
  return (
    <div className="flex items-end justify-between gap-3 px-1">
      <h1 className="titulo-grande">{children}</h1>
      {accion}
    </div>
  )
}

/**
 * Botón de volver con chevron, como la barra de navegación de iOS. Dice a
 * dónde vuelve, no un «atrás» a secas: a Objetivo se llega desde dos sitios.
 */
export function CabeceraVolver({ destino, onVolver }: Readonly<{ destino: string; onVolver: () => void }>) {
  return (
    <button
      type="button"
      onClick={onVolver}
      className="-ml-1 inline-flex items-center gap-0.5 self-start text-[17px] text-acento active:opacity-50"
    >
      <IconoAtras className="h-5 w-5" />
      {destino}
    </button>
  )
}

/* ------------------------------------------------- Listas agrupadas (iOS) */

/**
 * Sección de lista agrupada: encabezado en versalitas, tarjeta con las filas
 * y un pie opcional para la explicación. Es el patrón de Ajustes de iOS.
 */
export function Grupo({
  titulo,
  pie,
  className,
  children,
}: Readonly<{
  titulo?: ReactNode
  pie?: ReactNode
  className?: string
  children: ReactNode
}>) {
  return (
    <section className={className}>
      {titulo && (
        <h2 className="encabezado-grupo mb-1.5 px-4 font-medium uppercase tracking-[0.06em] text-tenue">
          {titulo}
        </h2>
      )}
      <div className="overflow-hidden rounded-tarjeta bg-superficie">{children}</div>
      {pie && <p className="encabezado-grupo mt-1.5 px-4 text-tenue">{pie}</p>}
    </section>
  )
}

// Separador sangrado por la izquierda y a sangre por la derecha, como iOS.
// El pseudo-elemento evita tener que saber si la fila es la primera.
const FILA_BASE =
  'relative flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left ' +
  'after:absolute after:left-4 after:right-0 after:top-0 after:h-px after:bg-borde first:after:hidden'

/**
 * Fila de lista agrupada. Con `onClick` se comporta como celda navegable
 * (chevron y realce al pulsar); sin él es una fila de solo lectura.
 */
export function FilaLista({
  titulo,
  detalle,
  valor,
  accion,
  onClick,
  destructivo,
  sinChevron,
}: Readonly<{
  titulo: ReactNode
  detalle?: ReactNode
  valor?: ReactNode
  accion?: ReactNode
  onClick?: () => void
  destructivo?: boolean
  /** Para filas pulsables que no navegan a otra pantalla (p. ej. «Añadir…»). */
  sinChevron?: boolean
}>) {
  const contenido = (
    <>
      <span className="min-w-0 flex-1">
        <span className={clases('block truncate', destructivo && 'text-negativo')}>{titulo}</span>
        {detalle && <span className="mt-0.5 block truncate text-[13px] text-tenue">{detalle}</span>}
      </span>
      {valor && <span className="cifras shrink-0 text-tenue">{valor}</span>}
      {accion}
      {onClick && !sinChevron && <IconoChevron className="h-4 w-4 shrink-0 text-sutil" />}
    </>
  )

  if (!onClick) return <div className={FILA_BASE}>{contenido}</div>

  return (
    <button type="button" onClick={onClick} className={clases(FILA_BASE, 'active:bg-relleno')}>
      {contenido}
    </button>
  )
}

/** Fila de «concepto … importe», el patrón que se repite en los resúmenes. */
export function Fila({
  concepto,
  importe,
  tono = 'normal',
  accion,
}: Readonly<{
  concepto: ReactNode
  importe: ReactNode
  tono?: 'normal' | 'tenue' | 'fuerte'
  accion?: ReactNode
}>) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span
        className={clases(
          'min-w-0 truncate text-[15px]',
          tono === 'tenue' && 'text-tenue',
          tono === 'fuerte' && 'font-semibold',
        )}
      >
        {concepto}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <span
          className={clases(
            'cifras text-[15px]',
            tono === 'tenue' && 'text-tenue',
            tono === 'fuerte' && 'font-semibold',
          )}
        >
          {importe}
        </span>
        {accion}
      </span>
    </div>
  )
}

/* --------------------------------------------------------------- Tarjetas */

export function Tarjeta({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <section className={clases('rounded-tarjeta bg-superficie p-4', className)}>{children}</section>
  )
}

/* --------------------------------------------------------------- Controles */

/** Control segmentado de iOS: pista gris con la opción activa en relieve. */
export function ControlSegmentado<T extends string>({
  opciones,
  valor,
  onCambiar,
  className,
}: Readonly<{
  opciones: { valor: T; etiqueta: string }[]
  valor: T
  onCambiar: (valor: T) => void
  className?: string
}>) {
  return (
    <div className={clases('flex gap-0.5 rounded-fila bg-relleno p-0.5', className)}>
      {opciones.map((o) => {
        const activa = o.valor === valor
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={activa}
            onClick={() => onCambiar(o.valor)}
            className={clases(
              'flex-1 rounded-[0.6rem] px-3 py-1.5 text-[14px] font-medium transition',
              activa ? 'bg-superficie text-tinta shadow-sm' : 'text-tenue active:opacity-60',
            )}
          >
            {o.etiqueta}
          </button>
        )
      })}
    </div>
  )
}

const ESTILO_ENTRADA =
  'w-full rounded-fila border border-borde bg-superficie px-3.5 py-2.5 text-[17px] text-tinta outline-none transition focus:border-acento disabled:opacity-50'

/**
 * Sin `name` ni `autocomplete`, Chrome no sabe clasificar el campo y muestra su
 * barra de autocompletado (llave/tarjeta/ubicación) encima del teclado por si
 * acaso, en cualquier input de texto ambiguo. `off` es el valor por defecto,
 * pero cada campo puede pedir el suyo (p. ej. `autoComplete="email"`) porque va
 * antes del `...props`: lo explícito gana.
 */
export function Entrada({
  className,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      autoComplete="off"
      {...props}
      aria-invalid={error || undefined}
      className={clases(
        ESTILO_ENTRADA,
        'cifras',
        error && 'border-negativo focus:border-negativo',
        className,
      )}
    />
  )
}

const MAX_DIGITOS_ENTERO = 7 // hasta 9.999.999 €

interface EstadoImporte {
  entero: string
  decimales: string
  enDecimales: boolean
}

/** ¿Está seleccionado el campo entero? Escribir entonces empieza de cero. */
function seleccionCompleta(input: HTMLInputElement): boolean {
  return input.selectionStart === 0 && input.selectionEnd === input.value.length
}

function conDigito(actual: EstadoImporte, digito: string, nueva: boolean): EstadoImporte {
  if (nueva) return { entero: digito, decimales: '', enDecimales: false }
  if (actual.enDecimales) {
    return actual.decimales.length >= 2 ? actual : { ...actual, decimales: actual.decimales + digito }
  }
  return actual.entero.length >= MAX_DIGITOS_ENTERO ? actual : { ...actual, entero: actual.entero + digito }
}

function conBorrado(actual: EstadoImporte, nueva: boolean): EstadoImporte {
  if (nueva) return { entero: '', decimales: '', enDecimales: false }
  if (actual.enDecimales) {
    return actual.decimales === ''
      ? { ...actual, enDecimales: false }
      : { ...actual, decimales: actual.decimales.slice(0, -1) }
  }
  return { ...actual, entero: actual.entero.slice(0, -1) }
}

/** Próximo estado del campo tras una tecla, o `null` si no le corresponde ninguna. */
function siguienteEstado(actual: EstadoImporte, tecla: string, nueva: boolean): EstadoImporte | null {
  if (tecla === ',' || tecla === '.') {
    return { entero: nueva ? '' : actual.entero, decimales: '', enDecimales: true }
  }
  if (/^\d$/.test(tecla)) return conDigito(actual, tecla, nueva)
  if (tecla === 'Backspace' || tecla === 'Delete') return conBorrado(actual, nueva)
  return null
}

/**
 * Campo de importe: la parte entera se escribe normal, de izquierda a
 * derecha (`2`, `7`, `9` → `279,00 €`, no `2,79 €`), y el € y los dos
 * decimales se ven desde el primer momento, antes de tocar el campo. Para
 * corregir los céntimos se pulsa la coma, que entra en un modo aparte: a
 * partir de ahí las cifras van a los decimales, hasta un máximo de dos. Cada
 * tecla se intercepta, así que la posición del cursor no decide nada por sí
 * sola; solo se mueve para que se lea con naturalidad.
 */
export function EntradaEuros({
  valor,
  onCambiar,
  error,
  className,
  ...props
}: Readonly<
  Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onKeyDown' | 'onPaste' | 'type'> & {
    valor: string
    onCambiar: (valor: string) => void
    error?: boolean
  }
>) {
  const ref = useRef<HTMLInputElement>(null)
  const [entero, decimales, enDecimales] = partesImporte(valor)
  const formateado = formateaPartes(entero, decimales)

  // El cursor se queda en las unidades mientras se escribe el entero, y salta
  // a los céntimos en cuanto se entra en modo decimal.
  useLayoutEffect(() => {
    const input = ref.current
    if (input && document.activeElement === input) {
      const posicion = enDecimales ? formateado.length : formateado.indexOf(',')
      input.setSelectionRange(posicion, posicion)
    }
  })

  return (
    <input
      autoComplete="off"
      {...props}
      ref={ref}
      type="text"
      inputMode="decimal"
      value={`${formateado} €`}
      aria-invalid={error || undefined}
      onKeyDown={(e) => {
        const siguiente = siguienteEstado(
          { entero, decimales, enDecimales },
          e.key,
          seleccionCompleta(e.currentTarget),
        )
        if (!siguiente) return
        e.preventDefault()
        onCambiar(combinaPartes(siguiente.entero, siguiente.decimales, siguiente.enDecimales))
      }}
      onPaste={(e) => {
        e.preventDefault()
        const [pE, pD, pC] = partesImporte(e.clipboardData.getData('text'))
        if (pE || pD) onCambiar(combinaPartes(pE.slice(-MAX_DIGITOS_ENTERO), pD, pC))
      }}
      // Red de seguridad ante autocompletar o entrada por IME, que no pasan
      // por `onKeyDown`: se reinterpretan las cifras que haya quedado.
      onChange={(e) => {
        const [e2, d2, c2] = partesImporte(e.target.value)
        onCambiar(combinaPartes(e2.slice(-MAX_DIGITOS_ENTERO), d2, c2))
      }}
      className={clases(
        ESTILO_ENTRADA,
        'cifras',
        error && 'border-negativo focus:border-negativo',
        className,
      )}
    />
  )
}

export function Selector({
  className,
  ...props
}: Readonly<SelectHTMLAttributes<HTMLSelectElement>>) {
  return <select {...props} className={clases(ESTILO_ENTRADA, 'appearance-none', className)} />
}

/**
 * Etiqueta de un campo. Los obligatorios llevan un `*`; los opcionales no
 * llevan nada más, ni siquiera un «(opcional)» — la ausencia del asterisco ya
 * lo dice. `ayuda` es solo para una explicación genuina, no para marcar
 * opcionalidad.
 */
export function Campo({
  etiqueta,
  ayuda,
  requerido,
  children,
}: Readonly<{
  etiqueta: string
  ayuda?: ReactNode
  requerido?: boolean
  children: ReactNode
}>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1 text-[13px] font-medium uppercase tracking-[0.05em] text-tenue">
        {etiqueta}
        {requerido && <span className="text-negativo">*</span>}
        {ayuda && <Info>{ayuda}</Info>}
      </span>
      {children}
    </label>
  )
}

/* ------------------------------------------------------------- Superpuestos */

/**
 * Explicación detrás de un icono, para no llenar de párrafos las pantallas de
 * configuración. Se abre al pulsar, no al pasar por encima: en móvil no hay
 * hover y ese texto se perdería.
 */
export function Info({ children }: Readonly<{ children: ReactNode }>) {
  const [abierto, setAbierto] = useState(false)

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-expanded={abierto}
        aria-label="Más información"
        onClick={() => setAbierto((v) => !v)}
        className="text-sutil transition active:opacity-50"
      >
        <IconoInfo className="h-4 w-4" />
      </button>
      {abierto && (
        <span
          role="tooltip"
          onClick={() => setAbierto(false)}
          className="absolute left-1/2 top-6 z-20 w-64 -translate-x-1/2 rounded-fila bg-tinta p-2.5 text-[13px] font-normal normal-case tracking-normal text-superficie shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  )
}

/**
 * Hoja inferior: entra desde abajo con tirador, como los modales de iOS. En
 * pantallas anchas se centra como tarjeta.
 */
export function Modal({
  abierto,
  onCerrar,
  titulo,
  subtitulo,
  children,
}: Readonly<{
  abierto: boolean
  onCerrar: () => void
  titulo?: string
  /** El mes al que se registrará lo que se dé de alta, p. ej. «Agosto 2026». */
  subtitulo?: string
  children: ReactNode
}>) {
  if (!abierto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-hoja bg-fondo px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sm:max-w-md sm:rounded-hoja"
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-sutil" aria-hidden />
        {titulo && (
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="titulo-pantalla">{titulo}</h2>
              {subtitulo && <p className="mt-0.5 text-[13px] text-tenue">{subtitulo}</p>}
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onCerrar}
              className="shrink-0 rounded-full bg-relleno p-1.5 text-tenue active:opacity-60"
            >
              <IconoCerrar className="h-4 w-4" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ Avisos */

export function Aviso({
  tono = 'info',
  children,
  accion,
}: Readonly<{
  tono?: 'info' | 'error'
  children: ReactNode
  accion?: ReactNode
}>) {
  return (
    <div
      className={clases(
        'flex flex-wrap items-center justify-between gap-3 rounded-fila px-3.5 py-2.5 text-[15px]',
        tono === 'error' ? 'bg-negativo/12 text-negativo' : 'bg-superficie text-tenue',
      )}
    >
      <span className="min-w-0">{children}</span>
      {accion}
    </div>
  )
}
