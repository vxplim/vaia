// Runs inside web pages, in an isolated world the page's own scripts can't see.
// Hold Shift while resting the pointer on a link for half a second: the link opens in Peek.
import { ipcRenderer } from 'electron'

const HOLD_MS = 500

if (window.top === window && /^https?:$/.test(location.protocol)) {
  let link: HTMLAnchorElement | null = null
  let shift = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let opened = ''

  const restart = () => {
    if (timer) clearTimeout(timer)
    timer = null
    const href = link?.href ?? ''
    if (!shift || !/^https?:/.test(href) || href === opened) return
    timer = setTimeout(() => {
      opened = href
      ipcRenderer.send('peek:link', href)
    }, HOLD_MS)
  }

  document.addEventListener(
    'mouseover',
    (e) => {
      const next = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (next === link) return
      link = next
      opened = ''
      shift = e.shiftKey
      restart()
    },
    true
  )
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Shift' && !shift) {
      shift = true
      restart()
    }
  })
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
      shift = false
      restart()
    }
  })
}
