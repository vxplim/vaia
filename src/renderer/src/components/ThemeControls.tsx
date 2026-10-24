// The controls for a Space's look, shared by the Space editor and Settings → Appearance.
import { useState } from 'react'
import { THEME_PRESETS } from '../../../shared/themes'
import type { Theme, ThemeMode } from '../../../shared/types'
import { DEFAULT_INTENSITY, colorsToCss, themeStyle, useSystemDark } from '../theme'
import { ColorWheel } from './ColorWheel'

/** A tiny VAIA window painted with the theme, so you see changes as you make them. */
export function ThemePreview({ theme, icon, name }: { theme: Theme; icon: string; name: string }) {
  const systemDark = useSystemDark()
  const style = themeStyle(theme, systemDark)
  return (
    <div className={`theme-preview${style.isDark ? ' dark' : ''}`} style={{ ...(style.vars as React.CSSProperties), background: style.background }}>
      <div className="theme-preview-sidebar">
        <div className="theme-preview-dots">
          <i />
          <i />
          <i />
        </div>
        <div className="theme-preview-url" />
        <div className="theme-preview-label">
          {icon} {name}
        </div>
        <div className="theme-preview-tab active" />
        <div className="theme-preview-tab" />
        <div className="theme-preview-tab short" />
      </div>
      <div className="theme-preview-card" />
    </div>
  )
}

function Slider({
  label,
  left,
  right,
  value,
  min,
  max,
  reset,
  onChange
}: {
  label: string
  left: string
  right: string
  value: number
  min: number
  max: number
  reset: number
  onChange: (value: number) => void
}) {
  return (
    <div className="theme-slider">
      <div className="field-label">{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        title="Double-click to reset"
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(reset)}
      />
      <div className="theme-slider-ends">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  )
}

export function ThemeControls({ theme, onChange }: { theme: Theme; onChange: (patch: Partial<Theme>) => void }) {
  const [stop, setStop] = useState(0)
  const colors = theme.colors.length ? theme.colors : ['#e8e4dc']
  const gradient = theme.gradient ?? colors.length > 1
  const shown = gradient ? colors : colors.slice(0, 1)
  const stopIndex = Math.min(stop, shown.length - 1)
  const setColor = (hex: string) => onChange({ colors: colors.map((c, i) => (i === stopIndex ? hex : c)) })

  return (
    <div className="theme-controls">
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
              onChange({ colors: [...p.colors], gradient: p.colors.length > 1 })
            }}
          />
        ))}
      </div>

      <div className="field-label">
        Colors
        <label className="inline-toggle" title="Blend two or three colors">
          <input
            type="checkbox"
            checked={gradient}
            onChange={(e) => {
              const on = e.target.checked
              // Turning the gradient on with one color adds a second one to start from.
              if (on && colors.length === 1) onChange({ gradient: true, colors: [colors[0], '#c8def7'] })
              else onChange({ gradient: on })
              setStop(0)
            }}
          />
          Gradient
        </label>
      </div>
      <div className="stops">
        {shown.map((c, i) => (
          <button
            key={i}
            className={`stop${i === stopIndex ? ' selected' : ''}`}
            style={{ background: c }}
            title="Edit this color"
            onClick={() => setStop(i)}
          />
        ))}
        {gradient && colors.length < 3 && (
          <button
            className="stop add"
            title="Add a color"
            onClick={() => {
              onChange({ colors: [...colors, colors[colors.length - 1]] })
              setStop(colors.length)
            }}
          >
            +
          </button>
        )}
        {gradient && colors.length > 2 && (
          <button
            className="stop add"
            title="Remove the selected color"
            onClick={() => {
              onChange({ colors: colors.filter((_, i) => i !== stopIndex) })
              setStop(0)
            }}
          >
            −
          </button>
        )}
      </div>
      <ColorWheel color={shown[stopIndex]} onChange={setColor} />

      <Slider
        label="Intensity"
        left="Whisper"
        right="Soft"
        min={0}
        max={100}
        reset={DEFAULT_INTENSITY * 100}
        value={Math.round((theme.intensity ?? DEFAULT_INTENSITY) * 100)}
        onChange={(v) => onChange({ intensity: v / 100 })}
      />
      <Slider
        label="Tone"
        left="Warmer"
        right="Cooler"
        min={-100}
        max={100}
        reset={0}
        value={Math.round((theme.tone ?? 0) * 100)}
        onChange={(v) => onChange({ tone: Math.abs(v) < 4 ? 0 : v / 100 })}
      />

      <div className="field-label">Appearance</div>
      <div className="segmented">
        {(['light', 'auto', 'dark'] as ThemeMode[]).map((m) => (
          <button key={m} className={theme.mode === m ? 'selected' : ''} onClick={() => onChange({ mode: m })}>
            {m === 'auto' ? 'Auto' : m === 'light' ? 'Light' : 'Dark'}
          </button>
        ))}
      </div>
    </div>
  )
}
