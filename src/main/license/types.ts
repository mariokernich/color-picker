import type { LicenseProviderId, LicenseState } from '../../shared/types'

export type ProviderState = Omit<LicenseState, 'busy' | 'error'>

export interface LicenseProvider {
  readonly id: LicenseProviderId
  init(): Promise<void>
  evaluate(now: number): ProviderState
  /** Resolves once the purchase flow has been started; completion is reported via `onChange`. */
  purchase(): Promise<void>
  restore(): Promise<void>
  /** Called when the provider's state changes outside of `purchase`/`restore`. */
  onChange(listener: (event: ProviderEvent) => void): void
}

export type ProviderEvent =
  | { type: 'updated' }
  | { type: 'finished' }
  | { type: 'failed'; message: string }
