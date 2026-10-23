// Ad blocking, using Ghostery's open-source filter engine with the community
// ad + tracker filter lists (EasyList & friends). The lists are downloaded
// once and cached in VAIA's data folder.
import { ElectronBlocker } from '@ghostery/adblocker-electron'
import { app, type Session } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

export class AdBlock {
  private blocker: ElectronBlocker | null = null
  private loading: Promise<ElectronBlocker | null> | null = null
  private sessions = new Set<Session>()
  private enabled = false

  private load(): Promise<ElectronBlocker | null> {
    this.loading ??= ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
      path: join(app.getPath('userData'), 'adblock-engine.bin'),
      read: fs.readFile,
      write: fs.writeFile
    })
      .then((blocker) => (this.blocker = blocker))
      .catch((err) => {
        console.error('[adblock] could not load filter lists', err)
        this.loading = null
        return null
      })
    return this.loading
  }

  /** Every browsing session (cookie jar) registers here so the toggle reaches all of them. */
  addSession(ses: Session): void {
    this.sessions.add(ses)
    if (this.enabled) this.blocker?.enableBlockingInSession(ses)
  }

  async setEnabled(on: boolean): Promise<void> {
    this.enabled = on
    const blocker = on ? await this.load() : this.blocker
    if (!blocker) return
    for (const ses of this.sessions) {
      const active = blocker.isBlockingEnabled(ses)
      // The user may have toggled again while the lists were downloading.
      if (this.enabled && !active) blocker.enableBlockingInSession(ses)
      if (!this.enabled && active) blocker.disableBlockingInSession(ses)
    }
  }
}
