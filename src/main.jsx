import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

if (localStorage.getItem('tema') === 'light') document.body.classList.add('light')

// El registro automático que inyecta vite-plugin-pwa solo chequea actualizaciones
// una vez al cargar. Alguien que deja la app abierta varios días (típico en la PWA
// instalada de Android) puede quedar atascado en un bundle viejo sin enterarse.
// Acá forzamos un chequeo cada 1h y cada vez que la app vuelve a primer plano,
// para que ningún usuario quede desactualizado por mucho tiempo.
const updateSW = registerSW({ immediate: true })
setInterval(() => updateSW(), 60 * 60 * 1000)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') updateSW()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
