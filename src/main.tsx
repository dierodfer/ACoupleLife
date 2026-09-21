import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { aplicarTema, temaGuardado } from './lib/tema'
import { vigilarAtras } from './services/navegacionAtras'
import { registrarServiceWorker, vigilarInstalacion } from './services/pwa'
import { useStore, vigilarCambiosSinGuardar } from './store/useStore'
import './index.css'

// Antes del primer render, para que no se vea un destello del tema contrario.
aplicarTema(temaGuardado())
vigilarCambiosSinGuardar()

// Chrome ofrece instalar la app muy pronto (ver services/pwa.ts).
vigilarInstalacion()
registrarServiceWorker()

// El botón atrás del sistema (ver services/navegacionAtras.ts): cierra
// modales, vuelve de una subpantalla o pregunta si se quiere salir.
vigilarAtras(() => useStore.getState().atras())

const raiz = document.getElementById('root')
if (!raiz) throw new Error('Falta el nodo #root en index.html')

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
