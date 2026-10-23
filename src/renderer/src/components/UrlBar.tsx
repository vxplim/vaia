import { useEffect, useRef, useState } from 'react'
import type { TabItem } from '../../../shared/types'
import { displayHost, inputToUrl } from '../../../shared/url'
import { dispatch, getAppState } from '../state'
import { IconLock, IconSearch } from './Icons'

interface Props {
  tab: TabItem | null
  editing: boolean
  setEditing: (editing: boolean) => void
}

/** Shows the current site's domain; click it to type a URL or search. */
export function UrlBar({ tab, editing, setEditing }: Props) {
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setText(tab?.url ?? '')
      requestAnimationFrame(() => {
        input.current?.focus()
        input.current?.select()
      })
    }
    // Only reset the text when editing starts, not on every page update.
  }, [editing])

  const submit = () => {
    const value = text.trim()
    setEditing(false)
    if (!value) return
    if (tab) {
      dispatch({ type: 'tab/navigate', id: tab.id, input: value })
    } else {
      const engine = getAppState()?.settings.searchEngine ?? 'google'
      dispatch({ type: 'tab/new', url: inputToUrl(value, engine) })
    }
  }

  if (editing) {
    return (
      <div className="urlbar editing">
        <IconSearch className="urlbar-icon" />
        <input
          ref={input}
          value={text}
          spellCheck={false}
          placeholder="Search or enter address"
          onChange={(e) => setText(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      </div>
    )
  }

  const secure = tab?.url.startsWith('https://')
  return (
    <button className="urlbar" onClick={() => setEditing(true)} title={tab?.url || 'Search or enter address (⌘L)'}>
      {tab?.url ? (
        <>
          {secure ? <IconLock className="urlbar-icon" /> : <IconSearch className="urlbar-icon" />}
          <span className="urlbar-host">{displayHost(tab.url)}</span>
        </>
      ) : (
        <>
          <IconSearch className="urlbar-icon" />
          <span className="urlbar-placeholder">Search or enter address</span>
        </>
      )}
    </button>
  )
}
