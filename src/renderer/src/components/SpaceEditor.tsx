import { useEffect, useState } from 'react'
import { SPACE_EMOJI, THEME_PRESETS } from '../../../shared/themes'
import type { AppState, Space, ThemeMode } from '../../../shared/types'
import { dispatch } from '../state'
import { colorsToCss } from '../theme'
import { ColorWheel } from './ColorWheel'

interface Props {
  state: AppState
  space: Space
  closing: boolean
  onClose: () => void
}

/** Name, emoji, colors, light/dark mode and profile for one Space. Changes apply live. */
export function SpaceEditor({ state, space, closing, onClose }: Props) {
  const [name, setName] = useState(space.name)
  const [stop, setStop] = useState(0)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const colors = space.theme.colors
  const stopIndex = Math.min(stop, colors.length - 1)

  useEffect(() => setName(space.name), [space.id, space.name])

  const setTheme = (patch: { colors?: string[]; mode?: ThemeMode }) =>
    dispatch({ type: 'space/update', id: space.id, patch: { theme: patch } })

  const setColor = (hex: string) => setTheme({ colors: colors.map((c, i) => (i === stopIndex ? hex : c)) })

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

        <div className="field-label">Presets</div>
        <div className="presets">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.name}
              className="swatch"
              title={p.name}
              style={{ background: colorsToCss(p.colors) }}
              onClick={() => {
                setStop(0)
                setTheme({ colors: [...p.colors] })
              }}
            />
          ))}
        </div>

        <div className="field-label">
          Colors
          <span className="field-hint">{colors.length === 1 ? 'Solid' : 'Gradient'}</span>
        </div>
        <div className="stops">
          {colors.map((c, i) => (
            <button
              key={i}
              className={`stop${i === stopIndex ? ' selected' : ''}`}
              style={{ background: c }}
              title="Edit this color"
              onClick={() => setStop(i)}
            />
          ))}
          {colors.length < 3 && (
            <button
              className="stop add"
              title="Add a color (gradient)"
              onClick={() => {
                setTheme({ colors: [...colors, colors[colors.length - 1]] })
                setStop(colors.length)
              }}
            >
              +
            </button>
          )}
          {colors.length > 1 && (
            <button
              className="stop add"
              title="Remove the selected color"
              onClick={() => {
                setTheme({ colors: colors.filter((_, i) => i !== stopIndex) })
                setStop(0)
              }}
            >
              −
            </button>
          )}
        </div>
        <ColorWheel color={colors[stopIndex]} onChange={setColor} />

        <div className="field-label">Appearance</div>
        <div className="segmented">
          {(['light', 'auto', 'dark'] as ThemeMode[]).map((m) => (
            <button key={m} className={space.theme.mode === m ? 'selected' : ''} onClick={() => setTheme({ mode: m })}>
              {m === 'auto' ? 'Auto' : m === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>

        <label className="check-row">
          <input
            type="checkbox"
            checked={!!space.profileId}
            onChange={(e) => dispatch({ type: 'space/setProfile', id: space.id, separate: e.target.checked })}
          />
          <span>
            Separate profile
            <small>This Space gets its own cookies and logins, e.g. a second Google account.</small>
          </span>
        </label>

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
