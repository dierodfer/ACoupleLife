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

/** Nombre de cada pantalla, para rotular el botón de volver. */
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
  error: string | null

  arrancar: () => Promise<void>
  entrar: () => Promise<void>
  salir: () => void
  crearArchivo: () => Promise<void>
  conectarArchivo: () => Promise<void>
  recargar: () => Promise<void>
  /** Aplica una mutación pura sobre los datos y programa el autoguardado. */
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
  /** Vuelve a la pantalla desde la que se llegó (al Mes si no hay rastro). */
  volver: () => void
  /** Salta al mes indicado y muestra la pantalla del mes, en un solo paso. */
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

function mensaje(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const useStore = create<Estado>((set, get) => {
  function programarAutoguardado() {
    if (temporizador) clearTimeout(temporizador)
    temporizador = setTimeout(() => {
      void get().guardar()
    }, RETARDO_AUTOGUARDADO)
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
      auth.salir()
      localStorage.removeItem(CLAVE_ARCHIVO)
      set({
        estado: 'sinSesion',
        usuario: null,
        fileId: null,
        version: null,
        datos: null,
        sinGuardar: false,
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

      try {
        set({ estado: 'cargando', error: null })
        const { datos, archivo } = await drive.descargar(fileId)
        // Primera vez que esta cuenta de Google abre el archivo: se vincula su
        // email a la primera persona que todavía no tenga uno.
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
      if (!datos || !fileId || !version || estado === 'guardando') return

      if (temporizador) {
        clearTimeout(temporizador)
        temporizador = null
      }

      const sellados = sellar(datos, usuario?.email ?? '')
      try {
        set({ estado: 'guardando', error: null, datos: sellados })
        const archivo = await drive.guardar(fileId, sellados, version)
        set({ estado: 'listo', version: archivo.version, sinGuardar: false })
      } catch (error) {
        if (error instanceof drive.ConflictoDrive) {
          set({ estado: 'conflicto', error: error.message })
          return
        }
        set({ estado: 'listo', error: mensaje(error) })
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

/** Aviso del navegador si se cierra la pestaña con cambios sin subir a Drive. */
export function vigilarCambiosSinGuardar() {
  window.addEventListener('beforeunload', (evento) => {
    if (useStore.getState().sinGuardar) {
      evento.preventDefault()
      evento.returnValue = ''
    }
  })
}
