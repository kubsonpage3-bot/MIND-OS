import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import '@/lib/i18n'
import { DjangoAuthProvider } from '@/lib/DjangoAuthContext'
import ServerWakeupWrapper from '@/components/ui/ServerWakeupWrapper'
import { HashRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { CapacitorUpdater } from '@capgo/capacitor-updater'

// Tell Capgo the app loaded successfully, prevents automatic rollback
CapacitorUpdater.notifyAppReady();

ReactDOM.createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClientInstance}>
    <HashRouter>
      <ServerWakeupWrapper>
        <DjangoAuthProvider>
          <App />
        </DjangoAuthProvider>
      </ServerWakeupWrapper>
    </HashRouter>
  </QueryClientProvider>
)
