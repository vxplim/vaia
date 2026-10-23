import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { LittleApp } from './LittleApp'
import './styles.css'

// The same UI code powers the main window and Little windows (?view=little&id=…).
const params = new URLSearchParams(location.search)
const view = params.get('view')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{view === 'little' ? <LittleApp tabId={params.get('id') ?? ''} /> : <App />}</StrictMode>
)
