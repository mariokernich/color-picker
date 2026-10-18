// Renders the app, tray and store icons from code so they stay consistent.
// Usage: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** resvg does not understand hsl(), so colors are converted to hex. */
function hsl(h, s, l) {
  const sn = s / 100
  const ln = l / 100
  const k = (n) => (n + h / 30) % 12
  const a = sn * Math.min(ln, 1 - ln)
  const f = (n) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const hex = (v) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`
}

/** SVG has no conic gradients, so the color ring is drawn from thin wedges. */
function colorRing(cx, cy, outer, inner, segments = 180) {
  const parts = []
  for (let i = 0; i < segments; i++) {
    const a0 = ((i - 0.6) / segments) * Math.PI * 2 - Math.PI / 2
    const a1 = ((i + 1) / segments) * Math.PI * 2 - Math.PI / 2
    const point = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`
    parts.push(
      `<path d="M${point(inner, a0)} L${point(outer, a0)} A${outer} ${outer} 0 0 1 ${point(outer, a1)} L${point(inner, a1)} A${inner} ${inner} 0 0 0 ${point(inner, a0)} Z" fill="${hsl((i / segments) * 360, 88, 60)}"/>`
    )
  }
  return parts.join('')
}

/** Zoomed "pixels" inside the loupe, with the picked pixel outlined. */
function pixelGrid(cx, cy, radius, cells) {
  const size = (radius * 2) / cells
  const start = cx - radius
  const top = cy - radius
  const parts = []
  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) {
      const t = (row + col) / (2 * (cells - 1))
      const hue = 250 + t * 80
      const light = 62 + Math.sin((row * 3 + col) * 1.7) * 6
      parts.push(
        `<rect x="${start + col * size}" y="${top + row * size}" width="${size + 0.5}" height="${size + 0.5}" fill="${hsl(hue, 80, light)}"/>`
      )
    }
  }
  const mid = Math.floor(cells / 2)
  const x = start + mid * size
  const y = top + mid * size
  return { cells: parts.join(''), center: { x, y, size } }
}

function appIcon() {
  const c = 512
  const grid = pixelGrid(c, c, 196, 5)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2E2A48"/>
      <stop offset="1" stop-color="#14121E"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.6">
      <stop offset="0" stop-color="#7B70FF" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#7B70FF" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="lens"><circle cx="${c}" cy="${c}" r="196"/></clipPath>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bg)"/>
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#glow)"/>
  <g filter="url(#shadow)">
    ${colorRing(c, c, 300, 208)}
    <circle cx="${c}" cy="${c}" r="208" fill="#F4F3FA"/>
    <g clip-path="url(#lens)">${grid.cells}</g>
    <rect x="${grid.center.x - 7}" y="${grid.center.y - 7}" width="${grid.center.size + 14}" height="${grid.center.size + 14}" rx="10" fill="none" stroke="#14121E" stroke-width="10"/>
    <rect x="${grid.center.x}" y="${grid.center.y}" width="${grid.center.size}" height="${grid.center.size}" rx="5" fill="none" stroke="#FFFFFF" stroke-width="8"/>
  </g>
</svg>`
}

/** Three fanned color cards; lighter cards are drawn with reduced opacity. */
function trayFan(color) {
  const card = (angle, opacity) =>
    `<rect x="5.5" y="2" width="5" height="11" rx="1.6" fill="${color}" fill-opacity="${opacity}" transform="rotate(${angle} 8 14)"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
  ${card(-28, 0.3)}${card(0, 0.6)}${card(28, 1)}
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
render(trayFan('#000000'), 16, 'resources/trayTemplate.png')
render(trayFan('#000000'), 32, 'resources/trayTemplate@2x.png')
render(trayFan('#1A1A1A'), 16, 'resources/tray-light.png')
render(trayFan('#1A1A1A'), 32, 'resources/tray-light@2x.png')
render(trayFan('#FFFFFF'), 16, 'resources/tray-dark.png')
render(trayFan('#FFFFFF'), 32, 'resources/tray-dark@2x.png')
render(tile(50, 50, 1.2), 50, 'build/appx/StoreLogo.png')
render(tile(44, 44, 1.2), 44, 'build/appx/Square44x44Logo.png')
render(tile(150, 150, 0.9), 150, 'build/appx/Square150x150Logo.png')
render(tile(310, 150, 0.9), 310, 'build/appx/Wide310x150Logo.png', 150)
