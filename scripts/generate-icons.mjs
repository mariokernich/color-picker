// Renders the app, tray and store icons from code so they stay consistent.
// Usage: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Quarters of the mark from deepest (top left, with the dot) to lightest (bottom right). */
const VIOLET = ['#4219C4', '#5B2EE8', '#7C57FF', '#C4B2FF']

/** A circle in four quarters at (c, c) with radius r; `fills` go top left, top right,
 * bottom left, bottom right. */
function quarters(c, r, fills, extra = '') {
  const paths = [
    `M${c} ${c} L${c - r} ${c} A${r} ${r} 0 0 1 ${c} ${c - r} Z`,
    `M${c} ${c} L${c} ${c - r} A${r} ${r} 0 0 1 ${c + r} ${c} Z`,
    `M${c} ${c} L${c} ${c + r} A${r} ${r} 0 0 1 ${c - r} ${c} Z`,
    `M${c} ${c} L${c + r} ${c} A${r} ${r} 0 0 1 ${c} ${c + r} Z`
  ]
  return paths.map((d, i) => `<path d="${d}" ${fills[i]}${extra}/>`).join('')
}

/** White macOS-style tile (824 of 1024, room for the shadow) with the violet mark. */
function appIcon() {
  const c = 512
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#F1F0F7"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="125%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity="0.2"/>
    </filter>
  </defs>
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bg)" filter="url(#shadow)"/>
  ${quarters(c, 280, VIOLET.map((color) => `fill="${color}"`))}
  <circle cx="${c - 130}" cy="${c - 130}" r="46" fill="#FFFFFF"/>
</svg>`
}

/** The mark in one color for the menu bar / tray: quarters told apart by opacity, the dot cut
 * out. */
function trayMark(color) {
  const opacities = [1, 0.72, 0.5, 0.3]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
  <defs>
    <mask id="dot">
      <rect width="16" height="16" fill="#fff"/>
      <circle cx="5.2" cy="5.2" r="1.35" fill="#000"/>
    </mask>
  </defs>
  <g mask="url(#dot)">
    ${quarters(8, 7, opacities.map((opacity) => `fill="${color}" fill-opacity="${opacity}"`))}
  </g>
</svg>`
}

function render(svg, width, file, height = width) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng()
  const path = join(root, file)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, png)
  console.log(`${file} (${width}x${height})`)
}

/** Microsoft Store tiles: the icon centered on a transparent canvas of the given size. */
function tile(width, height, scale) {
  const iconSize = Math.round(Math.min(width, height) * scale)
  const inner = appIcon().replace('width="1024" height="1024"', `width="${iconSize}" height="${iconSize}" x="${(width - iconSize) / 2}" y="${(height - iconSize) / 2}"`)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${inner}</svg>`
}

render(appIcon(), 1024, 'build/icon.png')
render(appIcon(), 512, 'resources/icon.png')
// macOS tints template images itself; Windows/Linux get one variant per taskbar theme.
render(trayMark('#000000'), 16, 'resources/trayTemplate.png')
render(trayMark('#000000'), 32, 'resources/trayTemplate@2x.png')
render(trayMark('#1A1A1A'), 16, 'resources/tray-light.png')
render(trayMark('#1A1A1A'), 32, 'resources/tray-light@2x.png')
render(trayMark('#FFFFFF'), 16, 'resources/tray-dark.png')
render(trayMark('#FFFFFF'), 32, 'resources/tray-dark@2x.png')
// Website: header and hero icon, favicon.
render(appIcon(), 256, 'site/assets/icon.png')
render(appIcon(), 64, 'site/assets/favicon.png')
render(tile(50, 50, 1.2), 50, 'build/appx/StoreLogo.png')
render(tile(44, 44, 1.2), 44, 'build/appx/Square44x44Logo.png')
render(tile(150, 150, 0.9), 150, 'build/appx/Square150x150Logo.png')
render(tile(310, 150, 0.9), 310, 'build/appx/Wide310x150Logo.png', 150)
