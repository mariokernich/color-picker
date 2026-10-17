import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { AppApi, IPC, Route } from '../shared/api'
import type { AppData, LicenseState } from '../shared/types'

function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, value: T): void => listener(value)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: AppApi = {
  getState: () => ipcRenderer.invoke(IPC.getState),
  onState: (listener) => subscribe<AppData>(IPC.stateChanged, listener),
  dispatch: (action) => ipcRenderer.invoke(IPC.dispatch, action),
  startPicker: () => ipcRenderer.invoke(IPC.startPicker),
  copy: (text) => ipcRenderer.invoke(IPC.copy, text),
  exportCollection: (collection, format) => ipcRenderer.invoke(IPC.exportCollection, collection, format),
  setShortcut: (kind, accelerator) => ipcRenderer.invoke(IPC.setShortcut, kind, accelerator),
  suspendShortcuts: (suspended) => ipcRenderer.invoke(IPC.suspendShortcuts, suspended),
  getPlatform: () => ipcRenderer.invoke(IPC.getPlatform),
  openScreenSettings: () => ipcRenderer.invoke(IPC.openScreenSettings),
  openExternal: (url) => ipcRenderer.invoke(IPC.openExternal, url),
  getLicense: () => ipcRenderer.invoke(IPC.getLicense),
  onLicense: (listener) => subscribe<LicenseState>(IPC.licenseChanged, listener),
  purchase: () => ipcRenderer.invoke(IPC.purchase),
  restore: () => ipcRenderer.invoke(IPC.restore),
  onNavigate: (listener) => subscribe<Route>(IPC.navigate, listener),
  hidePopover: () => ipcRenderer.send(IPC.hidePopover),
  quit: () => ipcRenderer.send(IPC.quit)
}

contextBridge.exposeInMainWorld('api', api)
