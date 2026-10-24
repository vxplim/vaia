// VAIA's built-in password manager.
// Passwords are kept per browsing profile (the shared profile, or a Space's
// separate profile) in one file that is encrypted as a whole with macOS's
// Keychain (Electron safeStorage). Nothing is ever sent anywhere.
import { app, safeStorage, systemPreferences } from 'electron'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { PasswordInfo } from '../shared/types'

const FILE = 'passwords.bin'
/** After you unlock with Touch ID / your Mac password, passwords stay viewable this long. */
const UNLOCK_MS = 60_000

interface Saved {
  id: string
  /** "default" = the shared profile, otherwise a Space's profile id. */
  profile: string
  origin: string
  username: string
  password: string
  createdAt: number
  updatedAt: number
}

interface Vault {
  entries: Saved[]
  /** Sites you said "Never" for, per profile. */
  never: Record<string, string[]>
}

export type CaptureAnswer = 'save' | 'update' | null

export class Passwords {
  private vault: Vault | null = null
  private loading: Promise<Vault> | null = null
  private unlockedUntil = 0

  private get file(): string {
    return join(app.getPath('userData'), FILE)
  }

  private load(): Promise<Vault> {
    if (this.vault) return Promise.resolve(this.vault)
    this.loading ??= (async () => {
      let vault: Vault = { entries: [], never: {} }
      if (existsSync(this.file)) {
        const { result } = await safeStorage.decryptStringAsync(readFileSync(this.file))
        vault = { ...vault, ...(JSON.parse(result) as Vault) }
      }
      this.vault = vault
      return vault
    })()
    return this.loading
  }

  private async save(): Promise<void> {
    if (!this.vault) return
    if (!(await safeStorage.isAsyncEncryptionAvailable())) throw new Error('Encryption is not available')
    const data = await safeStorage.encryptStringAsync(JSON.stringify(this.vault))
    writeFileSync(`${this.file}.tmp`, data)
    renameSync(`${this.file}.tmp`, this.file)
  }

  async list(): Promise<PasswordInfo[]> {
    const vault = await this.load()
    return vault.entries
      .map(({ id, profile, origin, username, updatedAt }) => ({ id, profile, origin, username, updatedAt }))
      .sort((a, b) => a.origin.localeCompare(b.origin) || a.username.localeCompare(b.username))
  }

  /** Logins saved for exactly this site in this profile (autofill never crosses sites). */
  async lookup(profile: string, origin: string): Promise<{ username: string; password: string }[]> {
    const vault = await this.load()
    return vault.entries
      .filter((e) => e.profile === profile && e.origin === origin)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(({ username, password }) => ({ username, password }))
  }

  /** You just logged in: should VAIA offer to save, or to update, this password? */
  async check(profile: string, origin: string, username: string, password: string): Promise<CaptureAnswer> {
    const vault = await this.load()
    if (vault.never[profile]?.includes(origin)) return null
    const same = vault.entries.find((e) => e.profile === profile && e.origin === origin && e.username === username)
    if (!same) return 'save'
    return same.password === password ? null : 'update'
  }

  async store(profile: string, origin: string, username: string, password: string): Promise<void> {
    const vault = await this.load()
    const now = Date.now()
    const same = vault.entries.find((e) => e.profile === profile && e.origin === origin && e.username === username)
    if (same) Object.assign(same, { password, updatedAt: now })
    else vault.entries.push({ id: randomUUID(), profile, origin, username, password, createdAt: now, updatedAt: now })
    await this.save()
  }

  async never(profile: string, origin: string): Promise<void> {
    const vault = await this.load()
    vault.never[profile] = [...new Set([...(vault.never[profile] ?? []), origin])]
    await this.save()
  }

  async update(id: string, patch: { username?: string; password?: string }): Promise<void> {
    const vault = await this.load()
    const entry = vault.entries.find((e) => e.id === id)
    if (!entry) return
    if (patch.username !== undefined) entry.username = patch.username
    if (patch.password !== undefined) entry.password = patch.password
    entry.updatedAt = Date.now()
    await this.save()
  }

  async remove(id: string): Promise<void> {
    const vault = await this.load()
    vault.entries = vault.entries.filter((e) => e.id !== id)
    await this.save()
  }

  /** Remove everything saved for a profile (e.g. when a Space's separate profile is deleted). */
  async forgetProfile(profile: string): Promise<void> {
    if (!existsSync(this.file) && !this.vault) return
    const vault = await this.load()
    vault.entries = vault.entries.filter((e) => e.profile !== profile)
    delete vault.never[profile]
    await this.save()
  }

  /**
   * Show a saved password, after Touch ID (or, on Macs without Touch ID, macOS's own
   * password dialog). Stays unlocked for a minute so you can copy and edit.
   */
  async reveal(id: string): Promise<string | null> {
    if (Date.now() > this.unlockedUntil) {
      if (!(await authenticate())) return null
      this.unlockedUntil = Date.now() + UNLOCK_MS
    }
    const vault = await this.load()
    return vault.entries.find((e) => e.id === id)?.password ?? null
  }

  /** Import a Google Password Manager / Chrome "passwords.csv" export into a profile. */
  async importCsv(profile: string, file: string): Promise<{ added: number; updated: number; skipped: number }> {
    const rows = parseCsv(readFileSync(file, 'utf8'))
    const header = (rows.shift() ?? []).map((h) => h.trim().toLowerCase())
    const col = (name: string) => header.indexOf(name)
    const [urlCol, userCol, passCol] = [col('url'), col('username'), col('password')]
    if (urlCol < 0 || passCol < 0) throw new Error('This doesn’t look like a passwords export (no url/password columns).')
    const vault = await this.load()
    let added = 0
    let updated = 0
    let skipped = 0
    const now = Date.now()
    for (const row of rows) {
      let origin = ''
      try {
        origin = new URL(row[urlCol] ?? '').origin
      } catch {
        // Android app entries ("android://…") and broken rows are skipped.
      }
      const password = row[passCol] ?? ''
      const username = userCol >= 0 ? (row[userCol] ?? '') : ''
      if (!/^https?:/.test(origin) || !password) {
        skipped++
        continue
      }
      const same = vault.entries.find((e) => e.profile === profile && e.origin === origin && e.username === username)
      if (same) {
        if (same.password !== password) {
          Object.assign(same, { password, updatedAt: now })
          updated++
        } else skipped++
      } else {
        vault.entries.push({ id: randomUUID(), profile, origin, username, password, createdAt: now, updatedAt: now })
        added++
      }
    }
    await this.save()
    return { added, updated, skipped }
  }
}

async function authenticate(): Promise<boolean> {
  const reason = 'show your saved passwords'
  if (systemPreferences.canPromptTouchID()) {
    try {
      await systemPreferences.promptTouchID(reason)
      return true
    } catch {
      return false
    }
  }
  // No Touch ID: ask macOS to confirm it's you with your Mac's password (the standard system dialog).
  try {
    await promisify(execFile)('/usr/bin/osascript', [
      '-e',
      `do shell script "/usr/bin/true" with prompt "VAIA wants to ${reason}." with administrator privileges`
    ])
    return true
  } catch {
    return false
  }
}

/** A small CSV reader that understands "quoted, values" and "" escapes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.some((f) => f !== '')) rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f !== '')) rows.push(row)
  return rows
}
