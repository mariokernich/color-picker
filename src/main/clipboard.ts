import { clipboard } from 'electron'
import { clipboardColor } from '../shared/clipboard'
import { clipboardChangeCount } from './sampler'

const INTERVAL = 1000

/**
 * Adds colors copied in other apps to the history while "Watch clipboard" is on. With the native
 * change count, the clipboard is only read after something was copied, which keeps the macOS
 * pasteboard privacy alert from showing up every second. Text this app copies itself is skipped.
 */
export class ClipboardWatcher {
  private timer: NodeJS.Timeout | null = null
  private changeCount: number | null = null
  private lastText = ''
  private checking = false

  constructor(private readonly onColor: (hex: string) => void) {}

  setEnabled(enabled: boolean): void {
    if (enabled === (this.timer !== null)) return
    if (!enabled) {
      clearInterval(this.timer!)
      this.timer = null
      return
    }
    // Only what is copied from now on counts.
    this.changeCount = clipboardChangeCount()
    this.lastText = ''
    if (this.changeCount === null) void this.check(false)
    this.timer = setInterval(() => void this.check(true), INTERVAL)
  }

  /** Copies text without adding it as a copied color. */
  async copy(text: string): Promise<void> {
    this.lastText = text
    await clipboard.writeText(text)
    this.changeCount = clipboardChangeCount()
  }

  private async check(report: boolean): Promise<void> {
    const count = clipboardChangeCount()
    if (this.checking || (count !== null && count === this.changeCount)) return
    this.changeCount = count
    this.checking = true
    try {
      const text = await clipboard.readText()
      if (text === this.lastText) return
      this.lastText = text
      const hex = clipboardColor(text)
      if (hex && report) this.onColor(hex)
    } finally {
      this.checking = false
    }
  }
}
