import { join } from 'node:path'
import { app } from 'electron'
import type { LicenseState, LicenseStatus } from '../../shared/types'
import { readJson, writeJsonAtomic } from '../store'
import { LocalLicenseData, LocalProvider } from './local'
import { MasLicenseData, MasProvider } from './mas'
import { MsStoreProvider } from './msstore'
import type { LicenseProvider, ProviderEvent } from './types'

interface LicenseFile {
  local?: LocalLicenseData
  mas?: MasLicenseData
}

const OVERRIDES: LicenseStatus[] = ['trial', 'active', 'expired', 'none']

/** Owns the license state and picks the provider matching the build (MAS, Microsoft Store, direct). */
export class LicenseService {
  private readonly provider: LicenseProvider
  private readonly listeners = new Set<(state: LicenseState) => void>()
  private readonly path = join(app.getPath('userData'), 'license.json')
  private busy = false
  private error: string | null = null
  private ready = false

  constructor() {
    const file = <K extends keyof LicenseFile>(key: K) => ({
      read: (): NonNullable<LicenseFile[K]> => ((readJson(this.path) as LicenseFile | null)?.[key] ?? {}) as NonNullable<LicenseFile[K]>,
      write: (data: NonNullable<LicenseFile[K]>): void => {
        const current = (readJson(this.path) as LicenseFile | null) ?? {}
        writeJsonAtomic(this.path, { ...current, [key]: data })
      }
    })
    const local = new LocalProvider(file('local'), !app.isPackaged)
    if (process.mas) this.provider = new MasProvider(file('mas'))
    else if (process.windowsStore) this.provider = new MsStoreProvider(local)
    else this.provider = local
    this.provider.onChange((event) => this.handleEvent(event))
  }

  async init(): Promise<void> {
    try {
      await this.provider.init()
    } catch (error) {
      console.error('License provider failed to initialize', error)
    }
    this.ready = true
    this.emit()
  }

  get state(): LicenseState {
    const state: LicenseState = {
      ...this.provider.evaluate(Date.now()),
      busy: this.busy || !this.ready,
      error: this.error
    }
    // Lets the paywall be tested without store accounts: COLOR_PICKER_LICENSE=expired npm run dev
    const override = process.env['COLOR_PICKER_LICENSE'] as LicenseStatus | undefined
    if (!app.isPackaged && override && OVERRIDES.includes(override)) {
      state.status = override
      state.entitled = override === 'trial' || override === 'active'
    }
    return state
  }

  /** Entitlement is assumed until the provider has answered, so startup never blocks the app. */
  get entitled(): boolean {
    return !this.ready || this.state.entitled
  }

  subscribe(listener: (state: LicenseState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async purchase(): Promise<void> {
    await this.run(() => this.provider.purchase())
  }

  async restore(): Promise<void> {
    await this.run(() => this.provider.restore())
  }

  private async run(task: () => Promise<void>): Promise<void> {
    this.busy = true
    this.error = null
    this.emit()
    try {
      await task()
    } catch (error) {
      this.busy = false
      this.error = error instanceof Error ? error.message : String(error)
      this.emit()
    }
  }

  private handleEvent(event: ProviderEvent): void {
    if (event.type !== 'updated') this.busy = false
    this.error = event.type === 'failed' ? event.message : null
    this.emit()
  }

  private emit(): void {
    const state = this.state
    this.listeners.forEach((listener) => listener(state))
  }
}
