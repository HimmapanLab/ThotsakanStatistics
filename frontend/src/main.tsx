import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { DrawerProvider } from './context/DrawerContext'
import LoginGate from './components/LoginGate'
import { trackInput } from './lib/haptics'
import './style.css'

// Haptics need to know whether the last input was a touch (lib/haptics.ts).
trackInput()

createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <AuthProvider>
      <LoginGate>
        <DataProvider>
          <DrawerProvider>
            <App />
          </DrawerProvider>
        </DataProvider>
      </LoginGate>
    </AuthProvider>
  </React.StrictMode>,
)
