import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

/** Primitivas de interfaz compartidas. Tailwind puro, sin dependencias extra. */

function clases(...partes: (string | false | undefined)[]): string {
  return partes.filter(Boolean).join(' ')
}

type VarianteBoton = 'principal' | 'suave' | 'texto' | 'peligro'

const VARIANTES: Record<VarianteBoton, string> = {
  principal: 'bg-acento text-white hover:opacity-90',
  suave: 'bg-superficie border border-borde text-tinta hover:border-acento',
  texto: 'text-tenue hover:text-tinta',
  peligro: 'text-negativo hover:underline',
}

export function Boton({
  variante = 'suave',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBoton }) {
  return (
    <button
      {...props}
      className={clases(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTES[variante],
        className,
      )}
    />
  )
}

export function Tarjeta({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={clases(
        'rounded-2xl border border-borde bg-superficie p-4 shadow-sm',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function Campo({
  etiqueta,
  ayuda,
  children,
}: {
  etiqueta: string
  ayuda?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-tinta">{etiqueta}</span>
      {children}
      {ayuda && <span className="text-xs text-tenue">{ayuda}</span>}
    </label>
  )
}

const ESTILO_ENTRADA =
  'w-full rounded-xl border border-borde bg-fondo px-3 py-2 text-sm text-tinta outline-none focus:border-acento'

export function Entrada({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clases(ESTILO_ENTRADA, 'cifras', className)} />
}

export function Selector({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clases(ESTILO_ENTRADA, className)} />
}

/** Fila de "concepto ... importe", el patrón que se repite en todo el resumen. */
export function Fila({
  concepto,
  importe,
  tono = 'normal',
  accion,
}: {
  concepto: ReactNode
  importe: ReactNode
  tono?: 'normal' | 'tenue' | 'fuerte'
  accion?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span
        className={clases(
          'min-w-0 truncate text-sm',
          tono === 'tenue' && 'text-tenue',
          tono === 'fuerte' && 'font-semibold',
        )}
      >
        {concepto}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span
          className={clases(
            'cifras text-sm',
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

export function Aviso({
  tono = 'info',
  children,
  accion,
}: {
  tono?: 'info' | 'error'
  children: ReactNode
  accion?: ReactNode
}) {
  return (
    <div
      className={clases(
        'flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm',
        tono === 'error'
          ? 'border-negativo/40 bg-negativo/10 text-negativo'
          : 'border-borde bg-superficie text-tenue',
      )}
    >
      <span className="min-w-0">{children}</span>
      {accion}
    </div>
  )
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="py-3 text-center text-sm text-tenue">{children}</p>
}
