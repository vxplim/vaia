/// <reference types="vite/client" />
import type { VaiaApi } from '../../shared/api'

declare global {
  interface Window {
    vaia: VaiaApi
  }
}
