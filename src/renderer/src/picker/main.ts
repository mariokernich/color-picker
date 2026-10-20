import { isLight, parseHex } from '@shared/color'
import type { PickerInit } from '@shared/api'
import { bgraToRgba, cursorSpeed, loupeCells, pixelHex } from '@shared/pixels'
import { LOUPE_SIZE, LOUPE_ZOOM } from '@shared/state'
import './picker.css'

const screenCanvas = document.getElementById('screen') as HTMLCanvasElement
const loupe = document.getElementById('loupe') as HTMLDivElement
const loupeCanvas = document.getElementById('loupe-canvas') as HTMLCanvasElement
const loupeLabel = document.getElementById('loupe-label') as HTMLDivElement
const hint = document.getElementById('hint') as HTMLDivElement

const isMac = navigator.userAgent.includes('Mac')
/** Extra pixels read around the loupe so it stays filled while the cursor moves. */
const READ_MARGIN = 8

/** Pixels around the cursor, in RGBA, positioned in display pixels. */
interface Region {
  x: number
  y: number
  width: number
  height: number
  pixels: Uint8ClampedArray<ArrayBuffer>
  canvas: HTMLCanvasElement
}

interface PickerState {
  init: PickerInit
  /** The whole display while frozen; the latest read around the cursor while live. */
  region: Region | null
  live: boolean
  /** Display pixels per CSS pixel. */
  scaleX: number
  scaleY: number
  /** Cursor in display pixels. */
  x: number
  y: number
  visible: boolean
  size: number
  zoom: number
  picked: number
}

let state: PickerState | null = null
let reading = false
/** Shown while a live read has not caught up with the cursor yet. */
let lastHex = '#000000'

function createRegion(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  image: { width: number; height: number; data: Uint8Array },
  opaque: boolean
): Region {
  const pixels = bgraToRgba(image.data, opaque)
  canvas.width = image.width
  canvas.height = image.height
  canvas.getContext('2d')!.putImageData(new ImageData(pixels, image.width), 0, 0)
  return { x, y, width: image.width, height: image.height, pixels, canvas }
}

window.picker.onInit((init) => {
  const live = init.image === null
  document.body.classList.toggle('live', live)
  // Frozen, the screen canvas shows the capture and doubles as the loupe's source.
  const region = init.image ? createRegion(screenCanvas, 0, 0, init.image, true) : null
  const scaleX = init.pixelWidth / init.width
  const scaleY = init.pixelHeight / init.height
  const x = init.cursor ? Math.floor(init.cursor.x * scaleX) : 0
  const y = init.cursor ? Math.floor(init.cursor.y * scaleY) : 0
  state = {
    init,
    region,
    live,
    scaleX,
    scaleY,
    x,
    y,
    visible: init.cursor !== null,
    size: LOUPE_SIZE.default,
    zoom: LOUPE_ZOOM.default,
    picked: 0
  }
  if (init.cursor) showHint()
  render()
  if (live) requestAnimationFrame(readLoop)
})

/** Keeps reading the live screen around the cursor, one request at a time. */
function readLoop(): void {
  requestAnimationFrame(readLoop)
  if (!state || !state.visible || reading) return
  const span = loupeCells(state.size, state.zoom) + READ_MARGIN * 2
  const x = state.x - Math.floor(span / 2)
  const y = state.y - Math.floor(span / 2)
  reading = true
  window.picker
    .read(x, y, span, span)
    .then((image) => {
      if (!state || !image) return
      state.region = createRegion(
        state.region?.canvas ?? document.createElement('canvas'),
        x,
        y,
        image,
        false
      )
      render()
    })
    .catch((error) => console.error('Reading the screen failed', error))
    .finally(() => {
      reading = false
    })
}

function colorAt(x: number, y: number): string | null {
  const region = state?.region
  return region ? pixelHex(region.pixels, region.width, x - region.x, y - region.y) : null
}

/** The color under the cursor right now; live overlays read the screen again for it. */
async function currentColor(): Promise<string | null> {
  if (!state) return null
  if (!state.live) return colorAt(state.x, state.y)
  const image = await window.picker.read(state.x, state.y, 1, 1)
  return image ? pixelHex(bgraToRgba(image.data, false), 1, 0, 0) : null
}

