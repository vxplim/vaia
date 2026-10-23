// The contract between the UI and the brain: every request the UI can make.
import type { AppState, Pane, Settings, UiCommand } from './types'

export type Action =
  | { type: 'tab/new'; url?: string }
  | { type: 'tab/activate'; id: string }
  | { type: 'tab/close'; id: string }
  | { type: 'tab/navigate'; id: string; input: string }
  | { type: 'tab/back'; id: string }
  | { type: 'tab/forward'; id: string }
  | { type: 'tab/reload'; id: string }
  | { type: 'tab/stop'; id: string }
  | { type: 'settings/update'; patch: Partial<Settings> }

/** What the UI sees as window.vaia (provided by the preload bridge). */
export interface VaiaApi {
  platform: string
  getState(): Promise<AppState>
  onState(listener: (state: AppState) => void): () => void
  dispatch(action: Action): Promise<unknown>
  setPanes(panes: Pane[]): void
  onCommand(listener: (command: UiCommand) => void): () => void
}
