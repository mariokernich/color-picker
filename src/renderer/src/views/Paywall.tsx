import { Contrast, Layers, Loader2, Pipette, Sparkles, SwatchBook } from 'lucide-react'
import { DAY_MS, PRODUCT } from '@shared/product'
import type { LicenseState } from '@shared/types'
import { Button } from '../components/controls'
import { api } from '../lib/api'
import { useApp } from '../lib/app'

const FEATURES = [
  { icon: Pipette, title: 'Pick from anywhere', text: 'Pixel-precise loupe and a global shortcut.' },
  { icon: SwatchBook, title: 'History & palettes', text: 'Collect, organize and export your colors.' },
  { icon: Layers, title: 'Every format', text: 'CSS, SwiftUI, Android, Flutter, .NET and more.' },
  { icon: Contrast, title: 'Contrast checker', text: 'WCAG AA and AAA at a glance.' }
]

export function daysLeft(timestamp: number | null): number {
  if (!timestamp) return 0
  return Math.max(0, Math.ceil((timestamp - Date.now()) / DAY_MS))
}

/** Store-managed trials are already subscriptions; only app-managed trials need an upgrade. */
export function offersUpgrade(license: LicenseState): boolean {
  return !license.entitled || (license.status === 'trial' && license.provider !== 'mas')
}

export function describeLicense(license: LicenseState): string {
  switch (license.status) {
    case 'active':
      return license.expiresAt ? `Pro · renews ${new Date(license.expiresAt).toLocaleDateString()}` : 'Pro'
    case 'trial': {
      const days = daysLeft(license.trialEndsAt)
      return `Free trial · ${days} ${days === 1 ? 'day' : 'days'} left`
    }
    case 'expired':
      return license.provider === 'local' ? 'Trial ended' : 'Subscription expired'
    case 'none':
      return 'Not subscribed'
  }
}

export function manageSubscriptionUrl(license: LicenseState | null): string | null {
  if (license?.provider === 'mas') return 'https://apps.apple.com/account/subscriptions'
  if (license?.provider === 'msstore') return 'https://account.microsoft.com/services'
  return null
}

/** Compact status in the home footer. */
export function LicenseBadge() {
  const { license, push } = useApp()
  if (!license || license.busy && license.status !== 'trial') return null
  if (license.status === 'active' || (license.status === 'trial' && license.provider === 'mas')) {
    return <span className="license-badge">{describeLicense(license)}</span>
  }
  const days = daysLeft(license.trialEndsAt)
  return (
    <button type="button" className="license-badge license-badge--action" onClick={() => push({ name: 'paywall' })}>
      <Sparkles size={13} />
      {license.status === 'trial' ? `${days} ${days === 1 ? 'day' : 'days'} left in trial` : describeLicense(license)}
      <span className="license-badge__cta">Upgrade</span>
    </button>
  )
}

export function Paywall() {
  const { license, back, push, isMac, view } = useApp()
  if (!license) return null
  const product = license.product
  const price = product?.price ?? PRODUCT.fallbackPrice
  const offerTrial = license.status === 'none' && product?.trialDays
  const canGoBack = license.entitled && view.name === 'paywall'
  const store = license.provider === 'mas' ? 'Apple Account' : license.provider === 'msstore' ? 'Microsoft account' : null

  const title = license.entitled
    ? `Get ${PRODUCT.name} Pro`
    : license.status === 'none'
      ? `Welcome to ${PRODUCT.name}`
      : license.provider === 'local'
        ? 'Your free trial has ended'
        : 'Your subscription has ended'

  return (
    <div className="view paywall">
      <div className="paywall__body">
        <div className="paywall__logo" aria-hidden="true">
          <Pipette size={26} strokeWidth={2.2} />
        </div>
        <h1 className="paywall__title">{title}</h1>
        <p className="paywall__subtitle">
          {offerTrial
            ? `Try everything free for ${product.trialDays} days.`
            : 'Subscribe to keep picking, organizing and converting colors.'}
        </p>

        <ul className="paywall__features">
          {FEATURES.map(({ icon: Icon, title: featureTitle, text }) => (
            <li key={featureTitle}>
              <span className="paywall__feature-icon">
                <Icon size={16} />
              </span>
              <div>
                <strong>{featureTitle}</strong>
                <span>{text}</span>
              </div>
            </li>
          ))}
        </ul>

        <div className="paywall__price">
          {offerTrial ? (
            <>
              <strong>{product.trialDays} days free</strong>, then {price} per year
            </>
          ) : (
            <>
              <strong>{price}</strong> per year
            </>
          )}
        </div>

        <Button
          variant="primary"
          size="lg"
          className="paywall__cta"
          disabled={license.busy || !license.canPurchase}
          onClick={() => void api.purchase()}
        >
          {license.busy ? <Loader2 size={16} className="spin" /> : offerTrial ? 'Start Free Trial' : 'Subscribe'}
        </Button>
        {!license.canPurchase && !license.busy && (
          <p className="paywall__note">
            Subscriptions are available in the {isMac ? 'Mac App Store' : 'Microsoft Store'} version.
          </p>
        )}
        {license.error && <p className="field-error paywall__error">{license.error}</p>}

        <div className="paywall__links">
          {license.provider !== 'local' && (
            <button type="button" className="link-button" disabled={license.busy} onClick={() => void api.restore()}>
              Restore Purchases
            </button>
          )}
          {license.provider === 'mas' && (
            <button type="button" className="link-button" onClick={() => void api.openExternal(PRODUCT.termsUrl)}>
              Terms of Use
            </button>
          )}
          <button type="button" className="link-button" onClick={() => void api.openExternal(PRODUCT.privacyUrl)}>
            Privacy
          </button>
        </div>
        {store && (
          <p className="paywall__legal">
            Payment is charged to your {store} at confirmation of purchase. The subscription renews automatically
            each year unless it is cancelled at least 24 hours before the end of the current period. You can manage
            or cancel it in your account settings.
          </p>
        )}
      </div>
      <footer className="paywall__footer">
        {canGoBack ? (
          <button type="button" className="link-button" onClick={back}>
            Not now
          </button>
        ) : (
          <>
            <button type="button" className="link-button" onClick={() => push({ name: 'settings' })}>
              Settings
            </button>
            <button type="button" className="link-button" onClick={() => api.quit()}>
              Quit
            </button>
          </>
        )}
      </footer>
    </div>
  )
}
