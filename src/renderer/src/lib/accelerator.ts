/** Converts between keyboard events, Electron accelerators and platform-style labels. */

const MAC_SYMBOLS: Record<string, string> = {
  Command: '⌘',
  Cmd: '⌘',
  CommandOrControl: '⌘',
  CmdOrCtrl: '⌘',
  Control: '⌃',
  Ctrl: '⌃',
  Alt: '⌥',
  Option: '⌥',
  Shift: '⇧',
  Super: '⌘',
  Up: '↑',
  Down: '↓',
  Left: '←',
  Right: '→',
  Space: 'Space',
  Plus: '+'
}

const WINDOWS_LABELS: Record<string, string> = {
  CommandOrControl: 'Ctrl',
  CmdOrCtrl: 'Ctrl',
  Control: 'Ctrl',
  Command: 'Win',
  Super: 'Win'
}

export function formatAccelerator(accelerator: string, isMac: boolean): string {
  if (!accelerator) return ''
  const parts = accelerator.split('+').map((part) => (part === '' ? 'Plus' : part))
  if (isMac) return parts.map((part) => MAC_SYMBOLS[part] ?? part).join('')
  return parts.map((part) => WINDOWS_LABELS[part] ?? part).join('+')
}

const CODE_KEYS: Record<string, string> = {
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Insert: 'Insert',
  Delete: 'Delete'
}

function keyFromCode(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  if (/^Numpad[0-9]$/.test(code)) return `num${code.slice(6)}`
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code
  return CODE_KEYS[code] ?? null
}

export type RecordResult =
  | { type: 'incomplete' }
  | { type: 'cancel' }
  | { type: 'clear' }
  | { type: 'accelerator'; accelerator: string }

/**
 * Interprets a keydown while recording. Global shortcuts need at least one modifier
 * besides Shift so they do not swallow normal typing.
 */
export function acceleratorFromEvent(event: Pick<KeyboardEvent, 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>, isMac: boolean): RecordResult {
  const hasModifier = event.metaKey || event.ctrlKey || event.altKey
  if (!hasModifier && event.code === 'Escape') return { type: 'cancel' }
  if (!hasModifier && !event.shiftKey && (event.code === 'Backspace' || event.code === 'Delete')) {
    return { type: 'clear' }
  }
  const key = keyFromCode(event.code)
  if (!key || !hasModifier) return { type: 'incomplete' }
  const modifiers: string[] = []
  if (event.ctrlKey) modifiers.push(isMac ? 'Control' : 'CommandOrControl')
  if (event.altKey) modifiers.push('Alt')
  if (event.shiftKey) modifiers.push('Shift')
  if (event.metaKey) modifiers.push(isMac ? 'Command' : 'Super')
  return { type: 'accelerator', accelerator: [...modifiers, key].join('+') }
}
