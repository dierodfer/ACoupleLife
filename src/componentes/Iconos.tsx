/**
 * Iconos de trazo, al estilo de SF Symbols: 24×24, `currentColor` y grosor
 * uniforme. Inline en vez de una librería para no añadir dependencias ni una
 * fuente de iconos entera por media docena de glifos.
 */

type Props = Readonly<{ className?: string }>

function Svg({ className, children }: Props & Readonly<{ children: React.ReactNode }>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className ?? 'h-6 w-6'}
    >
      {children}
    </svg>
  )
}

export function IconoMes(props: Props) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="16" rx="4" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Svg>
  )
}

export function IconoAnio(props: Props) {
  return (
    <Svg {...props}>
      <path d="M5 20V12M12 20V5M19 20v-6" />
    </Svg>
  )
}

export function IconoAjustes(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3.25" />
      <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9L5.3 5.3" />
    </Svg>
  )
}

export function IconoChevron(props: Props) {
  return (
    <Svg {...props}>
      <path d="M9 5l7 7-7 7" />
    </Svg>
  )
}

export function IconoAtras(props: Props) {
  return (
    <Svg {...props}>
      <path d="M15 5l-7 7 7 7" />
    </Svg>
  )
}

export function IconoMas(props: Props) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

export function IconoRecargar(props: Props) {
  return (
    <Svg {...props}>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v4.5h-4.5" />
    </Svg>
  )
}

export function IconoInfo(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9.25" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.75" r="0.6" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconoCerrar(props: Props) {
  return (
    <Svg {...props}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Svg>
  )
}

export function IconoRepetir(props: Props) {
  return (
    <Svg {...props}>
      <path d="M4 9.5A4.5 4.5 0 0 1 8.5 5H19" />
      <path d="M16 2.5L19.5 5 16 7.5" />
      <path d="M20 14.5A4.5 4.5 0 0 1 15.5 19H5" />
      <path d="M8 16.5L4.5 19 8 21.5" />
    </Svg>
  )
}

export function IconoCheck(props: Props) {
  return (
    <Svg {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  )
}

export function IconoLapiz(props: Props) {
  return (
    <Svg {...props}>
      <path d="M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="M13.5 6.5l4 4" />
    </Svg>
  )
}

export function IconoDeshacer(props: Props) {
  return (
    <Svg {...props}>
      <path d="M4 9h10.5a4.5 4.5 0 1 1 0 9H8" />
      <path d="M7.5 5.5L4 9l3.5 3.5" />
    </Svg>
  )
}
