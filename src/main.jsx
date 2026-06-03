import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

if (localStorage.getItem('tema') === 'light') document.body.classList.add('light')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
