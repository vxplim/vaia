import type { AppState, Space } from '../../../shared/types'
import { dispatch } from '../state'
import { todosForSpace } from '../todos'
import { IconChevron } from './Icons'
import { TodoRow } from './TodoList'

/** This Space's open to-dos, under Pinned in the sidebar (can be turned off in Settings). */
export function TodoSection({ state, space, onOpen }: { state: AppState; space: Space; onOpen: () => void }) {
  const open = todosForSpace(state, space.id).filter((t) => !t.done)
  if (!state.settings.todoInSidebar || open.length === 0) return null
  const collapsed = state.settings.todoSectionCollapsed
  return (
    <section className="todo-section">
      <div className="todo-section-head">
        <button
          className="todo-section-toggle"
          onClick={() => dispatch({ type: 'settings/update', patch: { todoSectionCollapsed: !collapsed } })}
        >
          <IconChevron className={`folder-chevron${collapsed ? '' : ' open'}`} />
          To-do
          <span className="todo-count">{open.length}</span>
        </button>
        <button className="clear-button" title="Open the full list (⇧⌘K)" onClick={onOpen}>
          All
        </button>
      </div>
      {!collapsed && open.map((t) => <TodoRow key={t.id} todo={t} state={state} compact />)}
    </section>
  )
}
