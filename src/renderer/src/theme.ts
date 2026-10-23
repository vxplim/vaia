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

export function themeStyle(theme: Theme, systemDark: boolean): ThemeStyle {
  const wantDark = theme.mode === 'dark' || (theme.mode === 'auto' && systemDark)
  const base = (theme.colors.length ? theme.colors : ['#e8e4dc']).map(hexToRgb)
  // In dark mode, keep the hue but sink the colors toward near-black.
  const colors = base.map((c) => (wantDark ? mix(c, [22, 22, 26], 0.74) : c))
  const avg = mix(colors[0], colors[colors.length - 1], 0.5)
  const isDark = luminance(avg) < 0.32
  const hex = colors.map(rgbToHex)
  const background =
    hex.length === 1 ? hex[0] : `linear-gradient(160deg, ${hex.map((c, i) => `${c} ${Math.round((i / (hex.length - 1)) * 100)}%`).join(', ')})`
  const ink = isDark ? '255, 255, 255' : '0, 0, 0'
  return {
    background,
    isDark,
    vars: {
      '--fg': isDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.84)',
      '--fg-muted': `rgba(${ink}, 0.5)`,
      '--fg-faint': `rgba(${ink}, 0.28)`,
      '--hover': `rgba(${ink}, 0.06)`,
      '--press': `rgba(${ink}, 0.1)`,
      '--field': `rgba(${ink}, 0.06)`,
      '--divider': `rgba(${ink}, 0.1)`,
      '--active-tab': isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.78)',
      '--active-shadow': isDark ? '0 1px 2px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.08)',
      '--accent': rgbToHex(wantDark ? mix(base[0], [255, 255, 255], 0.1) : mix(base[0], [0, 0, 0], 0.45))
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
