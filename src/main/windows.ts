import { join } from 'node:path'
import { BrowserWindow, Rectangle, nativeTheme, screen } from 'electron'

const isMac = process.platform === 'darwin'

export const POPOVER_SIZE = { width: 340, height: 560 }
const POPOVER_MARGIN = 8

export function loadRenderer(window: BrowserWindow, page: 'index' | 'picker'): void {
  const devServer = process.env['ELECTRON_RENDERER_URL']
  if (devServer) {
    void window.loadURL(page === 'index' ? devServer : `${devServer}/${page}.html`)
  } else {
    void window.loadFile(join(__dirname, `../renderer/${page}.html`))
  }
}

export function preloadPath(name: 'index' | 'picker'): string {
  return join(__dirname, `../preload/${name}.js`)
}

export function createPopoverWindow(): BrowserWindow {
  const window = new BrowserWindow({
    ...POPOVER_SIZE,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    // Native translucency on macOS; an opaque themed background elsewhere avoids a white flash.
    ...(isMac
      ? { vibrancy: 'popover' as const, visualEffectState: 'active' as const, transparent: true }
      : { backgroundColor: nativeTheme.shouldUseDarkColors ? '#1F1F23' : '#FAFAFB' }),
    webPreferences: {
      preload: preloadPath('index'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })
  if (isMac) window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  loadRenderer(window, 'index')
  return window
}

/**
 * Places the popover next to the tray icon: below it when the tray sits at the top of the
 * screen (macOS menu bar), above it when it sits at the bottom (Windows taskbar).
 */
export function positionPopover(window: BrowserWindow, trayBounds: Rectangle | null): void {
  const anchor =
    trayBounds && trayBounds.width > 0
      ? trayBounds
      : { ...screen.getCursorScreenPoint(), width: 0, height: 0 }
  const display = screen.getDisplayNearestPoint({ x: anchor.x, y: anchor.y })
  const area = display.workArea
  const { width, height } = window.getBounds()
  const anchorCenterX = anchor.x + anchor.width / 2
  const anchorCenterY = anchor.y + anchor.height / 2

  let x = Math.round(anchorCenterX - width / 2)
  let y: number
  if (anchor.width === 0) {
    // No tray anchor (e.g. opened via shortcut): center on the active display.
    x = Math.round(area.x + (area.width - width) / 2)
    y = Math.round(area.y + (area.height - height) / 3)
  } else if (anchorCenterY < area.y + area.height / 2) {
    y = Math.max(area.y, anchor.y + anchor.height) + POPOVER_MARGIN / 2
  } else {
    y = Math.min(area.y + area.height, anchor.y) - height - POPOVER_MARGIN
  }
  // Taskbars on the left or right edge.
  if (anchor.width > 0 && anchor.x + anchor.width <= area.x) x = area.x + POPOVER_MARGIN
  if (anchor.width > 0 && anchor.x >= area.x + area.width) x = area.x + area.width - width - POPOVER_MARGIN

  x = Math.min(Math.max(x, area.x + POPOVER_MARGIN), area.x + area.width - width - POPOVER_MARGIN)
  y = Math.min(Math.max(y, area.y), area.y + area.height - height)
  window.setPosition(x, y, false)
}
