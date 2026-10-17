import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { ShortcutKind } from '@shared/api'
import { acceleratorFromEvent, formatAccelerator } from '../lib/accelerator'
import { api } from '../lib/api'

export function ShortcutRecorder({ kind, value, isMac, label }: { kind: ShortcutKind; value: string; isMac: boolean; label: string }) {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!recording) return
    void api.suspendShortcuts(true)
    const save = async (accelerator: string): Promise<void> => {
      setRecording(false)
      await api.suspendShortcuts(false)
      const result = await api.setShortcut(kind, accelerator)
      setError(result.ok ? null : (result.error ?? 'This shortcut cannot be used.'))
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      const result = acceleratorFromEvent(event, isMac)
      if (result.type === 'cancel') setRecording(false)
      else if (result.type === 'clear') void save('')
      else if (result.type === 'accelerator') void save(result.accelerator)
    }
    const stop = (): void => setRecording(false)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('blur', stop)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('blur', stop)
      void api.suspendShortcuts(false)
    }
  }, [recording, kind, isMac])

  return (
    <div className="shortcut">
      <div className="shortcut__controls">
        <button
          type="button"
          className={['shortcut__field', recording && 'shortcut__field--recording'].filter(Boolean).join(' ')}
          aria-label={`${label} shortcut`}
          onClick={() => {
            setError(null)
            setRecording(!recording)
          }}
        >
          {recording ? 'Press keys…' : value ? formatAccelerator(value, isMac) : 'Not set'}
        </button>
        {value && !recording && (
          <button type="button" className="shortcut__clear" aria-label={`Remove ${label} shortcut`} onClick={() => void api.setShortcut(kind, '')}>
            <X size={12} />
          </button>
        )}
      </div>
      {error && <div className="field-error">{error}</div>}
    </div>
  )
}
