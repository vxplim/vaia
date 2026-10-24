// The "preload" bridge: the ONLY way the UI can ask the main process to do
// things. We expose a small, typed list of allowed functions as window.vaia.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { injectBrowserAction } from 'electron-chrome-extensions/browser-action'
import type { VaiaApi } from '../shared/api'
import type { AppState, UiCommand } from '../shared/types'

function listen<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, value: T) => listener(value)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: VaiaApi = {
  platform: process.platform,
  getState: () => ipcRenderer.invoke('state:get'),
  onState: (listener) => listen<AppState>('state:changed', listener),
  dispatch: (action) => ipcRenderer.invoke('action', action),
  setPanes: (panes) => ipcRenderer.send('panes:set', panes),
  setPeekRect: (rect) => ipcRenderer.send('peek:rect', rect),
  capture: (tabIds) => ipcRenderer.invoke('capture', tabIds),
  suggest: (query) => ipcRenderer.invoke('suggest', query),
  searchHistory: (query) => ipcRenderer.invoke('history:search', query),
  listArchive: (query) => ipcRenderer.invoke('archive:list', query),
  listHistory: (query) => ipcRenderer.invoke('history:list', query),
  setTrafficLights: (visible) => ipcRenderer.send('window:traffic-lights', visible),
  popupMenu: (items) => ipcRenderer.invoke('menu:popup', items),
  onCommand: (listener) => listen<UiCommand>('ui:command', listener)
}

contextBridge.exposeInMainWorld('vaia', api)

// The main window shows extension buttons (<browser-action-list>) in the sidebar.
const search = (globalThis as { location?: { search: string } }).location?.search ?? ''
if (!new URLSearchParams(search).get('view')) injectBrowserAction()
