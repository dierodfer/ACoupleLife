import { mesKey } from './fechas'
import type { Anio, Datos, Persona } from './tipos'

export const VERSION_ESQUEMA = 1

/**
 * `crypto.getRandomValues` en vez de `randomUUID`: este último solo existe en
 * contexto seguro, y la app se abre también por IP desde el móvil (`vite dev
 * --host`), donde no lo hay.
 */
export function nuevoId(prefijo: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  const aleatorio = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${prefijo}_${aleatorio}`
}

export function anioVacio(): Anio {
  return { objetivos: {}, gastos: [], transferencias: [] }
}

export function datosIniciales(propietario: Persona, hoy: Date = new Date()): Datos {
  const anio = hoy.getFullYear()
  return {
    version: VERSION_ESQUEMA,
    actualizadoEn: hoy.toISOString(),
    actualizadoPor: propietario.email,
    personas: [
      propietario,
      { id: nuevoId('p'), nombre: 'Persona 2', email: '' },
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

/** Cualquier cosa del JSON vista como objeto indexable, sin dar nada por hecho. */
function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === 'object' ? (valor as Record<string, unknown>) : {}
}

/** Aplica `fn` a cada elemento si es un array; si no, devuelve lista vacía. */
function lista<T>(valor: unknown, fn: (elemento: Record<string, unknown>, i: number) => T): T[] {
  return Array.isArray(valor) ? valor.map((elemento, i) => fn(objeto(elemento), i)) : []
}

/** Mapa `clave -> importe` (overrides de recurrentes, excepciones de objetivo). */
function importes(valor: unknown): Record<string, number> {
  return Object.fromEntries(
    Object.entries(objeto(valor)).map(([clave, importe]) => [clave, numero(importe)]),
  )
}

/** `hasta` es opcional en todo el esquema: ausente significa «sin fin». */
function finRango(valor: unknown): string | null {
  return typeof valor === 'string' ? valor : null
}

function inicioPorDefecto(): string {
  return mesKey(new Date().getFullYear(), 1)
}

function normalizarPersonas(valor: unknown): Persona[] {
  return lista(valor, (o, i) => ({
    id: texto(o.id, `p${i + 1}`),
    nombre: texto(o.nombre, `Persona ${i + 1}`),
    email: texto(o.email),
  }))
}

function normalizarRecurrentes(valor: unknown): Datos['recurrentes'] {
  return lista(valor, (o, i) => ({
    id: texto(o.id, `r${i + 1}`),
    personaId: texto(o.personaId),
    concepto: texto(o.concepto),
    importe: numero(o.importe),
    desde: texto(o.desde, inicioPorDefecto()),
    hasta: finRango(o.hasta),
    overrides: importes(o.overrides),
  }))
}

function normalizarEfectivo(valor: unknown): Datos['efectivo'] {
  return lista(valor, (o, i) => ({
    id: texto(o.id, `e${i + 1}`),
    personaId: texto(o.personaId),
    importe: numero(o.importe),
    desde: texto(o.desde, inicioPorDefecto()),
    hasta: finRango(o.hasta),
  }))
}

function normalizarAnio(valor: unknown, clave: string): Anio {
  const a = objeto(valor)

  const objetivos: Anio['objetivos'] = {}
  for (const [personaId, obj] of Object.entries(objeto(a.objetivos))) {
    const o = objeto(obj)
    objetivos[personaId] = {
      importeMensual: numero(o.importeMensual),
      excepciones: importes(o.excepciones),
    }
  }

  return {
    objetivos,
    gastos: lista(a.gastos, (o, i) => ({
      id: texto(o.id, `g${i + 1}`),
      personaId: texto(o.personaId),
      importe: numero(o.importe),
      fecha: texto(o.fecha, `${clave}-01-01`),
      concepto: texto(o.concepto),
    })),
    transferencias: lista(a.transferencias, (o, i) => ({
      id: texto(o.id, `t${i + 1}`),
      personaId: texto(o.personaId),
      importe: numero(o.importe),
      fecha: texto(o.fecha, `${clave}-01-01`),
    })),
  }
}

/**
 * Normaliza lo que venga del archivo de Drive: es editable a mano y puede venir
 * de una versión anterior del esquema, así que nada se da por hecho.
 */
export function normalizar(bruto: unknown): Datos {
  const d = objeto(bruto)

  const anios: Record<string, Anio> = {}
  for (const [clave, valor] of Object.entries(objeto(d.anios))) {
    anios[clave] = normalizarAnio(valor, clave)
  }

  return {
    version: numero(d.version, VERSION_ESQUEMA),
    actualizadoEn: texto(d.actualizadoEn, new Date().toISOString()),
    actualizadoPor: texto(d.actualizadoPor),
    personas: normalizarPersonas(d.personas),
    recurrentes: normalizarRecurrentes(d.recurrentes),
    efectivo: normalizarEfectivo(d.efectivo),
    anios,
  }
}
