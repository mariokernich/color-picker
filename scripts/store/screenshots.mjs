// Renders the App Store screenshots (2880×1800) from the real app UI with headless Chrome:
// the built popover renderer with its browser mock data, and the real picker overlay drawing
// the loupe over scene.html. Run `npm run store:screenshots` (builds the renderer first).
// Output: dist/store-screenshots/<locale>-<n>.png, raw captures in dist/store-screenshots/raw/.
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './cdp.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const renderer = join(root, 'out', 'renderer')
const output = join(root, 'dist', 'store-screenshots')
const raw = join(output, 'raw')
const listing = JSON.parse(readFileSync(join(here, 'listing.json'), 'utf8'))

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
}

/** Serves the built renderer at /renderer/, the raw captures at /raw/ and this folder at /. */
function serve() {
  const server = createServer((request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname))
    const [base, rest] = path.startsWith('/renderer/')
      ? [renderer, path.slice('/renderer/'.length)]
      : path.startsWith('/raw/')
        ? [raw, path.slice('/raw/'.length)]
        : [here, path.slice(1)]
    const file = join(base, rest)
    if (!file.startsWith(base) || !existsSync(file)) {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
    createReadStream(file).pipe(response)
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

/** Home, color editor, palette and contrast views of the popover (340×560), light and dark. */
async function popover(page, url) {
  for (const dark of [false, true]) {
    const theme = dark ? 'dark' : 'light'
    await page.viewport(340, 560, 3, dark)
    await page.goto(`${url}/renderer/index.html`, 1200)
    await page.shot(join(raw, `home-${theme}.png`))
    // The color editor opens on a double-click on a history swatch.
    await page.eval(`document.querySelectorAll('.swatch-grid [title]')[1]
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`)
    await page.sleep(700)
    await page.shot(join(raw, `color-${theme}.png`))
    await page.goto(`${url}/renderer/index.html`, 1200)
    await page.eval(`document.querySelector('.palette-row__main').click()`)
    await page.sleep(700)
    await page.shot(join(raw, `palette-${theme}.png`))
    await page.goto(`${url}/renderer/index.html?route=contrast`, 1200)
    // Dark text on white passes every level; pick it from the recent colors.
    await page.eval(`[...document.querySelectorAll('[aria-label]')]
      .find((element) => /#2B2D42/i.test(element.getAttribute('aria-label'))).click()`)
    await page.sleep(600)
    await page.shot(join(raw, `contrast-${theme}.png`))
  }
}

/** The picker overlay over scene.html, fed like a frozen pick, with an enlarged loupe. */
async function loupe(page, url) {
  await page.viewport(1440, 900, 2)
  await page.goto(`${url}/scene.html`, 800)
  await page.shot(join(raw, 'scene.png'))
  const scene = readFileSync(join(raw, 'scene.png')).toString('base64')
  // Stands in for the preload bridge (src/preload/picker.ts) with the scene as capture.
  await page.inject(`
    window.picker = {
      onInit(listener) {
        const image = new Image()
        image.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = image.width
          canvas.height = image.height
          const context = canvas.getContext('2d')
          context.drawImage(image, 0, 0)
          const rgba = context.getImageData(0, 0, image.width, image.height).data
          const bgra = new Uint8Array(rgba.length)
          for (let i = 0; i < rgba.length; i += 4) {
            bgra[i] = rgba[i + 2]
            bgra[i + 1] = rgba[i + 1]
            bgra[i + 2] = rgba[i]
            bgra[i + 3] = 255
          }
          listener({
            width: 1440,
            height: 900,
            pixelWidth: image.width,
            pixelHeight: image.height,
            image: { width: image.width, height: image.height, data: bgra },
            // On the edge of a purple letter, so the pixel grid shows.
            cursor: { x: 224, y: 236 }
          })
        }
        image.src = 'data:image/png;base64,${scene}'
      },
      pick() {},
      cancel() {},
      focus() {},
      setCursorSpeed() {},
      read: async () => null
    }
  `)
  await page.goto(`${url}/renderer/picker.html`, 600)
  // A bigger loupe, as with four steps of the scroll wheel.
  await page.eval(`for (let i = 0; i < 4; i++) {
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true }))
  }`)
  await page.sleep(400)
  await page.shot(join(raw, 'loupe.png'))
}

async function slides(page, url) {
  await page.viewport(1440, 900, 2)
  for (const [locale, { screenshots }] of Object.entries(listing.locales)) {
    for (let slide = 1; slide <= screenshots.length; slide++) {
      await page.goto(`${url}/compose.html?slide=${slide}&locale=${locale}`, 200)
      await page.eval('window.ready')
      await page.shot(join(output, `${locale}-${slide}.png`))
    }
  }
}

if (!existsSync(join(renderer, 'index.html'))) {
  throw new Error('out/renderer is missing; run `npm run build` first.')
}
rmSync(output, { recursive: true, force: true })
mkdirSync(raw, { recursive: true })
const server = await serve()
const url = `http://127.0.0.1:${server.address().port}`
const profile = join(tmpdir(), `chipdeck-store-${process.pid}`)
const { chrome, page } = await launch(profile)
try {
  await popover(page, url)
  await loupe(page, url)
  await slides(page, url)
  console.log(`Screenshots written to ${output}`)
} finally {
  server.close()
  // Chrome keeps writing its profile until it has exited.
  const exited = once(chrome, 'exit')
  chrome.kill()
  await exited
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
