// The Settings window (⌘,).
import { useState } from 'react'
import type { AppState, ArchiveAfter, PermissionKind, SearchEngineId } from '../../shared/types'
import { SEARCH_ENGINES } from '../../shared/url'
import { dispatch, useAppState } from './state'
import { ThemeControls, ThemePreview } from './components/ThemeControls'
import { themeStyle, useSystemDark } from './theme'

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
  ['⇧⌘N', 'New private window'],
  ['⌘P', 'Print'],
  ['⌘,', 'Settings'],
  ['⌘+  /  ⌘−  /  ⌘0', 'Zoom the page in / out / reset'],
  ['Esc', 'Close Peek, Command Bar or panels']
]

const PERMISSION_NAMES: Record<PermissionKind, string> = {
  camera: 'Camera',
  microphone: 'Microphone',
  location: 'Location',
  notifications: 'Notifications',
  clipboard: 'Clipboard',
  midi: 'MIDI devices',
  idle: 'Idle detection',
  windows: 'Window management',
  'open-apps': 'Open other apps'
}

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
  const [lookSpaceId, setLookSpaceId] = useState<string | null>(null)
  const systemDark = useSystemDark()
  const [importTarget, setImportTarget] = useState<'pinned' | 'favorites'>('pinned')
  const [importResult, setImportResult] = useState('')
  const importFrom = async (source: 'chrome' | 'safari' | 'file') => {
    setImportResult('Importing…')
    setImportResult(((await dispatch({ type: 'bookmarks/import', source, target: importTarget })) as string) || '')
  }
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

        <AppearanceSection state={state} spaceId={lookSpaceId ?? state.activeSpaceId} onPick={setLookSpaceId} />

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
                <span className="space-swatch" style={{ background: themeStyle(space.theme, systemDark).background }}>
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
          <h2>Extensions</h2>
          {state.extensions.map((ext) => (
            <div className="setting-row" key={ext.id}>
              <div className="space-summary">
                {ext.icon ? <img className="extension-icon" src={ext.icon} alt="" /> : <span className="extension-icon" />}
                <div>
                  <div className="setting-label">{ext.name}</div>
                  <div className="setting-hint">Version {ext.version}</div>
                </div>
              </div>
              <div className="row-actions">
                <button
                  className="secondary-button danger"
                  onClick={() => confirm(`Remove “${ext.name}” from VAIA?`) && dispatch({ type: 'extensions/remove', id: ext.id })}
                >
                  Remove
                </button>
                <Toggle checked={ext.enabled} onChange={(v) => dispatch({ type: 'extensions/setEnabled', id: ext.id, enabled: v })} />
              </div>
            </div>
          ))}
          <div className="setting-row">
            <div>
              <div className="setting-label">Chrome Web Store</div>
              <div className="setting-hint">
                Click “Add to Chrome” on an extension’s page to add it to VAIA. Extensions work in your normal profile (not
                in Spaces with a separate profile or private windows).
              </div>
            </div>
            <button className="secondary-button" onClick={() => dispatch({ type: 'extensions/openStore' })}>
              Get Extensions
            </button>
          </div>
        </section>

        <section>
          <h2>Site permissions</h2>
          {Object.keys(state.sitePermissions).length === 0 && (
            <div className="setting-row">
              <div className="setting-hint">
                When a site asks for your camera, microphone, location or notifications, VAIA asks you first. Sites you
                answered with “Remember for this site” appear here.
              </div>
            </div>
          )}
          {Object.entries(state.sitePermissions).map(([origin, perms]) => (
            <div className="setting-row permission-site" key={origin}>
              <div className="permission-head">
                <div className="setting-label">{origin.replace(/^https?:\/\//, '')}</div>
                <button className="text-button small" onClick={() => dispatch({ type: 'permissions/resetSite', origin })}>
                  Reset
                </button>
              </div>
              {Object.entries(perms).map(([kind, decision]) => (
                <div className="permission-row" key={kind}>
                  <span>{PERMISSION_NAMES[kind as PermissionKind] ?? kind}</span>
                  <select
                    value={decision}
                    onChange={(e) =>
                      dispatch({
                        type: 'permissions/set',
                        origin,
                        kind: kind as PermissionKind,
                        decision: e.target.value === 'ask' ? null : (e.target.value as 'allow' | 'block')
                      })
                    }
                  >
                    <option value="allow">Allow</option>
                    <option value="block">Block</option>
                    <option value="ask">Ask</option>
                  </select>
                </div>
              ))}
            </div>
          ))}
          {Object.keys(state.sitePermissions).length > 0 && (
            <div className="setting-row end">
              <button className="secondary-button" onClick={() => dispatch({ type: 'permissions/resetAll' })}>
                Reset All
              </button>
            </div>
          )}
        </section>

        <section>
          <h2>Import bookmarks</h2>
          <div className="setting-row">
            <div>
              <div className="setting-label">Put them in</div>
              <div className="setting-hint">
                {importTarget === 'pinned'
                  ? 'A pinned folder in this Space, keeping your folders.'
                  : 'Favorites: the links on your bookmarks bar (up to 24).'}
              </div>
            </div>
            <select value={importTarget} onChange={(e) => setImportTarget(e.target.value as 'pinned' | 'favorites')}>
              <option value="pinned">A pinned folder</option>
              <option value="favorites">Favorites</option>
            </select>
          </div>
          <div className="setting-row end">
            {importResult && <span className="setting-hint import-result">{importResult}</span>}
            <button className="secondary-button" onClick={() => importFrom('chrome')}>
              From Chrome
            </button>
            <button className="secondary-button" onClick={() => importFrom('safari')}>
              From Safari
            </button>
            <button className="secondary-button" onClick={() => importFrom('file')}>
              From a File…
            </button>
          </div>
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

/** Settings → Appearance: the same look controls as the Space editor, with a live preview. */
function AppearanceSection({ state, spaceId, onPick }: { state: AppState; spaceId: string; onPick: (id: string) => void }) {
  const space = state.spaces.find((s) => s.id === spaceId) ?? state.spaces[0]
  return (
    <section>
      <h2>Appearance</h2>
      <div className="setting-row">
        <div>
          <div className="setting-label">Space</div>
          <div className="setting-hint">Each Space has its own pastel color on top of VAIA’s black-and-white look.</div>
        </div>
        <select value={space.id} onChange={(e) => onPick(e.target.value)}>
          {state.spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.icon} {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="setting-row appearance-row">
        <div className="appearance-preview">
          <ThemePreview theme={space.theme} icon={space.icon} name={space.name} />
          <div className="setting-hint">Changes apply right away.</div>
        </div>
        <ThemeControls
          key={space.id}
          theme={space.theme}
          onChange={(patch) => dispatch({ type: 'space/update', id: space.id, patch: { theme: patch } })}
        />
      </div>
    </section>
  )
}
