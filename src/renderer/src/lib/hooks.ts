import { useEffect, useState } from 'react'
import type { AppData, PlatformInfo } from '@shared/types'
import { api } from './api'

export function useAppData(): AppData | null {
  const [data, setData] = useState<AppData | null>(null)
  useEffect(() => {
    let active = true
    void api.getState().then((initial) => active && setData(initial))
    const unsubscribe = api.onState(setData)
    return () => {
      active = false
      unsubscribe()
    }
  }, [])
  return data
}

/** Refreshes when the window regains focus, e.g. after granting screen access in System Settings. */
export function usePlatform(): PlatformInfo | null {
  const [platform, setPlatform] = useState<PlatformInfo | null>(null)
  useEffect(() => {
    const load = (): void => void api.getPlatform().then(setPlatform)
    load()
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [])
  return platform
}
