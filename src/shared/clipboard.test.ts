import { describe, expect, it } from 'vitest'
import { clipboardColor } from './clipboard'

describe('clipboardColor', () => {
  it('reads hex with #', () => {
    expect(clipboardColor('#ff8800')).toBe('#FF8800')
    expect(clipboardColor('  #F80\n')).toBe('#FF8800')
    expect(clipboardColor('#FF880080')).toBe('#FF880080')
  })

  it('reads hex without # only when it looks like a color', () => {
    expect(clipboardColor('FF8800')).toBe('#FF8800')
    expect(clipboardColor('c0ffee')).toBe('#C0FFEE')
    expect(clipboardColor('123456')).toBeNull()
    expect(clipboardColor('DEFACE')).toBeNull()
    expect(clipboardColor('add')).toBeNull()
    expect(clipboardColor('1234')).toBeNull()
  })

  it('reads CSS color functions', () => {
    expect(clipboardColor('rgb(255, 136, 0)')).toBe('#FF8800')
    expect(clipboardColor('hsl(32 100% 50%)')).toBe('#FF8800')
  })

  it('ignores other text', () => {
    expect(clipboardColor('')).toBeNull()
    expect(clipboardColor('hello')).toBeNull()
    expect(clipboardColor('#ff8800 is our orange')).toBeNull()
    expect(clipboardColor('#ff8800\n#00ff88')).toBeNull()
  })
})
