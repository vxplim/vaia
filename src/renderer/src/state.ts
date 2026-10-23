// Keeps the UI's copy of the app data in sync with the brain (main process).
// Components call useAppState() and re-render whenever the data changes.
import { useSyncExternalStore } from 'react'
import type { Action } from '../../shared/api'
import type { AppState } from '../../shared/types'

let current: AppState | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

window.vaia.onState((state) => {
  current = state
  emit()
})
window.vaia.getState().then((state) => {
  if (!current) {
    current = state
    emit()
  }
})

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAppState(): AppState | null {
  return useSyncExternalStore(subscribe, () => current)
}

export function getAppState(): AppState | null {
  return current
}

export function dispatch(action: Action): Promise<unknown> {
  return window.vaia.dispatch(action)
}
