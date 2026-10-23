import { useState } from 'react'
import { displayHost } from '../../../shared/url'

/** A site's icon, or a soft letter badge if it has none / fails to load. */
export function Favicon({ src, url, size = 16 }: { src?: string; url: string; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null)
  if (src && failed !== src) {
    return (
      <img
        className="favicon"
        src={src}
        width={size}
        height={size}
        alt=""
        draggable={false}
        onError={() => setFailed(src)}
      />
    )
  }
  const letter = (displayHost(url) || '•').charAt(0).toUpperCase()
  return (
    <span className="favicon favicon-letter" style={{ width: size, height: size, fontSize: size * 0.62 }}>
      {letter}
    </span>
  )
}
