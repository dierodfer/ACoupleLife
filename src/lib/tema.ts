export type Tema = 'claro' | 'oscuro'

const CLAVE = 'acouplelife.tema'

/**
 * El tema es una preferencia del dispositivo, no del archivo compartido: cada
 * miembro de la pareja puede tenerlo distinto sin pisarle el ajuste al otro.
 * Por eso vive en `localStorage` y no en el JSON de Drive.
 */
export function temaGuardado(): Tema {
  return localStorage.getItem(CLAVE) === 'oscuro' ? 'oscuro' : 'claro'
}

/** Marca el tema en el `<html>`, que es de donde cuelgan los tokens de color. */
export function aplicarTema(tema: Tema): void {
  document.documentElement.dataset.tema = tema
  // Alinea los controles nativos (teclado, selectores de fecha, barras de scroll).
  document.documentElement.style.colorScheme = tema === 'oscuro' ? 'dark' : 'light'
  localStorage.setItem(CLAVE, tema)
}
