import { toHex } from './color'
import { LOUPE_SIZE, LOUPE_ZOOM } from './state'

/**
 * Converts native BGRA pixels to the RGBA order canvases use. `opaque` ignores the source alpha,
 * which still captures do not fill reliably; live reads mark pixels outside the display with 0.
 */
export function bgraToRgba(source: Uint8Array, opaque: boolean): Uint8ClampedArray<ArrayBuffer> {
  const pixels = new Uint8ClampedArray(source.length)
  for (let i = 0; i < source.length; i += 4) {
    pixels[i] = source[i + 2]
    pixels[i + 1] = source[i + 1]
    pixels[i + 2] = source[i]
    pixels[i + 3] = opaque ? 255 : source[i + 3]
  }
  return pixels
}

/** Hex color of an RGBA pixel, or `null` outside the image and for transparent pixels. */
export function pixelHex(
  pixels: Uint8ClampedArray,
  width: number,
  x: number,
  y: number
): string | null {
  const height = pixels.length / 4 / width
  if (x < 0 || y < 0 || x >= width || y >= height) return null
  const index = (y * width + x) * 4
  if (pixels[index + 3] === 0) return null
  return toHex({ r: pixels[index], g: pixels[index + 1], b: pixels[index + 2], a: 1 })
}

/** Pixels per side shown in the loupe: odd, so the picked pixel sits in the middle. */
export function loupeCells(size: number, zoom: number): number {
  return Math.max(3, Math.floor(size / zoom) | 1)
}

/**
 * Share of the mouse movement the picker applies: with a loupe bigger or zoomed in further than
 * the default, the cursor slows down so single pixels stay easy to hit.
 */
export function cursorSpeed(size: number, zoom: number): number {
  return Math.min(1, LOUPE_SIZE.default / size) * Math.min(1, LOUPE_ZOOM.default / zoom)
}
