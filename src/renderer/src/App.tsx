import { useCallback, useEffect, useRef, useState } from 'react'
import { activeSpace, locate } from '../../shared/tree'
import type { TabItem } from '../../shared/types'
import { Backdrop } from './components/Backdrop'
import { CommandBar } from './components/CommandBar'
import { Content } from './components/Content'
import { Sidebar } from './components/Sidebar'
import { SpaceEditor } from './components/SpaceEditor'
import { Toast } from './components/Toast'
import { useAppState } from './state'
import { themeStyle, useSystemDark } from './theme'

const CLOSE_ANIMATION_MS = 140

/** Things that float over the page (the page is "frozen" into a picture while one is open). */
export type Overlay = { kind: 'command' } | { kind: 'space-editor'; spaceId: string }

export default function App() {
  const state = useAppState()
  const systemDark = useSystemDark()
  const [urlEditing, setUrlEditing] = useState(false)
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [closing, setClosing] = useState(false)
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openOverlay = useCallback((next: Overlay) => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setUrlEditing(false)
    setClosing(false)
    setOverlay(next)
  }, [])

  const closeOverlay = useCallback(() => {
    setClosing(true)
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => {
      setOverlay(null)
      setClosing(false)
    }, CLOSE_ANIMATION_MS)
  }, [])

  const editSpace = useCallback((spaceId: string) => openOverlay({ kind: 'space-editor', spaceId }), [openOverlay])

  useEffect(
    () =>
      window.vaia.onCommand((cmd) => {
        if (cmd.type === 'focus-url') setUrlEditing(true)
        if (cmd.type === 'command-bar') openOverlay({ kind: 'command' })
        if (cmd.type === 'edit-space') editSpace(cmd.id)
        if (cmd.type === 'toast') setToast({ message: cmd.message, key: Date.now() })
      }),
    [openOverlay, editSpace]
  )

  if (!state) return null

  const space = activeSpace(state)
  const loc = space.activeId ? locate(state, space.activeId) : null
  const activeTab: TabItem | null = loc?.item.kind === 'tab' ? loc.item : null
  const theme = themeStyle(space.theme, systemDark)
  const editing = overlay?.kind === 'space-editor' ? state.spaces.find((s) => s.id === overlay.spaceId) : null

  return (
    <div
      className={`app${theme.isDark ? ' dark' : ''}${state.settings.sidebarVisible ? '' : ' no-sidebar'}`}
      style={theme.vars as React.CSSProperties}
    >
      <Backdrop background={theme.background} />
      {state.settings.sidebarVisible && (
        <Sidebar
          state={state}
          space={space}
          activeTab={activeTab}
          urlEditing={urlEditing}
          setUrlEditing={setUrlEditing}
          onNewTab={() => openOverlay({ kind: 'command' })}
          onEditSpace={editSpace}
        />
      )}
      <Content tab={activeTab} frozen={overlay !== null} />
      {overlay?.kind === 'command' && (
        <CommandBar
          state={state}
          activeTabId={activeTab?.id ?? null}
          closing={closing}
          onClose={closeOverlay}
          onEditSpace={editSpace}
        />
      )}
      {editing && <SpaceEditor state={state} space={editing} closing={closing} onClose={closeOverlay} />}
      {toast && <Toast key={toast.key} message={toast.message} onDone={() => setToast(null)} />}
    </div>
  )
}
