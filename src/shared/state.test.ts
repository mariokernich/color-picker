import { describe, expect, it } from 'vitest'
import { Action, createInitialData, migrate, reduce, ReduceContext } from './state'
import type { AppData } from './types'

let counter = 0
const ctx: ReduceContext = { now: () => 1000, id: () => `id${++counter}` }

function run(data: AppData, ...actions: Action[]): AppData {
  return actions.reduce((state, action) => reduce(state, action, ctx), data)
}

describe('reduce', () => {
  it('adds picked colors to the front of the history and normalizes them', () => {
    const data = run(createInitialData(), { type: 'addColors', hexes: ['#fff', 'rgb(0,0,0)', 'nope'] })
    expect(data.history.map((c) => c.hex)).toEqual(['#000000', '#FFFFFF'])
  })

  it('skips consecutive duplicates in the history', () => {
    const data = run(
      createInitialData(),
      { type: 'addColors', hexes: ['#FF0000'] },
      { type: 'addColors', hexes: ['#ff0000'] }
    )
    expect(data.history).toHaveLength(1)
  })

  it('respects the history limit', () => {
    const initial = createInitialData()
    initial.settings.historyLimit = 2
    const data = run(initial, { type: 'addColors', hexes: ['#111', '#222', '#333'] })
    expect(data.history.map((c) => c.hex)).toEqual(['#333333', '#222222'])
  })

  it('adds picked colors to the active palette without duplicates', () => {
    let data = run(createInitialData(), { type: 'createPalette', name: 'Brand', activate: true })
    data = run(data, { type: 'addColors', hexes: ['#111', '#222'] }, { type: 'addColors', hexes: ['#111'] })
    expect(data.palettes[0].colors.map((c) => c.hex)).toEqual(['#111111', '#222222'])
    expect(data.history).toHaveLength(3)
  })

  it('moves and copies colors between palettes', () => {
    let data = run(
      createInitialData(),
      { type: 'createPalette', name: 'A', hexes: ['#111', '#222'] },
      { type: 'createPalette', name: 'B' }
    )
    const [a, b] = data.palettes
    data = run(data, { type: 'moveColor', from: a.id, to: b.id, colorId: a.colors[0].id, copy: false })
    expect(data.palettes[0].colors.map((c) => c.hex)).toEqual(['#222222'])
    expect(data.palettes[1].colors.map((c) => c.hex)).toEqual(['#111111'])
    data = run(data, {
      type: 'moveColor',
      from: a.id,
      to: b.id,
      colorId: data.palettes[0].colors[0].id,
      copy: true
    })
    expect(data.palettes[0].colors).toHaveLength(1)
    expect(data.palettes[1].colors).toHaveLength(2)
  })

  it('keeps history entries when dragging them into a palette', () => {
    let data = run(createInitialData(), { type: 'addColors', hexes: ['#111'] }, { type: 'createPalette', name: 'A' })
    data = run(data, {
      type: 'moveColor',
      from: 'history',
      to: data.palettes[0].id,
      colorId: data.history[0].id,
      copy: false
    })
    expect(data.history).toHaveLength(1)
    expect(data.palettes[0].colors).toHaveLength(1)
  })

  it('renames, duplicates and deletes palettes', () => {
    let data = run(createInitialData(), { type: 'createPalette', name: 'Brand', hexes: ['#111'], activate: true })
    const id = data.palettes[0].id
    data = run(data, { type: 'renamePalette', paletteId: id, name: '  Product ' }, { type: 'duplicatePalette', paletteId: id })
    expect(data.palettes.map((p) => p.name)).toEqual(['Product', 'Product Copy'])
    expect(data.palettes[1].colors[0].id).not.toBe(data.palettes[0].colors[0].id)
    data = run(data, { type: 'deletePalette', paletteId: id })
    expect(data.palettes.map((p) => p.name)).toEqual(['Product Copy'])
    expect(data.activePaletteId).toBeNull()
  })

  it('gives unnamed palettes unique names', () => {
    const data = run(createInitialData(), { type: 'createPalette', name: '' }, { type: 'createPalette', name: ' ' })
    expect(data.palettes.map((p) => p.name)).toEqual(['Untitled Palette', 'Untitled Palette 2'])
  })

  it('updates color value and name', () => {
    let data = run(createInitialData(), { type: 'addColors', hexes: ['#111'] })
    const colorId = data.history[0].id
    data = run(data, { type: 'updateColor', collection: 'history', colorId, hex: '#abc', name: 'Sky' })
    expect(data.history[0]).toMatchObject({ hex: '#AABBCC', name: 'Sky' })
    data = run(data, { type: 'updateColor', collection: 'history', colorId, name: '' })
    expect(data.history[0].name).toBeUndefined()
    expect(run(data, { type: 'updateColor', collection: 'history', colorId, hex: 'nope' })).toBe(data)
  })

  it('reorders colors', () => {
    let data = run(createInitialData(), { type: 'createPalette', name: 'A', hexes: ['#111', '#222', '#333'] })
    const palette = data.palettes[0]
    data = run(data, { type: 'reorderColor', collection: palette.id, colorId: palette.colors[0].id, toIndex: 2 })
    expect(data.palettes[0].colors.map((c) => c.hex)).toEqual(['#222222', '#333333', '#111111'])
  })
})

describe('migrate', () => {
  it('fills missing settings', () => {
    const data = migrate({ history: [], palettes: [], settings: { formatId: 'css-rgb' } })
    expect(data.settings.formatId).toBe('css-rgb')
    expect(data.settings.historyLimit).toBe(200)
  })

  it('drops the loupe size and zoom older versions stored', () => {
    const data = migrate({ history: [], palettes: [], settings: { loupeSize: 320, loupeZoom: 32 } })
    expect(data.settings).not.toHaveProperty('loupeSize')
    expect(data.settings).not.toHaveProperty('loupeZoom')
  })

  it('recovers from garbage', () => {
    expect(migrate(null)).toEqual(createInitialData())
  })
})
