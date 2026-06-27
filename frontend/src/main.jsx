import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { DjangoAuthProvider } from '@/lib/DjangoAuthContext'
import { HashRouter } from 'react-router-dom'

ReactDOM.createRoot(document.getElementById('root')).render(
  <HashRouter>
    <DjangoAuthProvider>
      <App />
    </DjangoAuthProvider>
  </HashRouter>
)
