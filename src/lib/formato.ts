const EUROS = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const EUROS_REDONDOS = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

export function euros(importe: number): string {
  return EUROS.format(importe)
}

/** Para cifras grandes en las que los céntimos son ruido (totales anuales). */
export function eurosRedondos(importe: number): string {
  return EUROS_REDONDOS.format(importe)
}

/** Lee un importe escrito a mano, aceptando coma o punto decimal. */
export function leeImporte(texto: string): number {
  const n = Number(texto.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** `2026-08-03` -> `3 ago` */
export function fechaCorta(fecha: string): string {
  const [, mes, dia] = fecha.split('-')
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${Number(dia)} ${meses[Number(mes) - 1] ?? ''}`
}

const RELATIVO = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' })

/** Escalones de tiempo y cuántos caben en el siguiente. */
const ESCALONES: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.35],
  ['month', 12],
]

/**
 * `2026-08-22T10:00:00Z` -> `hace 5 minutos`. Para el sello de última
 * actualización del archivo compartido: importa el "hace cuánto", no la fecha
 * exacta. Devuelve cadena vacía si la fecha no es válida.
 */
export function haceCuanto(iso: string, ahora: Date = new Date()): string {
  const marca = new Date(iso).getTime()
  if (!Number.isFinite(marca)) return ''

  let valor = (marca - ahora.getTime()) / 1000
  for (const [unidad, cabenEnElSiguiente] of ESCALONES) {
    if (Math.abs(valor) < cabenEnElSiguiente) return RELATIVO.format(Math.round(valor), unidad)
    valor /= cabenEnElSiguiente
  }
  return RELATIVO.format(Math.round(valor), 'year')
}
