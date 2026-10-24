// The Settings window (⌘,).
import { useCallback, useEffect, useState } from 'react'
import type { AppState, ArchiveAfter, PasswordInfo, PermissionKind, SearchEngineId } from '../../shared/types'
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
              <div className="setting-label">Google sign-in compatibility</div>
              <div className="setting-hint">
                Google blocks sign-in from browsers like VAIA. With this on, Google’s sign-in pages (only those) are told
                VAIA is Firefox, which Google accepts. Every other site sees VAIA as usual.
              </div>
            </div>
            <Toggle checked={s.googleSignInCompat} onChange={(v) => set({ googleSignInCompat: v })} />
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

        <PasswordsSection state={state} />

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

/** Which password "profile" a Space uses: the shared one, or its own separate profile. */
function passwordProfiles(state: AppState): { key: string; label: string }[] {
  const shared = state.spaces.filter((s) => !s.profileId)
  const out = shared.length ? [{ key: 'default', label: `Shared: ${shared.map((s) => `${s.icon} ${s.name}`).join(', ')}` }] : []
  for (const s of state.spaces) if (s.profileId) out.push({ key: s.profileId, label: `${s.icon} ${s.name} (separate account)` })
  return out
}

function PasswordRow({ entry, onChanged }: { entry: PasswordInfo; onChanged: () => void }) {
  const [shown, setShown] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [username, setUsername] = useState(entry.username)
  const [password, setPassword] = useState('')
  const [copied, setCopied] = useState(false)
  // Viewing, copying and editing need Touch ID (or your Mac password) first.
  const reveal = async () => (await dispatch({ type: 'passwords/reveal', id: entry.id })) as string | null
  return (
    <div className="setting-row password-row">
      <div style={{ minWidth: 0 }}>
        <div className="setting-label">{entry.origin.replace(/^https?:\/\//, '')}</div>
        {editing ? (
          <div className="password-edit">
            <input value={username} placeholder="Username" onChange={(e) => setUsername(e.target.value)} />
            <input value={password} type="text" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
          </div>
        ) : (
          <div className="setting-hint">
            {entry.username || '(no username)'} · <span className="password-value">{shown ?? '••••••••'}</span>
          </div>
        )}
      </div>
      <div className="row-actions">
        {editing ? (
          <>
            <button className="text-button small" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button
              className="secondary-button"
              disabled={!password}
              onClick={async () => {
                await dispatch({ type: 'passwords/update', id: entry.id, username, password })
                setEditing(false)
                setShown(null)
                onChanged()
              }}
            >
              Save
            </button>
          </>
        ) : (
          <>
            <button className="text-button small" onClick={async () => setShown(shown ? null : await reveal())}>
              {shown ? 'Hide' : 'Show'}
            </button>
            <button
              className="text-button small"
              onClick={async () => {
                const value = await reveal()
                if (value === null) return
                await navigator.clipboard.writeText(value)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              className="text-button small"
              onClick={async () => {
                const value = await reveal()
                if (value === null) return
                setPassword(value)
                setUsername(entry.username)
                setEditing(true)
              }}
            >
              Edit
            </button>
            <button
              className="text-button small danger"
              onClick={async () => {
                if (!confirm(`Delete the saved password for ${entry.origin.replace(/^https?:\/\//, '')}?`)) return
                await dispatch({ type: 'passwords/delete', id: entry.id })
                onChanged()
              }}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** Settings → Passwords: saved logins per profile, plus importing a Google/Chrome export. */
function PasswordsSection({ state }: { state: AppState }) {
  const profiles = passwordProfiles(state)
  const [profile, setProfile] = useState(profiles[0]?.key ?? 'default')
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState<PasswordInfo[]>([])
  const [importResult, setImportResult] = useState<{ message: string; file?: string } | null>(null)
  const refresh = useCallback(() => {
    window.vaia.listPasswords().then(setEntries, () => setEntries([]))
  }, [])
  useEffect(() => {
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refresh])
  const q = query.trim().toLowerCase()
  const shown = entries.filter((e) => e.profile === profile && (!q || `${e.origin} ${e.username}`.toLowerCase().includes(q)))

  return (
    <section>
      <h2>Passwords</h2>
      <div className="setting-row">
        <div>
          <div className="setting-label">Saved for</div>
          <div className="setting-hint">Each separate account keeps its own passwords. They’re encrypted on this Mac and never sent anywhere.</div>
        </div>
        <select value={profile} onChange={(e) => setProfile(e.target.value)}>
          {profiles.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div className="setting-row">
        <div className="password-search">
          <input placeholder="Search passwords" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      {shown.length === 0 && (
        <div className="setting-row">
          <div className="setting-hint">
            {q ? 'No saved passwords match.' : 'When you log in to a site, VAIA offers to save the password here.'}
          </div>
        </div>
      )}
      {shown.map((entry) => (
        <PasswordRow key={entry.id} entry={entry} onChanged={refresh} />
      ))}
      <div className="setting-row">
        <div>
          <div className="setting-label">Import from Google Password Manager or Chrome</div>
          <ol className="csv-help">
            <li>Go to passwords.google.com, open Settings (the gear), choose “Export passwords” and download the file.</li>
            <li>Click “Import CSV…” and choose that file. Passwords go into the account picked above.</li>
            <li className="csv-warning">Then delete the .csv file: it contains your passwords in plain text.</li>
          </ol>
          <div className="setting-hint">VAIA can’t stay in sync with Google Password Manager; importing is a one-time copy.</div>
        </div>
        <button
          className="secondary-button"
          onClick={async () => {
            const result = (await dispatch({ type: 'passwords/importCsv', profile })) as { message: string; file?: string }
            if (result.message) setImportResult(result)
            refresh()
          }}
        >
          Import CSV…
        </button>
      </div>
      {importResult && (
        <div className="setting-row end">
          <span className="setting-hint import-result">{importResult.message}</span>
          {importResult.file && (
            <button
              className="secondary-button danger"
              onClick={async () => {
                await dispatch({ type: 'passwords/trashCsv', path: importResult.file! })
                setImportResult({ message: 'The .csv file was moved to the Trash. Empty the Trash to delete it for good.' })
              }}
            >
              Move the CSV to the Trash
            </button>
          )}
        </div>
      )}
    </section>
  )
}
