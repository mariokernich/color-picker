import { describe, expect, it } from 'vitest'
import {
  hslToRgb,
  hsvToRgb,
  isLight,
  parseColor,
  parseHex,
  rgbToHsl,
  rgbToHsv,
  rgbToOklch,
  toHex
} from './color'

describe('parseHex', () => {
  it('parses short and long forms with and without alpha', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseHex('540d6e')).toEqual({ r: 84, g: 13, b: 110, a: 1 })
    expect(parseHex('#540D6E80')).toEqual({ r: 84, g: 13, b: 110, a: 0.502 })
    expect(parseHex('#0008')?.a).toBeCloseTo(0.533, 3)
  })

  it('rejects invalid input', () => {
    expect(parseHex('#12')).toBeNull()
    expect(parseHex('#ggg')).toBeNull()
    expect(parseHex('')).toBeNull()
  })
})

describe('parseColor', () => {
  it('parses rgb and rgba in comma and space syntax', () => {
    expect(parseColor('rgb(84, 13, 110)')).toEqual({ r: 84, g: 13, b: 110, a: 1 })
    expect(parseColor('rgba(84, 13, 110, 0.5)')).toEqual({ r: 84, g: 13, b: 110, a: 0.5 })
    expect(parseColor('rgb(84 13 110 / 50%)')).toEqual({ r: 84, g: 13, b: 110, a: 0.5 })
    expect(parseColor('rgb(100%, 0%, 0%)')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
  })

  it('parses hsl', () => {
    expect(toHex(parseColor('hsl(284, 79%, 24%)')!)).toBe('#540D6E')
    expect(toHex(parseColor('hsl(0 100% 50% / 0.5)')!)).toBe('#FF000080')
  })

  it('returns null for garbage', () => {
    expect(parseColor('rgb(1, 2)')).toBeNull()
    expect(parseColor('banana')).toBeNull()
  })
})

describe('toHex', () => {
  it('only includes alpha when translucent unless forced', () => {
    expect(toHex({ r: 84, g: 13, b: 110, a: 1 })).toBe('#540D6E')
    expect(toHex({ r: 84, g: 13, b: 110, a: 1 }, true)).toBe('#540D6EFF')
    expect(toHex({ r: 84, g: 13, b: 110, a: 0.5 })).toBe('#540D6E80')
  })
})

describe('conversions', () => {
  const samples = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#540D6E', '#EE4266', '#3BCEAC', '#808080']

  it.each(samples)('round-trips %s through HSL and HSV', (hex) => {
    const color = parseHex(hex)!
    expect(toHex(hslToRgb(rgbToHsl(color)))).toBe(hex)
    expect(toHex(hsvToRgb(rgbToHsv(color)))).toBe(hex)
  })

  it('computes known HSL/HSV values', () => {
    const hsl = rgbToHsl(parseHex('#540D6E')!)
    expect(hsl.h).toBeCloseTo(283.9, 1)
    expect(hsl.s).toBeCloseTo(78.9, 1)
    expect(hsl.l).toBeCloseTo(24.1, 1)
    const hsv = rgbToHsv(parseHex('#FF0000')!)
    expect(hsv).toEqual({ h: 0, s: 100, v: 100, a: 1 })
  })

  it('handles negative and >360 hues', () => {
    expect(toHex(hslToRgb({ h: -120, s: 100, l: 50, a: 1 }))).toBe('#0000FF')
    expect(toHex(hsvToRgb({ h: 480, s: 100, v: 100, a: 1 }))).toBe('#00FF00')
  })

  it('converts to OKLCH', () => {
    const white = rgbToOklch(parseHex('#FFFFFF')!)
    expect(white.l).toBeCloseTo(1, 3)
    expect(white.c).toBeCloseTo(0, 3)
    const red = rgbToOklch(parseHex('#FF0000')!)
    expect(red.l).toBeCloseTo(0.628, 3)
    expect(red.c).toBeCloseTo(0.2577, 3)
    expect(red.h).toBeCloseTo(29.23, 1)
  })
})

describe('isLight', () => {
  it('picks readable text color', () => {
    expect(isLight(parseHex('#FFFFFF')!)).toBe(true)
    expect(isLight(parseHex('#FFD23F')!)).toBe(true)
    expect(isLight(parseHex('#540D6E')!)).toBe(false)
    expect(isLight(parseHex('#00000010')!)).toBe(true)
  })
})
