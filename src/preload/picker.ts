import { contextBridge, ipcRenderer } from 'electron'
import { IPC, PickerApi, PickerInit } from '../shared/api'

const picker: PickerApi = {
  onInit: (listener) => {
    ipcRenderer.on(IPC.pickerInit, (_event, init: PickerInit) => listener(init))
  },
  pick: (hex, keepOpen) => ipcRenderer.send(IPC.pickerPick, hex, keepOpen),
  cancel: () => ipcRenderer.send(IPC.pickerCancel),
  focus: () => ipcRenderer.send(IPC.pickerFocus),
  moveCursor: (x, y) => ipcRenderer.send(IPC.pickerMoveCursor, x, y),
  read: (x, y, width, height) => ipcRenderer.invoke(IPC.pickerRead, x, y, width, height)
}

contextBridge.exposeInMainWorld('picker', picker)
