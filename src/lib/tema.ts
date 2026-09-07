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

/**
 * El `--color-fondo` de cada tema, en hexadecimal. Instalada como app en
 * Android, la barra de estado se pinta de este color, y ahí no valen ni las
 * variables CSS ni `oklch()`: el navegador lee el `<meta name="theme-color">`.
 */
const FONDO: Record<Tema, string> = { claro: '#f1f1f3', oscuro: '#000000' }

/** Marca el tema en el `<html>`, que es de donde cuelgan los tokens de color. */
export function aplicarTema(tema: Tema): void {
  document.documentElement.dataset.tema = tema
  // Alinea los controles nativos (teclado, selectores de fecha, barras de scroll).
  document.documentElement.style.colorScheme = tema === 'oscuro' ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', FONDO[tema])
  localStorage.setItem(CLAVE, tema)
}
