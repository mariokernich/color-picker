import { describe, expect, it } from 'vitest'
import { exportPalette, slugify } from './export'
import type { SavedColor } from './types'

const colors: SavedColor[] = [
  { id: '1', hex: '#540D6E', name: 'Deep Purple', createdAt: 0 },
  { id: '2', hex: '#EE4266', createdAt: 0 },
  { id: '3', hex: '#FFD23F', name: 'Deep Purple', createdAt: 0 }
]

describe('exportPalette', () => {
  it('exports CSS variables with unique names', () => {
    expect(exportPalette('Brand', colors, 'css')).toBe(
      '/* Brand */\n:root {\n  --deep-purple: #540D6E;\n  --color-2: #EE4266;\n  --deep-purple-2: #FFD23F;\n}\n'
    )
  })

  it('exports JSON', () => {
    expect(JSON.parse(exportPalette('Brand', colors, 'json'))).toEqual({
      name: 'Brand',
      colors: [{ name: 'Deep Purple', hex: '#540D6E' }, { hex: '#EE4266' }, { name: 'Deep Purple', hex: '#FFD23F' }]
    })
  })

  it('exports GIMP palettes', () => {
    expect(exportPalette('Brand', colors, 'gpl')).toContain(' 84  13 110\tDeep Purple')
  })

  it('slugifies umlauts and symbols', () => {
    expect(slugify('Grün & Blau!')).toBe('grun-blau')
    expect(slugify('***')).toBe('color')
  })
})
