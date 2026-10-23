// The to-do list. The same pieces make up the slide-out panel (⇧⌘K), the
// sidebar section, and the pop-out window, so all three always agree.
import { useEffect, useRef, useState, type DragEvent } from 'react'
import type { Action } from '../../../shared/api'
import { activeSpace, locate } from '../../../shared/tree'
import type { AppState, TabItem, Todo } from '../../../shared/types'
import { displayHost } from '../../../shared/url'
import { dispatch } from '../state'
import { beforeIdFor, dueLabel, dueStatus, todayKey } from '../todos'
import { Favicon } from './Favicon'
import { IconCalendar, IconCheck, IconChevron, IconGlobe, IconLink } from './Icons'

const TODO_MIME = 'application/x-vaia-todo'

type TodoPatch = Extract<Action, { type: 'todo/update' }>['patch']

/** The page on screen in the main window (what "link this page" attaches). */
export function activePage(state: AppState): TabItem | null {
  const space = activeSpace(state)
  const loc = space.activeId ? locate(state, space.activeId) : null
  if (!loc) return null
  const tab =
    loc.item.kind === 'tab'
      ? loc.item
      : loc.item.kind === 'split'
        ? (loc.item.tabs.find((t) => t.id === (loc.item as { focusedId?: string }).focusedId) ?? loc.item.tabs[0])
        : null
  return tab?.url ? tab : null
}

function tomorrowKey(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return todayKey(d)
}

/** Right-click menu for a to-do. */
async function todoMenu(state: AppState, todo: Todo, startEdit: () => void): Promise<void> {
  const page = activePage(state)
  const spaces = state.spaces.map((s) => ({
    id: `scope-${s.id}`,
    label: `${s.icon}  ${s.name}${todo.spaceId === s.id ? '  ✓' : ''}`
  }))
  const choice = await window.vaia.popupMenu([
    { id: 'edit', label: 'Edit' },
    {
      label: 'Due',
      submenu: [
        { id: 'due-today', label: 'Today' },
        { id: 'due-tomorrow', label: 'Tomorrow' },
        { id: 'due-clear', label: 'No Due Date', enabled: !!todo.due }
      ]
    },
    {
      label: 'Show In',
      submenu: [{ id: 'scope-everywhere', label: `🌐  Everywhere${todo.spaceId === null ? '  ✓' : ''}` }, ...spaces]
    },
    todo.link
      ? { id: 'unlink', label: 'Remove Linked Page' }
      : { id: 'link', label: 'Link This Page', enabled: !!page },
    { type: 'separator' },
    { id: 'delete', label: 'Delete' }
  ])
  const update = (patch: TodoPatch) => dispatch({ type: 'todo/update', id: todo.id, patch })
  if (choice === 'edit') startEdit()
  if (choice === 'due-today') update({ due: todayKey() })
  if (choice === 'due-tomorrow') update({ due: tomorrowKey() })
  if (choice === 'due-clear') update({ due: undefined })
  if (choice === 'scope-everywhere') update({ spaceId: null })
  if (choice?.startsWith('scope-') && choice !== 'scope-everywhere') update({ spaceId: choice.slice(6) })
  if (choice === 'link') dispatch({ type: 'todo/linkActive', id: todo.id })
  if (choice === 'unlink') update({ link: undefined })
  if (choice === 'delete') dispatch({ type: 'todo/delete', id: todo.id })
}

