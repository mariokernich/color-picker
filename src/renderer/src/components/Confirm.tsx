import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Button } from './controls'

interface ConfirmRequest {
  title: string
  message?: string
  confirmLabel: string
  resolve: (confirmed: boolean) => void
}

type ConfirmFn = (options: { title: string; message?: string; confirmLabel?: string }) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>(async () => false)

/**
 * In-window confirmation. Native dialogs would take focus away from the popover, which
 * hides it on blur.
 */
export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext)
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise((resolve) =>
        setRequest({ confirmLabel: 'Delete', ...options, resolve })
      ),
    []
  )
  const close = (confirmed: boolean): void => {
    request?.resolve(confirmed)
    setRequest(null)
  }
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && <ConfirmDialog request={request} onClose={close} />}
    </ConfirmContext.Provider>
  )
}

function ConfirmDialog({ request, onClose }: { request: ConfirmRequest; onClose: (confirmed: boolean) => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    confirmRef.current?.focus()
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="dialog-backdrop" onMouseDown={() => onClose(false)}>
      <div className="dialog" role="alertdialog" aria-labelledby="confirm-title" onMouseDown={(event) => event.stopPropagation()}>
        <h3 id="confirm-title">{request.title}</h3>
        {request.message && <p>{request.message}</p>}
        <div className="dialog__actions">
          <Button onClick={() => onClose(false)}>Cancel</Button>
          <Button ref={confirmRef} variant="danger" onClick={() => onClose(true)}>
            {request.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
