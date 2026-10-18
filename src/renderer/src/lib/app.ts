import { createContext, useContext } from 'react'
import type { Action } from '@shared/state'
import type { AppData, CollectionId, PlatformInfo } from '@shared/types'

export type View =
  | { name: 'home' }
  | { name: 'palette'; id: string }
  | { name: 'color'; collection: CollectionId; colorId: string }
  | { name: 'contrast'; foreground?: string; background?: string }
  | { name: 'settings' }

export interface AppContextValue {
  data: AppData
  platform: PlatformInfo
  isMac: boolean
  view: View
  push: (view: View) => void
  back: () => void
  dispatch: (action: Action) => void
  /** Copies a color in the user's preferred format. */
  copyHex: (hex: string) => void
  copyText: (text: string) => void
  toast: (message: string, hex?: string) => void
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside AppContext')
  return value
}
