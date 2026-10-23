import { useEffect, useState } from 'react'

/**
 * The window's tinted background. Gradients can't animate directly, so when the
 * Space changes we fade the new background in on top of the old one.
 */
export function Backdrop({ background }: { background: string }) {
  const [layers, setLayers] = useState([{ background, key: 0 }])

  useEffect(() => {
    setLayers((prev) => {
      if (prev[prev.length - 1].background === background) return prev
      return [prev[prev.length - 1], { background, key: prev[prev.length - 1].key + 1 }]
    })
  }, [background])

  return (
    <>
      {layers.map((layer, i) => (
        <div
          key={layer.key}
          className={`backdrop${i > 0 ? ' fade-in' : ''}`}
          style={{ background: layer.background }}
          onAnimationEnd={() => setLayers((prev) => prev.slice(-1))}
        />
      ))}
    </>
  )
}
