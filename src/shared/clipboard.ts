import { parseColor, toHex } from './color'

const BARE_HEX = /^[0-9a-f]{6}([0-9a-f]{2})?$/i

/**
 * The color in copied text as `#RRGGBB` (or `#RRGGBBAA`), or `null` unless the text is one color.
 * Hex without `#` only counts with 6 or 8 digits that mix letters and numbers, so plain numbers
 * and words like "DEFACE" are not taken for colors.
 */
export function clipboardColor(text: string): string | null {
  const value = text.trim()
  if (!value || value.length > 64 || value.includes('\n')) return null
  if (/^[0-9a-f]+$/i.test(value)) {
    if (!BARE_HEX.test(value) || !/[0-9]/.test(value) || !/[a-f]/i.test(value)) return null
  }
  const color = parseColor(value)
  return color ? toHex(color) : null
}
