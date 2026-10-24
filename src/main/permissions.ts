// Site permissions: camera, microphone, location, notifications, ...
// A site asking for one gets a small Allow / Block prompt (a native sheet, so it
// shows over web pages). "Remember for this site" saves the answer in
// permissions.json; otherwise it lasts until VAIA quits. Anything VAIA doesn't
// recognise is blocked.
import { BrowserWindow, dialog, systemPreferences, type PermissionRequest, type Session, type WebContents } from 'electron'
import type { PermissionDecision, PermissionKind, SitePermissions } from '../shared/types'
import { readJson, writeJson } from './store'

const FILE = 'permissions.json'

/** Things browsers allow without asking (Chrome does the same). */
const ALWAYS_ALLOW = new Set([
  'fullscreen',
  'pointerLock',
  'keyboardLock',
  'clipboard-sanitized-write',
  'mediaKeySystem',
  'speaker-selection',
  'storage-access',
  'top-level-storage-access'
])

const KIND_FOR: Record<string, PermissionKind> = {
  geolocation: 'location',
  notifications: 'notifications',
  'clipboard-read': 'clipboard',
  midi: 'midi',
  midiSysex: 'midi',
  'idle-detection': 'idle',
  'window-management': 'windows',
  openExternal: 'open-apps'
}

export const KIND_LABELS: Record<PermissionKind, string> = {
  camera: 'use your camera',
  microphone: 'use your microphone',
  location: 'know your location',
  notifications: 'show notifications',
  clipboard: 'see text and images you copy',
  midi: 'use your MIDI devices',
  idle: 'know when you’re using your Mac',
  windows: 'manage windows on all your screens',
  'open-apps': 'open another app'
}

/** Which kinds a request is about (a video call asks for camera AND microphone). */
function kindsFor(permission: string, details: { mediaTypes?: string[]; mediaType?: string }): PermissionKind[] | null {
  if (permission === 'media') {
    const types = details.mediaTypes ?? (details.mediaType ? [details.mediaType] : [])
    const kinds: PermissionKind[] = []
    if (types.includes('video')) kinds.push('camera')
    if (types.includes('audio')) kinds.push('microphone')
    return kinds.length ? kinds : ['camera', 'microphone']
  }
  const kind = KIND_FOR[permission]
  return kind ? [kind] : null
}

function originOf(url: string | undefined): string {
  try {
    return url ? new URL(url).origin : ''
  } catch {
    return ''
  }
}

export class Permissions {
  /** Remembered answers, by site (origin) then kind. */
  saved: SitePermissions = readJson<SitePermissions>(FILE, {})
  /** Answers for this run only ("remember" unticked, or private windows). */
  private temporary = new Map<string, PermissionDecision>()
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private onChange: () => void,
    private notify: (message: string) => void
  ) {}

  private decision(origin: string, kind: PermissionKind): PermissionDecision | undefined {
    return this.temporary.get(`${origin} ${kind}`) ?? this.saved[origin]?.[kind]
  }

  set(origin: string, kind: PermissionKind, decision: PermissionDecision | null): void {
    this.temporary.delete(`${origin} ${kind}`)
    const site = { ...this.saved[origin] }
    if (decision) site[kind] = decision
    else delete site[kind]
    if (Object.keys(site).length) this.saved[origin] = site
    else delete this.saved[origin]
    this.save()
  }

  resetSite(origin: string): void {
    delete this.saved[origin]
    for (const key of [...this.temporary.keys()]) if (key.startsWith(`${origin} `)) this.temporary.delete(key)
    this.save()
  }

  resetAll(): void {
    this.saved = {}
    this.temporary.clear()
    this.save()
  }

  private save(): void {
    try {
      writeJson(FILE, this.saved)
    } catch (err) {
      console.error('[permissions] save failed', err)
    }
    this.onChange()
  }

  /** Hook a browsing session up to VAIA's permission rules. */
  attach(ses: Session, isPrivate = false): void {
    ses.setPermissionRequestHandler((wc, permission, callback, details) => {
      this.request(wc, permission, details as PermissionRequest & { mediaTypes?: string[]; externalURL?: string }, isPrivate)
        .then(callback)
        .catch(() => callback(false))
    })
    ses.setPermissionCheckHandler((_wc, permission, requestingOrigin, details) => {
      if (ALWAYS_ALLOW.has(permission)) return true
      const kinds = kindsFor(permission, details as { mediaType?: string })
      const origin = originOf(requestingOrigin) || originOf((details as { requestingUrl?: string }).requestingUrl)
      return !!kinds && !!origin && kinds.every((k) => this.decision(origin, k) === 'allow')
    })
  }

  private async request(
    wc: WebContents,
    permission: string,
    details: { requestingUrl?: string; mediaTypes?: string[]; externalURL?: string },
    isPrivate: boolean
  ): Promise<boolean> {
    if (ALWAYS_ALLOW.has(permission)) return true
    const kinds = kindsFor(permission, details)
    const origin = originOf(details.requestingUrl) || originOf(wc.getURL())
    if (!kinds || !origin) return false
    const known = kinds.map((k) => this.decision(origin, k))
    if (known.includes('block')) return false
    if (known.every((d) => d === 'allow')) return this.systemAccess(kinds)
    // One prompt at a time, so a burst of requests doesn't stack sheets on top of each other.
    const answer = (this.queue = this.queue.then(() => this.prompt(wc, origin, kinds, details.externalURL, isPrivate)))
    return (await answer) as boolean
  }

  private async prompt(
    wc: WebContents,
    origin: string,
    kinds: PermissionKind[],
    externalURL: string | undefined,
    isPrivate: boolean
  ): Promise<boolean> {
    // The page may have been answered while waiting in line.
    const known = kinds.map((k) => this.decision(origin, k))
    if (known.includes('block')) return false
    if (known.every((d) => d === 'allow')) return this.systemAccess(kinds)
    if (wc.isDestroyed()) return false
    const host = new URL(origin).host || origin
    const what = kinds.map((k) => KIND_LABELS[k]).join(' and ')
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const options = {
      type: 'question' as const,
      message: `${host} wants to ${what}`,
      detail:
        kinds[0] === 'open-apps' && externalURL
          ? `It wants to open “${externalURL.split(':')[0]}:” links in another app.`
          : 'You can change this later in Settings → Site permissions.',
      buttons: ['Allow', 'Block'],
      defaultId: 0,
      cancelId: 1,
      checkboxLabel: isPrivate ? undefined : 'Remember for this site',
      checkboxChecked: true
    }
    const { response, checkboxChecked } = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options)
    const decision: PermissionDecision = response === 0 ? 'allow' : 'block'
    for (const kind of kinds) {
      if (checkboxChecked && !isPrivate) this.set(origin, kind, decision)
      else this.temporary.set(`${origin} ${kind}`, decision)
    }
    return decision === 'allow' && this.systemAccess(kinds)
  }

  /** Camera and microphone also need macOS's own permission for VAIA (asked once). */
  private async systemAccess(kinds: PermissionKind[]): Promise<boolean> {
    if (process.platform !== 'darwin') return true
    for (const kind of kinds) {
      if (kind !== 'camera' && kind !== 'microphone') continue
      const media = kind
      const status = systemPreferences.getMediaAccessStatus(media)
      if (status === 'granted') continue
      if (status === 'not-determined' && (await systemPreferences.askForMediaAccess(media))) continue
      this.notify(`macOS is blocking the ${media} for VAIA. Allow it in System Settings → Privacy & Security`)
      return false
    }
    return true
  }
}
