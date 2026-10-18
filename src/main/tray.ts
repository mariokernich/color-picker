import { join } from 'node:path'
import { Menu, MenuItemConstructorOptions, Tray, nativeImage, nativeTheme } from 'electron'
import { PRODUCT } from '../shared/product'

const isMac = process.platform === 'darwin'

export function resourcePath(name: string): string {
  return join(__dirname, '../../resources', name)
}

export interface TrayHandlers {
  onClick: () => void
  pick: () => void
  open: () => void
  contrast: () => void
  settings: () => void
  quit: () => void
}

/**
 * Template images adapt to light and dark menu bars on macOS. Windows has no such mechanism,
 * so the icon follows the taskbar theme. `@2x` variants are picked up automatically.
 */
function trayIcon(): Electron.NativeImage {
  if (isMac) {
    const icon = nativeImage.createFromPath(resourcePath('trayTemplate.png'))
    icon.setTemplateImage(true)
    return icon
  }
  const dark = nativeTheme.shouldUseDarkColorsForSystemIntegratedUI
  return nativeImage.createFromPath(resourcePath(dark ? 'tray-dark.png' : 'tray-light.png'))
}

export function createTray(handlers: TrayHandlers): Tray {
  const tray = new Tray(trayIcon())
  tray.setToolTip(PRODUCT.name)
  if (!isMac) nativeTheme.on('updated', () => tray.setImage(trayIcon()))

  const template: MenuItemConstructorOptions[] = [
    { label: 'Pick Color', click: handlers.pick },
    { label: `Open ${PRODUCT.name}`, click: handlers.open },
    { label: 'Contrast Checker', click: handlers.contrast },
    { type: 'separator' },
    { label: isMac ? 'Settings…' : 'Settings', click: handlers.settings },
    { type: 'separator' },
    { label: `Quit ${PRODUCT.name}`, click: handlers.quit }
  ]
  const menu = Menu.buildFromTemplate(template)

  // The context menu is opened manually so a left click keeps its own action on macOS.
  tray.on('click', handlers.onClick)
  tray.on('right-click', () => tray.popUpContextMenu(menu))
  return tray
}
