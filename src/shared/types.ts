export interface SavedColor {
  id: string
  /** Normalized uppercase `#RRGGBB` or `#RRGGBBAA`. */
  hex: string
  name?: string
  createdAt: number
}

export interface Palette {
  id: string
  name: string
  colors: SavedColor[]
  createdAt: number
}

export type Theme = 'system' | 'light' | 'dark'
export type TrayClickAction = 'popover' | 'picker'

export interface Settings {
  formatId: string
  pickerShortcut: string
  popoverShortcut: string
  trayClickAction: TrayClickAction
  copyOnPick: boolean
  historyLimit: number
  loupeSize: number
  loupeZoom: number
  theme: Theme
  launchAtLogin: boolean
}

export interface AppData {
  version: 1
  history: SavedColor[]
  palettes: Palette[]
  /** Picked colors are also added to this palette. */
  activePaletteId: string | null
  settings: Settings
}

/** `history` addresses the color history, any other value a palette id. */
export type CollectionId = 'history' | string

export type LicenseStatus = 'trial' | 'active' | 'expired' | 'none'
export type LicenseProviderId = 'mas' | 'msstore' | 'local'

export interface ProductInfo {
  id: string
  title: string
  /** Localized price as returned by the store, e.g. "9,99 €". */
  price: string
  /** Free trial length in days, when the store offers one for this user. */
  trialDays: number | null
}

export interface LicenseState {
  provider: LicenseProviderId
  status: LicenseStatus
  /** Whether the user may use the app right now. */
  entitled: boolean
  trialEndsAt: number | null
  expiresAt: number | null
  product: ProductInfo | null
  canPurchase: boolean
  busy: boolean
  error: string | null
}

export type ScreenAccess = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown'

export interface PlatformInfo {
  platform: string
  version: string
  screenAccess: ScreenAccess
  supportsLoginItem: boolean
}

export type ExportFormat = 'json' | 'css' | 'scss' | 'tailwind' | 'gpl'
