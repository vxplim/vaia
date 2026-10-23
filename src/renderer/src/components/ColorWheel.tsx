import { useEffect, useRef, type PointerEvent } from 'react'
import { hexToHsv, hsvToHex } from '../theme'

const SIZE = 168

/** A round color picker: angle = hue, distance from the center = how colorful. Plus a brightness slider. */
export function ColorWheel({ color, onChange }: { color: string; onChange: (hex: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const hsv = hexToHsv(color)

  // Paint the wheel once.
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const scale = 2
    el.width = SIZE * scale
    el.height = SIZE * scale
    const ctx = el.getContext('2d')!
    const img = ctx.createImageData(el.width, el.height)
    const r = el.width / 2
    for (let y = 0; y < el.height; y++) {
      for (let x = 0; x < el.width; x++) {
        const dx = x - r
        const dy = y - r
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > r) continue
        const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360
        const hex = hsvToHex({ h, s: dist / r, v: 1 })
        const i = (y * el.width + x) * 4
        img.data[i] = parseInt(hex.slice(1, 3), 16)
        img.data[i + 1] = parseInt(hex.slice(3, 5), 16)
        img.data[i + 2] = parseInt(hex.slice(5, 7), 16)
        // Soften the very edge so the circle looks smooth.
        img.data[i + 3] = Math.min(255, (r - dist) * 255)
      }
    }
    ctx.putImageData(img, 0, 0)
  }, [])

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = e.clientX - rect.left - SIZE / 2
    const dy = e.clientY - rect.top - SIZE / 2
    const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360
    const s = Math.min(1, Math.sqrt(dx * dx + dy * dy) / (SIZE / 2))
    onChange(hsvToHex({ h, s, v: hsv.v || 1 }))
  }

  const angle = (hsv.h * Math.PI) / 180
  const markerX = SIZE / 2 + Math.cos(angle) * hsv.s * (SIZE / 2)
  const markerY = SIZE / 2 + Math.sin(angle) * hsv.s * (SIZE / 2)

  return (
    <div className="color-wheel">
      <div
        className="wheel"
        style={{ width: SIZE, height: SIZE }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          pick(e)
        }}
        onPointerMove={(e) => e.buttons === 1 && pick(e)}
      >
        <canvas ref={canvas} style={{ width: SIZE, height: SIZE, opacity: 0.35 + hsv.v * 0.65 }} />
        <span className="wheel-marker" style={{ left: markerX, top: markerY, background: color }} />
      </div>
      <label className="brightness">
        <span>Brightness</span>
        <input
          type="range"
          min={0.15}
          max={1}
          step={0.01}
          value={hsv.v}
          onChange={(e) => onChange(hsvToHex({ ...hsv, v: Number(e.target.value) }))}
        />
      </label>
    </div>
  )
}
