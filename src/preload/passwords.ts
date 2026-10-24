// Runs inside web pages, in an isolated world the page's own scripts can't see.
// It notices when you log in (so VAIA can offer to save the password) and fills
// in a saved login when you click into a login field on the exact same site.
import { ipcRenderer } from 'electron'

// Only the main page of a tab (not ads or other sites' embedded frames), and only real websites.
if (window.top === window && /^https?:$/.test(location.protocol)) {
  const visible = (el: HTMLInputElement) => !el.disabled && !el.readOnly && el.getClientRects().length > 0
  const isUsername = (el: HTMLInputElement) =>
    ['text', 'email', 'tel'].includes(el.type) &&
    /user|login|email|mail|account|identifier|phone/i.test(`${el.name} ${el.id} ${el.autocomplete}`)

  /** The login fields on the page right now: a password box and the username box before it. */
  const loginFields = () => {
    const inputs = [...document.querySelectorAll('input')].filter(visible)
    const password = inputs.find((el) => el.type === 'password') ?? null
    const before = (password ? inputs.slice(0, inputs.indexOf(password)) : inputs).reverse()
    const username = before.find(isUsername) ?? before.find((el) => el.type === 'text' || el.type === 'email') ?? null
    return { username, password }
  }

  // ---- Noticing a login ----
  let lastSent = ''
  const report = () => {
    const { username, password } = loginFields()
    if (password?.value) {
      const key = `${username?.value ?? ''}\n${password.value}`
      if (key === lastSent) return
      lastSent = key
      ipcRenderer.send('pw:submitted', { origin: location.origin, username: username?.value ?? '', password: password.value })
    } else if (username?.value && isUsername(username)) {
      // Two-step logins (e.g. Google) ask for the username first and the password on the next page.
      ipcRenderer.send('pw:username', { origin: location.origin, username: username.value })
    }
  }
  document.addEventListener('submit', report, true)
  document.addEventListener('keydown', (e) => e.key === 'Enter' && report(), true)
  document.addEventListener(
    'click',
    (e) => {
      if ((e.target as Element | null)?.closest?.('button, input[type=submit], [role=button]')) report()
    },
    true
  )

  // ---- Filling in a saved login (after you click into a login field) ----
  let filled = false
  const setValue = (el: HTMLInputElement, value: string) => {
    // Use the browser's own setter so sites built with React & co. notice the change.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  document.addEventListener(
    'focusin',
    async (e) => {
      if (filled) return
      const { username, password } = loginFields()
      if (e.target !== password && !(e.target === username && username && isUsername(username))) return
      filled = true
      const saved = (await ipcRenderer.invoke('pw:lookup', location.origin)) as { username: string; password: string }[]
      const login = saved.find((s) => !username?.value || s.username === username.value)
      if (!login) return
      if (username && !username.value) setValue(username, login.username)
      if (password && !password.value) setValue(password, login.password)
    },
    true
  )
}
