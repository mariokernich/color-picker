import type { AppApi, Route } from '@shared/api'
import { PRODUCT } from '@shared/product'
import { Action, createInitialData, reduce, ReduceContext } from '@shared/state'
import type { AppData, LicenseState } from '@shared/types'

/**
 * In-memory stand-in for the Electron bridge so the UI can be developed and screenshotted in
 * a plain browser (open the renderer dev server URL directly). Not used inside Electron.
 */
export function createMockApi(): AppApi {
  let counter = 0
  const ctx: ReduceContext = { now: () => Date.now(), id: () => `mock-${++counter}` }
  const run = (data: AppData, ...actions: Action[]): AppData =>
    actions.reduce((state, action) => reduce(state, action, ctx), data)

  let data = run(
    createInitialData(),
    { type: 'createPalette', name: 'Brand', hexes: ['#540D6E', '#EE4266', '#FFD23F', '#3BCEAC', '#0EAD69'], activate: true },
    { type: 'createPalette', name: 'Website', hexes: ['#0B132B', '#1C2541', '#3A506B', '#5BC0BE', '#E0FBFC', '#F25F5C'] },
    { type: 'createPalette', name: 'Pastels', hexes: ['#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#A0C4FF', '#BDB2FF', '#FFC6FF'] },
    { type: 'addColors', hexes: ['#F72585', '#7209B7', '#3A0CA3', '#4361EE', '#4CC9F0', '#2B2D42', '#8D99AE', '#EDF2F4', '#EF233C', '#D90429', '#FFBE0B', '#FB5607'] }
  )
  const query = new URLSearchParams(location.search)
  const status = (query.get('license') as LicenseState['status']) ?? 'trial'
  const license: LicenseState = {
    provider: 'local',
    status,
    entitled: status === 'trial' || status === 'active',
    trialEndsAt: Date.now() + 23 * 24 * 3600 * 1000,
    expiresAt: null,
    product: { id: 'mock', title: `${PRODUCT.name} Pro`, price: '9,99 €', trialDays: 30 },
    canPurchase: true,
    busy: false,
    error: null
  }
  const stateListeners = new Set<(data: AppData) => void>()
  const routeListeners = new Set<(route: Route) => void>()
  const subscribe = <T,>(set: Set<(value: T) => void>, listener: (value: T) => void) => {
    set.add(listener)
    return () => void set.delete(listener)
  }
  setTimeout(() => {
    const route = query.get('route') as Route | null
    if (route) routeListeners.forEach((listener) => listener(route))
  }, 50)

  return {
    getState: async () => data,
    onState: (listener) => subscribe(stateListeners, listener),
    dispatch: async (action) => {
      data = run(data, action)
      stateListeners.forEach((listener) => listener(data))
    },
    startPicker: async () => {
      const hex = `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`
      data = run(data, { type: 'addColors', hexes: [hex] })
      stateListeners.forEach((listener) => listener(data))
    },
    copy: async (text) => console.info('copy', text),
    exportCollection: async () => true,
    setShortcut: async () => ({ ok: true }),
    suspendShortcuts: async () => {},
    getPlatform: async () => ({
      platform: query.get('platform') ?? 'darwin',
      version: '0.1.0',
      screenAccess: 'granted',
      supportsLoginItem: true
    }),
    openScreenSettings: async () => {},
    openExternal: async (url) => void window.open(url),
    getLicense: async () => license,
    onLicense: () => () => {},
    purchase: async () => {},
    restore: async () => {},
    onNavigate: (listener) => subscribe(routeListeners, listener),
    hidePopover: () => {},
    quit: () => {}
  }
}
