import { parseHex } from './color'
import type { ExportFormat, SavedColor } from './types'

export const EXPORT_FORMATS: { id: ExportFormat; label: string; extension: string }[] = [
  { id: 'json', label: 'JSON', extension: 'json' },
  { id: 'css', label: 'CSS Variables', extension: 'css' },
  { id: 'scss', label: 'SCSS Variables', extension: 'scss' },
  { id: 'tailwind', label: 'Tailwind Config', extension: 'js' },
  { id: 'gpl', label: 'GIMP / Inkscape Palette', extension: 'gpl' }
]

export function slugify(text: string): string {
  return (
    text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'color'
  )
}

/** Variable names derived from color names, falling back to `color-N`; always unique. */
function variableNames(colors: SavedColor[]): string[] {
  const used = new Map<string, number>()
  return colors.map((color, index) => {
    const base = color.name ? slugify(color.name) : `color-${index + 1}`
    const count = used.get(base) ?? 0
    used.set(base, count + 1)
    return count ? `${base}-${count + 1}` : base
  })
}

export function exportPalette(name: string, colors: SavedColor[], format: ExportFormat): string {
  const names = variableNames(colors)
  switch (format) {
    case 'json':
      return (
        JSON.stringify(
          {
            name,
            colors: colors.map((color) => (color.name ? { name: color.name, hex: color.hex } : { hex: color.hex }))
          },
          null,
          2
        ) + '\n'
      )
    case 'css':
      return `/* ${name} */\n:root {\n${colors.map((c, i) => `  --${names[i]}: ${c.hex};`).join('\n')}\n}\n`
    case 'scss':
      return `// ${name}\n${colors.map((c, i) => `$${names[i]}: ${c.hex};`).join('\n')}\n`
    case 'tailwind':
      return (
        `// ${name}\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n        '${slugify(name)}': {\n` +
        colors.map((c, i) => `          '${names[i]}': '${c.hex}',`).join('\n') +
        `\n        }\n      }\n    }\n  }\n}\n`
      )
    case 'gpl': {
      const rows = colors.map((color, i) => {
        const rgb = parseHex(color.hex) ?? { r: 0, g: 0, b: 0 }
        const channels = [rgb.r, rgb.g, rgb.b].map((v) => String(v).padStart(3, ' ')).join(' ')
        return `${channels}\t${color.name ?? names[i]}`
      })
      return `GIMP Palette\nName: ${name}\nColumns: 8\n#\n${rows.join('\n')}\n`
    }
  }
}
