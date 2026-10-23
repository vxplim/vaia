import { useCallback, useEffect, useRef, useState } from 'react'
import { activeSpace, locate } from '../../shared/tree'
import type { TabItem } from '../../shared/types'
import { CommandBar } from './components/CommandBar'
import { Content } from './components/Content'
import { Sidebar } from './components/Sidebar'
import { Toast } from './components/Toast'
import { useAppState } from './state'
import { themeStyle, useSystemDark } from './theme'

const CLOSE_ANIMATION_MS = 140

export default function App() {
  const state = useAppState()
  const systemDark = useSystemDark()
  const [urlEditing, setUrlEditing] = useState(false)
  const [commandBar, setCommandBar] = useState<'closed' | 'open' | 'closing'>('closed')
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openCommandBar = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setUrlEditing(false)
    setCommandBar('open')
  }, [])

  const closeCommandBar = useCallback(() => {
    setCommandBar((c) => (c === 'open' ? 'closing' : c))
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setCommandBar('closed'), CLOSE_ANIMATION_MS)
  }, [])

  useEffect(
    () =>
      window.vaia.onCommand((cmd) => {
        if (cmd.type === 'focus-url') setUrlEditing(true)
        if (cmd.type === 'command-bar') openCommandBar()
        if (cmd.type === 'toast') setToast({ message: cmd.message, key: Date.now() })
      }),
    [openCommandBar]
  )

  if (!state) return null

  const space = activeSpace(state)
  const loc = space.activeId ? locate(state, space.activeId) : null
  const activeTab: TabItem | null = loc?.item.kind === 'tab' ? loc.item : null
  const theme = themeStyle(space.theme, systemDark)

  return (
    <div className={`app${theme.isDark ? ' dark' : ''}${state.settings.sidebarVisible ? '' : ' no-sidebar'}`} style={theme.vars as React.CSSProperties}>
      <div className="backdrop" style={{ background: theme.background }} />
      {state.settings.sidebarVisible && (
        <Sidebar
          state={state}
          space={space}
          activeTab={activeTab}
          urlEditing={urlEditing}
          setUrlEditing={setUrlEditing}
          onNewTab={openCommandBar}
        />
      )}
      <Content tab={activeTab} frozen={commandBar !== 'closed'} />
      {commandBar !== 'closed' && (
        <CommandBar
          state={state}
          activeTabId={activeTab?.id ?? null}
          closing={commandBar === 'closing'}
          onClose={closeCommandBar}
        />
      )}
      {toast && <Toast key={toast.key} message={toast.message} onDone={() => setToast(null)} />}
    </div>
  )
}