/** One to-do: a checkbox, its text, and any due date or linked page. */
export function TodoRow({ todo, state, showSpace, compact }: { todo: Todo; state: AppState; showSpace?: boolean; compact?: boolean }) {
  const [checking, setChecking] = useState(false)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(todo.text)
  const [dropAt, setDropAt] = useState<'above' | 'below' | null>(null)
  const dateInput = useRef<HTMLInputElement>(null)
  const status = dueStatus(todo)
  const space = todo.spaceId ? state.spaces.find((s) => s.id === todo.spaceId) : null

  useEffect(() => setText(todo.text), [todo.text])

  const toggle = () => {
    if (todo.done) return dispatch({ type: 'todo/update', id: todo.id, patch: { done: false } })
    // Let the check mark show and the row fade before it moves to "Done".
    setChecking(true)
    setTimeout(() => dispatch({ type: 'todo/update', id: todo.id, patch: { done: true } }), 420)
  }
  const commit = () => {
    setEditing(false)
    if (text.trim() && text !== todo.text) dispatch({ type: 'todo/update', id: todo.id, patch: { text } })
    else setText(todo.text)
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(TODO_MIME)) return
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    const at = e.clientY > r.top + r.height / 2 ? 'below' : 'above'
    if (at !== dropAt) setDropAt(at)
  }

  return (
    <div
      className={`todo-row${todo.done ? ' done' : ''}${checking ? ' checking' : ''}${compact ? ' compact' : ''}${dropAt ? ` drop-${dropAt}` : ''}`}
      draggable={!editing}
      onDragStart={(e) => {
        e.dataTransfer.setData(TODO_MIME, todo.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={onDragOver}
      onDragLeave={() => setDropAt(null)}
      onDrop={(e) => {
        const id = e.dataTransfer.getData(TODO_MIME)
        setDropAt(null)
        if (!id || id === todo.id) return
        e.preventDefault()
        dispatch({ type: 'todo/move', id, beforeId: beforeIdFor(state, todo.id, dropAt === 'below') })
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        todoMenu(state, todo, () => setEditing(true))
      }}
    >
      <button
        className={`todo-check${todo.done || checking ? ' checked' : ''}`}
        title={todo.done ? 'Mark as not done' : 'Mark as done'}
        onClick={toggle}
      >
        {(todo.done || checking) && <IconCheck />}
      </button>
      <div className="todo-body">
        {editing ? (
          <input
            className="todo-edit"
            value={text}
            autoFocus
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') {
                setText(todo.text)
                setEditing(false)
              }
            }}
          />
        ) : (
          <span
            className={`todo-text${todo.link ? ' linked' : ''}`}
            title={todo.link ? `Open ${todo.link.title}` : 'Double-click to edit'}
            onClick={() => todo.link && dispatch({ type: 'todo/open', id: todo.id })}
            onDoubleClick={() => setEditing(true)}
          >
            {todo.text}
          </span>
        )}
        {(todo.due || todo.link || showSpace) && !compact && (
          <div className="todo-meta">
            {showSpace && (
              <span className="todo-space" title={space ? space.name : 'Everywhere'}>
                {space ? space.icon : <IconGlobe width={11} height={11} />}
              </span>
            )}
            {todo.due && (
              <span className={`todo-due ${status ?? ''}`} title={todo.due}>
                {dueLabel(todo)}
              </span>
            )}
            {todo.link && (
              <button className="todo-link" title={todo.link.url} onClick={() => dispatch({ type: 'todo/open', id: todo.id })}>
                <Favicon url={todo.link.url} />
                <span>{todo.link.title || displayHost(todo.link.url)}</span>
              </button>
            )}
          </div>
        )}
      </div>
      {compact && todo.due && <span className={`todo-due ${status ?? ''}`}>{dueLabel(todo)}</span>}
      {!compact && !todo.done && (
        <span className="todo-actions">
          <button className="tab-action" title="Due date" onClick={() => dateInput.current?.showPicker()}>
            <IconCalendar />
          </button>
          <input
            ref={dateInput}
            className="todo-date-input"
            type="date"
            tabIndex={-1}
            value={todo.due ?? ''}
            onChange={(e) => dispatch({ type: 'todo/update', id: todo.id, patch: { due: e.target.value || undefined } })}
          />
        </span>
      )}
    </div>
  )
}

