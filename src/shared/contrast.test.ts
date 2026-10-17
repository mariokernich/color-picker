import { describe, expect, it } from 'vitest'
import { parseHex } from './color'
import { checkContrast, contrastRatio, formatRatio } from './contrast'

const hex = (value: string) => parseHex(value)!

describe('contrast', () => {
  it('matches WCAG reference values', () => {
    expect(contrastRatio(hex('#000000'), hex('#FFFFFF'))).toBeCloseTo(21, 5)
    expect(contrastRatio(hex('#FFFFFF'), hex('#FFFFFF'))).toBeCloseTo(1, 5)
    expect(contrastRatio(hex('#767676'), hex('#FFFFFF'))).toBeCloseTo(4.54, 2)
  })

  it('is symmetric for opaque colors', () => {
    expect(contrastRatio(hex('#540D6E'), hex('#FFD23F'))).toBeCloseTo(
      contrastRatio(hex('#FFD23F'), hex('#540D6E')),
      10
    )
  })

  it('composites translucent foregrounds', () => {
    expect(contrastRatio(hex('#00000000'), hex('#FFFFFF'))).toBeCloseTo(1, 5)
  })

  it('evaluates levels', () => {
    const result = checkContrast(hex('#777777'), hex('#FFFFFF'))
    expect(result.aaNormal).toBe(false)
    expect(result.aaLarge).toBe(true)
    expect(result.aaaLarge).toBe(false)
  })

  it('truncates when formatting', () => {
    expect(formatRatio(4.499)).toBe('4.49:1')
    expect(formatRatio(21)).toBe('21.00:1')
  })
})
