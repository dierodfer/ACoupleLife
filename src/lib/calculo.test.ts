import { describe, expect, it } from 'vitest'
import {
  efectivoDelMes,
  gastosRecurrentesDelMes,
  objetivoDelMes,
  resumenAnio,
  resumenMes,
  resumenPersona,
} from './calculo'
import type { Datos } from './tipos'

/**
 * Escenario base: el ejemplo de la sección 9 del plan.
 * Diego 1.000 € de objetivo, 400 € de gastos, 100 € de efectivo -> 500 € por transferir.
 * Ana   1.000 € de objetivo, 350 € de gastos,   0 € de efectivo -> 650 € por transferir.
 * Total: 1.150 € por transferir.
 */
function datosBase(): Datos {
  return {
    version: 1,
    actualizadoEn: '2026-08-17T10:00:00Z',
    actualizadoPor: 'diego@gmail.com',
    personas: [
      { id: 'p1', nombre: 'Diego', email: 'diego@gmail.com' },
      { id: 'p2', nombre: 'Ana', email: 'ana@gmail.com' },
    ],
    recurrentes: [],
    efectivo: [{ id: 'e1', personaId: 'p1', importe: 100, desde: '2026-01', hasta: null }],
    anios: {
      '2026': {
        objetivos: {
          p1: { importeMensual: 1000, excepciones: {} },
          p2: { importeMensual: 1000, excepciones: {} },
        },
        gastos: [
          { id: 'g1', personaId: 'p1', importe: 400, fecha: '2026-08-03', concepto: 'Compra' },
          { id: 'g2', personaId: 'p2', importe: 350, fecha: '2026-08-11', concepto: 'Luz' },
        ],
        transferencias: [],
      },
    },
  }
}

describe('resumen del mes', () => {
  it('reproduce el ejemplo del plan', () => {
    const resumen = resumenMes(datosBase(), '2026-08')

    expect(resumen.porPersona[0]).toMatchObject({
      personaId: 'p1',
      objetivo: 1000,
      gastos: 400,
      efectivo: 100,
      pendiente: 500,
    })
    expect(resumen.porPersona[1]).toMatchObject({
      personaId: 'p2',
      objetivo: 1000,
      gastos: 350,
      efectivo: 0,
      pendiente: 650,
    })
    expect(resumen.pendiente).toBe(1150)
  })

  it('descuenta las transferencias ya realizadas', () => {
    const datos = datosBase()
    datos.anios['2026']!.transferencias.push({
      id: 't1',
      personaId: 'p1',
      importe: 500,
      fecha: '2026-08-28',
    })

    expect(resumenPersona(datos, 'p1', '2026-08').pendiente).toBe(0)
  })

  it('deja el pendiente en negativo cuando se aporta de más, sin arrastrarlo', () => {
    const datos = datosBase()
    datos.anios['2026']!.transferencias.push({
      id: 't1',
      personaId: 'p1',
      importe: 700,
      fecha: '2026-08-28',
    })

    // Agosto queda a -200 (200 € de más)...
    expect(resumenPersona(datos, 'p1', '2026-08').pendiente).toBe(-200)
    // ...y septiembre arranca limpio: objetivo 1000 menos los 100 de efectivo.
    expect(resumenPersona(datos, 'p1', '2026-09').pendiente).toBe(900)
  })

  it('ignora los gastos de otras personas y de otros meses', () => {
    const datos = datosBase()
    expect(resumenPersona(datos, 'p1', '2026-09').gastos).toBe(0)
    expect(resumenPersona(datos, 'p2', '2026-08').gastos).toBe(350)
  })
})

describe('objetivo del mes', () => {
  it('usa la regla general cuando no hay excepción', () => {
    expect(objetivoDelMes(datosBase(), 'p1', '2026-05')).toBe(1000)
  })

  it('la excepción del mes gana a la regla general', () => {
    const datos = datosBase()
    datos.anios['2026']!.objetivos.p1!.excepciones['8'] = 500
    expect(objetivoDelMes(datos, 'p1', '2026-08')).toBe(500)
    expect(objetivoDelMes(datos, 'p1', '2026-07')).toBe(1000)
  })

  it('es 0 para un año sin datos', () => {
    expect(objetivoDelMes(datosBase(), 'p1', '2030-03')).toBe(0)
  })
})

