import { isLight, parseHex, toHex } from '@shared/color'
import type { PickerInit } from '@shared/api'
import { LOUPE_SIZE, LOUPE_ZOOM } from '@shared/state'
import './picker.css'

const screenCanvas = document.getElementById('screen') as HTMLCanvasElement
const loupe = document.getElementById('loupe') as HTMLDivElement
const loupeCanvas = document.getElementById('loupe-canvas') as HTMLCanvasElement
const loupeLabel = document.getElementById('loupe-label') as HTMLDivElement
const hint = document.getElementById('hint') as HTMLDivElement

const isMac = navigator.userAgent.includes('Mac')

interface PickerState {
  init: PickerInit
  pixels: Uint8ClampedArray
  /** Image pixels per CSS pixel. */
  scaleX: number
  scaleY: number
  /** Cursor in image pixels. */
  x: number
  y: number
  visible: boolean
  size: number
  zoom: number
  picked: number
}

let state: PickerState | null = null

window.picker.onInit((init) => {
  // Native bitmaps are BGRA; canvases want RGBA.
  const pixels = new Uint8ClampedArray(init.image.data.length)
  const source = init.image.data
  for (let i = 0; i < source.length; i += 4) {
    pixels[i] = source[i + 2]
    pixels[i + 1] = source[i + 1]
    pixels[i + 2] = source[i]
    pixels[i + 3] = 255
  }
  screenCanvas.width = init.image.width
  screenCanvas.height = init.image.height
  screenCanvas.getContext('2d')!.putImageData(new ImageData(pixels, init.image.width), 0, 0)

  const scaleX = init.image.width / init.width
  const scaleY = init.image.height / init.height
  state = {
    init,
    pixels,
    scaleX,
    scaleY,
    x: init.cursor ? Math.floor(init.cursor.x * scaleX) : 0,
    y: init.cursor ? Math.floor(init.cursor.y * scaleY) : 0,
    visible: init.cursor !== null,
    size: init.loupeSize,
    zoom: init.loupeZoom,
    picked: 0
  }
  if (init.cursor) showHint()
  render()
})

function colorAt(x: number, y: number): string {
  if (!state) return '#000000'
  const index = (y * state.init.image.width + x) * 4
  const p = state.pixels
  return toHex({ r: p[index], g: p[index + 1], b: p[index + 2], a: 1 })
}

function render(): void {
  if (!state || !state.visible) {
    loupe.hidden = true
    return
  }
  const { size, zoom, x, y, scaleX, scaleY } = state
  const dpr = window.devicePixelRatio || 1
  // An odd number of cells keeps the picked pixel in the middle.
  const cells = Math.max(3, Math.floor(size / zoom) | 1)
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
  ctx.drawImage(screenCanvas, x - half, y - half, cells, cells, 0, 0, size, size)

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

  const hex = colorAt(x, y)
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
  state.x = Math.min(Math.max(0, Math.round(x)), state.init.image.width - 1)
  state.y = Math.min(Math.max(0, Math.round(y)), state.init.image.height - 1)
  state.visible = true
  render()
}

function resize(sizeDelta: number, zoomDelta: number): void {
  if (!state) return
  state.size = Math.min(LOUPE_SIZE.max, Math.max(LOUPE_SIZE.min, state.size + sizeDelta))
  state.zoom = Math.min(LOUPE_ZOOM.max, Math.max(LOUPE_ZOOM.min, state.zoom + zoomDelta))
  render()
  window.picker.setLoupe(state.size, state.zoom)
}

function pick(keepOpen: boolean): void {
  if (!state || !state.visible) return
  window.picker.pick(colorAt(state.x, state.y), keepOpen)
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

window.addEventListener('mousemove', (event) => {
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
  else if (event.button === 0) pick(event.shiftKey || event.metaKey || event.ctrlKey)
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
      pick(event.shiftKey)
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
