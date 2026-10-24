import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { LittleApp } from './LittleApp'
import { MiniApp } from './MiniApp'
import { SettingsApp } from './SettingsApp'
import { TodoApp } from './TodoApp'
import './styles.css'

// The same UI code powers every VAIA window: ?view=little&id=…, ?view=settings, ?view=todo and
// ?view=mini (the Mini Player).
const params = new URLSearchParams(location.search)
const view = params.get('view')

function Root() {
  if (view === 'little') return <LittleApp tabId={params.get('id') ?? ''} />
  if (view === 'settings') return <SettingsApp />
  if (view === 'todo') return <TodoApp />
  if (view === 'mini') return <MiniApp />
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
