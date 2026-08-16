import { objetivoDelMes } from './calculo'
import { anioDeFecha, mesKey } from './fechas'
import { anioVacio, nuevoId } from './esquema'
import type {
  Anio,
  Datos,
  Efectivo,
  Gasto,
  MesKey,
  Objetivo,
  PersonaId,
  Recurrente,
  Transferencia,
} from './tipos'

/**
 * Mutaciones puras: reciben el estado completo y devuelven uno nuevo. Ninguna
 * toca Drive ni el store; el guardado lo decide la capa de arriba.
 */

const OBJETIVO_VACIO: Objetivo = { importeMensual: 0, excepciones: {} }

function nodo(datos: Datos, anio: string): Anio {
  return datos.anios[anio] ?? anioVacio()
}

function conAnio(datos: Datos, anio: string, nuevo: Anio): Datos {
  return { ...datos, anios: { ...datos.anios, [anio]: nuevo } }
}

/**
 * Crea el nodo de un año si no existe, arrastrando como punto de partida el
 * `importeMensual` del año anterior (sin sus excepciones, que son puntuales).
 */
export function asegurarAnio(datos: Datos, anio: number): Datos {
  const clave = String(anio)
  if (datos.anios[clave]) return datos

  const anterior = datos.anios[String(anio - 1)]
  const objetivos: Record<PersonaId, Objetivo> = {}
  for (const persona of datos.personas) {
    const previo = anterior?.objetivos[persona.id]
    objetivos[persona.id] = {
      importeMensual: previo?.importeMensual ?? 0,
      excepciones: {},
    }
  }

  return conAnio(datos, clave, { ...anioVacio(), objetivos })
}

export function renombrarPersona(datos: Datos, personaId: PersonaId, nombre: string): Datos {
  return {
    ...datos,
    personas: datos.personas.map((p) => (p.id === personaId ? { ...p, nombre } : p)),
  }
}

export function cambiarEmailPersona(datos: Datos, personaId: PersonaId, email: string): Datos {
  return {
    ...datos,
    personas: datos.personas.map((p) => (p.id === personaId ? { ...p, email } : p)),
  }
}

export type ModoCambioObjetivo = 'todoElAnio' | 'desdeEsteMes'

/**
 * Cambia la regla de objetivo mensual de una persona en un año.
 *
 * - `todoElAnio`: cambia la regla y con ella todos los meses sin excepción,
 *   incluidos los ya pasados.
 * - `desdeEsteMes`: antes de cambiar la regla, congela el objetivo efectivo
 *   actual de los meses anteriores a `desdeMes` como excepciones, de forma que
 *   el histórico ya vivido no se reescriba solo.
 */
export function cambiarObjetivoMensual(
  datos: Datos,
  anio: number,
  personaId: PersonaId,
  importeMensual: number,
  modo: ModoCambioObjetivo,
  desdeMes = 1,
): Datos {
  const base = asegurarAnio(datos, anio)
  const clave = String(anio)
  const actual = nodo(base, clave)
  const objetivo = actual.objetivos[personaId] ?? OBJETIVO_VACIO

  const excepciones = { ...objetivo.excepciones }
  if (modo === 'desdeEsteMes') {
    for (let m = 1; m < desdeMes; m++) {
      if (excepciones[String(m)] === undefined) {
        excepciones[String(m)] = objetivoDelMes(base, personaId, mesKey(anio, m))
      }
    }
  }

  return conAnio(base, clave, {
    ...actual,
    objetivos: {
      ...actual.objetivos,
      [personaId]: { importeMensual, excepciones },
    },
  })
}

/** Fija (o borra, con `null`) la excepción de objetivo de un mes concreto. */
export function fijarExcepcionObjetivo(
  datos: Datos,
  anio: number,
  personaId: PersonaId,
  mes: number,
  importe: number | null,
): Datos {
  const base = asegurarAnio(datos, anio)
  const clave = String(anio)
  const actual = nodo(base, clave)
  const objetivo = actual.objetivos[personaId] ?? OBJETIVO_VACIO

  const excepciones = { ...objetivo.excepciones }
  if (importe === null) delete excepciones[String(mes)]
  else excepciones[String(mes)] = importe

  return conAnio(base, clave, {
    ...actual,
    objetivos: { ...actual.objetivos, [personaId]: { ...objetivo, excepciones } },
  })
}

