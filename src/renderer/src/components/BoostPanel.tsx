import { useEffect, useRef, useState } from 'react'
import type { AppState, Boost, TabItem } from '../../../shared/types'
import { siteKey } from '../../../shared/url'
import { dispatch } from '../state'
import { IconClose } from './Icons'

const FONTS: { label: string; value: string }[] = [
  { label: "Site's own font", value: '' },
  { label: 'System (SF Pro)', value: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif' },
  { label: 'Serif (New York)', value: 'ui-serif, "New York", Georgia, serif' },
  { label: 'Rounded', value: 'ui-rounded, "SF Pro Rounded", -apple-system, sans-serif' },
  { label: 'Monospace', value: 'ui-monospace, "SF Mono", Menlo, monospace' },
  { label: 'Helvetica', value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: 'Avenir', value: '"Avenir Next", Avenir, sans-serif' }
]

const COLOR_FIELDS: { key: 'bgColor' | 'textColor' | 'linkColor'; label: string; fallback: string }[] = [
  { key: 'bgColor', label: 'Background', fallback: '#fdf6e3' },
  { key: 'textColor', label: 'Text', fallback: '#333333' },
  { key: 'linkColor', label: 'Links', fallback: '#2f6fde' }
]

/** A text box that saves a moment after you stop typing. */
function CodeBox({ value, placeholder, onSave }: { value: string; placeholder: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => setText(value), [value])
  return (
    <textarea
      className="code-box"
      spellCheck={false}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value
        setText(v)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => onSave(v), 500)
      }}
    />
  )
}

/** Customize the current website. Lives in the sidebar so the page stays visible. */
export function BoostPanel({ state, tab, onClose }: { state: AppState; tab: TabItem | null; onClose: () => void }) {
  const site = tab ? siteKey(tab.url) : null
  const [zapping, setZapping] = useState(false)

  useEffect(() => window.vaia.onCommand((cmd) => cmd.type === 'zap-ended' && setZapping(false)), [])
  // Leaving the panel (or switching tabs) stops zapping.
  useEffect(
    () => () => {
      if (tab) dispatch({ type: 'boost/zapStop', tabId: tab.id })
    },
    [tab?.id]
  )

  if (!tab || !site) {
    return (
      <div className="boost-panel">
        <div className="boost-head">
          <h2>Boost</h2>
          <button className="icon-button" title="Close" onClick={onClose}>
            <IconClose />
          </button>
        </div>
        <p className="boost-empty">Open a website to customize how it looks.</p>
      </div>
    )
  }

  const boost: Boost | undefined = state.boosts[site]
  const update = (patch: Partial<Boost>) => dispatch({ type: 'boost/update', site, patch })

  return (
    <div className="boost-panel">
      <div className="boost-head">
        <div>
          <h2>Boost</h2>
          <div className="boost-site">{site}</div>
        </div>
        <button
          className={`toggle${boost?.enabled ? ' on' : ''}`}
          role="switch"
          aria-checked={!!boost?.enabled}
          title={boost?.enabled ? 'Turn this Boost off' : 'Turn this Boost on'}
          onClick={() => update({ enabled: !boost?.enabled })}
        >
          <span />
        </button>
      </div>

      <div className="boost-scroll">
        <div className="boost-label">Colors</div>
        {COLOR_FIELDS.map((f) => (
          <div className="boost-row" key={f.key}>
            <span>{f.label}</span>
            <span className="boost-color">
              <input
                type="color"
                value={boost?.[f.key] ?? f.fallback}
                onChange={(e) => update({ [f.key]: e.target.value, enabled: true })}
              />
              {boost?.[f.key] ? (
                <button className="tab-action" title="Use the site's color" onClick={() => update({ [f.key]: undefined })}>
                  <IconClose />
                </button>
              ) : (
                <span className="boost-off">Off</span>
              )}
            </span>
          </div>
        ))}

        <div className="boost-label">Font</div>
        <select
          className="boost-select"
          value={boost?.font ?? ''}
          onChange={(e) => update({ font: e.target.value || undefined, enabled: true })}
        >
          {FONTS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <div className="boost-label">Zap</div>
        <button
          className={`boost-zap${zapping ? ' active' : ''}`}
          onClick={() => {
            if (zapping) {
              dispatch({ type: 'boost/zapStop', tabId: tab.id })
              setZapping(false)
            } else {
              setZapping(true)
              dispatch({ type: 'boost/zapStart', tabId: tab.id })
            }
          }}
        >
          {zapping ? 'Click things on the page to hide them… (Esc to stop)' : '⚡︎ Zap elements'}
        </button>
        {!!boost?.zaps.length && (
          <div className="zap-list">
            {boost.zaps.map((z) => (
              <div className="zap-item" key={z} title={z}>
                <span>{z}</span>
                <button
                  className="tab-action"
                  title="Show it again"
                  onClick={() => update({ zaps: boost.zaps.filter((x) => x !== z) })}
                >
                  <IconClose />
                </button>
              </div>
            ))}
            <button className="text-button" onClick={() => update({ zaps: [] })}>
              Restore all
            </button>
          </div>
        )}

        <div className="boost-label">Custom CSS</div>
        <CodeBox
          value={boost?.css ?? ''}
          placeholder={'/* e.g. */\nbody { max-width: 800px; margin: auto; }'}
          onSave={(css) => update({ css, enabled: true })}
        />

        <div className="boost-label">
          Custom JavaScript
          <button className="text-button small" disabled={!boost?.js.trim()} onClick={() => dispatch({ type: 'boost/runJs', tabId: tab.id })}>
            Run now
          </button>
        </div>
        <CodeBox
          value={boost?.js ?? ''}
          placeholder={'// Runs each time a page on this site loads'}
          onSave={(js) => update({ js, enabled: true })}
        />

        {boost && (
          <button className="text-button danger boost-delete" onClick={() => dispatch({ type: 'boost/delete', site })}>
            Delete this Boost
          </button>
        )}
      </div>

      <button className="primary-button boost-done" onClick={onClose}>
        Done
      </button>
    </div>
  )
}
