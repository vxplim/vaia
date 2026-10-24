/// <reference types="vite/client" />
import type { VaiaApi } from '../../shared/api'

declare global {
  interface Window {
    vaia: VaiaApi
  }
}

// The extensions toolbar is a custom element provided by electron-chrome-extensions.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'browser-action-list': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        partition?: string
        alignment?: string
      }
    }
  }
}
