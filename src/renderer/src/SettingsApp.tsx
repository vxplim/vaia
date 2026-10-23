// The Settings window (⌘,).
import { useState } from 'react'
import type { ArchiveAfter, SearchEngineId } from '../../shared/types'
import { SEARCH_ENGINES } from '../../shared/url'
import { dispatch, useAppState } from './state'
import { colorsToCss } from './theme'

const ARCHIVE_OPTIONS: { value: ArchiveAfter; label: string }[] = [
  { value: '12h', label: 'After 12 hours' },
  { value: '24h', label: 'After 24 hours' },
  { value: '7d', label: 'After 7 days' },
  { value: '30d', label: 'After 30 days' },
  { value: 'never', label: 'Never' }
]

const SHORTCUTS: [string, string][] = [
  ['⌘T', 'Command Bar / new tab'],
  ['⌘L', 'Edit the address'],
  ['⌘W', 'Close tab (pinned tabs go to sleep)'],
  ['⇧⌘T', 'Reopen closed tab'],
  ['⌘R', 'Reload page'],
  ['⌘[  /  ⌘]', 'Back / forward'],
  ['⌘S', 'Show / hide the sidebar'],
  ['⇧⌘C', 'Copy the page address'],
  ['⌘F', 'Find in page (⌘G next, ⇧⌘G previous)'],
  ['⌃1 … ⌃9', 'Switch to Space 1–9'],
  ['⌃⇧=', 'Add a Split View pane'],
  ['⌥⌘N', 'New Little window'],
  ['⇧⌘K', 'To-do list'],
  ['⌘Y', 'History'],
  ['⇧⌘J', 'Downloads'],
  ['⌘,', 'Settings'],
  ['⌘+  /  ⌘−  /  ⌘0', 'Zoom the page in / out / reset'],
  ['Esc', 'Close Peek, Command Bar or panels']
]

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={`toggle${checked ? ' on' : ''}`} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span />
    </button>
  )
}

export function SettingsApp() {
  const state = useAppState()
  const [clear, setClear] = useState({ history: true, cookies: false, cache: true, archive: false })
  const [cleared, setCleared] = useState(false)
  const [apiKey, setApiKey] = useState('')
  if (!state) return null
  const s = state.settings
  const set = (patch: Partial<typeof s>) => dispatch({ type: 'settings/update', patch })

  return (
    <div className="settings">
      <div className="settings-titlebar">Settings</div>
      <div className="settings-body">
        <section>
          <h2>General</h2>
          <div className="setting-row">
            <div>
              <div className="setting-label">Search engine</div>
              <div className="setting-hint">Used when you type something that isn't a web address.</div>
            </div>
            <select value={s.searchEngine} onChange={(e) => set({ searchEngine: e.target.value as SearchEngineId })}>
              {Object.entries(SEARCH_ENGINES).map(([id, engine]) => (
                <option key={id} value={id}>
                  {engine.name}
                </option>
              ))}
            </select>
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Archive Today tabs</div>
              <div className="setting-hint">Tabs you haven't looked at for this long move to the Archive.</div>
            </div>
            <select value={s.archiveAfter} onChange={(e) => set({ archiveAfter: e.target.value as ArchiveAfter })}>
              {ARCHIVE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Open links from pinned tabs in Peek</div>
              <div className="setting-hint">Links to other sites open in a floating preview instead.</div>
            </div>
            <Toggle checked={s.peekPinnedLinks} onChange={(v) => set({ peekPinnedLinks: v })} />
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Block ads and trackers</div>
              <div className="setting-hint">Uses the open-source EasyList filter lists (downloaded the first time).</div>
            </div>
            <Toggle checked={s.adBlock} onChange={(v) => set({ adBlock: v })} />
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Default browser</div>
              <div className="setting-hint">Links from other apps will open in a Little window.</div>
            </div>
            <button className="secondary-button" onClick={() => dispatch({ type: 'app/makeDefaultBrowser' })}>
              Make Default
            </button>
          </div>
        </section>

        <section>
          <h2>Tidy &amp; to-do</h2>
          <div className="setting-row">
            <div>
              <div className="setting-label">Use AI to Tidy</div>
              <div className="setting-hint">
                Tidy asks Claude to sort Today tabs into topic folders and give them shorter names. Only tab titles and
                website names are sent. Without a key or internet, Tidy groups tabs by website instead.
              </div>
            </div>
            <Toggle checked={s.aiTidy} onChange={(v) => set({ aiTidy: v })} />
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Claude API key</div>
              <div className="setting-hint">
                {state.aiKeySet
                  ? 'Saved, encrypted with your Mac’s Keychain.'
                  : 'From console.anthropic.com. Stored encrypted on this Mac, never in plain text.'}
              </div>
            </div>
            {state.aiKeySet ? (
              <button className="secondary-button" onClick={() => dispatch({ type: 'ai/clearKey' })}>
                Remove Key
              </button>
            ) : (
              <form
                className="key-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!apiKey.trim()) return
                  dispatch({ type: 'ai/setKey', key: apiKey })
                  setApiKey('')
                }}
              >
                <input
                  type="password"
                  placeholder="sk-ant-…"
                  value={apiKey}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <button className="secondary-button" type="submit" disabled={!apiKey.trim()}>
                  Save
                </button>
              </form>
            )}
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Show to-dos in the sidebar</div>
              <div className="setting-hint">This Space’s unfinished to-dos appear under your pinned tabs.</div>
            </div>
            <Toggle checked={s.todoInSidebar} onChange={(v) => set({ todoInSidebar: v })} />
          </div>
        </section>

        <section>
          <h2>Spaces &amp; themes</h2>
          {state.spaces.map((space) => (
            <div className="setting-row" key={space.id}>
              <div className="space-summary">
                <span className="space-swatch" style={{ background: colorsToCss(space.theme.colors) }}>
                  {space.icon}
                </span>
                <div>
                  <div className="setting-label">{space.name}</div>
                  <div className="setting-hint">
                    {space.theme.mode === 'auto' ? 'Auto' : space.theme.mode === 'dark' ? 'Dark' : 'Light'} appearance
                    {space.profileId ? ' · separate profile' : ''}
                  </div>
                </div>
              </div>
              <button className="secondary-button" onClick={() => dispatch({ type: 'app/editSpace', id: space.id })}>
                Edit…
              </button>
            </div>
          ))}
        </section>

        <section>
          <h2>Clear browsing data</h2>
          <div className="clear-options">
            {(
              [
                ['history', 'Browsing history'],
                ['cache', 'Cached images and files'],
                ['cookies', 'Cookies and site data (signs you out of websites)'],
                ['archive', 'Archived tabs']
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="check-row">
                <input
                  type="checkbox"
                  checked={clear[key]}
                  onChange={(e) => {
                    setCleared(false)
                    setClear({ ...clear, [key]: e.target.checked })
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="setting-row end">
            {cleared && <span className="setting-hint">Done.</span>}
            <button
              className="secondary-button danger"
              disabled={!Object.values(clear).some(Boolean)}
              onClick={() => dispatch({ type: 'data/clear', ...clear }).then(() => setCleared(true))}
            >
              Clear Data
            </button>
          </div>
        </section>

        <section>
          <h2>Keyboard shortcuts</h2>
          <div className="shortcuts">
            {SHORTCUTS.map(([keys, what]) => (
              <div className="shortcut" key={keys}>
                <kbd>{keys}</kbd>
                <span>{what}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
