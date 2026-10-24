import { useEffect, useState } from 'react'
import { SPACE_EMOJI } from '../../../shared/themes'
import type { AppState, Space, Theme } from '../../../shared/types'
import { dispatch } from '../state'
import { ThemeControls, ThemePreview } from './ThemeControls'

interface Props {
  state: AppState
  space: Space
  /** A brand-new Space: start with the account setup step. */
  setup?: boolean
  closing: boolean
  onClose: () => void
}

/** Name, emoji, look (colors, intensity, tone, light/dark) and profile for one Space. Changes apply live. */
export function SpaceEditor({ state, space, setup = false, closing, onClose }: Props) {
  const [name, setName] = useState(space.name)
  const [setupDone, setSetupDone] = useState(!setup)
  const [emojiOpen, setEmojiOpen] = useState(false)

  useEffect(() => setName(space.name), [space.id, space.name])

  const setTheme = (patch: Partial<Theme>) => dispatch({ type: 'space/update', id: space.id, patch: { theme: patch } })

  const commitName = () => {
    if (name.trim() && name !== space.name) dispatch({ type: 'space/update', id: space.id, patch: { name } })
  }

  return (
    <div className={`overlay-layer light${closing ? ' closing' : ''}`} onMouseDown={onClose}>
      <div
        className="panel space-editor"
        style={{ left: state.settings.sidebarVisible ? state.settings.sidebarWidth + 16 : 24 }}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <div className="space-editor-head">
          <button className="emoji-button" title="Choose an icon" onClick={() => setEmojiOpen((o) => !o)}>
            {space.icon}
          </button>
          <input
            className="text-field"
            value={name}
            placeholder="Space name"
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === 'Enter' && (commitName(), (e.target as HTMLInputElement).blur())}
          />
        </div>

        {emojiOpen && (
          <div className="emoji-grid">
            {SPACE_EMOJI.map((emoji) => (
              <button
                key={emoji}
                className={emoji === space.icon ? 'selected' : ''}
                onClick={() => {
                  dispatch({ type: 'space/update', id: space.id, patch: { icon: emoji } })
                  setEmojiOpen(false)
                }}
              >
                {emoji}
              </button>
            ))}
            <input
              className="emoji-custom"
              maxLength={4}
              placeholder="Type"
              title="Or type any emoji"
              onChange={(e) => {
                const value = e.target.value.trim()
                if (value) dispatch({ type: 'space/update', id: space.id, patch: { icon: value } })
              }}
            />
          </div>
        )}

        {!setupDone && (
          <div className="space-setup">
            <div className="space-setup-title">Set up this Space</div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={!!space.profileId}
                onChange={(e) => dispatch({ type: 'space/setProfile', id: space.id, separate: e.target.checked })}
              />
              <span>
                Use a separate account for this Space
                <small>Its own cookies, logins and saved passwords, e.g. a work Google account.</small>
              </span>
            </label>
            <div className="space-setup-actions">
              <button
                className="google-button"
                onClick={() => {
                  setSetupDone(true)
                  onClose()
                  dispatch({ type: 'space/signInGoogle', id: space.id })
                }}
              >
                Sign in with Google
              </button>
              <button className="text-button" onClick={() => setSetupDone(true)}>
                {space.profileId ? 'Continue' : 'Skip'}
              </button>
            </div>
            <div className="field-hint">You can change this later in the Space’s settings.</div>
          </div>
        )}

        <ThemePreview theme={space.theme} icon={space.icon} name={name || space.name} />
        <ThemeControls theme={space.theme} onChange={setTheme} />

        <label className="check-row">
          <input
            type="checkbox"
            checked={!!space.profileId}
            onChange={(e) => dispatch({ type: 'space/setProfile', id: space.id, separate: e.target.checked })}
          />
          <span>
            Separate profile
            <small>This Space gets its own cookies, logins and saved passwords, e.g. a second Google account.</small>
          </span>
        </label>
        <button
          className="google-button small"
          onClick={() => {
            onClose()
            dispatch({ type: 'space/signInGoogle', id: space.id })
          }}
        >
          Sign in with Google{space.profileId ? ' in this Space' : ''}
        </button>

        <div className="panel-footer">
          {state.spaces.length > 1 && (
            <button
              className="text-button danger"
              onClick={() => {
                onClose()
                dispatch({ type: 'space/delete', id: space.id })
              }}
            >
              Delete Space
            </button>
          )}
          <button className="primary-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
