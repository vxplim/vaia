import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { LittleApp } from './LittleApp'
import { SettingsApp } from './SettingsApp'
import './styles.css'

// The same UI code powers every VAIA window: ?view=little&id=… and ?view=settings.
const params = new URLSearchParams(location.search)
const view = params.get('view')

function Root() {
  if (view === 'little') return <LittleApp tabId={params.get('id') ?? ''} />
  if (view === 'settings') return <SettingsApp />
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
