// Turning what you type into a web address, and web addresses into short labels.
import type { SearchEngineId } from './types'

export const SEARCH_ENGINES: Record<SearchEngineId, { name: string; search: string; suggest: string }> = {
  google: {
    name: 'Google',
    search: 'https://www.google.com/search?q=%s',
    suggest: 'https://suggestqueries.google.com/complete/search?client=firefox&q=%s'
  },
  duckduckgo: {
    name: 'DuckDuckGo',
    search: 'https://duckduckgo.com/?q=%s',
    suggest: 'https://duckduckgo.com/ac/?type=list&q=%s'
  },
  bing: {
    name: 'Bing',
    search: 'https://www.bing.com/search?q=%s',
    suggest: 'https://api.bing.com/osjson.aspx?query=%s'
  },
  ecosia: {
    name: 'Ecosia',
    search: 'https://www.ecosia.org/search?q=%s',
    suggest: 'https://ac.ecosia.org/autocomplete?type=list&q=%s'
  }
}

const SCHEMES = /^(https?|file|about|data|view-source|mailto):/i
const LOCAL = /^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?([/?#].*)?$/i
const DOMAIN = /^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(:\d+)?([/?#].*)?$/i

export function searchUrl(query: string, engine: SearchEngineId): string {
  return SEARCH_ENGINES[engine].search.replace('%s', encodeURIComponent(query))
}

/** "apple.com" -> https://apple.com, "how tall is everest" -> a search. */
export function inputToUrl(input: string, engine: SearchEngineId): string {
  const text = input.trim()
  if (!text) return ''
  if (SCHEMES.test(text)) return text
  if (!/\s/.test(text)) {
    if (LOCAL.test(text)) return `http://${text}`
    if (DOMAIN.test(text)) return `https://${text}`
  }
  return searchUrl(text, engine)
}

/** https://www.example.com/a/b -> example.com */
/** VAIA's own pages: vaia:note/<id> and vaia:easel/<id> (drawn by VAIA, not loaded from the web). */
export function internalPage(url: string): { kind: 'note' | 'easel'; id: string } | null {
  const m = /^vaia:(note|easel)\/([\w-]+)$/.exec(url)
  return m ? { kind: m[1] as 'note' | 'easel', id: m[2] } : null
}

export function displayHost(url: string): string {
  const internal = internalPage(url)
  if (internal) return internal.kind === 'note' ? 'Note' : 'Easel'
  try {
    const u = new URL(url)
    if (u.protocol === 'file:') return decodeURIComponent(u.pathname.split('/').pop() || 'File')
    if (!u.hostname) return url
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Domain key used for per-site settings (Boosts). */
export function siteKey(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/** Same page, ignoring a trailing slash or #section. */
export function sameUrl(a: string, b: string): boolean {
  const norm = (u: string) => u.replace(/#.*$/, '').replace(/\/$/, '')
  return norm(a) === norm(b)
}
