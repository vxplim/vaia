// Live Folders: reading RSS and Atom feeds (a small reader, no extra library).
import { net } from 'electron'

export const FEED_REFRESH_MS = 30 * 60_000
export const FEED_KEEP = 20

export interface FeedEntry {
  title: string
  url: string
}

export class FeedError extends Error {}

function decode(text: string): string {
  // Titles are often HTML that was escaped once ("&lt;b&gt;"), so tags are removed after decoding too.
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const tag = (xml: string, name: string): string | null => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(xml)
  return m ? m[1] : null
}

/** The feed's name and its newest entries (as the feed lists them, newest first). */
export function parseFeed(xml: string, base: string): { title: string; entries: FeedEntry[] } {
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml)
  const blocks = xml.match(isAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) ?? []
  const entries: FeedEntry[] = []
  for (const block of blocks) {
    let link = ''
    if (isAtom) {
      // Prefer the "alternate" link (the article itself).
      const links = [...block.matchAll(/<link\b([^>]*)\/?>/gi)].map((m) => m[1])
      const pick = links.find((a) => /rel\s*=\s*["']alternate["']/i.test(a)) ?? links.find((a) => !/rel\s*=/i.test(a)) ?? links[0]
      link = pick ? (/href\s*=\s*["']([^"']+)["']/i.exec(pick)?.[1] ?? '') : ''
    } else {
      link = decode(tag(block, 'link') ?? '') || decode(tag(block, 'guid') ?? '')
    }
    try {
      link = new URL(decode(link), base).href
    } catch {
      continue
    }
    if (!/^https?:/.test(link)) continue
    entries.push({ title: decode(tag(block, 'title') ?? '') || link, url: link })
  }
  const channel = isAtom ? xml : (tag(xml, 'channel') ?? xml)
  const title = decode(tag(channel.replace(/<(item|entry)[\s>][\s\S]*/i, ''), 'title') ?? '') || new URL(base).hostname
  return { title, entries: entries.slice(0, FEED_KEEP) }
}

export async function fetchFeed(url: string): Promise<{ title: string; entries: FeedEntry[] }> {
  let res: Response
  try {
    res = await net.fetch(url, { headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5' } })
  } catch {
    throw new FeedError('Couldn’t reach the feed')
  }
  if (!res.ok) throw new FeedError(`The feed answered with error ${res.status}`)
  const text = await res.text()
  if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(text)) throw new FeedError('That address isn’t an RSS or Atom feed')
  return parseFeed(text, res.url || url)
}
