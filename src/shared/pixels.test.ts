import { describe, expect, it } from 'vitest'
import { bgraToRgba, cursorSpeed, loupeCells, pixelHex } from './pixels'

describe('bgraToRgba', () => {
  const bgra = new Uint8Array([10, 20, 30, 0, 40, 50, 60, 255])

  it('swaps red and blue and keeps the alpha of live reads', () => {
    expect([...bgraToRgba(bgra, false)]).toEqual([30, 20, 10, 0, 60, 50, 40, 255])
  })

  it('makes still captures opaque', () => {
    expect([...bgraToRgba(bgra, true)]).toEqual([30, 20, 10, 255, 60, 50, 40, 255])
  })
})

describe('pixelHex', () => {
  // 2 x 2 image: red, green / blue, transparent.
  const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 9, 9, 9, 0])

  it('reads pixels by position', () => {
    expect(pixelHex(pixels, 2, 0, 0)).toBe('#FF0000')
    expect(pixelHex(pixels, 2, 1, 0)).toBe('#00FF00')
    expect(pixelHex(pixels, 2, 0, 1)).toBe('#0000FF')
  })

  it('returns null for transparent pixels and outside the image', () => {
    expect(pixelHex(pixels, 2, 1, 1)).toBeNull()
    expect(pixelHex(pixels, 2, -1, 0)).toBeNull()
    expect(pixelHex(pixels, 2, 2, 0)).toBeNull()
    expect(pixelHex(pixels, 2, 0, 2)).toBeNull()
  })
})

describe('loupeCells', () => {
  it('is odd and at least 3', () => {
    expect(loupeCells(168, 12)).toBe(15)
    expect(loupeCells(96, 32)).toBe(3)
    expect(loupeCells(320, 4)).toBe(81)
    expect(loupeCells(100, 50)).toBe(3)
  })
})

describe('cursorSpeed', () => {
  it('keeps full speed up to the default zoom', () => {
    expect(cursorSpeed(4)).toBe(1)
    expect(cursorSpeed(12)).toBe(1)
  })

  it('slows down the further the loupe zooms in', () => {
    expect(cursorSpeed(24)).toBe(0.5)
    expect(cursorSpeed(32)).toBe(0.375)
  })
})
