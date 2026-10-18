import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  app,
  clipboard,
  dialog,
  ipcMain,
  nativeTheme,
  shell,
  systemPreferences
} from 'electron'
import { IPC, Route, ShortcutKind } from '../shared/api'
import { parseHex } from '../shared/color'
import { EXPORT_FORMATS, exportPalette, slugify } from '../shared/export'
import { formatColor } from '../shared/formats'
import { PRODUCT } from '../shared/product'
import { Action, LOUPE_SIZE, LOUPE_ZOOM } from '../shared/state'
import type { AppData, CollectionId, ExportFormat, PlatformInfo, ScreenAccess } from '../shared/types'
import { Picker } from './picker'
import { Shortcuts } from './shortcuts'
import { DataStore } from './store'
import { createTray } from './tray'
import { createPopoverWindow, positionPopover } from './windows'

const isMac = process.platform === 'darwin'

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.setName(PRODUCT.name)
  if (process.platform === 'win32') app.setAppUserModelId(PRODUCT.appId)
  void app.whenReady().then(main)
}

function main(): void {
  if (isMac) app.dock?.hide()

  const dataPath = join(app.getPath('userData'), 'data.json')
  const isFirstRun = !existsSync(dataPath)
  const store = new DataStore(dataPath)
  const popover = createPopoverWindow()
  let popoverWasVisible = false
  let suppressBlur = false
  let hiddenByBlurAt = 0

  const sendToPopover = (channel: string, ...args: unknown[]): void => {
    if (!popover.isDestroyed()) popover.webContents.send(channel, ...args)
  }

  const showPopover = (route?: Route): void => {
    positionPopover(popover, tray.getBounds())
    if (route) sendToPopover(IPC.navigate, route)
    if (isMac) app.focus({ steal: true })
    popover.show()
    popover.focus()
  }

  const togglePopover = (): void => {
    // Clicking the tray icon blurs the popover first; don't reopen what that click just closed.
    if (Date.now() - hiddenByBlurAt < 250) return
    if (popover.isVisible()) popover.hide()
    else showPopover()
  }

  const screenAccess = (): ScreenAccess =>
    isMac ? systemPreferences.getMediaAccessStatus('screen') : 'granted'

  const picker = new Picker({
    loupe: () => ({ size: store.state.settings.loupeSize, zoom: store.state.settings.loupeZoom }),
    onLoupeChange: (size, zoom) => {
      const clamp = (value: number, range: { min: number; max: number }): number =>
        Math.min(range.max, Math.max(range.min, Math.round(value)))
      store.dispatch({
        type: 'updateSettings',
        patch: { loupeSize: clamp(size, LOUPE_SIZE), loupeZoom: clamp(zoom, LOUPE_ZOOM) }
      })
    },
    onPick: (hex) => {
      const color = parseHex(hex)
      if (!color) return
      store.dispatch({ type: 'addColors', hexes: [hex] })
      if (store.state.settings.copyOnPick) {
        clipboard.writeText(formatColor(color, store.state.settings.formatId))
      }
    },
    onClose: () => {
      if (popoverWasVisible) showPopover()
    }
  })

  const startPicker = async (): Promise<void> => {
    if (picker.isActive) return
    const access = screenAccess()
    if (access === 'denied' || access === 'restricted') {
      // The popover shows how to grant the permission.
      showPopover('home')
      return
    }
    popoverWasVisible = popover.isVisible()
    if (popoverWasVisible) {
      popover.hide()
      // Let the hide animation finish so the popover does not end up in the capture.
      await new Promise((resolve) => setTimeout(resolve, isMac ? 180 : 60))
    }
    try {
      await picker.start()
    } catch (error) {
      console.error('Picker failed', error)
      showPopover('home')
      void dialog.showMessageBox(popover, {
        type: 'warning',
        message: 'The screen could not be captured.',
        detail: isMac
          ? 'Please allow screen recording for Color Picker in System Settings > Privacy & Security.'
          : String(error instanceof Error ? error.message : error)
      })
    }
  }

  const tray = createTray({
    onClick: () => {
      if (store.state.settings.trayClickAction === 'picker') void startPicker()
      else togglePopover()
    },
    pick: () => void startPicker(),
    open: () => showPopover('home'),
    contrast: () => showPopover('contrast'),
    settings: () => showPopover('settings'),
    quit: () => app.quit()
  })

  const shortcuts = new Shortcuts({
    picker: () => void startPicker(),
    popover: () => togglePopover()
  })
  shortcuts.apply({
    picker: store.state.settings.pickerShortcut,
    popover: store.state.settings.popoverShortcut
  })

  const applySettings = (data: AppData): void => {
    nativeTheme.themeSource = data.settings.theme
    if (!isMac) popover.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#1F1F23' : '#FAFAFB')
  }
  applySettings(store.state)

  const applyLoginItem = (openAtLogin: boolean): void => {
    if (process.windowsStore || !app.isPackaged) return
    app.setLoginItemSettings(isMac ? { openAtLogin, type: 'mainAppService' } : { openAtLogin })
  }

  store.subscribe((data, previous) => {
    sendToPopover(IPC.stateChanged, data)
    if (data.settings === previous.settings) return
    applySettings(data)
    if (data.settings.launchAtLogin !== previous.settings.launchAtLogin) {
      applyLoginItem(data.settings.launchAtLogin)
    }
  })

  popover.on('blur', () => {
    if (suppressBlur || popover.webContents.isDevToolsOpened()) return
    hiddenByBlurAt = Date.now()
    popover.hide()
  })

  // IPC

  ipcMain.handle(IPC.getState, () => store.state)
  ipcMain.handle(IPC.dispatch, (_event, action: Action) => {
    store.dispatch(action)
  })
  ipcMain.handle(IPC.startPicker, () => startPicker())
  ipcMain.handle(IPC.copy, (_event, text: string) => clipboard.writeText(String(text)))
  ipcMain.handle(IPC.exportCollection, async (_event, collection: CollectionId, format: ExportFormat) => {
    const data = store.state
    const palette = data.palettes.find((item) => item.id === collection)
    const name = palette?.name ?? 'Color History'
    const colors = palette?.colors ?? (collection === 'history' ? data.history : null)
    const exportFormat = EXPORT_FORMATS.find((item) => item.id === format)
    if (!colors || !exportFormat) return false

    suppressBlur = true
    try {
      const result = await dialog.showSaveDialog(popover, {
        defaultPath: `${slugify(name)}.${exportFormat.extension}`,
        filters: [{ name: exportFormat.label, extensions: [exportFormat.extension] }]
      })
      if (result.canceled || !result.filePath) return false
      await writeFile(result.filePath, exportPalette(name, colors, format), 'utf8')
      return true
    } finally {
      suppressBlur = false
      if (!popover.isDestroyed()) showPopover()
    }
  })
  ipcMain.handle(IPC.setShortcut, (_event, kind: ShortcutKind, accelerator: string) => {
    const result = shortcuts.set(kind, accelerator)
    if (result.ok) {
      store.dispatch({
        type: 'updateSettings',
        patch: kind === 'picker' ? { pickerShortcut: accelerator } : { popoverShortcut: accelerator }
      })
    }
    return result
  })
  ipcMain.handle(IPC.suspendShortcuts, (_event, suspended: boolean) => shortcuts.suspend(suspended))
  ipcMain.handle(
    IPC.getPlatform,
    (): PlatformInfo => ({
      platform: process.platform,
      version: app.getVersion(),
      screenAccess: screenAccess(),
      supportsLoginItem: !process.windowsStore
    })
  )
  ipcMain.handle(IPC.openScreenSettings, () =>
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
  )
  ipcMain.handle(IPC.openExternal, (_event, url: string) => {
    if (/^(https:|mailto:)/.test(url)) return shell.openExternal(url)
  })
  ipcMain.on(IPC.hidePopover, () => popover.hide())
  ipcMain.on(IPC.quit, () => app.quit())

  app.on('second-instance', () => showPopover())
  // A menu bar app keeps running without visible windows.
  app.on('window-all-closed', () => {})
  app.on('before-quit', () => store.flush())

  // Tray icons are easy to miss (especially in the Windows overflow area), so introduce the app once.
  if (isFirstRun || !app.isPackaged) {
    popover.once('ready-to-show', () => showPopover())
  }
}