/** "Add a to-do…" with options for where it shows, a due date, and linking the current page. */
export function TodoAdd({ state, spaceId }: { state: AppState; spaceId: string }) {
  const [text, setText] = useState('')
  const [everywhere, setEverywhere] = useState(false)
  const [due, setDue] = useState('')
  const [link, setLink] = useState(false)
  const dateInput = useRef<HTMLInputElement>(null)
  const page = activePage(state)
  const space = state.spaces.find((s) => s.id === spaceId)

  const add = () => {
    if (!text.trim()) return
    dispatch({
      type: 'todo/add',
      text,
      spaceId: everywhere ? null : spaceId,
      due: due || undefined,
      linkTabId: link && page ? page.id : undefined
    })
    setText('')
    setDue('')
    setLink(false)
  }

  return (
    <div className="todo-add">
      <input
        className="todo-add-input"
        placeholder="Add a to-do…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
      />
      <div className="todo-add-options">
        <button
          className={`todo-chip${everywhere ? ' on' : ''}`}
          title={everywhere ? 'Shows in every Space' : `Only in ${space?.name ?? 'this Space'}`}
          onClick={() => setEverywhere(!everywhere)}
        >
          {everywhere ? (
            <>
              <IconGlobe width={12} height={12} /> Everywhere
            </>
          ) : (
            <>
              {space?.icon} This Space
            </>
          )}
        </button>
        <button className={`todo-chip${due ? ' on' : ''}`} onClick={() => dateInput.current?.showPicker()}>
          <IconCalendar width={12} height={12} />
          {due ? dueLabel({ due, done: false } as Todo) : 'Due'}
        </button>
        <input
          ref={dateInput}
          className="todo-date-input"
          type="date"
          tabIndex={-1}
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
        <button
          className={`todo-chip${link ? ' on' : ''}`}
          disabled={!page}
          title={page ? `Link “${page.name || page.title}”` : 'Open a page to link it'}
          onClick={() => setLink(!link)}
        >
          <IconLink width={12} height={12} /> Link this page
        </button>
      </div>
    </div>
  )
}

/** Open to-dos, then a collapsed "Done" section. */
export function TodoItems({ state, todos, showSpace }: { state: AppState; todos: Todo[]; showSpace?: boolean }) {
  const [showDone, setShowDone] = useState(false)
  const open = todos.filter((t) => !t.done)
  const done = todos.filter((t) => t.done)
  return (
    <div className="todo-items">
      {open.length === 0 && <div className="list-empty small">Nothing to do. Enjoy the calm.</div>}
      {open.map((t) => (
        <TodoRow key={t.id} todo={t} state={state} showSpace={showSpace} />
      ))}
      {done.length > 0 && (
        <div className="todo-done">
          <div className="todo-done-head">
            <button className="todo-done-toggle" onClick={() => setShowDone(!showDone)}>
              <IconChevron className={`folder-chevron${showDone ? ' open' : ''}`} />
              Done ({done.length})
            </button>
            {showDone && (
              <button className="text-button small" onClick={() => dispatch({ type: 'todo/clearDone' })}>
                Clear
              </button>
            )}
          </div>
          {showDone && (
            <>
              {done.map((t) => (
                <TodoRow key={t.id} todo={t} state={state} showSpace={showSpace} />
              ))}
              <div className="todo-done-note">Checked items are deleted after 7 days.</div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** "This Space" / "All" switch plus the list (used by the panel and the window). */
export function TodoView({ state, header }: { state: AppState; header?: React.ReactNode }) {
  const [tab, setTab] = useState<'space' | 'all'>('space')
  const space = activeSpace(state)
  const todos = tab === 'space' ? state.todos.filter((t) => t.spaceId === space.id || t.spaceId === null) : state.todos
  return (
    <div className="todo-view">
      {header}
      <div className="segmented todo-tabs">
        <button className={tab === 'space' ? 'selected' : ''} onClick={() => setTab('space')}>
          {space.icon} This Space
        </button>
        <button className={tab === 'all' ? 'selected' : ''} onClick={() => setTab('all')}>
          All
        </button>
      </div>
      <TodoAdd state={state} spaceId={space.id} />
      <div className="todo-scroll">
        <TodoItems state={state} todos={todos} showSpace={tab === 'all'} />
      </div>
    </div>
  )
}
