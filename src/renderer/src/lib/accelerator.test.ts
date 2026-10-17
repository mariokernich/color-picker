import { describe, expect, it } from 'vitest'
import { acceleratorFromEvent, formatAccelerator } from './accelerator'

const key = (code: string, modifiers: Partial<Record<'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey', boolean>> = {}) => ({
  code,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...modifiers
})

describe('formatAccelerator', () => {
  it('uses symbols on macOS', () => {
    expect(formatAccelerator('CommandOrControl+Alt+Shift+C', true)).toBe('⌘⌥⇧C')
  })

  it('uses labels on Windows', () => {
    expect(formatAccelerator('CommandOrControl+Alt+Shift+C', false)).toBe('Ctrl+Alt+Shift+C')
  })

  it('handles empty values', () => {
    expect(formatAccelerator('', true)).toBe('')
  })
})

describe('acceleratorFromEvent', () => {
  it('builds accelerators in Electron modifier order', () => {
    expect(acceleratorFromEvent(key('KeyP', { metaKey: true, altKey: true, ctrlKey: true }), true)).toEqual({
      type: 'accelerator',
      accelerator: 'Control+Alt+Command+P'
    })
    expect(acceleratorFromEvent(key('Digit1', { ctrlKey: true, shiftKey: true }), false)).toEqual({
      type: 'accelerator',
      accelerator: 'CommandOrControl+Shift+1'
    })
  })

  it('requires a modifier other than Shift', () => {
    expect(acceleratorFromEvent(key('KeyP', { shiftKey: true }), true).type).toBe('incomplete')
    expect(acceleratorFromEvent(key('ShiftLeft', { shiftKey: true, metaKey: true }), true).type).toBe('incomplete')
  })

  it('supports cancel and clear', () => {
    expect(acceleratorFromEvent(key('Escape'), true).type).toBe('cancel')
    expect(acceleratorFromEvent(key('Backspace'), true).type).toBe('clear')
  })
})
