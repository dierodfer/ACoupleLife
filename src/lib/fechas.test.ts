import { describe, expect, it } from 'vitest'
import { mesActual, mesPorDefecto } from './fechas'

describe('mesPorDefecto', () => {
  it('antes del día 7 muestra el mes en curso', () => {
    const dia6 = new Date(2026, 7, 6) // 6 de agosto de 2026
    expect(mesPorDefecto(dia6)).toBe(mesActual(dia6))
    expect(mesPorDefecto(dia6)).toBe('2026-08')
  })

  it('a partir del día 7 muestra ya el mes siguiente', () => {
    const dia7 = new Date(2026, 7, 7) // 7 de agosto de 2026
    expect(mesPorDefecto(dia7)).toBe('2026-09')

    const finDeMes = new Date(2026, 7, 31)
    expect(mesPorDefecto(finDeMes)).toBe('2026-09')
  })

  it('salta de año cuando el mes siguiente es enero', () => {
    const dia20Diciembre = new Date(2026, 11, 20)
    expect(mesPorDefecto(dia20Diciembre)).toBe('2027-01')
  })
})
