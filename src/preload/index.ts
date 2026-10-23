// The "preload" bridge: the ONLY way the UI can ask the main process to do
// things. We expose a small, typed list of allowed functions as window.vaia.
import { contextBridge } from 'electron'
import type { VaiaApi } from './api'

const api: VaiaApi = {
  platform: process.platform
}

contextBridge.exposeInMainWorld('vaia', api)
