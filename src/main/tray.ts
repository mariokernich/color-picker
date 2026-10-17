import { join } from 'node:path'
import { Menu, MenuItemConstructorOptions, Tray, nativeImage } from 'electron'
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

export function createTray(handlers: TrayHandlers): Tray {
  // Template images adapt to light/dark menu bars on macOS; `@2x` variants are picked up automatically.
  const icon = nativeImage.createFromPath(resourcePath(isMac ? 'trayTemplate.png' : 'tray.png'))
  if (isMac) icon.setTemplateImage(true)
  const tray = new Tray(icon)
  tray.setToolTip(PRODUCT.name)

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
