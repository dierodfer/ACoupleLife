// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { ErrorDrive, numeroDeProyecto } from './drive'

/**
 * El selector de Google necesita el número de proyecto (`setAppId`) para
 * conceder acceso a un archivo que el usuario no ha creado: sin él la segunda
 * persona puede elegir el archivo compartido, pero Drive responde 404 al
 * leerlo. Se deduce del client ID, así que conviene fijar esa forma.
 */
describe('número de proyecto', () => {
  it('lo saca del prefijo del client ID', () => {
    expect(numeroDeProyecto('123456789012-abcdef.apps.googleusercontent.com')).toBe('123456789012')
  })

  it('avisa en vez de seguir si el client ID no tiene esa forma', () => {
    // Antes esto no se notaba hasta el 404, ya con el archivo elegido.
    expect(() => numeroDeProyecto('sin-numero.apps.googleusercontent.com')).toThrow(ErrorDrive)
    expect(() => numeroDeProyecto(undefined)).toThrow(ErrorDrive)
    expect(() => numeroDeProyecto('')).toThrow(ErrorDrive)
  })
})
