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
