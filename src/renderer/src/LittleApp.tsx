// The Little window: a small, minimal browser for quick lookups.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { displayHost } from '../../shared/url'
import { IconBack, IconExpand, IconForward, IconLock, IconMask, IconReload, IconSearch } from './components/Icons'
import { dispatch, useAppState } from './state'
import { themeStyle, useSystemDark } from './theme'
import { activeSpace } from '../../shared/tree'

export function LittleApp({ tabId }: { tabId: string }) {
  const state = useAppState()
  const systemDark = useSystemDark()
  const card = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const tab = state?.littles[tabId]
  const rt = state?.runtime[tabId]
  const hasPage = !!tab?.url

  useEffect(() => {
    if (state && tab && !tab.url) setEditing(true)
  }, [state, tab])

  useEffect(() => {
    if (!editing) return
    setText(tab?.url ?? '')
    requestAnimationFrame(() => input.current?.select())
  }, [editing])

  useEffect(() => window.vaia.onCommand((cmd) => cmd.type === 'focus-url' && setEditing(true)), [])

  useEffect(() => {
    if (tab?.title) document.title = tab.title
  }, [tab?.title])

  useLayoutEffect(() => {
    const el = card.current
    if (!el) return
    const report = () => {
      const r = el.getBoundingClientRect()
      window.vaia.setPanes(hasPage ? [{ tabId, rect: { x: r.left, y: r.top, width: r.width, height: r.height } }] : [])
    }
    report()
    const observer = new ResizeObserver(report)
    observer.observe(el)
    return () => observer.disconnect()
  }, [tabId, hasPage])

  if (!state || !tab) return null
  // Private windows always look dark and purple, so you can tell them apart at a glance.
  const theme = themeStyle(tab.private ? { colors: ['#2b2140', '#1c1730'], mode: 'dark' } : activeSpace(state).theme, systemDark)

  const submit = () => {
    setEditing(false)
    if (text.trim()) dispatch({ type: 'tab/navigate', id: tabId, input: text })
  }

  return (
    <div className={`app little${theme.isDark ? ' dark' : ''}${tab.private ? ' private' : ''}`} style={theme.vars as React.CSSProperties}>
      <div className="backdrop" style={{ background: theme.background }} />
      <div className="little-bar">
        <div className="nav-buttons">
          <button className="icon-button" disabled={!rt?.canGoBack} onClick={() => dispatch({ type: 'tab/back', id: tabId })}>
            <IconBack />
          </button>
          <button
            className="icon-button"
            disabled={!rt?.canGoForward}
            onClick={() => dispatch({ type: 'tab/forward', id: tabId })}
          >
            <IconForward />
          </button>
          <button className="icon-button" disabled={!hasPage} onClick={() => dispatch({ type: 'tab/reload', id: tabId })}>
            <IconReload />
          </button>
        </div>
        {editing ? (
          <div className="urlbar editing little-url">
            <IconSearch className="urlbar-icon" />
            <input
              ref={input}
              autoFocus
              value={text}
              spellCheck={false}
              placeholder="Search or enter address"
              onChange={(e) => setText(e.target.value)}
              onBlur={() => hasPage && setEditing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
                if (e.key === 'Escape' && hasPage) setEditing(false)
              }}
            />
          </div>
        ) : (
          <button className="urlbar little-url" onClick={() => setEditing(true)} title={tab.url}>
            {tab.url.startsWith('https://') ? <IconLock className="urlbar-icon" /> : <IconSearch className="urlbar-icon" />}
            <span className="urlbar-host">{displayHost(tab.url)}</span>
          </button>
        )}
        {tab.private ? (
          <span className="private-badge" title="Nothing from this window is saved. Its cookies are deleted when you close it.">
            <IconMask />
            Private
          </span>
        ) : (
          <button
            className="peek-button little-move"
            title="Move this page into the main VAIA window as a tab"
            disabled={!hasPage}
            onClick={() => dispatch({ type: 'little/toMain', id: tabId })}
          >
            <IconExpand />
            <span>Open in VAIA</span>
          </button>
        )}
      </div>
      <div className="little-content">
        <div className="content-card" ref={card}>
          {!hasPage && (
            <div className="empty-state">
              {tab.private ? (
                <>
                  <div className="empty-mark">Private</div>
                  <p>Pages you visit here aren’t saved in your history.</p>
                  <p className="hint">Cookies and site data are deleted when you close this window.</p>
                </>
              ) : (
                <p>Type an address or search above.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
