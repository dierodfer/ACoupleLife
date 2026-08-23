import { mesKey } from './fechas'
import type { Anio, Datos, Persona } from './tipos'

export const VERSION_ESQUEMA = 1

export function nuevoId(prefijo: string): string {
  const aleatorio =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefijo}_${aleatorio}`
}

export function anioVacio(): Anio {
  return { objetivos: {}, gastos: [], transferencias: [] }
}

/** Archivo inicial que crea el primer usuario. */
export function datosIniciales(propietario: Persona, hoy: Date = new Date()): Datos {
  const anio = hoy.getFullYear()
  return {
    version: VERSION_ESQUEMA,
    actualizadoEn: hoy.toISOString(),
    actualizadoPor: propietario.email,
    personas: [
      propietario,
      { id: nuevoId('p'), nombre: 'Pareja', email: '' },
    ],
    recurrentes: [],
    efectivo: [],
    anios: { [String(anio)]: anioVacio() },
  }
}

function numero(valor: unknown, porDefecto = 0): number {
  const n = typeof valor === 'string' ? Number(valor.replace(',', '.')) : valor
  return typeof n === 'number' && Number.isFinite(n) ? n : porDefecto
}

function texto(valor: unknown, porDefecto = ''): string {
  return typeof valor === 'string' ? valor : porDefecto
}

/**
 * Normaliza lo que venga del archivo de Drive. El JSON es editable a mano y
 * puede venir de una versión anterior del esquema, así que nada se da por hecho:
 * cada campo se valida y se rellena con un valor por defecto seguro.
 */
export function normalizar(bruto: unknown): Datos {
  const d = (bruto ?? {}) as Record<string, unknown>

  const personas: Persona[] = Array.isArray(d.personas)
    ? d.personas.map((p, i) => {
        const o = (p ?? {}) as Record<string, unknown>
        return {
          id: texto(o.id, `p${i + 1}`),
          nombre: texto(o.nombre, `Persona ${i + 1}`),
          email: texto(o.email),
        }
      })
    : []

  const recurrentes = Array.isArray(d.recurrentes)
    ? d.recurrentes.map((r, i) => {
        const o = (r ?? {}) as Record<string, unknown>
        const overrides: Record<string, number> = {}
        if (o.overrides && typeof o.overrides === 'object') {
          for (const [mes, importe] of Object.entries(o.overrides as object)) {
            overrides[mes] = numero(importe)
          }
        }
        return {
          id: texto(o.id, `r${i + 1}`),
          personaId: texto(o.personaId),
          concepto: texto(o.concepto),
          importe: numero(o.importe),
          desde: texto(o.desde, mesKey(new Date().getFullYear(), 1)),
          hasta: typeof o.hasta === 'string' ? o.hasta : null,
          overrides,
        }
      })
    : []

  const efectivo = Array.isArray(d.efectivo)
    ? d.efectivo.map((e, i) => {
        const o = (e ?? {}) as Record<string, unknown>
        return {
          id: texto(o.id, `e${i + 1}`),
          personaId: texto(o.personaId),
          importe: numero(o.importe),
          desde: texto(o.desde, mesKey(new Date().getFullYear(), 1)),
          hasta: typeof o.hasta === 'string' ? o.hasta : null,
        }
      })
    : []

  const anios: Record<string, Anio> = {}
  if (d.anios && typeof d.anios === 'object') {
    for (const [clave, valor] of Object.entries(d.anios as object)) {
      const a = (valor ?? {}) as Record<string, unknown>

      const objetivos: Anio['objetivos'] = {}
      if (a.objetivos && typeof a.objetivos === 'object') {
        for (const [personaId, obj] of Object.entries(a.objetivos as object)) {
          const o = (obj ?? {}) as Record<string, unknown>
          const excepciones: Record<string, number> = {}
          if (o.excepciones && typeof o.excepciones === 'object') {
            for (const [mes, importe] of Object.entries(o.excepciones as object)) {
              excepciones[mes] = numero(importe)
            }
          }
          objetivos[personaId] = { importeMensual: numero(o.importeMensual), excepciones }
        }
      }

      anios[clave] = {
        objetivos,
        gastos: Array.isArray(a.gastos)
          ? a.gastos.map((g, i) => {
              const o = (g ?? {}) as Record<string, unknown>
              return {
                id: texto(o.id, `g${i + 1}`),
                personaId: texto(o.personaId),
                importe: numero(o.importe),
                fecha: texto(o.fecha, `${clave}-01-01`),
                concepto: texto(o.concepto),
              }
            })
          : [],
        transferencias: Array.isArray(a.transferencias)
          ? a.transferencias.map((t, i) => {
              const o = (t ?? {}) as Record<string, unknown>
              return {
                id: texto(o.id, `t${i + 1}`),
                personaId: texto(o.personaId),
                importe: numero(o.importe),
                fecha: texto(o.fecha, `${clave}-01-01`),
              }
            })
          : [],
      }
    }
  }

  return {
    version: numero(d.version, VERSION_ESQUEMA),
    actualizadoEn: texto(d.actualizadoEn, new Date().toISOString()),
    actualizadoPor: texto(d.actualizadoPor),
    personas,
    recurrentes,
    efectivo,
    anios,
  }
}
