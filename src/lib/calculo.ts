import { anioDeFecha, mesDeFecha, mesEnRango, mesesDelAnio, partesMes } from './fechas'
import type {
  Anio,
  Datos,
  MesKey,
  PersonaId,
  ResumenMes,
  ResumenPersona,
} from './tipos'

/**
 * Núcleo de la aplicación. Todo el cálculo es puro: entra el JSON completo y un
 * mes, y sale el desglose. No hay estado ni efectos aquí.
 *
 * Regla de oro: los meses son independientes. El excedente o el déficit de un mes
 * nunca se arrastra al siguiente; el acumulado del año es solo informativo.
 */

const ANIO_VACIO: Anio = { objetivos: {}, gastos: [], transferencias: [] }

function nodoAnio(datos: Datos, anio: number | string): Anio {
  return datos.anios[String(anio)] ?? ANIO_VACIO
}

function redondea(n: number): number {
  const r = Math.round(n * 100) / 100
  // `Math.round` devuelve -0 para valores negativos muy pequeños, e `Intl` lo
  // formatearía como "-0,00 €". Normalizamos a +0.
  return r === 0 ? 0 : r
}

export function objetivoDelMes(datos: Datos, personaId: PersonaId, mes: MesKey): number {
  const { anio, mes: m } = partesMes(mes)
  const objetivo = nodoAnio(datos, anio).objetivos[personaId]
  if (!objetivo) return 0
  const excepcion = objetivo.excepciones[String(m)]
  return excepcion ?? objetivo.importeMensual
}

/** El nodo de año se deriva de la fecha del gasto, no del año en pantalla. */
export function gastosPuntualesDelMes(
  datos: Datos,
  personaId: PersonaId,
  mes: MesKey,
): number {
  const { anio } = partesMes(mes)
  return nodoAnio(datos, anio)
    .gastos.filter((g) => g.personaId === personaId && mesDeFecha(g.fecha) === mes)
    .reduce((total, g) => total + g.importe, 0)
}

export function gastosRecurrentesDelMes(
  datos: Datos,
  personaId: PersonaId,
  mes: MesKey,
): number {
  return datos.recurrentes
    .filter((r) => r.personaId === personaId && mesEnRango(mes, r.desde, r.hasta))
    .reduce((total, r) => total + (r.overrides[mes] ?? r.importe), 0)
}

export function efectivoDelMes(datos: Datos, personaId: PersonaId, mes: MesKey): number {
  return datos.efectivo
    .filter((e) => e.personaId === personaId && mesEnRango(mes, e.desde, e.hasta))
    .reduce((total, e) => total + e.importe, 0)
}

export function transferenciasDelMes(
  datos: Datos,
  personaId: PersonaId,
  mes: MesKey,
): number {
  const { anio } = partesMes(mes)
  return nodoAnio(datos, anio)
    .transferencias.filter(
      (t) => t.personaId === personaId && mesDeFecha(t.fecha) === mes,
    )
    .reduce((total, t) => total + t.importe, 0)
}

/**
 * Desglose del mes para una persona:
 *
 *   pendiente = objetivo − gastos − efectivo − transferencias
 */
export function resumenPersona(
  datos: Datos,
  personaId: PersonaId,
  mes: MesKey,
): ResumenPersona {
  const objetivo = objetivoDelMes(datos, personaId, mes)
  const gastosPuntuales = gastosPuntualesDelMes(datos, personaId, mes)
  const gastosRecurrentes = gastosRecurrentesDelMes(datos, personaId, mes)
  const gastos = gastosPuntuales + gastosRecurrentes
  const efectivo = efectivoDelMes(datos, personaId, mes)
  const transferencias = transferenciasDelMes(datos, personaId, mes)

  return {
    personaId,
    objetivo: redondea(objetivo),
    gastosPuntuales: redondea(gastosPuntuales),
    gastosRecurrentes: redondea(gastosRecurrentes),
    gastos: redondea(gastos),
    efectivo: redondea(efectivo),
    transferencias: redondea(transferencias),
    pendiente: redondea(objetivo - gastos - efectivo - transferencias),
  }
}

