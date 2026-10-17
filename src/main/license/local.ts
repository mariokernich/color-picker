import { DAY_MS, PRODUCT } from '../../shared/product'
import type { LicenseStatus } from '../../shared/types'
import { evaluateTrial, touchTrial, TrialRecord } from './trial'
import type { LicenseProvider, ProviderEvent, ProviderState } from './types'

export interface LocalLicenseData {
  trial?: TrialRecord
  /** Simulated purchase, only available in development builds. */
  devPurchaseAt?: number
}

/**
 * App-managed trial for builds outside the stores (direct download and development).
 * Purchasing is only simulated in development; release builds point users to the stores.
 */
export class LocalProvider implements LicenseProvider {
  readonly id = 'local' as const
  private listener: (event: ProviderEvent) => void = () => {}

  constructor(
    private readonly storage: { read(): LocalLicenseData; write(data: LocalLicenseData): void },
    private readonly isDevelopment: boolean
  ) {}

  async init(): Promise<void> {
    const data = this.storage.read()
    this.storage.write({ ...data, trial: touchTrial(data.trial ?? null, Date.now()) })
  }

  evaluate(now: number): ProviderState {
    const data = this.storage.read()
    const trial = evaluateTrial(touchTrial(data.trial ?? null, now), now, PRODUCT.localTrialDays)
    const purchaseExpires = data.devPurchaseAt ? data.devPurchaseAt + 365 * DAY_MS : null
    const purchased = purchaseExpires !== null && purchaseExpires > now
    const status: LicenseStatus = purchased ? 'active' : trial.active ? 'trial' : 'expired'
    return {
      provider: this.id,
      status,
      entitled: purchased || trial.active,
      trialEndsAt: trial.trialEndsAt,
      expiresAt: purchaseExpires,
      product: {
        id: 'local',
        title: `${PRODUCT.name} Pro`,
        price: PRODUCT.fallbackPrice,
        trialDays: PRODUCT.localTrialDays
      },
      canPurchase: this.isDevelopment
    }
  }

  async purchase(): Promise<void> {
    if (!this.isDevelopment) throw new Error('Purchases are available in the Mac App Store and Microsoft Store versions.')
    this.storage.write({ ...this.storage.read(), devPurchaseAt: Date.now() })
    this.listener({ type: 'finished' })
  }

  async restore(): Promise<void> {
    this.listener({ type: 'finished' })
  }

  onChange(listener: (event: ProviderEvent) => void): void {
    this.listener = listener
  }
}
