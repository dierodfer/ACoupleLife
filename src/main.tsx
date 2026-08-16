import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { vigilarCambiosSinGuardar } from './store/useStore'
import './index.css'

vigilarCambiosSinGuardar()

const raiz = document.getElementById('root')
if (!raiz) throw new Error('Falta el nodo #root en index.html')

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
