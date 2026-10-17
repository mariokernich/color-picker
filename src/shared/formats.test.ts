import { describe, expect, it } from 'vitest'
import { parseHex } from './color'
import { COLOR_FORMATS, formatColor, getFormat } from './formats'

const purple = parseHex('#540D6E')!
const translucent = parseHex('#540D6E80')!

describe('formats', () => {
  it('has unique ids', () => {
    const ids = COLOR_FORMATS.map((format) => format.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each([
    ['css-hex', '#540D6E'],
    ['css-hex-bare', '540D6E'],
    ['css-rgb', 'rgb(84 13 110)'],
    ['css-rgba', 'rgba(84, 13, 110, 1)'],
    ['css-hsl', 'hsl(284 79% 24%)'],
    ['swiftui', 'Color(red: 0.329, green: 0.051, blue: 0.431, opacity: 1)'],
    ['android-xml', '<color name="color">#FF540D6E</color>'],
    ['android-compose', 'Color(0xFF540D6E)'],
    ['dotnet', 'Color.FromArgb(255, 84, 13, 110)'],
    ['java', 'new Color(84, 13, 110)'],
    ['hsb', '284°, 88%, 43%']
  ])('formats %s', (id, expected) => {
    expect(formatColor(purple, id)).toBe(expected)
  })

  it('includes alpha for translucent colors', () => {
    expect(formatColor(translucent, 'css-hex')).toBe('#540D6E80')
    expect(formatColor(translucent, 'css-rgb')).toBe('rgb(84 13 110 / 0.502)')
    expect(formatColor(translucent, 'android-compose')).toBe('Color(0x80540D6E)')
  })

  it('falls back to hex for unknown ids', () => {
    expect(getFormat('nope').id).toBe('css-hex')
  })
})
