import { describe, expect, it } from 'vitest'
import { objetivoDelMes, resumenPersona } from './calculo'
import { normalizar } from './esquema'
import {
  anadirGasto,
  asegurarAnio,
  cambiarObjetivoMensual,
  fijarOverrideRecurrente,
  guardarRecurrente,
} from './mutaciones'
import type { Datos } from './tipos'

function datos(): Datos {
  return {
    version: 1,
    actualizadoEn: '2026-08-17T10:00:00Z',
    actualizadoPor: 'diego@gmail.com',
    personas: [{ id: 'p1', nombre: 'Diego', email: 'diego@gmail.com' }],
    recurrentes: [],
    efectivo: [],
    anios: {
      '2026': {
        objetivos: { p1: { importeMensual: 1000, excepciones: {} } },
        gastos: [],
        transferencias: [],
      },
    },
  }
}

describe('cambiar el objetivo mensual', () => {
  it('en modo "todo el año" reescribe también los meses ya pasados', () => {
    const nuevo = cambiarObjetivoMensual(datos(), 2026, 'p1', 1200, 'todoElAnio', 8)

    expect(objetivoDelMes(nuevo, 'p1', '2026-03')).toBe(1200)
    expect(objetivoDelMes(nuevo, 'p1', '2026-12')).toBe(1200)
  })

  it('en modo "desde este mes" congela los meses anteriores', () => {
    const nuevo = cambiarObjetivoMensual(datos(), 2026, 'p1', 1200, 'desdeEsteMes', 8)

    expect(objetivoDelMes(nuevo, 'p1', '2026-07')).toBe(1000)
    expect(objetivoDelMes(nuevo, 'p1', '2026-08')).toBe(1200)
    expect(objetivoDelMes(nuevo, 'p1', '2026-12')).toBe(1200)
  })

  it('respeta las excepciones que ya existían al congelar', () => {
    const base = datos()
    base.anios['2026']!.objetivos.p1!.excepciones['3'] = 500

    const nuevo = cambiarObjetivoMensual(base, 2026, 'p1', 1200, 'desdeEsteMes', 8)

    expect(objetivoDelMes(nuevo, 'p1', '2026-03')).toBe(500)
    expect(objetivoDelMes(nuevo, 'p1', '2026-04')).toBe(1000)
  })

  it('es idempotente: repetir el cambio no altera el histórico congelado', () => {
    const uno = cambiarObjetivoMensual(datos(), 2026, 'p1', 1200, 'desdeEsteMes', 8)
    const dos = cambiarObjetivoMensual(uno, 2026, 'p1', 1500, 'desdeEsteMes', 8)

    expect(objetivoDelMes(dos, 'p1', '2026-07')).toBe(1000)
    expect(objetivoDelMes(dos, 'p1', '2026-08')).toBe(1500)
  })

  it('no muta el estado original', () => {
    const original = datos()
    cambiarObjetivoMensual(original, 2026, 'p1', 1200, 'desdeEsteMes', 8)

    expect(original.anios['2026']!.objetivos.p1!.importeMensual).toBe(1000)
    expect(original.anios['2026']!.objetivos.p1!.excepciones).toEqual({})
  })
})

describe('crear un año nuevo', () => {
  it('arrastra el importe mensual del año anterior, pero no sus excepciones', () => {
    const base = datos()
    base.anios['2026']!.objetivos.p1!.excepciones['8'] = 500

    const nuevo = asegurarAnio(base, 2027)

    expect(nuevo.anios['2027']!.objetivos.p1!.importeMensual).toBe(1000)
    expect(nuevo.anios['2027']!.objetivos.p1!.excepciones).toEqual({})
  })

  it('no toca un año que ya existe', () => {
    const base = datos()
    expect(asegurarAnio(base, 2026)).toBe(base)
  })
})

describe('añadir un gasto', () => {
  it('lo guarda en el año de su fecha, no en el año abierto en pantalla', () => {
    const nuevo = anadirGasto(datos(), {
      personaId: 'p1',
      importe: 80,
      fecha: '2025-12-31',
      concepto: 'Cena',
    })

    expect(nuevo.anios['2025']!.gastos).toHaveLength(1)
    expect(nuevo.anios['2026']!.gastos).toHaveLength(0)
    expect(resumenPersona(nuevo, 'p1', '2025-12').gastos).toBe(80)
  })
})

describe('ajustar un recurrente en un mes', () => {
  it('cambia el importe de ese mes sin crear un gasto puntual duplicado', () => {
    let d = guardarRecurrente(datos(), {
      personaId: 'p1',
      concepto: 'Internet',
      importe: 60,
      desde: '2026-01',
      hasta: null,
    })
    const recurrenteId = d.recurrentes[0]!.id
    d = fijarOverrideRecurrente(d, recurrenteId, '2026-08', 45)

    const resumen = resumenPersona(d, 'p1', '2026-08')
    expect(resumen.gastosRecurrentes).toBe(45)
    expect(resumen.gastosPuntuales).toBe(0)
    expect(resumen.gastos).toBe(45)
  })

  it('quitar el override devuelve el importe general', () => {
    let d = guardarRecurrente(datos(), {
      personaId: 'p1',
      concepto: 'Internet',
      importe: 60,
      desde: '2026-01',
      hasta: null,
    })
    const recurrenteId = d.recurrentes[0]!.id
    d = fijarOverrideRecurrente(d, recurrenteId, '2026-08', 45)
    d = fijarOverrideRecurrente(d, recurrenteId, '2026-08', null)

    expect(resumenPersona(d, 'p1', '2026-08').gastosRecurrentes).toBe(60)
  })
})

describe('normalizar el archivo de Drive', () => {
  it('sobrevive a un archivo vacío o corrupto', () => {
    const vacio = normalizar(null)
    expect(vacio.personas).toEqual([])
    expect(vacio.anios).toEqual({})
    expect(vacio.recurrentes).toEqual([])
  })

  it('rellena los campos que falten sin perder los que hay', () => {
    const d = normalizar({
      personas: [{ id: 'p1', nombre: 'Diego' }],
      anios: { '2026': { objetivos: { p1: { importeMensual: 1000 } } } },
    })

    expect(d.personas[0]).toEqual({ id: 'p1', nombre: 'Diego', email: '' })
    expect(d.anios['2026']!.gastos).toEqual([])
    expect(d.anios['2026']!.objetivos.p1!.excepciones).toEqual({})
    expect(objetivoDelMes(d, 'p1', '2026-04')).toBe(1000)
  })

  it('acepta importes escritos con coma decimal', () => {
    const d = normalizar({
      personas: [{ id: 'p1' }],
      efectivo: [{ id: 'e1', personaId: 'p1', importe: '12,50', desde: '2026-01' }],
    })

    expect(d.efectivo[0]!.importe).toBe(12.5)
    expect(d.efectivo[0]!.hasta).toBeNull()
  })
})
