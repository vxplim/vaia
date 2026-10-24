import type { CSSProperties } from 'react'
import type { AppState } from '../../../shared/types'
import { dispatch } from '../state'
import { IconClose, IconPopout } from './Icons'
import { TodoView } from './TodoList'

/** The to-do list sliding out next to the sidebar (⇧⌘K or the ✓ button). */
export function TodoPanel({ state, closing, onClose, place }: { state: AppState; closing: boolean; onClose: () => void; place: CSSProperties }) {
  return (
    <div className={`overlay-layer light${closing ? ' closing' : ''}`} onMouseDown={onClose}>
      <div
        className="panel todo-drawer"
        style={place}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <TodoView
          state={state}
          header={
            <div className="todo-head">
              <h2>To-do</h2>
              <button
                className="icon-button"
                title="Pop out into a small window"
                onClick={() => {
                  onClose()
                  dispatch({ type: 'todo/popout' })
                }}
              >
                <IconPopout />
              </button>
              <button className="icon-button" title="Close (Esc)" onClick={onClose}>
                <IconClose />
              </button>
            </div>
          }
        />
      </div>
    </div>
  )
}
