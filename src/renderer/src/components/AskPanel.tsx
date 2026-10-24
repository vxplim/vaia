import { useEffect, useRef, useState } from 'react'
import type { AppState, TabItem } from '../../../shared/types'
import { tabLabel } from '../../../shared/tree'
import { dispatch } from '../state'
import { IconClose } from './Icons'

/** Ask on Page: a question about the page you're looking at, answered by Claude. */
export function AskPanel({ state, tab, closing, onClose }: { state: AppState; tab: TabItem | null; closing: boolean; onClose: () => void }) {
  const [question, setQuestion] = useState('')
  const [asked, setAsked] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const askId = useRef('')

  useEffect(
    () =>
      window.vaia.onCommand((cmd) => {
        if (cmd.type !== 'ask-update' || cmd.askId !== askId.current) return
        setAnswer(cmd.text)
        if (cmd.done) setBusy(false)
        if (cmd.error) setError(cmd.error)
      }),
    []
  )
  // Closing the panel stops an answer that's still coming.
  useEffect(() => () => void (askId.current && dispatch({ type: 'ai/cancelAsk', askId: askId.current })), [])

  const ask = () => {
    const q = question.trim()
    if (!q || !tab || busy) return
    if (askId.current) dispatch({ type: 'ai/cancelAsk', askId: askId.current })
    askId.current = crypto.randomUUID()
    setAsked(q)
    setAnswer('')
    setError('')
    setBusy(true)
    setQuestion('')
    dispatch({ type: 'ai/ask', tabId: tab.id, question: q, askId: askId.current })
  }

  return (
    <div className={`overlay-layer light${closing ? ' closing' : ''}`} onMouseDown={onClose}>
      <div className="panel ask-panel" onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <div className="todo-head">
          <h2>Ask about this page</h2>
          <button className="icon-button" title="Close (Esc)" onClick={onClose}>
            <IconClose />
          </button>
        </div>
        {!state.aiKeySet ? (
          <div className="ask-setup">
            <p>Ask on Page uses Claude with your own API key (the same one as AI Tidy).</p>
            <p>Create a key at console.anthropic.com, then paste it in Settings → Tidy &amp; to-do → “Claude API key”.</p>
            <button className="primary-button" onClick={() => dispatch({ type: 'app/openSettings' })}>
              Open Settings
            </button>
          </div>
        ) : !tab ? (
          <p className="ask-setup">Open a page first.</p>
        ) : (
          <>
            <div className="ask-page">{tabLabel(tab)}</div>
            <div className="ask-answer">
              {asked && <div className="ask-question">{asked}</div>}
              {answer && <div className="ask-text">{answer}</div>}
              {busy && !answer && <div className="ask-thinking">Reading the page…</div>}
              {error && <div className="ask-error">{error}</div>}
              {!asked && <div className="ask-hint">The page’s text and your question are sent to Claude (Anthropic). Nothing else is.</div>}
            </div>
            <input
              className="text-field"
              autoFocus
              value={question}
              placeholder={asked ? 'Ask a follow-up…' : 'e.g. Summarise this in 3 points'}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ask()}
            />
          </>
        )}
      </div>
    </div>
  )
}
