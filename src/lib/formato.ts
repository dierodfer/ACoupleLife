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
