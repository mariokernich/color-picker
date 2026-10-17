import type { AppApi, PickerApi } from '../shared/api'

declare global {
  interface Window {
    api: AppApi
    picker: PickerApi
  }
}
