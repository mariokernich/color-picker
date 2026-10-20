import { parseColor, toHex } from './color'
import { DEFAULT_FORMAT_ID } from './formats'
import type { AppData, CollectionId, Palette, SavedColor, Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  formatId: DEFAULT_FORMAT_ID,
  pickerShortcut: 'CommandOrControl+Alt+Shift+C',
  popoverShortcut: 'CommandOrControl+Alt+Shift+M',
  trayClickAction: 'popover',
  copyOnPick: true,
  freezeScreen: false,
  historyLimit: 200,
  loupeSize: 168,
  theme: 'system',
  launchAtLogin: false
}

export const LOUPE_SIZE = { min: 96, max: 320, step: 24 }
/** Every pick starts at the default zoom. */
export const LOUPE_ZOOM = { min: 4, max: 32, step: 2, default: 12 }

export function createInitialData(): AppData {
  return {
    version: 1,
    history: [],
    palettes: [],
    activePaletteId: null,
    settings: { ...DEFAULT_SETTINGS }
  }
}

export type Action =
  | { type: 'addColors'; hexes: string[] }
  | { type: 'addToPalette'; paletteId: string; hexes: string[] }
  | { type: 'updateColor'; collection: CollectionId; colorId: string; hex?: string; name?: string }
  | { type: 'deleteColors'; collection: CollectionId; colorIds: string[] }
  | { type: 'moveColor'; from: CollectionId; to: string; colorId: string; copy: boolean }
  | { type: 'reorderColor'; collection: CollectionId; colorId: string; toIndex: number }
  | { type: 'clearHistory' }
  | { type: 'createPalette'; name: string; hexes?: string[]; activate?: boolean }
  | { type: 'renamePalette'; paletteId: string; name: string }
  | { type: 'duplicatePalette'; paletteId: string }
  | { type: 'deletePalette'; paletteId: string }
  | { type: 'reorderPalette'; paletteId: string; toIndex: number }
  | { type: 'setActivePalette'; paletteId: string | null }
  | { type: 'updateSettings'; patch: Partial<Settings> }

export interface ReduceContext {
  now: () => number
  id: () => string
}

export function normalizeHex(input: string): string | null {
  const color = parseColor(input)
  return color ? toHex(color) : null
}

function newColor(hex: string, ctx: ReduceContext, name?: string): SavedColor {
  return name ? { id: ctx.id(), hex, name, createdAt: ctx.now() } : { id: ctx.id(), hex, createdAt: ctx.now() }
}

function normalizeAll(hexes: string[]): string[] {
  return hexes.map(normalizeHex).filter((hex): hex is string => hex !== null)
}

/** Palettes never contain the same color twice. */
function appendUnique(colors: SavedColor[], hexes: string[], ctx: ReduceContext): SavedColor[] {
  const known = new Set(colors.map((color) => color.hex))
  const added: SavedColor[] = []
  for (const hex of hexes) {
    if (known.has(hex)) continue
    known.add(hex)
    added.push(newColor(hex, ctx))
  }
  return added.length ? [...colors, ...added] : colors
}

function getColors(data: AppData, collection: CollectionId): SavedColor[] | undefined {
  if (collection === 'history') return data.history
  return data.palettes.find((palette) => palette.id === collection)?.colors
}

function setColors(data: AppData, collection: CollectionId, colors: SavedColor[]): AppData {
  if (collection === 'history') return { ...data, history: colors }
  return {
    ...data,
    palettes: data.palettes.map((palette) =>
      palette.id === collection ? { ...palette, colors } : palette
    )
  }
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const result = [...items]
  const [item] = result.splice(from, 1)
  result.splice(Math.max(0, Math.min(to, result.length)), 0, item)
  return result
}

function uniqueName(base: string, palettes: Palette[]): string {
  const names = new Set(palettes.map((palette) => palette.name))
  if (!names.has(base)) return base
  let index = 2
  while (names.has(`${base} ${index}`)) index++
  return `${base} ${index}`
}

