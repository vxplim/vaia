import { useEffect } from 'react'

/** A small message (like "Copied URL") that fades away on its own. */
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="toast" role="status">
      {message}
    </div>
  )
}
