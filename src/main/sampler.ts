import { join } from 'node:path'
import { Display, app, screen } from 'electron'

/** Display as the native sampler sees it: physical origin (Windows) and size in pixels. */
interface SamplerDisplay {
  id: number
  x: number
  y: number
  width: number
  height: number
}

/** API of `native/sampler` (see the sources there). */
interface NativeSampler {
  start(displays: SamplerDisplay[]): Promise<boolean>
  /** BGRA pixels of a region in display pixels, transparent outside the display. */
  read(displayId: number, x: number, y: number, width: number, height: number): Uint8Array | null
  stop(): void
  /** Global point: display points on macOS, physical pixels of the virtual screen on Windows. */
  moveCursor?(x: number, y: number): void
}

/** Starting gives up after this long, e.g. when macOS never answers the permission query. */
const START_TIMEOUT = 3000

let native: NativeSampler | null | undefined

function load(): NativeSampler | null {
  if (native !== undefined) return native
  native = null
  if (process.platform !== 'darwin' && process.platform !== 'win32') return native
  const path = app.isPackaged
    ? join(process.resourcesPath, 'native', 'sampler.node')
    : join(
        app.getAppPath(),
        'native/sampler/prebuilds',
        `${process.platform}-${process.arch}`,
        'sampler.node'
      )
  try {
    const module = { exports: {} as NativeSampler }
    process.dlopen(module, path)
    native = module.exports
  } catch (error) {
    console.warn('Live screen sampling is not available; the picker freezes the screen.', error)
  }
  return native
}

/** Size of a display in physical pixels, the coordinate space of picking. */
export function pixelSize(display: Display): Electron.Size {
  return {
    width: Math.round(display.size.width * display.scaleFactor),
    height: Math.round(display.size.height * display.scaleFactor)
  }
}

function samplerDisplay(display: Display): SamplerDisplay {
  // Windows reads from the virtual screen in physical pixels; with mixed DPI only Electron knows
  // where a display starts there.
  const origin =
    process.platform === 'win32'
      ? screen.dipToScreenPoint({ x: display.bounds.x, y: display.bounds.y })
      : { x: display.bounds.x, y: display.bounds.y }
  return { id: display.id, x: origin.x, y: origin.y, ...pixelSize(display) }
}

/**
 * Reads live screen pixels below the picker overlays. The overlays themselves are left out of
 * the capture: on Windows by the window's content protection, on macOS by the stream filter.
 */
export const sampler = {
  /** Resolves to false when live sampling is not available, e.g. without screen access. */
  async start(displays: Display[]): Promise<boolean> {
    const module = load()
    if (!module) return false
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), START_TIMEOUT)
    })
    try {
      const started = await Promise.race([module.start(displays.map(samplerDisplay)), timeout])
      if (!started) module.stop()
      return started
    } catch (error) {
      console.error('Starting live screen sampling failed', error)
      module.stop()
      return false
    } finally {
      clearTimeout(timer)
    }
  },

  read(display: Display, x: number, y: number, width: number, height: number): Uint8Array | null {
    return native ? native.read(display.id, x, y, width, height) : null
  },

  stop(): void {
    native?.stop()
  },

  /** Whether `moveCursor` works; sampling does not have to be started for it. */
  canMoveCursor(): boolean {
    return typeof load()?.moveCursor === 'function'
  },

  /** Moves the mouse cursor to a pixel of a display. */
  moveCursor(display: Display, x: number, y: number): void {
    const module = load()
    if (!module?.moveCursor) return
    if (process.platform === 'win32') {
      const origin = samplerDisplay(display)
      module.moveCursor(origin.x + Math.round(x), origin.y + Math.round(y))
    } else {
      module.moveCursor(
        display.bounds.x + x / display.scaleFactor,
        display.bounds.y + y / display.scaleFactor
      )
    }
  }
}