/** Desglose del mes para las dos personas más el total de la pareja. */
export function resumenMes(datos: Datos, mes: MesKey): ResumenMes {
  const porPersona = datos.personas.map((p) => resumenPersona(datos, p.id, mes))
  const suma = (campo: keyof ResumenPersona) =>
    redondea(porPersona.reduce((total, r) => total + (r[campo] as number), 0))

  return {
    mes,
    porPersona,
    objetivo: suma('objetivo'),
    gastos: suma('gastos'),
    efectivo: suma('efectivo'),
    transferencias: suma('transferencias'),
    pendiente: suma('pendiente'),
  }
}

export interface ResumenAnio {
  anio: number
  meses: ResumenMes[]
  objetivo: number
  aportado: number
  pendiente: number
  /** Total pendiente por persona, en el mismo orden que `datos.personas`. */
  pendientePorPersona: { personaId: PersonaId; objetivo: number; aportado: number; pendiente: number }[]
}

/** Estado global del año: suma de los doce meses. */
export function resumenAnio(datos: Datos, anio: number): ResumenAnio {
  const meses = mesesDelAnio(anio).map((mes) => resumenMes(datos, mes))

  const pendientePorPersona = datos.personas.map((p) => {
    const suyos = meses.flatMap((m) => m.porPersona.filter((r) => r.personaId === p.id))
    const objetivo = suyos.reduce((t, r) => t + r.objetivo, 0)
    const pendiente = suyos.reduce((t, r) => t + r.pendiente, 0)
    return {
      personaId: p.id,
      objetivo: redondea(objetivo),
      aportado: redondea(objetivo - pendiente),
      pendiente: redondea(pendiente),
    }
  })

  const objetivo = redondea(meses.reduce((t, m) => t + m.objetivo, 0))
  const pendiente = redondea(meses.reduce((t, m) => t + m.pendiente, 0))

  return {
    anio,
    meses,
    objetivo,
    aportado: redondea(objetivo - pendiente),
    pendiente,
    pendientePorPersona,
  }
}

/** Años con datos, de más reciente a más antiguo. */
export function aniosConDatos(datos: Datos): number[] {
  return Object.keys(datos.anios)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a)
}

/**
 * Meses de un año que ya tienen algún movimiento propio (gasto puntual o
 * transferencia). Los recurrentes y el efectivo no cuentan: aplican a todo su
 * rango y marcarían meses en los que nadie ha registrado nada todavía.
 */
export function mesesConMovimientos(datos: Datos, anio: number): Set<MesKey> {
  const nodo = nodoAnio(datos, anio)
  const meses = new Set<MesKey>()
  for (const gasto of nodo.gastos) meses.add(mesDeFecha(gasto.fecha))
  for (const transferencia of nodo.transferencias) meses.add(mesDeFecha(transferencia.fecha))
  return meses
}

export function listaGastosDelMes(datos: Datos, mes: MesKey) {
  const { anio } = partesMes(mes)
  return nodoAnio(datos, anio)
    .gastos.filter((g) => mesDeFecha(g.fecha) === mes)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export function listaTransferenciasDelMes(datos: Datos, mes: MesKey) {
  const { anio } = partesMes(mes)
  return nodoAnio(datos, anio)
    .transferencias.filter((t) => mesDeFecha(t.fecha) === mes)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/** Recurrentes del mes, ya con el override aplicado si lo tienen. */
export function listaRecurrentesDelMes(datos: Datos, mes: MesKey) {
  return datos.recurrentes
    .filter((r) => mesEnRango(mes, r.desde, r.hasta))
    .map((r) => ({ recurrente: r, importe: r.overrides[mes] ?? r.importe }))
}

export function listaEfectivoDelMes(datos: Datos, mes: MesKey) {
  return datos.efectivo.filter((e) => mesEnRango(mes, e.desde, e.hasta))
}

export function anioDe(fecha: string): number {
  return Number(anioDeFecha(fecha))
}
