import { create } from 'zustand'
import { mesActual } from '../lib/fechas'
import { datosIniciales, nuevoId } from '../lib/esquema'
import { sellar, vincularEmailPersona } from '../lib/mutaciones'
import { aplicarTema, temaGuardado, type Tema } from '../lib/tema'
import type { Datos, MesKey, PersonaId } from '../lib/tipos'
import type { Usuario } from '../services/auth'
import { auth, drive } from '../services/backend'

const CLAVE_ARCHIVO = 'acouplelife.fileId'
const RETARDO_AUTOGUARDADO = 2000

/**
 * Esperas entre reintentos cuando Drive falla por red. Crecen para no machacar
 * una conexión que ya va mal; a partir de la última se repite esa.
 */
export const ESPERAS_REINTENTO = [5000, 15000, 45000]

export type EstadoApp =
  | 'arrancando'
  | 'sinSesion'
  | 'sinArchivo'
  | 'cargando'
  | 'listo'
  | 'guardando'
  | 'conflicto'

/**
 * Pantalla visible. Vive en el store para poder saltar de una a otra desde
 * cualquier sitio. `objetivos` es una subpantalla: no tiene botón propio en la
 * barra inferior y se llega a ella desde Ajustes o desde el resumen mensual.
 */
export type Pestana = 'mes' | 'anio' | 'ajustes' | 'objetivos'

export const ETIQUETAS_PESTANA: Record<Pestana, string> = {
  mes: 'Mes',
  anio: 'Año',
  ajustes: 'Ajustes',
  objetivos: 'Objetivo',
}

interface Estado {
  estado: EstadoApp
  usuario: Usuario | null
  fileId: string | null
  version: string | null
  datos: Datos | null
  mes: MesKey
  pestana: Pestana
  /** Pantallas por las que se ha pasado, para que «atrás» vuelva a la correcta. */
  historial: Pestana[]
  /**
   * Modal de alta/edición de gasto (puntual o recurrente). Vive aquí porque se
   * abre tanto desde la pantalla principal como desde Ajustes: es el mismo
   * modal, montado una sola vez en `App.tsx`.
   */
  modalGasto: { abierto: boolean; editandoId: string | null; tipoInicial: 'puntual' | 'recurrente' }
  /**
   * Persona preseleccionada al dar de alta un gasto, transferencia o efectivo,
   * para no tener que cambiar el desplegable cada vez. Solo afecta al valor
   * inicial de altas nuevas; editar algo existente sigue respetando a quién
   * pertenece ya.
   */
  personaActiva: PersonaId | null
  /** Claro u oscuro. Preferencia del dispositivo, no del archivo compartido. */
  tema: Tema
  sinGuardar: boolean
  /** Fallos de red seguidos al guardar. Marca el escalón de espera del reintento. */
  fallosSeguidos: number
  error: string | null

  arrancar: () => Promise<void>
  entrar: () => Promise<void>
  salir: () => void
  crearArchivo: () => Promise<void>
  conectarArchivo: () => Promise<void>
  recargar: () => Promise<void>
  /** Programa el autoguardado tras aplicar la mutación. */
  aplicar: (mutacion: (datos: Datos) => Datos) => void
  guardar: () => Promise<void>
  /** Ante un conflicto: traer la versión de Drive descartando los cambios locales. */
  descartarYRecargar: () => Promise<void>
  /** Ante un conflicto: escribir encima de lo que haya en Drive. */
  sobrescribir: () => Promise<void>
  irAMes: (mes: MesKey) => void
  /** Barra inferior: navegación de primer nivel, descarta el historial. */
  irAPestana: (pestana: Pestana) => void
  /** Navegación desde dentro de una pantalla: deja rastro para poder volver. */
  abrirPestana: (pestana: Pestana) => void
  /** Al Mes si no queda rastro en el historial. */
  volver: () => void
  /** Salto atómico a un mes, sin dejar entrada en el historial de pantallas. */
  verMes: (mes: MesKey) => void
  /** Abre el modal de gasto. Sin opciones: alta de gasto puntual. */
  abrirModalGasto: (opciones?: { editandoId?: string; tipoInicial?: 'puntual' | 'recurrente' }) => void
  cerrarModalGasto: () => void
  setPersonaActiva: (personaId: PersonaId) => void
  setTema: (tema: Tema) => void
  limpiarError: () => void
}

