import { PRODUCT } from '../../shared/product'
import { LocalProvider } from './local'
import type { LicenseProvider, ProviderEvent, ProviderState } from './types'

/**
 * Microsoft Store builds (APPX/MSIX).
 *
 * TODO: Purchases need `Windows.Services.Store.StoreContext`, which requires a native
 * bridge (see docs/STORE.md). Until then this behaves like the app-managed trial and
 * does not offer a purchase.
 */
export class MsStoreProvider implements LicenseProvider {
  readonly id = 'msstore' as const

  constructor(private readonly fallback: LocalProvider) {}

  init(): Promise<void> {
    return this.fallback.init()
  }

  evaluate(now: number): ProviderState {
    return { ...this.fallback.evaluate(now), provider: this.id, canPurchase: false }
  }

  async purchase(): Promise<void> {
    throw new Error(
      PRODUCT.msStoreSubscriptionId
        ? 'Microsoft Store purchases are not available yet.'
        : 'Microsoft Store subscription is not configured.'
    )
  }

  async restore(): Promise<void> {
    throw new Error('Microsoft Store purchases are not available yet.')
  }

  onChange(listener: (event: ProviderEvent) => void): void {
    this.fallback.onChange(listener)
  }
}
