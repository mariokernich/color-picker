import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseHex } from '@shared/color'
import { formatColor } from '@shared/formats'
import type { Action } from '@shared/state'
import { ConfirmProvider } from './components/Confirm'
import { MenuProvider } from './components/Menu'
import { api } from './lib/api'
import { AppContext, AppContextValue, View } from './lib/app'
import { useAppData, useLicense, usePlatform } from './lib/hooks'
import { ColorView } from './views/ColorView'
import { ContrastView } from './views/ContrastView'
import { Home } from './views/Home'
import { PaletteView } from './views/PaletteView'
import { Paywall } from './views/Paywall'
import { SettingsView } from './views/SettingsView'

interface Toast {
  id: number
  message: string
  hex?: string
}

export function App() {
  const data = useAppData()
  const license = useLicense()
  const platform = usePlatform()
  const [stack, setStack] = useState<View[]>([{ name: 'home' }])
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<number>(undefined)
  const view = stack[stack.length - 1]

  const push = useCallback((next: View) => setStack((current) => [...current, next]), [])
  const back = useCallback(() => setStack((current) => (current.length > 1 ? current.slice(0, -1) : current)), [])

  useEffect(
    () =>
      api.onNavigate((route) => {
        setStack(route === 'home' ? [{ name: 'home' }] : [{ name: 'home' }, { name: route }])
      }),
    []
  )

  useEffect(() => {
    if (platform) document.documentElement.classList.add(`platform-${platform.platform}`)
  }, [platform])

  // Escape steps back, then closes the popover.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (document.querySelector('.menu, .dialog')) return
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT') {
        target.blur()
        return
      }
      if (stack.length > 1) back()
      else api.hidePopover()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [stack.length, back])

  const showToast = useCallback((message: string, hex?: string) => {
    window.clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), message, hex })
    toastTimer.current = window.setTimeout(() => setToast(null), 1600)
  }, [])

  const formatId = data?.settings.formatId
  const context = useMemo<AppContextValue | null>(() => {
    if (!data || !platform) return null
    return {
      data,
      license,
      platform,
      isMac: platform.platform === 'darwin',
      view,
      push,
      back,
      dispatch: (action: Action) => void api.dispatch(action),
      copyHex: (hex: string) => {
        const color = parseHex(hex)
        if (!color) return
        const text = formatColor(color, formatId!)
        void api.copy(text)
        showToast(`Copied ${text}`, hex)
      },
      copyText: (text: string) => {
        void api.copy(text)
        showToast(`Copied ${text}`)
      },
      toast: showToast
    }
  }, [data, license, platform, view, push, back, formatId, showToast])

  if (!context) return <div className="loading" />

  // Without an entitlement only the paywall and settings are reachable.
  const locked = license !== null && !license.entitled && view.name !== 'settings'

  return (
    <AppContext.Provider value={context}>
      <ConfirmProvider>
        <MenuProvider>
          <div className="app" key={locked ? 'locked' : stack.length}>
            {locked ? <Paywall /> : renderView(view)}
          </div>
          {toast && (
            <div className="toast" key={toast.id} role="status">
              {toast.hex && <span className="toast__swatch" style={{ background: toast.hex }} />}
              <span className="toast__text">{toast.message}</span>
            </div>
          )}
        </MenuProvider>
      </ConfirmProvider>
    </AppContext.Provider>
  )
}

function renderView(view: View) {
  switch (view.name) {
    case 'home':
      return <Home />
    case 'palette':
      return <PaletteView id={view.id} />
    case 'color':
      return <ColorView key={view.colorId} collection={view.collection} colorId={view.colorId} />
    case 'contrast':
      return <ContrastView foreground={view.foreground} background={view.background} />
    case 'settings':
      return <SettingsView />
    case 'paywall':
      return <Paywall />
  }
}
