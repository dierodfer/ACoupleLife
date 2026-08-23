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

export function IconoNube(props: Props) {
  return (
    <Svg {...props}>
      <path d="M7 19a4.5 4.5 0 0 1-.5-8.97 5.5 5.5 0 0 1 10.6-1.48A4.25 4.25 0 0 1 17.5 19Z" />
    </Svg>
  )
}

export function IconoCandado(props: Props) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="10" width="15" height="10.5" rx="3" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </Svg>
  )
}

export function IconoPersonas(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3 19.5a6 6 0 0 1 12 0" />
      <path d="M16.5 5.2a3.25 3.25 0 0 1 0 5.6M18 14.2a6 6 0 0 1 3 5.3" />
    </Svg>
  )
}

/**
 * Logo de Google Drive. Es la única marca ajena de la aplicación, así que no
 * sigue la pauta de los demás iconos: colores fijos de Google (no
 * `currentColor`) y relleno en vez de trazo, porque un logo no se reinterpreta.
 */
export function LogoGoogleDrive({ className }: Props) {
  return (
    <svg viewBox="0 0 87.3 78" aria-hidden className={className ?? 'h-6 w-6'}>
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
        fill="#0066da"
      />
      <path
        d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z"
        fill="#00ac47"
      />
      <path
        d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
        fill="#ea4335"
      />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path
        d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
        fill="#2684fc"
      />
      <path
        d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
        fill="#ffba00"
      />
    </svg>
  )
}
