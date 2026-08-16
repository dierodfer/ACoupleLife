/** Identificador estable de persona, independiente del nombre visible. */
export type PersonaId = string

/** Mes en formato `AAAA-MM`, p. ej. `"2026-08"`. */
export type MesKey = string

/** Fecha en formato `AAAA-MM-DD`. */
export type FechaKey = string

export interface Persona {
  id: PersonaId
  nombre: string
  email: string
}

/**
 * Gasto que se repite cada mes dentro de un rango. No se materializa como filas
 * mensuales: se calcula al vuelo a partir del rango y los overrides.
 *
 * `overrides` sustituye al antiguo par "lista de meses excluidos + gasto puntual":
 * un mes excluido es un override a 0 y un mes con importe distinto es un override
 * a ese importe. Así el ajuste es una sola escritura y nunca se contabiliza doble.
 */
export interface Recurrente {
  id: string
  personaId: PersonaId
  concepto: string
  importe: number
  desde: MesKey
  /** `null` = sin fin definido. */
  hasta: MesKey | null
  overrides: Record<MesKey, number>
}

/** Aportación en efectivo fija por mes, dentro de un rango. */
export interface Efectivo {
  id: string
  personaId: PersonaId
  importe: number
  desde: MesKey
  /** `null` = sin fin definido. */
  hasta: MesKey | null
}

/**
 * Objetivo de aportación de una persona en un año.
 *
 * `importeMensual` es la regla general y `excepciones` la rompe para meses
 * concretos (clave `"1"`..`"12"`). No se persiste ningún flag de "aplicar todo
 * el año": la regla ya aplica a los 12 meses por definición.
 */
export interface Objetivo {
  importeMensual: number
  excepciones: Record<string, number>
}

export interface Gasto {
  id: string
  personaId: PersonaId
  importe: number
  fecha: FechaKey
  concepto: string
}

export interface Transferencia {
  id: string
  personaId: PersonaId
  importe: number
  fecha: FechaKey
}

export interface Anio {
  objetivos: Record<PersonaId, Objetivo>
  gastos: Gasto[]
  transferencias: Transferencia[]
}

/** Contenido íntegro del archivo JSON compartido en Drive. */
export interface Datos {
  version: number
  actualizadoEn: string
  actualizadoPor: string
  personas: Persona[]
  /** Fuera del nodo de año: un recurrente sin fin sigue aplicando en años futuros. */
  recurrentes: Recurrente[]
  /** Fuera del nodo de año, por el mismo motivo. */
  efectivo: Efectivo[]
  anios: Record<string, Anio>
}

/** Desglose del mes para una persona. Todos los importes en euros. */
export interface ResumenPersona {
  personaId: PersonaId
  objetivo: number
  gastosPuntuales: number
  gastosRecurrentes: number
  /** `gastosPuntuales + gastosRecurrentes` */
  gastos: number
  efectivo: number
  transferencias: number
  /** Objetivo menos todo lo aportado. Negativo = ha aportado de más este mes. */
  pendiente: number
}

export interface ResumenMes {
  mes: MesKey
  porPersona: ResumenPersona[]
  objetivo: number
  gastos: number
  efectivo: number
  transferencias: number
  pendiente: number
}
