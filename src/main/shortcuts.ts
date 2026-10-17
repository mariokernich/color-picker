import { globalShortcut } from 'electron'
import type { ShortcutKind, ShortcutResult } from '../shared/api'

/** Keeps the app's global shortcuts registered and lets the user change them safely. */
export class Shortcuts {
  private readonly accelerators = new Map<ShortcutKind, string>()
  private suspended = false

  constructor(private readonly handlers: Record<ShortcutKind, () => void>) {}

  /** Registers the stored shortcuts; returns the kinds that could not be registered. */
  apply(accelerators: Record<ShortcutKind, string>): ShortcutKind[] {
    const failed: ShortcutKind[] = []
    for (const kind of Object.keys(accelerators) as ShortcutKind[]) {
      if (!this.set(kind, accelerators[kind]).ok) failed.push(kind)
    }
    return failed
  }

  set(kind: ShortcutKind, accelerator: string): ShortcutResult {
    const previous = this.accelerators.get(kind)
    if (previous === accelerator) return { ok: true }
    const other = [...this.accelerators.entries()].find(([key, value]) => key !== kind && value === accelerator)
    if (accelerator && other) return { ok: false, error: 'This shortcut is already used by another action.' }

    if (!this.suspended && previous) globalShortcut.unregister(previous)
    if (accelerator && !this.suspended) {
      const result = this.register(kind, accelerator)
      if (!result.ok) {
        if (previous) this.register(kind, previous)
        return result
      }
    }
    if (accelerator) this.accelerators.set(kind, accelerator)
    else this.accelerators.delete(kind)
    return { ok: true }
  }

  /** Releases all shortcuts while the user records a new one, so the old keys can be pressed. */
  suspend(suspended: boolean): void {
    if (suspended === this.suspended) return
    this.suspended = suspended
    if (suspended) {
      this.accelerators.forEach((accelerator) => globalShortcut.unregister(accelerator))
    } else {
      this.accelerators.forEach((accelerator, kind) => this.register(kind, accelerator))
    }
  }

  private register(kind: ShortcutKind, accelerator: string): ShortcutResult {
    try {
      if (globalShortcut.register(accelerator, this.handlers[kind])) return { ok: true }
      return { ok: false, error: 'This shortcut is used by another app.' }
    } catch {
      return { ok: false, error: 'This key combination is not supported.' }
    }
  }
}
