import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { inAppPurchase, Product, Transaction } from 'electron'
import { DAY_MS, PRODUCT } from '../../shared/product'
import type { ProductInfo } from '../../shared/types'
import { readInAppRecords, subscriptionStatus, SubscriptionStatus } from './receipt'
import type { LicenseProvider, ProviderEvent, ProviderState } from './types'

/** StoreKit error code for a purchase the user cancelled. */
const PAYMENT_CANCELLED = 2
const RESTORE_TIMEOUT_MS = 20_000

const PERIOD_DAYS = { day: 1, week: 7, month: 30, year: 365 }

export interface MasLicenseData {
  /** Last subscription transaction seen; used when the receipt cannot be read. */
  lastTransactionAt?: number
}

/**
 * Mac App Store: auto-renewable yearly subscription via StoreKit. The free trial is the
 * subscription's introductory offer, configured in App Store Connect.
 */
export class MasProvider implements LicenseProvider {
  readonly id = 'mas' as const
  private product: Product | null = null
  private receipt: SubscriptionStatus | null = null
  private listener: (event: ProviderEvent) => void = () => {}
  private restoreTimer: NodeJS.Timeout | null = null

  constructor(private readonly storage: { read(): MasLicenseData; write(data: MasLicenseData): void }) {}

  async init(): Promise<void> {
    inAppPurchase.on('transactions-updated', (_event, transactions) => this.handleTransactions(transactions))
    this.reloadReceipt()
    try {
      const [product] = await inAppPurchase.getProducts([PRODUCT.masSubscriptionId])
      this.product = product ?? null
    } catch (error) {
      console.error('Could not load App Store products', error)
    }
  }

  evaluate(now: number): ProviderState {
    let active: boolean
    let expiresAt: number | null
    let inTrial = false
    if (this.receipt) {
      active = this.receipt.active
      expiresAt = this.receipt.expiresAt
      inTrial = this.receipt.inIntroOffer
    } else {
      // Without a readable receipt, trust the last transaction for one period plus grace.
      const last = this.storage.read().lastTransactionAt
      expiresAt = last ? last + 372 * DAY_MS : null
      active = expiresAt !== null && expiresAt > now
    }
    return {
      provider: this.id,
      status: active ? (inTrial ? 'trial' : 'active') : expiresAt ? 'expired' : 'none',
      entitled: active,
      trialEndsAt: inTrial ? expiresAt : null,
      expiresAt,
      product: this.productInfo(),
      canPurchase: this.product !== null && inAppPurchase.canMakePayments()
    }
  }

  async purchase(): Promise<void> {
    if (!inAppPurchase.canMakePayments()) throw new Error('Purchases are disabled on this Mac.')
    if (!this.product) throw new Error('The App Store is not reachable right now. Please try again later.')
    const queued = await inAppPurchase.purchaseProduct(PRODUCT.masSubscriptionId)
    if (!queued) throw new Error('The purchase could not be started.')
  }

  async restore(): Promise<void> {
    inAppPurchase.restoreCompletedTransactions()
    // StoreKit 1 in Electron does not report "nothing to restore", so stop waiting eventually.
    if (this.restoreTimer) clearTimeout(this.restoreTimer)
    this.restoreTimer = setTimeout(() => {
      this.restoreTimer = null
      this.listener({ type: 'finished' })
    }, RESTORE_TIMEOUT_MS)
  }

  onChange(listener: (event: ProviderEvent) => void): void {
    this.listener = listener
  }

  private handleTransactions(transactions: Transaction[]): void {
    for (const transaction of transactions) {
      if (transaction.payment.productIdentifier !== PRODUCT.masSubscriptionId) continue
      switch (transaction.transactionState) {
        case 'purchased':
        case 'restored': {
          const date = Date.parse(transaction.transactionDate)
          const previous = this.storage.read().lastTransactionAt ?? 0
          if (!isNaN(date) && date > previous) this.storage.write({ lastTransactionAt: date })
          inAppPurchase.finishTransactionByDate(transaction.transactionDate)
          this.reloadReceipt()
          this.finishRestore()
          this.listener({ type: 'finished' })
          break
        }
        case 'failed':
          inAppPurchase.finishTransactionByDate(transaction.transactionDate)
          this.listener(
            transaction.errorCode === PAYMENT_CANCELLED
              ? { type: 'finished' }
              : { type: 'failed', message: transaction.errorMessage || 'The purchase failed.' }
          )
          break
        case 'deferred':
          // Waiting for approval (e.g. Ask to Buy).
          this.listener({ type: 'finished' })
          break
        case 'purchasing':
          break
      }
    }
  }

  private finishRestore(): void {
    if (!this.restoreTimer) return
    clearTimeout(this.restoreTimer)
    this.restoreTimer = null
  }

  private reloadReceipt(): void {
    try {
      const location = inAppPurchase.getReceiptURL()
      const path = location.startsWith('file:') ? fileURLToPath(location) : location
      this.receipt = subscriptionStatus(
        readInAppRecords(readFileSync(path)),
        PRODUCT.masSubscriptionId,
        Date.now()
      )
    } catch {
      // No receipt yet (fresh development build) or unreadable: fall back to transactions.
      this.receipt = null
    }
  }

  private productInfo(): ProductInfo | null {
    if (!this.product) return null
    const intro = this.product.introductoryPrice
    const period = intro?.subscriptionPeriod
    const trialDays =
      intro?.paymentMode === 'freeTrial' && period
        ? PERIOD_DAYS[period.unit] * period.numberOfUnits * Math.max(1, intro.numberOfPeriods)
        : null
    return {
      id: this.product.productIdentifier,
      title: this.product.localizedTitle || `${PRODUCT.name} Pro`,
      price: this.product.formattedPrice,
      trialDays
    }
  }
}
