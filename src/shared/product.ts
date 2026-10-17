/**
 * Store and product configuration. Identifiers must match App Store Connect and
 * Microsoft Partner Center; see docs/STORE.md.
 */
export const PRODUCT = {
  name: 'Color Picker',
  appId: 'de.kernich.colorpicker',
  /** Auto-renewable yearly subscription (App Store Connect product id). */
  masSubscriptionId: 'de.kernich.colorpicker.pro.yearly',
  /** Store ID of the yearly subscription add-on in Partner Center (e.g. 9NXXXXXXXXXX). */
  msStoreSubscriptionId: '',
  /** Length of the app-managed trial used outside the stores (direct download, development). */
  localTrialDays: 30,
  /** Shown when the store cannot be reached. Store prices are always taken from the store. */
  fallbackPrice: '9.99 / year',
  supportEmail: 'mario@kernich.de',
  privacyUrl: 'https://github.com/mariokernich/color-picker/blob/main/docs/PRIVACY.md',
  /** Apple's standard EULA; replace when using a custom license agreement. */
  termsUrl: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'
} as const

export const DAY_MS = 24 * 60 * 60 * 1000