/** El gasto se guarda en el nodo del año de su fecha, no en el año en pantalla. */
export function anadirGasto(datos: Datos, gasto: Omit<Gasto, 'id'>): Datos {
  const clave = anioDeFecha(gasto.fecha)
  const base = asegurarAnio(datos, Number(clave))
  const actual = nodo(base, clave)
  return conAnio(base, clave, {
    ...actual,
    gastos: [...actual.gastos, { ...gasto, id: nuevoId('g') }],
  })
}

export function eliminarGasto(datos: Datos, anio: string, gastoId: string): Datos {
  const actual = nodo(datos, anio)
  return conAnio(datos, anio, {
    ...actual,
    gastos: actual.gastos.filter((g) => g.id !== gastoId),
  })
}

export function anadirTransferencia(
  datos: Datos,
  transferencia: Omit<Transferencia, 'id'>,
): Datos {
  const clave = anioDeFecha(transferencia.fecha)
  const base = asegurarAnio(datos, Number(clave))
  const actual = nodo(base, clave)
  return conAnio(base, clave, {
    ...actual,
    transferencias: [...actual.transferencias, { ...transferencia, id: nuevoId('t') }],
  })
}

export function eliminarTransferencia(
  datos: Datos,
  anio: string,
  transferenciaId: string,
): Datos {
  const actual = nodo(datos, anio)
  return conAnio(datos, anio, {
    ...actual,
    transferencias: actual.transferencias.filter((t) => t.id !== transferenciaId),
  })
}

/** Alta o edición de un recurrente, según traiga `id` o no. */
export function guardarRecurrente(
  datos: Datos,
  recurrente: Omit<Recurrente, 'id' | 'overrides'> & { id?: string; overrides?: Record<MesKey, number> },
): Datos {
  if (recurrente.id) {
    const id = recurrente.id
    return {
      ...datos,
      recurrentes: datos.recurrentes.map((r) =>
        r.id === id ? { ...r, ...recurrente, id } : r,
      ),
    }
  }
  return {
    ...datos,
    recurrentes: [
      ...datos.recurrentes,
      { ...recurrente, id: nuevoId('r'), overrides: recurrente.overrides ?? {} },
    ],
  }
}

export function eliminarRecurrente(datos: Datos, recurrenteId: string): Datos {
  return { ...datos, recurrentes: datos.recurrentes.filter((r) => r.id !== recurrenteId) }
}

/**
 * Ajusta un recurrente en un mes concreto: importe distinto, o 0 para que ese
 * mes no cuente. Es una sola escritura, así que no hay riesgo de contabilizar
 * dos veces el mismo gasto.
 */
export function fijarOverrideRecurrente(
  datos: Datos,
  recurrenteId: string,
  mes: MesKey,
  importe: number | null,
): Datos {
  return {
    ...datos,
    recurrentes: datos.recurrentes.map((r) => {
      if (r.id !== recurrenteId) return r
      const overrides = { ...r.overrides }
      if (importe === null) delete overrides[mes]
      else overrides[mes] = importe
      return { ...r, overrides }
    }),
  }
}

/** Alta o edición de una configuración de efectivo. */
export function guardarEfectivo(
  datos: Datos,
  efectivo: Omit<Efectivo, 'id'> & { id?: string },
): Datos {
  if (efectivo.id) {
    const id = efectivo.id
    return {
      ...datos,
      efectivo: datos.efectivo.map((e) => (e.id === id ? { ...e, ...efectivo, id } : e)),
    }
  }
  return { ...datos, efectivo: [...datos.efectivo, { ...efectivo, id: nuevoId('e') }] }
}

export function eliminarEfectivo(datos: Datos, efectivoId: string): Datos {
  return { ...datos, efectivo: datos.efectivo.filter((e) => e.id !== efectivoId) }
}

/** Sello de auditoría que se escribe justo antes de subir el archivo a Drive. */
export function sellar(datos: Datos, email: string, ahora: Date = new Date()): Datos {
  return { ...datos, actualizadoEn: ahora.toISOString(), actualizadoPor: email }
}
