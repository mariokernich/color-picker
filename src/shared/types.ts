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
  /** The picker shows a still capture instead of the live screen. */
  freezeScreen: boolean
  /** Colors copied in other apps are added to the history. */
  watchClipboard: boolean
  historyLimit: number
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

export type ScreenAccess = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown'

export interface PlatformInfo {
  platform: string
  version: string
  screenAccess: ScreenAccess
  supportsLoginItem: boolean
}

export type ExportFormat = 'json' | 'css' | 'scss' | 'tailwind' | 'gpl'
