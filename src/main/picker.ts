import { BrowserWindow, Display, app, desktopCapturer, ipcMain, screen } from 'electron'
import { IPC, PickerImage, PickerInit } from '../shared/api'
import { pixelSize, sampler } from './sampler'
import { loadRenderer, preloadPath } from './windows'

const isMac = process.platform === 'darwin'
/** Largest region an overlay may read at once, in pixels per side. */
const MAX_READ = 256

interface PickerOptions {
  /** Show a still capture instead of the live screen. */
  freeze: () => boolean
  onPick: (hex: string) => void
  /** Called once all overlays are closed; `picked` tells whether at least one color was picked. */
  onClose: (picked: boolean) => void
}

interface Capture {
  display: Display
  image: Electron.NativeImage
}

interface Overlay {
  window: BrowserWindow
  display: Display
}

/**
 * Screen color picker. It covers every display with a borderless overlay that shows a
 * magnifying loupe. Live, the overlay is transparent and reads the pixels below the cursor from
 * the native sampler. Frozen (by setting, or when live sampling is not available), it captures
 * every display first and shows that still image. Both read exact pixels.
 */
export class Picker {
  private overlays: Overlay[] = []
  private starting = false
  private picked = false
  private live = false

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
    ipcMain.on(IPC.pickerCursorSpeed, (_event, speed: number) => {
      if (this.overlays.length && Number.isFinite(speed)) sampler.setCursorSpeed(speed)
    })
    ipcMain.handle(
      IPC.pickerRead,
      (event, x: number, y: number, width: number, height: number): PickerImage | null => {
        const overlay = this.overlays.find((item) => item.window.webContents === event.sender)
        const valid =
          [x, y, width, height].every(Number.isInteger) &&
          width > 0 &&
          height > 0 &&
          width <= MAX_READ &&
          height <= MAX_READ
        if (!overlay || !this.live || !valid) return null
        const data = sampler.read(overlay.display, x, y, width, height)
        return data ? { width, height, data } : null
      }
    )
  }

  get isActive(): boolean {
    return this.starting || this.overlays.length > 0
  }

  async start(): Promise<void> {
    if (this.isActive) return
    this.starting = true
    this.picked = false
    try {
      const displays = screen.getAllDisplays()
      this.live = !this.options.freeze() && (await sampler.start(displays))
      const captures: Capture[] = this.live ? [] : await captureDisplays(displays)
      if (!this.live && !captures.length) throw new Error('Screen capture returned no images.')
      const cursor = screen.getCursorScreenPoint()
      const cursorDisplay = screen.getDisplayNearestPoint(cursor)
      const cursorOn = (display: Display): Electron.Point | null =>
        display.id === cursorDisplay.id ? cursor : null
      this.overlays = this.live
        ? displays.map((display) => this.createOverlay(display, null, cursorOn(display)))
        : captures.map((capture) =>
            this.createOverlay(capture.display, capture.image, cursorOn(capture.display))
          )
    } finally {
      this.starting = false
    }
  }

  close(): void {
    const overlays = this.overlays
    if (!overlays.length) return
    this.overlays = []
    sampler.setCursorSpeed(1)
    if (this.live) sampler.stop()
    overlays.forEach(({ window }) => {
      if (!window.isDestroyed()) window.destroy()
    })
    this.options.onClose(this.picked)
  }

  /** `image` is the frozen capture of the display, `null` for a live overlay. */
  private createOverlay(
    display: Display,
    image: Electron.NativeImage | null,
    cursor: Electron.Point | null
  ): Overlay {
    const { bounds } = display
    const window = new BrowserWindow({
      ...bounds,
      show: false,
      frame: false,
      // Live overlays only draw the loupe; the screen shows through.
      ...(image
        ? { backgroundColor: '#000000' }
        : { transparent: true, backgroundColor: '#00000000' }),
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
    // Keeps the overlay out of the live reads on Windows (WDA_EXCLUDEFROMCAPTURE). On macOS the
    // sampler's stream filter leaves out all of the app's windows.
    if (!image) window.setContentProtection(true)
    window.setBounds(bounds)

    const pixels = image ? image.getSize() : pixelSize(display)
    const init: PickerInit = {
      width: bounds.width,
      height: bounds.height,
      pixelWidth: pixels.width,
      pixelHeight: pixels.height,
      image: image ? { width: pixels.width, height: pixels.height, data: image.toBitmap() } : null,
      cursor: cursor ? { x: cursor.x - bounds.x, y: cursor.y - bounds.y } : null
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
      if (this.overlays.some((overlay) => overlay.window === window)) this.close()
    })
    // A crashed overlay could no longer pick or cancel, which would leave the mouse slowed down.
    window.webContents.on('render-process-gone', () => {
      if (this.overlays.some((overlay) => overlay.window === window)) this.close()
    })
    loadRenderer(window, 'picker')
    return { window, display }
  }
}

/**
 * Captures each display at its native pixel size. Displays with different sizes are captured
 * in separate passes so no thumbnail gets resampled, which would blend neighboring pixels.
 */
async function captureDisplays(displays: Display[]): Promise<Capture[]> {
  const sizes = new Map<string, Electron.Size>()
  displays.forEach((display) => {
    const size = pixelSize(display)
    sizes.set(`${size.width}x${size.height}`, size)
  })

  const captures: Capture[] = []
  for (const [key, thumbnailSize] of sizes) {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize })
    displays.forEach((display, index) => {
      const size = pixelSize(display)
      if (`${size.width}x${size.height}` !== key) return
      // `display_id` can be empty on some Linux setups; fall back to enumeration order.
      const source = sources.find((item) => item.display_id === String(display.id)) ?? sources[index]
      if (source && !source.thumbnail.isEmpty()) captures.push({ display, image: source.thumbnail })
    })
  }
  return captures
}
