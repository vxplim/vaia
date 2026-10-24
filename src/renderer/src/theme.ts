// Turns a Space's theme (colors + light/dark mode) into CSS variables.
import { useEffect, useState } from 'react'
import type { Theme } from '../../shared/types'

type RGB = [number, number, number]

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0')
  const n = parseInt(full.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function luminance([r, g, b]: RGB): number {
  const f = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

export function useSystemDark(): boolean {
  const query = '(prefers-color-scheme: dark)'
  const [dark, setDark] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return dark
}

export interface ThemeStyle {
  background: string
  isDark: boolean
  vars: Record<string, string>
}

export const DEFAULT_INTENSITY = 0.6

const WHITE: RGB = [255, 255, 255]
const NEAR_BLACK: RGB = [17, 17, 18]
const WARM: RGB = [255, 196, 140]
const COOL: RGB = [140, 182, 255]

/** The Space's colors after its tone and gradient settings. */
export function themeColors(theme: Theme): string[] {
  const picked = theme.colors.length ? theme.colors : ['#e8e4dc']
  const gradient = theme.gradient ?? picked.length > 1
  const tone = Math.max(-1, Math.min(1, theme.tone ?? 0))
  return (gradient ? picked : picked.slice(0, 1)).map((hex) => {
    const c = hexToRgb(hex)
    return rgbToHex(tone === 0 ? c : mix(c, tone < 0 ? WARM : COOL, Math.abs(tone) * 0.4))
  })
}

/**
 * VAIA's window is white (or near-black in dark mode) with the Space's pastel
 * mixed in: a whisper of color at low intensity, a soft pastel at full.
 */
export function themeStyle(theme: Theme, systemDark: boolean): ThemeStyle {
  const isDark = theme.mode === 'dark' || (theme.mode === 'auto' && systemDark)
  const intensity = Math.max(0, Math.min(1, theme.intensity ?? DEFAULT_INTENSITY))
  const amount = isDark ? 0.05 + 0.2 * intensity : 0.12 + 0.88 * intensity
  const base = isDark ? NEAR_BLACK : WHITE
  const hex = themeColors(theme).map((c) => rgbToHex(mix(base, hexToRgb(c), amount)))
  const background =
    hex.length === 1 ? hex[0] : `linear-gradient(160deg, ${hex.map((c, i) => `${c} ${Math.round((i / (hex.length - 1)) * 100)}%`).join(', ')})`
  const ink = isDark ? '255, 255, 255' : '0, 0, 0'
  return {
    background,
    isDark,
    vars: {
      '--fg': isDark ? '#f5f5f5' : '#111111',
      '--fg-muted': isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.58)',
      '--fg-faint': `rgba(${ink}, 0.3)`,
      '--hover': `rgba(${ink}, 0.05)`,
      '--press': `rgba(${ink}, 0.09)`,
      '--field': isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.7)',
      '--field-border': `rgba(${ink}, 0.08)`,
      '--divider': `rgba(${ink}, 0.09)`,
      '--active-tab': isDark ? 'rgba(255, 255, 255, 0.11)' : '#ffffff',
      '--active-shadow': isDark
        ? '0 0 0 1px rgba(255, 255, 255, 0.08), 0 1px 2px rgba(0, 0, 0, 0.3)'
        : '0 0 0 1px rgba(0, 0, 0, 0.07), 0 1px 3px rgba(0, 0, 0, 0.06)',
      '--accent': isDark ? '#f5f5f5' : '#111111'
    }
  }
}

/** Hue 0–360, saturation and value 0–1. */
export interface HSV {
  h: number
  s: number
  v: number
}

export function hexToHsv(hex: string): HSV {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255)
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
  }
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max }
}

export function hsvToHex({ h, s, v }: HSV): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return rgbToHex([f(5) * 255, f(3) * 255, f(1) * 255])
}

/** CSS background for a list of colors (used for swatches and the window). */
export function colorsToCss(colors: string[]): string {
  if (colors.length <= 1) return colors[0] ?? '#e8e4dc'
  return `linear-gradient(160deg, ${colors.join(', ')})`
}
