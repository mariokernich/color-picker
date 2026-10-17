/**
 * Color model and conversions. All colors are sRGB with 8-bit channels and a 0..1 alpha.
 */

export interface RGBA {
  r: number
  g: number
  b: number
  a: number
}

export interface HSLA {
  h: number
  s: number
  l: number
  a: number
}

export interface HSVA {
  h: number
  s: number
  v: number
  a: number
}

export interface OKLCH {
  l: number
  c: number
  h: number
  a: number
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const clampChannel = (value: number): number => clamp(Math.round(value), 0, 255)

const clampAlpha = (value: number): number => clamp(value, 0, 1)

export const round = (value: number, digits = 0): number => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function rgba(r: number, g: number, b: number, a = 1): RGBA {
  return { r: clampChannel(r), g: clampChannel(g), b: clampChannel(b), a: clampAlpha(a) }
}

const HEX_PATTERN = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

export function parseHex(input: string): RGBA | null {
  const match = HEX_PATTERN.exec(input.trim())
  if (!match) return null
  let hex = match[1]
  if (hex.length <= 4) {
    hex = [...hex].map((char) => char + char).join('')
  }
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
  return { r, g, b, a: round(a, 3) }
}

const FUNCTION_PATTERN = /^(rgba?|hsla?)\(\s*([^)]*)\)$/i

function parseNumber(token: string, percentScale: number): number {
  const value = parseFloat(token)
  return token.trim().endsWith('%') ? (value / 100) * percentScale : value
}

/** Parses hex, rgb()/rgba() and hsl()/hsla() strings in both comma and space syntax. */
export function parseColor(input: string): RGBA | null {
  const text = input.trim()
  const hex = parseHex(text)
  if (hex) return hex

  const match = FUNCTION_PATTERN.exec(text)
  if (!match) return null
  const kind = match[1].toLowerCase()
  const parts = match[2]
    .replace(/\s*\/\s*/, ' / ')
    .split(/[\s,]+/)
    .filter((part) => part && part !== '/')
  if (parts.length < 3 || parts.length > 4 || parts.some((part) => isNaN(parseFloat(part)))) {
    return null
  }
  const alpha = parts[3] !== undefined ? parseNumber(parts[3], 1) : 1

  if (kind.startsWith('rgb')) {
    const [r, g, b] = parts.slice(0, 3).map((part) => parseNumber(part, 255))
    return rgba(r, g, b, alpha)
  }
  const h = parseFloat(parts[0])
  const s = parseNumber(parts[1].endsWith('%') ? parts[1] : `${parts[1]}%`, 100)
  const l = parseNumber(parts[2].endsWith('%') ? parts[2] : `${parts[2]}%`, 100)
  return hslToRgb({ h, s, l, a: alpha })
}

const toHexPair = (value: number): string => clampChannel(value).toString(16).padStart(2, '0')

/** Uppercase `#RRGGBB`, or `#RRGGBBAA` when the color is translucent (or `alpha` is forced). */
export function toHex(color: RGBA, alpha: boolean | 'auto' = 'auto'): string {
  const base = `#${toHexPair(color.r)}${toHexPair(color.g)}${toHexPair(color.b)}`
  const withAlpha = alpha === true || (alpha === 'auto' && color.a < 1)
  return (withAlpha ? base + toHexPair(color.a * 255) : base).toUpperCase()
}

export function rgbToHsl({ r, g, b, a }: RGBA): HSLA {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1))
    h = hueFromRgb(rn, gn, bn, max, delta)
  }
  return { h, s: s * 100, l: l * 100, a }
}

export function hslToRgb({ h, s, l, a }: HSLA): RGBA {
  const sn = clamp(s, 0, 100) / 100
  const ln = clamp(l, 0, 100) / 100
  const hue = ((h % 360) + 360) % 360
  const k = (n: number): number => (n + hue / 30) % 12
  const chroma = sn * Math.min(ln, 1 - ln)
  const f = (n: number): number =>
    ln - chroma * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return rgba(f(0) * 255, f(8) * 255, f(4) * 255, a)
}

export function rgbToHsv({ r, g, b, a }: RGBA): HSVA {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  const h = delta === 0 ? 0 : hueFromRgb(rn, gn, bn, max, delta)
  const s = max === 0 ? 0 : delta / max
  return { h, s: s * 100, v: max * 100, a }
}

export function hsvToRgb({ h, s, v, a }: HSVA): RGBA {
  const sn = clamp(s, 0, 100) / 100
  const vn = clamp(v, 0, 100) / 100
  const f = (n: number): number => {
    const k = (n + ((((h % 360) + 360) % 360) / 60)) % 6
    return vn - vn * sn * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return rgba(f(5) * 255, f(3) * 255, f(1) * 255, a)
}

function hueFromRgb(r: number, g: number, b: number, max: number, delta: number): number {
  let h: number
  if (max === r) h = ((g - b) / delta) % 6
  else if (max === g) h = (b - r) / delta + 2
  else h = (r - g) / delta + 4
  h *= 60
  return h < 0 ? h + 360 : h
}

const srgbToLinear = (channel: number): number => {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function rgbToOklch(color: RGBA): OKLCH {
  const r = srgbToLinear(color.r)
  const g = srgbToLinear(color.g)
  const b = srgbToLinear(color.b)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const c = Math.sqrt(A * A + B * B)
  let h = (Math.atan2(B, A) * 180) / Math.PI
  if (h < 0) h += 360
  return { l: L, c, h: c < 0.0001 ? 0 : h, a: color.a }
}

/** WCAG 2.x relative luminance. */
export function relativeLuminance(color: RGBA): number {
  return (
    0.2126 * srgbToLinear(color.r) + 0.7152 * srgbToLinear(color.g) + 0.0722 * srgbToLinear(color.b)
  )
}

/** Alpha-composites `top` over an opaque `bottom`. */
export function composite(top: RGBA, bottom: RGBA): RGBA {
  const a = top.a
  return rgba(
    top.r * a + bottom.r * (1 - a),
    top.g * a + bottom.g * (1 - a),
    top.b * a + bottom.b * (1 - a),
    1
  )
}

/** True when black text has more contrast on this color than white text. */
export function isLight(color: RGBA, background: RGBA = { r: 255, g: 255, b: 255, a: 1 }): boolean {
  // Luminance at which contrast against black equals contrast against white.
  return relativeLuminance(composite(color, background)) > Math.sqrt(1.05 * 0.05) - 0.05
}

export function equals(a: RGBA, b: RGBA): boolean {
  return toHex(a, true) === toHex(b, true)
}
