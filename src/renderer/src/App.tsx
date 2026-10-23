import { useCallback, useEffect, useRef, useState } from 'react'
import { activeSpace, locate } from '../../shared/tree'
import type { Panel, SplitItem, TabItem } from '../../shared/types'
import { ArchivePanel } from './components/ArchivePanel'
import { Backdrop } from './components/Backdrop'
import { CommandBar } from './components/CommandBar'
import { Content } from './components/Content'
import { DownloadsPanel } from './components/DownloadsPanel'
import { FindBar } from './components/FindBar'
import { HistoryPanel } from './components/HistoryPanel'
import { PeekLayer } from './components/PeekLayer'
import { Sidebar } from './components/Sidebar'
import { SpaceEditor } from './components/SpaceEditor'
import { DndProvider } from './dnd'
import { dispatch, useAppState } from './state'
import { themeStyle, useSystemDark } from './theme'

const CLOSE_ANIMATION_MS = 140

/** Things that float over the page (the page is "frozen" into a picture while one is open). */
export type Overlay =
  | { kind: 'command'; mode: 'new' | 'split' }
  | { kind: 'space-editor'; spaceId: string }
  | { kind: Panel }

export default function App() {
  const state = useAppState()
  const systemDark = useSystemDark()
  const [urlEditing, setUrlEditing] = useState(false)
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [closing, setClosing] = useState(false)
  const [findKey, setFindKey] = useState(0)
  const [findOpen, setFindOpen] = useState(false)
  // With the sidebar hidden, hovering the left edge slides it out over the page.
  const [sidebarPeek, setSidebarPeek] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openOverlay = useCallback((next: Overlay) => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setUrlEditing(false)
    setClosing(false)
    setSidebarPeek(false)
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
  const openPanel = useCallback((panel: Panel) => openOverlay({ kind: panel }), [openOverlay])
  const openFind = useCallback(() => {
    setFindOpen(true)
    setFindKey((k) => k + 1)
  }, [])
  const sidebarVisible = state?.settings.sidebarVisible ?? true

  const toggleSidebar = useCallback(() => {
    setSidebarPeek(false)
    dispatch({ type: 'settings/update', patch: { sidebarVisible: !sidebarVisible } })
  }, [sidebarVisible])

  useEffect(
    () =>
      window.vaia.onCommand((cmd) => {
        if (cmd.type === 'focus-url') {
          // With the sidebar hidden, slide it out so the address can be edited.
          if (!sidebarVisible) setSidebarPeek(true)
          setUrlEditing(true)
        }
        if (cmd.type === 'command-bar') openOverlay({ kind: 'command', mode: cmd.mode ?? 'new' })
        if (cmd.type === 'edit-space') editSpace(cmd.id)
        if (cmd.type === 'open-panel') openPanel(cmd.panel)
        if (cmd.type === 'toggle-sidebar') toggleSidebar()
        if (cmd.type === 'find') openFind()
      }),
    [openOverlay, editSpace, openPanel, toggleSidebar, openFind, sidebarVisible]
  )

  // Hide the window's red/yellow/green buttons along with the sidebar.
  useEffect(() => window.vaia.setTrafficLights(sidebarVisible || sidebarPeek), [sidebarVisible, sidebarPeek])

  // Picking a tab (or finishing typing an address) in the slid-out sidebar tucks it away again.
  const activeId = state ? activeSpace(state).activeId : null
  useEffect(() => setSidebarPeek(false), [activeId])
  useEffect(() => {
    if (!urlEditing) setSidebarPeek(false)
  }, [urlEditing])

  // Tuck the slid-out sidebar away once the pointer wanders off to the right of it.
  const sidebarWidth = state?.settings.sidebarWidth ?? 248
  useEffect(() => {
    if (!sidebarPeek) return
    const onMove = (e: MouseEvent) => {
      const away = e.clientX > sidebarWidth + 40
      if (away && !urlEditing && !peekTimer.current) {
        peekTimer.current = setTimeout(() => setSidebarPeek(false), 250)
      } else if (!away && peekTimer.current) {
        clearTimeout(peekTimer.current)
        peekTimer.current = null
      }
    }
    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (peekTimer.current) clearTimeout(peekTimer.current)
      peekTimer.current = null
    }
  }, [sidebarPeek, urlEditing, sidebarWidth])

  if (!state) return null

  const space = activeSpace(state)
  const loc = space.activeId ? locate(state, space.activeId) : null
  // In Split View, the "active tab" is the pane you last clicked.
  const activeTab: TabItem | null =
    loc?.item.kind === 'tab'
      ? loc.item
      : loc?.item.kind === 'split'
        ? (loc.item.tabs.find((t) => t.id === (loc.item as SplitItem).focusedId) ?? loc.item.tabs[0] ?? null)
        : null
  const theme = themeStyle(space.theme, systemDark)
  const editing = overlay?.kind === 'space-editor' ? state.spaces.find((s) => s.id === overlay.spaceId) : null

  const sidebar = (
    <Sidebar
      state={state}
      space={space}
      activeTab={activeTab}
      urlEditing={urlEditing}
      setUrlEditing={setUrlEditing}
      onNewTab={() => openOverlay({ kind: 'command', mode: 'new' })}
      onEditSpace={editSpace}
      onOpenPanel={openPanel}
      onToggleSidebar={toggleSidebar}
    />
  )

  return (
    <DndProvider>
      <div
        className={`app${theme.isDark ? ' dark' : ''}${sidebarVisible ? '' : ' no-sidebar'}`}
        style={theme.vars as React.CSSProperties}
      >
        <Backdrop background={theme.background} />
        {sidebarVisible && sidebar}
        <Content
          state={state}
          space={space}
          frozen={overlay !== null || !!state.peek || sidebarPeek}
          findBar={findOpen && activeTab?.url ? <FindBar focusKey={findKey} onClose={() => setFindOpen(false)} /> : null}
        />
        {!sidebarVisible && !sidebarPeek && <div className="edge-hover" onMouseEnter={() => setSidebarPeek(true)} />}
        {!sidebarVisible && sidebarPeek && (
          <div className="sidebar-float">
            <Backdrop background={theme.background} />
            {sidebar}
          </div>
        )}
        {state.peek && <PeekLayer key={state.peek.id} state={state} peek={state.peek} />}
        {overlay?.kind === 'command' && (
          <CommandBar
            state={state}
            activeTabId={activeTab?.id ?? null}
            mode={overlay.mode}
            closing={closing}
            onClose={closeOverlay}
            ui={{
              editSpace,
              openPanel,
              openSplitPicker: () => openOverlay({ kind: 'command', mode: 'split' }),
              toggleSidebar,
              find: openFind
            }}
          />
        )}
        {overlay?.kind === 'archive' && <ArchivePanel state={state} closing={closing} onClose={closeOverlay} />}
        {overlay?.kind === 'history' && <HistoryPanel closing={closing} onClose={closeOverlay} />}
        {overlay?.kind === 'downloads' && <DownloadsPanel state={state} closing={closing} onClose={closeOverlay} />}
        {editing && <SpaceEditor state={state} space={editing} closing={closing} onClose={closeOverlay} />}
      </div>
    </DndProvider>
  )
}
