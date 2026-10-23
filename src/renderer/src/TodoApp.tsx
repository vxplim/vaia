// The popped-out to-do window: the same list, small and optionally always on top.
import { useEffect } from 'react'
import { IconPin } from './components/Icons'
import { TodoView } from './components/TodoList'
import { dispatch, useAppState } from './state'
import { themeStyle, useSystemDark } from './theme'
import { activeSpace } from '../../shared/tree'

export function TodoApp() {
  const state = useAppState()
  const systemDark = useSystemDark()
  useEffect(() => {
    document.title = 'VAIA To-do'
  }, [])
  if (!state) return null
  const theme = themeStyle(activeSpace(state).theme, systemDark)
  const onTop = state.settings.todoWindowOnTop
  return (
    <div className={`app todo-window${theme.isDark ? ' dark' : ''}`} style={theme.vars as React.CSSProperties}>
      <div className="backdrop" style={{ background: theme.background }} />
      <TodoView
        state={state}
        header={
          <div className="todo-head todo-window-head">
            <h2>To-do</h2>
            <button
              className={`icon-button todo-pin${onTop ? ' on' : ''}`}
              title={onTop ? 'Stop keeping on top' : 'Always on top'}
              onClick={() => dispatch({ type: 'settings/update', patch: { todoWindowOnTop: !onTop } })}
            >
              <IconPin />
            </button>
          </div>
        }
      />
    </div>
  )
}