function render(): void {
  const region = state?.region
  if (!state || !state.visible || !region) {
    loupe.hidden = true
    return
  }
  const { size, zoom, x, y, scaleX, scaleY } = state
  const dpr = window.devicePixelRatio || 1
  const cells = loupeCells(size, zoom)
  const cellSize = size / cells
  const half = Math.floor(cells / 2)

  loupe.hidden = false
  loupe.style.width = loupe.style.height = `${size}px`
  loupe.style.transform = `translate(${x / scaleX - size / 2}px, ${y / scaleY - size / 2}px)`
  loupeCanvas.width = loupeCanvas.height = Math.round(size * dpr)
  loupeCanvas.style.width = loupeCanvas.style.height = `${size}px`

  const ctx = loupeCanvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, size, size)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(
    region.canvas,
    x - half - region.x,
    y - half - region.y,
    cells,
    cells,
    0,
    0,
    size,
    size
  )

  if (cellSize >= 6) {
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.22)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 1; i < cells; i++) {
      const offset = Math.round(i * cellSize) + 0.5
      ctx.moveTo(offset, 0)
      ctx.lineTo(offset, size)
      ctx.moveTo(0, offset)
      ctx.lineTo(size, offset)
    }
    ctx.stroke()
  }

  const hex = colorAt(x, y) ?? lastHex
  lastHex = hex
  const center = half * cellSize
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)'
  ctx.strokeRect(center - 1, center - 1, cellSize + 2, cellSize + 2)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 1.5
  ctx.strokeRect(center + 0.25, center + 0.25, cellSize - 0.5, cellSize - 0.5)

  loupe.style.setProperty('--picked', hex)
  loupe.style.setProperty('--picked-text', isLight(parseHex(hex)!) ? '#111' : '#fff')
  loupeLabel.textContent = state.picked ? `${hex}  ·  ${state.picked} picked` : hex
}

function moveTo(x: number, y: number): void {
  if (!state) return
  state.x = Math.min(Math.max(0, Math.round(x)), state.init.pixelWidth - 1)
  state.y = Math.min(Math.max(0, Math.round(y)), state.init.pixelHeight - 1)
  state.visible = true
  render()
}

function resize(sizeDelta: number, zoomDelta: number): void {
  if (!state) return
  state.size = Math.min(LOUPE_SIZE.max, Math.max(LOUPE_SIZE.min, state.size + sizeDelta))
  state.zoom = Math.min(LOUPE_ZOOM.max, Math.max(LOUPE_ZOOM.min, state.zoom + zoomDelta))
  render()
  // The bigger or further zoomed in the loupe, the slower the mouse (macOS only).
  window.picker.setCursorSpeed(cursorSpeed(state.size, state.zoom))
}

async function pick(keepOpen: boolean): Promise<void> {
  if (!state || !state.visible) return
  const hex = await currentColor()
  if (!hex || !state) return
  window.picker.pick(hex, keepOpen)
  if (keepOpen) {
    state.picked++
    loupe.classList.remove('flash')
    void loupe.offsetWidth
    loupe.classList.add('flash')
    render()
  }
}

function showHint(): void {
  const mod = isMac ? '⇧' : 'Shift'
  hint.innerHTML = [
    ['Click', 'pick'],
    [`${mod} Click`, 'pick multiple'],
    ['← ↑ → ↓', 'move'],
    ['+ −', 'size'],
    [isMac ? '⌥ + −' : 'Alt + −', 'zoom'],
    ['Esc', 'cancel']
  ]
    .map(([key, label]) => `<span><kbd>${key}</kbd>${label}</span>`)
    .join('')
  hint.hidden = false
  window.setTimeout(() => hint.classList.add('fade'), 3500)
}

// Pointer events report fractions of a CSS pixel, so the slowed-down mouse reaches every pixel.
window.addEventListener('pointermove', (event) => {
  if (!state) return
  moveTo(event.clientX * state.scaleX, event.clientY * state.scaleY)
})

window.addEventListener('mouseenter', () => window.picker.focus())
document.addEventListener('mouseleave', () => {
  if (!state) return
  state.visible = false
  render()
})

window.addEventListener('mousedown', (event) => {
  event.preventDefault()
  if (event.button === 2) window.picker.cancel()
  else if (event.button === 0) void pick(event.shiftKey || event.metaKey || event.ctrlKey)
})
window.addEventListener('contextmenu', (event) => event.preventDefault())

window.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault()
    const direction = event.deltaY < 0 ? 1 : -1
    if (event.altKey) resize(0, direction * LOUPE_ZOOM.step)
    else resize(direction * LOUPE_SIZE.step, 0)
  },
  { passive: false }
)

window.addEventListener('keydown', (event) => {
  if (!state) return
  const step = event.shiftKey ? 10 : 1
  switch (event.code) {
    case 'Escape':
      window.picker.cancel()
      break
    case 'Enter':
    case 'NumpadEnter':
    case 'Space':
      void pick(event.shiftKey)
      break
    case 'ArrowLeft':
      moveTo(state.x - step, state.y)
      break
    case 'ArrowRight':
      moveTo(state.x + step, state.y)
      break
    case 'ArrowUp':
      moveTo(state.x, state.y - step)
      break
    case 'ArrowDown':
      moveTo(state.x, state.y + step)
      break
    // `BracketRight` and `Slash` are the + and - keys on German and similar layouts.
    case 'Equal':
    case 'NumpadAdd':
    case 'BracketRight':
      if (event.altKey) resize(0, LOUPE_ZOOM.step)
      else resize(LOUPE_SIZE.step, 0)
      break
    case 'Minus':
    case 'NumpadSubtract':
    case 'Slash':
      if (event.altKey) resize(0, -LOUPE_ZOOM.step)
      else resize(-LOUPE_SIZE.step, 0)
      break
    default:
      return
  }
  event.preventDefault()
})
