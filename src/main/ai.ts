// AI Tidy: asks Claude to sort tabs into topic folders and give them shorter
// names. Only tab titles and domains are sent, never addresses or page content.
// The API key is stored encrypted with macOS's Keychain (Electron safeStorage).
import Anthropic from '@anthropic-ai/sdk'
import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AiTidyPlan } from './tidy'

const KEY_FILE = 'claude-key.bin'
export const TIDY_MODEL = 'claude-opus-5-5'

const keyPath = () => join(app.getPath('userData'), KEY_FILE)

export function hasApiKey(): boolean {
  return existsSync(keyPath())
}

export async function saveApiKey(key: string): Promise<void> {
  if (!(await safeStorage.isAsyncEncryptionAvailable())) throw new Error('Encryption is not available')
  const file = keyPath()
  writeFileSync(`${file}.tmp`, await safeStorage.encryptStringAsync(key.trim()))
  renameSync(`${file}.tmp`, file)
}

export function clearApiKey(): void {
  rmSync(keyPath(), { force: true })
}

async function loadApiKey(): Promise<string | null> {
  try {
    if (!hasApiKey()) return null
    const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(readFileSync(keyPath()))
    if (shouldReEncrypt) await saveApiKey(result)
    return result
  } catch {
    return null
  }
}

/** Why AI Tidy didn't work, in words for a toast. */
export class AiTidyError extends Error {}

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    folders: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          tabs: { type: 'array', items: { type: 'integer' } }
        },
        required: ['name', 'tabs'],
        additionalProperties: false
      }
    },
    names: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tab: { type: 'integer' },
          name: { type: 'string' }
        },
        required: ['tab', 'name'],
        additionalProperties: false
      }
    }
  },
  required: ['folders', 'names'],
  additionalProperties: false
}

const SYSTEM = `You organize a person's open browser tabs in a sidebar.
You get a numbered list of tabs (title and website). Group tabs that belong to the same topic or task into folders:
- Folder names are 1-3 words, Title Case, no emoji (e.g. "Trip to Lisbon", "React Docs", "Shopping").
- Only make a folder when 2 or more tabs clearly belong together; leave unrelated tabs out of every folder.
- Each tab number appears in at most one folder.
Also suggest a shorter name for tabs whose titles are long or cluttered (drop site names, taglines and separators like " | " or " - "). Keep names under 40 characters and only include tabs that need a shorter name.`

export async function aiTidyPlan(lines: { title: string; domain: string }[]): Promise<AiTidyPlan> {
  const apiKey = await loadApiKey()
  if (!apiKey) throw new AiTidyError('No Claude API key')
  const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 })
  const list = lines.map((l, i) => `${i}. ${l.title} — ${l.domain}`).join('\n')
  let response: Anthropic.Beta.BetaMessage
  try {
    response = await client.beta.messages.create({
      model: TIDY_MODEL,
      max_tokens: 16000,
      // If Claude declines, the API retries on a fallback model automatically.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: PLAN_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: `Tabs:\n${list}` }]
    })
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new AiTidyError('Claude API key was rejected')
    if (err instanceof Anthropic.RateLimitError) throw new AiTidyError('Claude is busy right now')
    if (err instanceof Anthropic.APIConnectionError) throw new AiTidyError('No internet connection')
    if (err instanceof Anthropic.APIError) throw new AiTidyError(`Claude API error ${err.status ?? ''}`.trim())
    throw err
  }
  if (response.stop_reason === 'refusal') throw new AiTidyError('Claude declined')
  const text = response.content.find((b) => b.type === 'text')
  if (!text || text.type !== 'text') throw new AiTidyError('Empty answer from Claude')
  const plan = JSON.parse(text.text) as AiTidyPlan
  if (!Array.isArray(plan.folders) || !Array.isArray(plan.names)) throw new AiTidyError('Unexpected answer from Claude')
  return plan
}
