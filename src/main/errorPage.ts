// The friendly page shown when a site can't be loaded. It's written into
// Chromium's (otherwise blank) error page; its buttons are vaia-page: links
// that the brain catches (see wireView in browser.ts).

interface ErrorText {
  title: string
  body: string
  /** Certificate problems: no "Try again", and a warning colour. */
  danger?: boolean
}

function describe(code: number, host: string): ErrorText {
  if (code <= -200 && code > -300) {
    return {
      title: 'This connection isn’t private',
      body: `VAIA couldn’t confirm that this is really ${host}. Someone might be trying to steal your information, so the page was blocked.`,
      danger: true
    }
  }
  switch (code) {
    case -105:
    case -137:
      return { title: 'Can’t find this site', body: `${host}’s address couldn’t be found. Check the spelling, or try again in a moment.` }
    case -106:
    case -21:
      return { title: 'You’re offline', body: 'Check your Wi-Fi or network connection, then try again.' }
    case -102:
      return { title: 'This site can’t be reached', body: `${host} refused to connect.` }
    case -118:
    case -7:
      return { title: 'This site took too long to respond', body: `${host} didn’t answer in time.` }
    case -20:
      return { title: 'This page was blocked', body: 'The ad and tracker blocker stopped this page from loading.' }
    case -300:
      return { title: 'That address doesn’t look right', body: 'Check it for typos and try again.' }
    default:
      return { title: 'This site can’t be reached', body: `${host} couldn’t be loaded.` }
  }
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** A script that replaces the blank error page with VAIA's own. */
export function errorPageScript(url: string, code: number, description: string, canGoBack: boolean): string {
  let host = url
  try {
    host = new URL(url).host || url
  } catch {
    // keep the raw address
  }
  const text = describe(code, escape(host))
  const buttons = [
    text.danger
      ? canGoBack
        ? '<a class="primary" href="vaia-page:back">Go back</a>'
        : '<a class="primary" href="vaia-page:close">Close tab</a>'
      : '<a class="primary" href="vaia-page:reload">Try again</a>',
    !text.danger && canGoBack ? '<a href="vaia-page:back">Go back</a>' : ''
  ].join('')
  const html = `<head><meta charset="utf-8"><title>${escape(host)}</title><style>
    :root{color-scheme:light dark}
    body{margin:0;min-height:100vh;display:grid;place-items:center;font:15px/1.5 -apple-system,system-ui,sans-serif;
      background:#fafaf8;color:#1d1d1f}
    @media (prefers-color-scheme:dark){body{background:#1f1f22;color:#f2f2f4}}
    main{max-width:440px;padding:40px 28px;text-align:center}
    .mark{width:52px;height:52px;margin:0 auto 18px;border-radius:16px;display:grid;place-items:center;font-size:24px;
      background:${text.danger ? 'rgba(229,83,61,.14)' : 'rgba(127,127,127,.12)'}}
    h1{margin:0 0 8px;font-size:22px;font-weight:600;letter-spacing:-.01em}
    p{margin:0 0 22px;opacity:.7}
    code{display:block;margin:-10px 0 22px;font:11px ui-monospace,Menlo,monospace;opacity:.4}
    nav{display:flex;gap:8px;justify-content:center}
    a{padding:8px 16px;border-radius:9px;text-decoration:none;color:inherit;background:rgba(127,127,127,.14);font-weight:500}
    a.primary{background:${text.danger ? '#d1453b' : '#2f5d50'};color:#fff}
    a:hover{filter:brightness(1.08)}
  </style></head><body><main>
    <div class="mark">${text.danger ? '⚠️' : '🌿'}</div>
    <h1>${text.title}</h1>
    <p>${text.body}</p>
    <code>${escape(description)}</code>
    <nav>${buttons}</nav>
  </main></body>`
  return `document.documentElement.innerHTML = ${JSON.stringify(html)}`
}
