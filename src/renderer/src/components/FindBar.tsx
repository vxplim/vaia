import { useEffect, useRef, useState } from 'react'
import { dispatch } from '../state'
import { IconChevronDown, IconChevronUp, IconClose, IconSearch } from './Icons'

/** Find in page (⌘F): sits above the page; Enter / ⌘G = next, ⇧Enter / ⇧⌘G = previous. */
export function FindBar({ onClose, focusKey }: { onClose: () => void; focusKey: number }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<{ matches: number; active: number } | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const textRef = useRef(text)
  textRef.current = text

  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [focusKey])

  useEffect(
    () =>
      window.vaia.onCommand((cmd) => {
        if (cmd.type === 'find-result') setResult({ matches: cmd.matches, active: cmd.active })
        if (cmd.type === 'find-next' && textRef.current) {
          dispatch({ type: 'find/query', text: textRef.current, forward: cmd.forward, next: true })
        }
      }),
    []
  )

  const search = (value: string) => {
    setText(value)
    if (!value) setResult(null)
    dispatch({ type: 'find/query', text: value })
  }
  const step = (forward: boolean) => text && dispatch({ type: 'find/query', text, forward, next: true })
  const close = () => {
    dispatch({ type: 'find/stop' })
    onClose()
  }

  return (
    <div className="find-bar">
      <IconSearch className="find-icon" />
      <input
        ref={input}
        value={text}
        placeholder="Find in page"
        spellCheck={false}
        onChange={(e) => search(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') step(!e.shiftKey)
          if (e.key === 'Escape') close()
        }}
      />
      <span className="find-count">
        {text && result ? (result.matches ? `${result.active} of ${result.matches}` : 'No matches') : ''}
      </span>
      <button className="icon-button" title="Previous (⇧⌘G)" disabled={!result?.matches} onClick={() => step(false)}>
        <IconChevronUp />
      </button>
      <button className="icon-button" title="Next (⌘G)" disabled={!result?.matches} onClick={() => step(true)}>
        <IconChevronDown />
      </button>
      <button className="icon-button" title="Close (Esc)" onClick={close}>
        <IconClose />
      </button>
    </div>
  )
}
