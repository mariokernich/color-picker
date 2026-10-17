import { createContext, ReactNode, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'

export type MenuItem =
  | { type?: 'item'; label: string; onSelect: () => void; danger?: boolean; disabled?: boolean; checked?: boolean; hint?: ReactNode }
  | { type: 'separator' }
  | { type: 'header'; label: string }

interface OpenMenu {
  x: number
  y: number
  items: MenuItem[]
}

const MenuContext = createContext<(position: { x: number; y: number }, items: MenuItem[]) => void>(() => {})

/** Opens a menu at a point; used for context menus and "•••" buttons. */
export function useMenu() {
  return useContext(MenuContext)
}

export function MenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<OpenMenu | null>(null)
  const open = useCallback((position: { x: number; y: number }, items: MenuItem[]) => setMenu({ ...position, items }), [])
  return (
    <MenuContext.Provider value={open}>
      {children}
      {menu && <MenuPopup menu={menu} onClose={() => setMenu(null)} />}
    </MenuContext.Provider>
  )
}

function MenuPopup({ menu, onClose }: { menu: OpenMenu; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: menu.x, top: menu.y })

  // Keep the menu inside the window.
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const { width, height } = element.getBoundingClientRect()
    setPosition({
      left: Math.max(6, Math.min(menu.x, window.innerWidth - width - 6)),
      top: Math.max(6, menu.y + height > window.innerHeight - 6 ? menu.y - height : menu.y)
    })
    element.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  }, [menu])

  useEffect(() => {
    const close = (event: Event): void => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return
      if (event.type === 'mousedown' && ref.current?.contains(event.target as Node)) return
      onClose()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', close)
    window.addEventListener('blur', onClose)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', close)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'ArrowDown' ? index + 1 : index - 1
    buttons[(next + buttons.length) % buttons.length]?.focus()
  }

  return (
    <div ref={ref} className="menu" role="menu" style={position} onKeyDown={onKeyDown}>
      {menu.items.map((item, index) => {
        if (item.type === 'separator') return <div key={index} className="menu__separator" role="separator" />
        if (item.type === 'header') return <div key={index} className="menu__header">{item.label}</div>
        return (
          <button
            key={index}
            type="button"
            role="menuitem"
            className={['menu__item', item.danger && 'menu__item--danger'].filter(Boolean).join(' ')}
            disabled={item.disabled}
            onClick={() => {
              onClose()
              item.onSelect()
            }}
          >
            <span className="menu__check">{item.checked ? '✓' : ''}</span>
            <span className="menu__label">{item.label}</span>
            {item.hint && <span className="menu__hint">{item.hint}</span>}
          </button>
        )
      })}
    </div>
  )
}
