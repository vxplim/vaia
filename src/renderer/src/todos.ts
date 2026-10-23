// Small helpers for the to-do list (shared by the panel, sidebar section and window).
import type { AppState, Todo } from '../../shared/types'

/** Today's date as "YYYY-MM-DD" in your time zone. */
export function todayKey(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export type DueStatus = 'overdue' | 'today' | 'later'

export function dueStatus(todo: Todo): DueStatus | null {
  if (!todo.due || todo.done) return null
  const today = todayKey()
  return todo.due < today ? 'overdue' : todo.due === today ? 'today' : 'later'
}

/** "Today", "Overdue", "Tomorrow", or a short date like "Mon, Oct 27". */
export function dueLabel(todo: Todo): string {
  const status = dueStatus(todo)
  if (status === 'overdue') return 'Overdue'
  if (status === 'today') return 'Today'
  if (!todo.due) return ''
  const [y, m, d] = todo.due.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (todayKey(tomorrow) === todo.due) return 'Tomorrow'
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

/** The to-dos for a Space: its own plus the "Everywhere" ones. */
export function todosForSpace(state: AppState, spaceId: string): Todo[] {
  return state.todos.filter((t) => t.spaceId === spaceId || t.spaceId === null)
}

/** How many open to-dos are due today or overdue (shown on the ✓ button). */
export function dueCount(state: AppState): number {
  return state.todos.filter((t) => {
    const s = dueStatus(t)
    return s === 'today' || s === 'overdue'
  }).length
}

/**
 * Where a dragged to-do should go when dropped on `targetId` (above or below it).
 * Returns the id it should be placed before, in the full shared list (null = the end).
 */
export function beforeIdFor(state: AppState, targetId: string, below: boolean): string | null {
  if (!below) return targetId
  const i = state.todos.findIndex((t) => t.id === targetId)
  return state.todos[i + 1]?.id ?? null
}
