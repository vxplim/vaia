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
import { TodoPanel } from './components/TodoPanel'
import { DndProvider } from './dnd'
import { dispatch, useAppState } from './state'
import { themeStyle, useSystemDark } from './theme'

const CLOSE_ANIMATION_MS = 140
/** Hidden sidebar: how long to rest at the left edge before it slides out, and grace periods before it tucks away. */
const PEEK_OPEN_DELAY_MS = 150
const PEEK_AWAY_GRACE_MS = 320
const PEEK_LEAVE_WINDOW_GRACE_MS = 600
const PEEK_SLIDE_OUT_MS = 180

/** closed → opening (freezing the page) → open (slid out) → closing (sliding away) → closed */
type PeekPhase = 'closed' | 'opening' | 'open' | 'closing'

/** Things that float over the page (the page is "frozen" into a picture while one is open). */
export type Overlay =
  | { kind: 'command'; mode: 'new' | 'split' }
  | { kind: 'space-editor'; spaceId: string; setup?: boolean }
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
  const [peekPhase, setPeekPhase] = useState<PeekPhase>('closed')
  const sidebarPeek = peekPhase !== 'closed'
  /** The page has been swapped for a picture, so the sliding sidebar can show above it. */
  const [frozenReady, setFrozenReady] = useState(false)
  const edgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setSidebarPeek = useCallback((on: boolean) => {
    setPeekPhase((p) => (on ? (p === 'closed' || p === 'closing' ? 'opening' : p) : p === 'closed' ? p : 'closing'))
  }, [])
  const [boostOpen, setBoostOpen] = useState(false)
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

  const editSpace = useCallback(
    (spaceId: string, setup = false) => openOverlay({ kind: 'space-editor', spaceId, setup }),
    [openOverlay]
  )
  const openPanel = useCallback((panel: Panel) => openOverlay({ kind: panel }), [openOverlay])
  const openFind = useCallback(() => {
    setFindOpen(true)
    setFindKey((k) => k + 1)
  }, [])
  const sidebarVisible = state?.settings.sidebarVisible ?? true

  // The Boost editor lives in the sidebar, so make sure the sidebar is showing.
  const openBoost = useCallback(() => {
    if (!sidebarVisible) dispatch({ type: 'settings/update', patch: { sidebarVisible: true } })
    setBoostOpen(true)
  }, [sidebarVisible])

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
        if (cmd.type === 'edit-space') editSpace(cmd.id, cmd.setup)
        if (cmd.type === 'open-panel') openPanel(cmd.panel)
        if (cmd.type === 'toggle-sidebar') toggleSidebar()
        if (cmd.type === 'find') openFind()
        if (cmd.type === 'boost') openBoost()
      }),
    [openOverlay, editSpace, openPanel, toggleSidebar, openFind, openBoost, sidebarVisible]
  )

  // Hide the window's red/yellow/green buttons along with the sidebar.
  useEffect(() => window.vaia.setTrafficLights(sidebarVisible || sidebarPeek), [sidebarVisible, sidebarPeek])

  // Picking a tab (or finishing typing an address) in the slid-out sidebar tucks it away again.
  const activeId = state ? activeSpace(state).activeId : null
  useEffect(() => setSidebarPeek(false), [activeId])
  useEffect(() => {
    if (!urlEditing) setSidebarPeek(false)
  }, [urlEditing])

  // Slide in once the page is frozen into a picture (two frames later, so the move animates).
  useEffect(() => {
    if (peekPhase !== 'opening' || !frozenReady) return
    let second = 0
    const first = requestAnimationFrame(() => (second = requestAnimationFrame(() => setPeekPhase('open'))))
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [peekPhase, frozenReady])
  // After sliding away, let the live page come back.
  useEffect(() => {
    if (peekPhase !== 'closing') return
    const t = setTimeout(() => setPeekPhase('closed'), PEEK_SLIDE_OUT_MS)
    return () => clearTimeout(t)
  }, [peekPhase])

  // Tuck the slid-out sidebar away once the pointer wanders off to the right of it (or out of
  // the window), with a short grace period so a brief slip doesn't close it.
  const sidebarWidth = state?.settings.sidebarWidth ?? 248
  useEffect(() => {
    if (peekPhase !== 'open') return
    const cancel = () => {
      if (peekTimer.current) clearTimeout(peekTimer.current)
      peekTimer.current = null
    }
    const closeAfter = (ms: number) => {
      if (!peekTimer.current) peekTimer.current = setTimeout(() => setSidebarPeek(false), ms)
    }
    const onMove = (e: MouseEvent) => {
      if (e.clientX > sidebarWidth + 24 && !urlEditing) closeAfter(PEEK_AWAY_GRACE_MS)
      else cancel()
    }
    const onLeave = () => !urlEditing && closeAfter(PEEK_LEAVE_WINDOW_GRACE_MS)
    window.addEventListener('mousemove', onMove)
    document.documentElement.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      cancel()
    }
  }, [peekPhase, urlEditing, sidebarWidth, setSidebarPeek])

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
  const setup = overlay?.kind === 'space-editor' && !!overlay.setup

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
      boostOpen={boostOpen && sidebarVisible}
      onBoost={(open) => (open ? openBoost() : setBoostOpen(false))}
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
          onFrozen={setFrozenReady}
          findBar={findOpen && activeTab?.url ? <FindBar focusKey={findKey} onClose={() => setFindOpen(false)} /> : null}
        />
        {!sidebarVisible && !sidebarPeek && (
          <div
            className="edge-hover"
            onMouseEnter={() => {
              if (edgeTimer.current) clearTimeout(edgeTimer.current)
              edgeTimer.current = setTimeout(() => setSidebarPeek(true), PEEK_OPEN_DELAY_MS)
            }}
            onMouseLeave={() => {
              if (edgeTimer.current) clearTimeout(edgeTimer.current)
              edgeTimer.current = null
            }}
          />
        )}
        {!sidebarVisible && sidebarPeek && frozenReady && (
          <div className={`sidebar-float${peekPhase === 'open' ? ' open' : peekPhase === 'closing' ? ' closing' : ''}`}>
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
              find: openFind,
              boost: openBoost
            }}
          />
        )}
        {overlay?.kind === 'archive' && <ArchivePanel state={state} closing={closing} onClose={closeOverlay} />}
        {overlay?.kind === 'history' && <HistoryPanel closing={closing} onClose={closeOverlay} />}
        {overlay?.kind === 'downloads' && <DownloadsPanel state={state} closing={closing} onClose={closeOverlay} />}
        {overlay?.kind === 'todo' && (
          <TodoPanel state={state} closing={closing} onClose={closeOverlay} left={sidebarVisible ? sidebarWidth + 4 : 10} />
        )}
        {editing && <SpaceEditor state={state} space={editing} setup={setup} closing={closing} onClose={closeOverlay} />}
      </div>
    </DndProvider>
  )
}