const MODAL_GASTO_CERRADO = {
  abierto: false,
  editandoId: null,
  tipoInicial: 'puntual',
} as const

let temporizador: ReturnType<typeof setTimeout> | null = null

function cancelarGuardado() {
  if (temporizador) clearTimeout(temporizador)
  temporizador = null
}

function mensaje(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const useStore = create<Estado>((set, get) => {
  function programarGuardado(espera: number) {
    cancelarGuardado()
    temporizador = setTimeout(() => {
      temporizador = null
      void get().guardar()
    }, espera)
  }

  function programarAutoguardado() {
    programarGuardado(RETARDO_AUTOGUARDADO)
  }

  /** Espera creciente tras un fallo de red, hasta el último escalón. */
  function programarReintento() {
    const fallos = get().fallosSeguidos
    const i = Math.min(fallos, ESPERAS_REINTENTO.length - 1)
    set({ fallosSeguidos: fallos + 1 })
    programarGuardado(ESPERAS_REINTENTO[i] ?? RETARDO_AUTOGUARDADO)
  }

  return {
    estado: 'arrancando',
    usuario: null,
    fileId: localStorage.getItem(CLAVE_ARCHIVO),
    version: null,
    datos: null,
    mes: mesActual(),
    pestana: 'mes',
    historial: [],
    modalGasto: MODAL_GASTO_CERRADO,
    personaActiva: null,
    tema: temaGuardado(),
    sinGuardar: false,
    fallosSeguidos: 0,
    error: null,

    async arrancar() {
      const usuario = await auth.reanudarSesion()
      if (!usuario) {
        set({ estado: 'sinSesion' })
        return
      }
      set({ usuario })

      if (get().fileId) await get().recargar()
      else set({ estado: 'sinArchivo' })
    },

    async entrar() {
      try {
        set({ error: null })
        const usuario = await auth.entrar()
        set({ usuario })
        if (get().fileId) await get().recargar()
        else set({ estado: 'sinArchivo' })
      } catch (error) {
        set({ estado: 'sinSesion', error: mensaje(error) })
      }
    },

    salir() {
      cancelarGuardado()
      auth.salir()
      localStorage.removeItem(CLAVE_ARCHIVO)
      set({
        estado: 'sinSesion',
        usuario: null,
        fileId: null,
        version: null,
        datos: null,
        sinGuardar: false,
        fallosSeguidos: 0,
      })
    },

    async crearArchivo() {
      const usuario = get().usuario
      if (!usuario) return

      try {
        set({ estado: 'cargando', error: null })
        const datos = datosIniciales({
          id: nuevoId('p'),
          nombre: usuario.nombre.split(' ')[0] ?? usuario.nombre,
          email: usuario.email,
        })
        const archivo = await drive.crearArchivo(datos)
        localStorage.setItem(CLAVE_ARCHIVO, archivo.id)
        set({
          estado: 'listo',
          datos,
          fileId: archivo.id,
          version: archivo.version,
          sinGuardar: false,
        })
      } catch (error) {
        set({ estado: 'sinArchivo', error: mensaje(error) })
      }
    },

    async conectarArchivo() {
      try {
        set({ error: null })
        const fileId = await drive.elegirArchivo()
        if (!fileId) return
        localStorage.setItem(CLAVE_ARCHIVO, fileId)
        set({ fileId })
        await get().recargar()
      } catch (error) {
        set({ estado: 'sinArchivo', error: mensaje(error) })
      }
    },

    async recargar() {
      const fileId = get().fileId
      if (!fileId) {
        set({ estado: 'sinArchivo' })
        return
      }

      // Lo que venga de Drive sustituye a lo local: un guardado pendiente ya no
      // aplica, y en «descartar mis cambios» volvería a subir lo descartado.
      cancelarGuardado()

      try {
        set({ estado: 'cargando', error: null })
        const { datos, archivo } = await drive.descargar(fileId)
        // Primera vez que esta cuenta abre el archivo: vincula su email.
        const usuario = get().usuario
        const vinculados = usuario ? vincularEmailPersona(datos, usuario.email) : datos
        set({ estado: 'listo', datos: vinculados, version: archivo.version, sinGuardar: false })
        if (vinculados !== datos) void get().guardar()
      } catch (error) {
        // Un archivo borrado o sin permiso deja de servir: se vuelve al onboarding.
        localStorage.removeItem(CLAVE_ARCHIVO)
        set({ estado: 'sinArchivo', fileId: null, datos: null, error: mensaje(error) })
      }
    },

    aplicar(mutacion) {
      const datos = get().datos
      if (!datos) return
      set({ datos: mutacion(datos), sinGuardar: true })
      programarAutoguardado()
    },

    async guardar() {
      const { datos, fileId, version, usuario, estado } = get()
      if (!datos || !fileId || !version) return

      // Ya hay una subida en marcha. Volver a intentarlo ahora escribiría con
      // una `version` que está a punto de quedar obsoleta, así que se reprograma:
      // salir sin más dejaría este cambio sin guardar hasta la siguiente edición.
      if (estado === 'guardando') {
        programarAutoguardado()
        return
      }

      cancelarGuardado()

      const sellados = sellar(datos, usuario?.email ?? '')
      try {
        set({ estado: 'guardando', error: null, datos: sellados })
        const archivo = await drive.guardar(fileId, sellados, version)

        // Si se editó durante la subida, lo que hay en memoria ya no es lo que
        // se subió: siguen quedando cambios pendientes, por mucho que Drive
        // haya respondido que sí.
        const pendientes = get().datos !== sellados
        set({
          estado: 'listo',
          version: archivo.version,
          sinGuardar: pendientes,
          fallosSeguidos: 0,
        })
        if (pendientes) programarAutoguardado()
      } catch (error) {
        // Un conflicto no se reintenta solo: lo resuelve la persona.
        if (error instanceof drive.ConflictoDrive) {
          set({ estado: 'conflicto', error: error.message })
          return
        }
        set({ estado: 'listo', error: mensaje(error) })
        programarReintento()
      }
    },

    async descartarYRecargar() {
      await get().recargar()
    },

    async sobrescribir() {
      const { datos, fileId } = get()
      if (!datos || !fileId) return

      try {
        set({ estado: 'guardando', error: null })
        // Releemos la versión remota para escribir encima de ella a propósito.
        const remoto = await drive.metadatos(fileId)
        const archivo = await drive.guardar(fileId, datos, remoto.version)
        set({ estado: 'listo', version: archivo.version, sinGuardar: false })
      } catch (error) {
        set({ estado: 'conflicto', error: mensaje(error) })
      }
    },

    irAMes(mes) {
      set({ mes })
    },

    irAPestana(pestana) {
      set({ pestana, historial: [] })
    },

    abrirPestana(pestana) {
      const actual = get().pestana
      if (actual === pestana) return
      set({ pestana, historial: [...get().historial, actual] })
    },

    volver() {
      const historial = [...get().historial]
      set({ pestana: historial.pop() ?? 'mes', historial })
    },

    verMes(mes) {
      set({ mes, pestana: 'mes', historial: [] })
    },

    abrirModalGasto(opciones) {
      set({
        modalGasto: {
          abierto: true,
          editandoId: opciones?.editandoId ?? null,
          tipoInicial: opciones?.editandoId ? 'recurrente' : (opciones?.tipoInicial ?? 'puntual'),
        },
      })
    },

    cerrarModalGasto() {
      set({ modalGasto: MODAL_GASTO_CERRADO })
    },

    setPersonaActiva(personaId) {
      set({ personaActiva: personaId })
    },

    setTema(tema) {
      aplicarTema(tema)
      set({ tema })
    },

    limpiarError() {
      set({ error: null })
    },
  }
})

export function vigilarCambiosSinGuardar() {
  window.addEventListener('beforeunload', (evento) => {
    // `preventDefault()` basta desde hace años; `returnValue` está obsoleto.
    if (useStore.getState().sinGuardar) evento.preventDefault()
  })
}
