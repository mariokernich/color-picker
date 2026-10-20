// Tiny Chrome DevTools Protocol driver for rendering screenshots with headless Chrome.
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function launch(profileDir, port = 9333) {
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--font-render-hinting=none',
      'about:blank'
    ],
    { stdio: 'ignore' }
  )
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = list.find((item) => item.type === 'page')
      if (page) return { chrome, page: await connect(page.webSocketDebuggerUrl) }
    } catch {}
    await sleep(200)
  }
  chrome.kill()
  throw new Error('Chrome did not start')
}

async function connect(url) {
  const socket = new WebSocket(url)
  await new Promise((resolve, reject) => {
    socket.onopen = resolve
    socket.onerror = reject
  })
  let id = 0
  const pending = new Map()
  const listeners = new Map()
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(JSON.stringify(message.error)))
      else resolve(message.result)
    } else if (message.method) {
      listeners.get(message.method)?.forEach((listener) => listener(message.params))
    }
  }
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const messageId = ++id
      pending.set(messageId, { resolve, reject })
      socket.send(JSON.stringify({ id: messageId, method, params }))
    })
  const once = (method) =>
    new Promise((resolve) => {
      const set = listeners.get(method) ?? new Set()
      const listener = (params) => {
        set.delete(listener)
        resolve(params)
      }
      set.add(listener)
      listeners.set(method, set)
    })
  await send('Page.enable')
  await send('Runtime.enable')
  return {
    send,
    async viewport(width, height, scale = 2, dark = false) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: scale,
        mobile: false
      })
      await send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }]
      })
    },
    async inject(source) {
      return send('Page.addScriptToEvaluateOnNewDocument', { source })
    },
    async goto(url, settle = 800) {
      const loaded = once('Page.loadEventFired')
      await send('Page.navigate', { url })
      await loaded
      await sleep(settle)
    },
    async eval(expression) {
      const result = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true
      })
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
      return result.result.value
    },
    async shot(path) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(path, Buffer.from(data, 'base64'))
    },
    sleep
  }
}
