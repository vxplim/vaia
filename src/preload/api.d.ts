// The shape of window.vaia, shared by the preload bridge and the UI.
export interface VaiaApi {
  platform: string
}

declare global {
  interface Window {
    vaia: VaiaApi
  }
}