describe('gastos recurrentes', () => {
  it('aplica solo dentro del rango', () => {
    const datos = datosBase()
    datos.recurrentes.push({
      id: 'r1',
      personaId: 'p1',
      concepto: 'Internet',
      importe: 60,
      desde: '2026-03',
      hasta: '2026-10',
      overrides: {},
    })

    expect(gastosRecurrentesDelMes(datos, 'p1', '2026-02')).toBe(0)
    expect(gastosRecurrentesDelMes(datos, 'p1', '2026-03')).toBe(60)
    expect(gastosRecurrentesDelMes(datos, 'p1', '2026-10')).toBe(60)
    expect(gastosRecurrentesDelMes(datos, 'p1', '2026-11')).toBe(0)
  })

  it('sigue aplicando en años posteriores cuando no tiene fin', () => {
    const datos = datosBase()
    datos.recurrentes.push({
      id: 'r1',
      personaId: 'p1',
      concepto: 'Internet',
      importe: 60,
      desde: '2026-01',
      hasta: null,
      overrides: {},
    })

    expect(gastosRecurrentesDelMes(datos, 'p1', '2028-04')).toBe(60)
  })

  it('el override sustituye el importe de ese mes y 0 lo excluye', () => {
    const datos = datosBase()
    datos.recurrentes.push({
      id: 'r1',
      personaId: 'p1',
      concepto: 'Internet',
      importe: 60,
      desde: '2026-01',
      hasta: null,
      overrides: { '2026-07': 0, '2026-08': 45 },
    })

    expect(gastosRecurrentesDelMes(datos, 'p1', '2026-06')).toBe(60)
    expect(gastosRecurrentesDelMes(datos, 'p1', '2026-07')).toBe(0)
    expect(gastosRecurrentesDelMes(datos, 'p1', '2026-08')).toBe(45)
  })

  it('se suma a los gastos puntuales del mismo mes sin duplicar', () => {
    const datos = datosBase()
    datos.recurrentes.push({
      id: 'r1',
      personaId: 'p1',
      concepto: 'Internet',
      importe: 60,
      desde: '2026-01',
      hasta: null,
      overrides: {},
    })

    const resumen = resumenPersona(datos, 'p1', '2026-08')
    expect(resumen.gastosPuntuales).toBe(400)
    expect(resumen.gastosRecurrentes).toBe(60)
    expect(resumen.gastos).toBe(460)
    expect(resumen.pendiente).toBe(440)
  })
})

describe('efectivo', () => {
  it('deja de contar fuera de su rango', () => {
    const datos = datosBase()
    datos.efectivo[0]!.hasta = '2026-06'

    expect(efectivoDelMes(datos, 'p1', '2026-06')).toBe(100)
    expect(efectivoDelMes(datos, 'p1', '2026-07')).toBe(0)
  })
})

describe('resumen del año', () => {
  it('suma los doce meses y compara objetivo con aportado', () => {
    const resumen = resumenAnio(datosBase(), 2026)

    expect(resumen.objetivo).toBe(24000) // 2 personas x 1.000 x 12
    // Aportado: 750 de gastos en agosto + 100 de efectivo x 12 meses.
    expect(resumen.aportado).toBe(1950)
    expect(resumen.pendiente).toBe(22050)
    expect(resumen.meses).toHaveLength(12)
  })

  it('desglosa el pendiente por persona', () => {
    const { pendientePorPersona } = resumenAnio(datosBase(), 2026)

    expect(pendientePorPersona[0]).toMatchObject({ personaId: 'p1', objetivo: 12000 })
    expect(pendientePorPersona[0]!.aportado).toBe(1600) // 400 de gastos + 1.200 de efectivo
    expect(pendientePorPersona[1]!.aportado).toBe(350)
  })

  it('devuelve ceros para un año sin datos', () => {
    const resumen = resumenAnio(datosBase(), 2019)
    expect(resumen.objetivo).toBe(0)
    expect(resumen.pendiente).toBe(0)
  })
})

describe('redondeo', () => {
  it('no arrastra errores de coma flotante', () => {
    const datos = datosBase()
    datos.anios['2026']!.objetivos.p1!.importeMensual = 0.3
    datos.efectivo[0]!.importe = 0.1
    datos.anios['2026']!.gastos = [
      { id: 'g1', personaId: 'p1', importe: 0.2, fecha: '2026-08-03', concepto: '' },
    ]

    expect(resumenPersona(datos, 'p1', '2026-08').pendiente).toBe(0)
  })
})
