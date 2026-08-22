import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { aplicarTema, temaGuardado } from './lib/tema'
import { vigilarCambiosSinGuardar } from './store/useStore'
import './index.css'

// Antes del primer render, para que no se vea un destello del tema contrario.
aplicarTema(temaGuardado())
vigilarCambiosSinGuardar()

const raiz = document.getElementById('root')
if (!raiz) throw new Error('Falta el nodo #root en index.html')

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
