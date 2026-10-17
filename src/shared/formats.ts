import { RGBA, rgbToHsl, rgbToHsv, rgbToOklch, round, toHex } from './color'

export interface ColorFormat {
  id: string
  group: string
  label: string
  format: (color: RGBA) => string
}

const unit = (channel: number): string => round(channel / 255, 3).toFixed(3)
const alpha = (color: RGBA): string => round(color.a, 3).toString()
const argbHex = (color: RGBA): string => {
  const hex = toHex(color, true).slice(1)
  return hex.slice(6, 8) + hex.slice(0, 6)
}

export const COLOR_FORMATS: ColorFormat[] = [
  { id: 'css-hex', group: 'CSS', label: 'Hex', format: (c) => toHex(c) },
  { id: 'css-hex-bare', group: 'CSS', label: 'Hex without #', format: (c) => toHex(c).slice(1) },
  {
    id: 'css-rgb',
    group: 'CSS',
    label: 'RGB',
    format: (c) =>
      c.a < 1 ? `rgb(${c.r} ${c.g} ${c.b} / ${alpha(c)})` : `rgb(${c.r} ${c.g} ${c.b})`
  },
  {
    id: 'css-rgba',
    group: 'CSS',
    label: 'RGBA (legacy)',
    format: (c) => `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha(c)})`
  },
  {
    id: 'css-hsl',
    group: 'CSS',
    label: 'HSL',
    format: (c) => {
      const { h, s, l } = rgbToHsl(c)
      const body = `${round(h)} ${round(s)}% ${round(l)}%`
      return c.a < 1 ? `hsl(${body} / ${alpha(c)})` : `hsl(${body})`
    }
  },
  {
    id: 'css-oklch',
    group: 'CSS',
    label: 'OKLCH',
    format: (c) => {
      const { l, c: chroma, h } = rgbToOklch(c)
      const body = `${round(l * 100, 1)}% ${round(chroma, 3)} ${round(h, 1)}`
      return c.a < 1 ? `oklch(${body} / ${alpha(c)})` : `oklch(${body})`
    }
  },
  {
    id: 'swiftui',
    group: 'Apple',
    label: 'SwiftUI Color',
    format: (c) =>
      `Color(red: ${unit(c.r)}, green: ${unit(c.g)}, blue: ${unit(c.b)}, opacity: ${alpha(c)})`
  },
  {
    id: 'uicolor',
    group: 'Apple',
    label: 'UIColor',
    format: (c) =>
      `UIColor(red: ${unit(c.r)}, green: ${unit(c.g)}, blue: ${unit(c.b)}, alpha: ${alpha(c)})`
  },
  {
    id: 'nscolor',
    group: 'Apple',
    label: 'NSColor',
    format: (c) =>
      `NSColor(srgbRed: ${unit(c.r)}, green: ${unit(c.g)}, blue: ${unit(c.b)}, alpha: ${alpha(c)})`
  },
  {
    id: 'android-xml',
    group: 'Android',
    label: 'XML resource',
    format: (c) => `<color name="color">#${argbHex(c)}</color>`
  },
  {
    id: 'android-compose',
    group: 'Android',
    label: 'Jetpack Compose',
    format: (c) => `Color(0x${argbHex(c)})`
  },
  { id: 'flutter', group: 'Flutter', label: 'Color', format: (c) => `Color(0x${argbHex(c)})` },
  {
    id: 'dotnet',
    group: '.NET',
    label: 'Color.FromArgb',
    format: (c) => `Color.FromArgb(${Math.round(c.a * 255)}, ${c.r}, ${c.g}, ${c.b})`
  },
  {
    id: 'java',
    group: 'Java',
    label: 'java.awt.Color',
    format: (c) =>
      c.a < 1
        ? `new Color(${c.r}, ${c.g}, ${c.b}, ${Math.round(c.a * 255)})`
        : `new Color(${c.r}, ${c.g}, ${c.b})`
  },
  {
    id: 'unity',
    group: 'Unity',
    label: 'Color',
    format: (c) => `new Color(${unit(c.r)}f, ${unit(c.g)}f, ${unit(c.b)}f, ${alpha(c)}f)`
  },
  {
    id: 'opengl',
    group: 'OpenGL',
    label: 'vec4',
    format: (c) => `vec4(${unit(c.r)}, ${unit(c.g)}, ${unit(c.b)}, ${round(c.a, 3).toFixed(3)})`
  },
  {
    id: 'hsb',
    group: 'Design',
    label: 'HSB',
    format: (c) => {
      const { h, s, v } = rgbToHsv(c)
      return `${round(h)}°, ${round(s)}%, ${round(v)}%`
    }
  }
]

export const DEFAULT_FORMAT_ID = 'css-hex'

export function getFormat(id: string): ColorFormat {
  return COLOR_FORMATS.find((format) => format.id === id) ?? COLOR_FORMATS[0]
}

export function formatColor(color: RGBA, formatId: string): string {
  return getFormat(formatId).format(color)
}
