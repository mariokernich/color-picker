import { BrowserWindow, Display, app, desktopCapturer, ipcMain, screen } from 'electron'
import { IPC, PickerInit } from '../shared/api'
import { loadRenderer, preloadPath } from './windows'

const isMac = process.platform === 'darwin'

interface PickerOptions {
  loupe: () => { size: number; zoom: number }
  onLoupeChange: (size: number, zoom: number) => void
  onPick: (hex: string) => void
  /** Called once all overlays are closed; `picked` tells whether at least one color was picked. */
  onClose: (picked: boolean) => void
}

interface Capture {
  display: Display
  image: Electron.NativeImage
}

/**
 * Screen color picker. It captures every display, then covers each one with a borderless
 * overlay showing the frozen capture plus a magnifying loupe. Reading pixels from the
 * capture keeps picking exact and works the same on macOS and Windows.
 */
export class Picker {
  private windows: BrowserWindow[] = []
  private starting = false
  private picked = false

  constructor(private readonly options: PickerOptions) {
    ipcMain.on(IPC.pickerPick, (_event, hex: string, keepOpen: boolean) => {
      this.picked = true
      this.options.onPick(hex)
      if (!keepOpen) this.close()
    })
    ipcMain.on(IPC.pickerCancel, () => this.close())
    ipcMain.on(IPC.pickerFocus, (event) => {
      const window = BrowserWindow.fromWebContents(event.sender)
      if (window && !window.isFocused()) window.focus()
    })
    ipcMain.on(IPC.pickerLoupe, (_event, size: number, zoom: number) => {
      this.options.onLoupeChange(size, zoom)
    })
  }

  get isActive(): boolean {
    return this.starting || this.windows.length > 0
  }

  async start(): Promise<void> {
    if (this.isActive) return
    this.starting = true
    this.picked = false
    try {
      const captures = await captureDisplays()
      if (!captures.length) throw new Error('Screen capture returned no images.')
      const cursor = screen.getCursorScreenPoint()
      const cursorDisplay = screen.getDisplayNearestPoint(cursor)
      this.windows = captures.map((capture) =>
        this.createOverlay(capture, capture.display.id === cursorDisplay.id ? cursor : null)
      )
    } finally {
      this.starting = false
    }
  }

  close(): void {
    const windows = this.windows
    if (!windows.length) return
    this.windows = []
    windows.forEach((window) => {
      if (!window.isDestroyed()) window.destroy()
    })
    this.options.onClose(this.picked)
  }

  private createOverlay(capture: Capture, cursor: Electron.Point | null): BrowserWindow {
    const { bounds } = capture.display
    const window = new BrowserWindow({
      ...bounds,
      show: false,
      frame: false,
      backgroundColor: '#000000',
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      hasShadow: false,
      roundedCorners: false,
      enableLargerThanScreen: true,
      alwaysOnTop: true,
      webPreferences: {
        preload: preloadPath('picker'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false
      }
    })
    // Above the menu bar, the Dock and full screen apps.
    window.setAlwaysOnTop(true, 'screen-saver')
    if (isMac) window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    window.setBounds(bounds)

    const size = capture.image.getSize()
    const loupe = this.options.loupe()
    const init: PickerInit = {
      width: bounds.width,
      height: bounds.height,
      image: { width: size.width, height: size.height, data: capture.image.toBitmap() },
      cursor: cursor ? { x: cursor.x - bounds.x, y: cursor.y - bounds.y } : null,
      loupeSize: loupe.size,
      loupeZoom: loupe.zoom
    }
    window.webContents.once('did-finish-load', () => {
      window.webContents.send(IPC.pickerInit, init)
      if (cursor) {
        if (isMac) app.focus({ steal: true })
        window.show()
        window.focus()
      } else {
        window.showInactive()
      }
    })
    // Losing an overlay (e.g. display unplugged) ends the session.
    window.on('closed', () => {
      if (this.windows.includes(window)) this.close()
    })
    loadRenderer(window, 'picker')
    return window
  }
}

/**
 * Captures each display at its native pixel size. Displays with different sizes are captured
 * in separate passes so no thumbnail gets resampled, which would blend neighboring pixels.
 */
async function captureDisplays(): Promise<Capture[]> {
  const displays = screen.getAllDisplays()
  const physicalSize = (display: Display): Electron.Size => ({
    width: Math.round(display.size.width * display.scaleFactor),
    height: Math.round(display.size.height * display.scaleFactor)
  })
  const sizes = new Map<string, Electron.Size>()
  displays.forEach((display) => {
    const size = physicalSize(display)
    sizes.set(`${size.width}x${size.height}`, size)
  })

  const captures: Capture[] = []
  for (const [key, thumbnailSize] of sizes) {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize })
    displays.forEach((display, index) => {
      const size = physicalSize(display)
      if (`${size.width}x${size.height}` !== key) return
      // `display_id` can be empty on some Linux setups; fall back to enumeration order.
      const source = sources.find((item) => item.display_id === String(display.id)) ?? sources[index]
      if (source && !source.thumbnail.isEmpty()) captures.push({ display, image: source.thumbnail })
    })
  }
  return captures
}
