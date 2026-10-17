import { RGBA, composite, relativeLuminance } from './color'

export interface ContrastResult {
  ratio: number
  /** Normal text (< 18pt / 14pt bold). */
  aaNormal: boolean
  aaaNormal: boolean
  /** Large text (>= 18pt / 14pt bold). */
  aaLarge: boolean
  aaaLarge: boolean
  /** Graphical objects and UI components (WCAG 1.4.11). */
  aaUi: boolean
}

/** WCAG 2.x contrast ratio. A translucent foreground is composited over the background first. */
export function contrastRatio(foreground: RGBA, background: RGBA): number {
  const opaqueBackground = { ...background, a: 1 }
  const fg = relativeLuminance(composite(foreground, opaqueBackground))
  const bg = relativeLuminance(opaqueBackground)
  const [lighter, darker] = fg > bg ? [fg, bg] : [bg, fg]
  return (lighter + 0.05) / (darker + 0.05)
}

export function checkContrast(foreground: RGBA, background: RGBA): ContrastResult {
  const ratio = contrastRatio(foreground, background)
  return {
    ratio,
    aaNormal: ratio >= 4.5,
    aaaNormal: ratio >= 7,
    aaLarge: ratio >= 3,
    aaaLarge: ratio >= 4.5,
    aaUi: ratio >= 3
  }
}

/** Formats a ratio like WCAG tools do: truncated (never rounded up) to two decimals. */
export function formatRatio(ratio: number): string {
  return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`
}
