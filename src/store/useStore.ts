import { create } from 'zustand'
import { mesActual } from '../lib/fechas'
import { datosIniciales, nuevoId } from '../lib/esquema'
import { sellar } from '../lib/mutaciones'
import type { Datos, MesKey } from '../lib/tipos'
import * as auth from '../services/auth'
import * as drive from '../services/drive'

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

interface Estado {
  estado: EstadoApp
  usuario: auth.Usuario | null
  fileId: string | null
  version: string | null
  datos: Datos | null
  mes: MesKey
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
  limpiarError: () => void
}

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
        set({ estado: 'listo', datos, version: archivo.version, sinGuardar: false })
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
