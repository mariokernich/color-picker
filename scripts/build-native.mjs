// Builds the native screen sampler in native/sampler for Electron and copies it to
// native/sampler/prebuilds/<platform>-<arch>/sampler.node, where the app loads it in development
// and electron-builder picks it up for packaging.
// Usage: node scripts/build-native.mjs [arch] [--optional]
// `--optional` (used by postinstall) only warns on failure: the picker then freezes the screen.
// electron-builder runs the default export as `beforePack` hook for every packaged architecture.
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const samplerDir = join(root, 'native', 'sampler')
const require = createRequire(import.meta.url)

export function buildSampler(arch = process.arch) {
  if (process.platform !== 'darwin' && process.platform !== 'win32') {
    console.log(`Skipping the native sampler: not available on ${process.platform}.`)
    return
  }
  const electron = JSON.parse(readFileSync(require.resolve('electron/package.json'), 'utf8'))
  const nodeGyp = require.resolve('node-gyp/bin/node-gyp.js')
  execFileSync(
    process.execPath,
    [
      nodeGyp,
      'rebuild',
      `--target=${electron.version}`,
      `--arch=${arch}`,
      '--dist-url=https://electronjs.org/headers'
    ],
    { cwd: samplerDir, stdio: 'inherit' }
  )
  const target = join(samplerDir, 'prebuilds', `${process.platform}-${arch}`)
  mkdirSync(target, { recursive: true })
  copyFileSync(join(samplerDir, 'build', 'Release', 'sampler.node'), join(target, 'sampler.node'))
  console.log(`Built the native sampler for ${process.platform}-${arch}.`)
}

export default async function beforePack(context) {
  const { Arch } = await import('electron-builder')
  buildSampler(Arch[context.arch])
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  const optional = args.includes('--optional')
  try {
    buildSampler(args.find((arg) => !arg.startsWith('--')))
  } catch (error) {
    if (!optional) throw error
    console.warn(
      'The native sampler could not be built, so the picker freezes the screen instead of ' +
        'showing it live. Install the C++ build tools (Xcode Command Line Tools or Visual ' +
        'Studio Build Tools) and run `npm run native`.'
    )
  }
}
