import type { FechaKey, MesKey } from './tipos'

export const NOMBRES_MES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const

/** Construye `AAAA-MM` a partir de año y mes 1-12. */
export function mesKey(anio: number, mes: number): MesKey {
  return `${anio}-${String(mes).padStart(2, '0')}`
}

/** Descompone `AAAA-MM` en año y mes 1-12. */
export function partesMes(mes: MesKey): { anio: number; mes: number } {
  const [a, m] = mes.split('-')
  return { anio: Number(a), mes: Number(m) }
}

/** El mes al que pertenece una fecha `AAAA-MM-DD`. */
export function mesDeFecha(fecha: FechaKey): MesKey {
  return fecha.slice(0, 7)
}

/** El año al que pertenece una fecha `AAAA-MM-DD`, como clave del nodo `anios`. */
export function anioDeFecha(fecha: FechaKey): string {
  return fecha.slice(0, 4)
}

/**
 * Orden cronológico. Como el formato es `AAAA-MM` con mes a dos dígitos, la
 * comparación lexicográfica ya es cronológica.
 */
export function comparaMes(a: MesKey, b: MesKey): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** ¿`mes` cae dentro de `[desde, hasta]`? `hasta: null` = sin fin definido. */
export function mesEnRango(mes: MesKey, desde: MesKey, hasta: MesKey | null): boolean {
  if (comparaMes(mes, desde) < 0) return false
  if (hasta !== null && comparaMes(mes, hasta) > 0) return false
  return true
}

/** Desplaza un mes n posiciones (n puede ser negativo). */
export function sumaMeses(mes: MesKey, n: number): MesKey {
  const { anio, mes: m } = partesMes(mes)
  const total = anio * 12 + (m - 1) + n
  return mesKey(Math.floor(total / 12), (total % 12) + 1)
}

/** Los 12 meses de un año, en orden. */
export function mesesDelAnio(anio: number): MesKey[] {
  return Array.from({ length: 12 }, (_, i) => mesKey(anio, i + 1))
}

export function nombreMes(mes: MesKey): string {
  return NOMBRES_MES[partesMes(mes).mes - 1] ?? ''
}

export function etiquetaMes(mes: MesKey): string {
  const { anio } = partesMes(mes)
  return `${nombreMes(mes)} ${anio}`
}

/** Mes actual del sistema, en hora local. */
export function mesActual(hoy: Date = new Date()): MesKey {
  return mesKey(hoy.getFullYear(), hoy.getMonth() + 1)
}

/** Fecha de hoy como `AAAA-MM-DD`, en hora local. */
export function hoyKey(hoy: Date = new Date()): FechaKey {
  const mm = String(hoy.getMonth() + 1).padStart(2, '0')
  const dd = String(hoy.getDate()).padStart(2, '0')
  return `${hoy.getFullYear()}-${mm}-${dd}`
}
