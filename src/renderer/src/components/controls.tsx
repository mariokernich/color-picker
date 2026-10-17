import { ButtonHTMLAttributes, ReactNode, Ref } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  children: ReactNode
  active?: boolean
}

export function IconButton({ label, children, active, className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      className={['icon-button', active && 'icon-button--active', className].filter(Boolean).join(' ')}
      title={label}
      aria-label={label}
      {...props}
    >
      {children}
    </button>
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  ref?: Ref<HTMLButtonElement>
}

export function Button({ variant = 'secondary', size = 'md', className, ref, ...props }: ButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      className={['button', `button--${variant}`, `button--${size}`, className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={['toggle', checked && 'toggle--on'].filter(Boolean).join(' ')}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__thumb" />
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={['segmented__item', option.value === value && 'segmented__item--active'].filter(Boolean).join(' ')}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function ViewHeader({ title, onBack, actions }: { title: ReactNode; onBack?: () => void; actions?: ReactNode }) {
  return (
    <header className="view-header">
      {onBack && (
        <button type="button" className="view-header__back" onClick={onBack} aria-label="Back">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <div className="view-header__title">{title}</div>
      <div className="view-header__actions">{actions}</div>
    </header>
  )
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section__header">
        <h2 className="section__title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