export function reduce(data: AppData, action: Action, ctx: ReduceContext): AppData {
  switch (action.type) {
    case 'addColors': {
      const hexes = normalizeAll(action.hexes)
      if (!hexes.length) return data
      // Newest first; picking the same color twice in a row does not create a duplicate entry.
      let history = data.history
      for (const hex of hexes) {
        if (history[0]?.hex === hex) continue
        history = [newColor(hex, ctx), ...history]
      }
      history = history.slice(0, data.settings.historyLimit)
      const next = { ...data, history }
      return data.activePaletteId
        ? reduce(next, { type: 'addToPalette', paletteId: data.activePaletteId, hexes }, ctx)
        : next
    }
    case 'addToPalette': {
      const colors = getColors(data, action.paletteId)
      if (!colors || action.paletteId === 'history') return data
      return setColors(data, action.paletteId, appendUnique(colors, normalizeAll(action.hexes), ctx))
    }
    case 'updateColor': {
      const colors = getColors(data, action.collection)
      if (!colors) return data
      const hex = action.hex !== undefined ? normalizeHex(action.hex) : undefined
      if (hex === null) return data
      return setColors(
        data,
        action.collection,
        colors.map((color) => {
          if (color.id !== action.colorId) return color
          const updated = { ...color, hex: hex ?? color.hex }
          if (action.name !== undefined) {
            const name = action.name.trim()
            if (name) updated.name = name
            else delete updated.name
          }
          return updated
        })
      )
    }
    case 'deleteColors': {
      const colors = getColors(data, action.collection)
      if (!colors) return data
      const ids = new Set(action.colorIds)
      return setColors(
        data,
        action.collection,
        colors.filter((color) => !ids.has(color.id))
      )
    }
    case 'moveColor': {
      const source = getColors(data, action.from)
      const target = getColors(data, action.to)
      const color = source?.find((item) => item.id === action.colorId)
      if (!source || !target || !color || action.to === 'history' || action.from === action.to) {
        return data
      }
      let next = data
      if (!target.some((item) => item.hex === color.hex)) {
        next = setColors(next, action.to, [...target, { ...color, id: ctx.id() }])
      }
      // The history is a log and keeps its entries when colors are dragged out of it.
      if (!action.copy && action.from !== 'history') {
        next = setColors(
          next,
          action.from,
          source.filter((item) => item.id !== color.id)
        )
      }
      return next
    }
    case 'reorderColor': {
      const colors = getColors(data, action.collection)
      const index = colors?.findIndex((color) => color.id === action.colorId) ?? -1
      if (!colors || index < 0) return data
      return setColors(data, action.collection, moveItem(colors, index, action.toIndex))
    }
    case 'clearHistory':
      return { ...data, history: [] }
    case 'createPalette': {
      const palette: Palette = {
        id: ctx.id(),
        name: action.name.trim() || uniqueName('Untitled Palette', data.palettes),
        colors: appendUnique([], normalizeAll(action.hexes ?? []), ctx),
        createdAt: ctx.now()
      }
      return {
        ...data,
        palettes: [...data.palettes, palette],
        activePaletteId: action.activate ? palette.id : data.activePaletteId
      }
    }
    case 'renamePalette': {
      const name = action.name.trim()
      if (!name) return data
      return {
        ...data,
        palettes: data.palettes.map((palette) =>
          palette.id === action.paletteId ? { ...palette, name } : palette
        )
      }
    }
    case 'duplicatePalette': {
      const index = data.palettes.findIndex((palette) => palette.id === action.paletteId)
      if (index < 0) return data
      const original = data.palettes[index]
      const copy: Palette = {
        id: ctx.id(),
        name: uniqueName(`${original.name} Copy`, data.palettes),
        colors: original.colors.map((color) => ({ ...color, id: ctx.id() })),
        createdAt: ctx.now()
      }
      const palettes = [...data.palettes]
      palettes.splice(index + 1, 0, copy)
      return { ...data, palettes }
    }
    case 'deletePalette':
      return {
        ...data,
        palettes: data.palettes.filter((palette) => palette.id !== action.paletteId),
        activePaletteId: data.activePaletteId === action.paletteId ? null : data.activePaletteId
      }
    case 'reorderPalette': {
      const index = data.palettes.findIndex((palette) => palette.id === action.paletteId)
      if (index < 0) return data
      return { ...data, palettes: moveItem(data.palettes, index, action.toIndex) }
    }
    case 'setActivePalette': {
      const exists =
        action.paletteId === null || data.palettes.some((palette) => palette.id === action.paletteId)
      return exists ? { ...data, activePaletteId: action.paletteId } : data
    }
    case 'updateSettings': {
      const settings = { ...data.settings, ...action.patch }
      return {
        ...data,
        settings,
        history: data.history.slice(0, settings.historyLimit)
      }
    }
  }
}

/** Fills in fields missing from data written by older versions. */
export function migrate(raw: unknown): AppData {
  const initial = createInitialData()
  if (!raw || typeof raw !== 'object') return initial
  const data = raw as Partial<AppData>
  const settings: Settings & { loupeZoom?: number } = { ...initial.settings, ...data.settings }
  // Stored until 0.1.1; every pick now starts at the default zoom.
  delete settings.loupeZoom
  return {
    version: 1,
    history: Array.isArray(data.history) ? data.history : [],
    palettes: Array.isArray(data.palettes) ? data.palettes : [],
    activePaletteId: typeof data.activePaletteId === 'string' ? data.activePaletteId : null,
    settings
  }
}
