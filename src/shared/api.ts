import type { Action } from './state'
import type { AppData, CollectionId, ExportFormat, PlatformInfo } from './types'

export const IPC = {
  getState: 'state:get',
  stateChanged: 'state:changed',
  dispatch: 'state:dispatch',
  startPicker: 'picker:start',
  copy: 'clipboard:copy',
  exportCollection: 'export:collection',
  setShortcut: 'shortcut:set',
  suspendShortcuts: 'shortcut:suspend',
  getPlatform: 'platform:get',
  openScreenSettings: 'platform:open-screen-settings',
  openExternal: 'platform:open-external',
  hidePopover: 'popover:hide',
  navigate: 'popover:navigate',
  quit: 'app:quit',
  pickerInit: 'picker:init',
  pickerPick: 'picker:pick',
  pickerCancel: 'picker:cancel',
  pickerFocus: 'picker:focus',
  pickerLoupe: 'picker:loupe',
  pickerRead: 'picker:read'
} as const

export type ShortcutKind = 'picker' | 'popover'

export interface ShortcutResult {
  ok: boolean
  error?: string
}

/** Views the main process can ask the popover to show, e.g. from the tray menu. */
export type Route = 'home' | 'settings' | 'contrast'

/** Exposed to the popover window as `window.api`. */
export interface AppApi {
  getState(): Promise<AppData>
  onState(listener: (data: AppData) => void): () => void
  dispatch(action: Action): Promise<void>
  startPicker(): Promise<void>
  copy(text: string): Promise<void>
  exportCollection(collection: CollectionId, format: ExportFormat): Promise<boolean>
  setShortcut(kind: ShortcutKind, accelerator: string): Promise<ShortcutResult>
  /** Global shortcuts are released while the user records a new one. */
  suspendShortcuts(suspended: boolean): Promise<void>
  getPlatform(): Promise<PlatformInfo>
  openScreenSettings(): Promise<void>
  openExternal(url: string): Promise<void>
  onNavigate(listener: (route: Route) => void): () => void
  hidePopover(): void
  quit(): void
}

export interface PickerImage {
  width: number
  height: number
  /** Native bitmap pixels (BGRA on all supported platforms), row major. */
  data: Uint8Array
}

export interface PickerInit {
  /** Window size in CSS pixels. */
  width: number
  height: number
  /** Display size in physical pixels, the coordinates for picking. */
  pixelWidth: number
  pixelHeight: number
  /** Frozen capture of the display, or `null` when the overlay reads the screen live. */
  image: PickerImage | null
  /** Cursor position in CSS pixels relative to this window, when the cursor is on its display. */
  cursor: { x: number; y: number } | null
  loupeSize: number
  loupeZoom: number
}

/** Exposed to the picker overlay windows as `window.picker`. */
export interface PickerApi {
  onInit(listener: (init: PickerInit) => void): void
  pick(hex: string, keepOpen: boolean): void
  cancel(): void
  focus(): void
  setLoupe(size: number, zoom: number): void
  /**
   * Reads a region of the live screen in display pixels; pixels outside the display have alpha 0.
   * Resolves to `null` for frozen overlays or before the first frame is available.
   */
  read(x: number, y: number, width: number, height: number): Promise<PickerImage | null>
}
