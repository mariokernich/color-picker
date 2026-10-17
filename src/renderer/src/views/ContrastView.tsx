import { useEffect, useRef, useState } from 'react'
import { ArrowUpDown, Check, Pipette, X } from 'lucide-react'
import { parseColor, parseHex, toHex } from '@shared/color'
import { checkContrast, formatRatio } from '@shared/contrast'
import { IconButton, ViewHeader } from '../components/controls'
import { Swatch } from '../components/Swatch'
import { api } from '../lib/api'
import { useApp } from '../lib/app'

type Slot = 'foreground' | 'background'

export function ContrastView({ foreground: initialForeground, background: initialBackground }: { foreground?: string; background?: string }) {
  const { data, back } = useApp()
  const [foreground, setForeground] = useState(initialForeground ?? data.history[0]?.hex ?? '#1C1C1F')
  const [background, setBackground] = useState(initialBackground ?? '#FFFFFF')
  const pickingSlot = useRef<Slot | null>(null)
  const lastHistoryId = useRef(data.history[0]?.id)

  // A color picked for a slot arrives as the newest history entry.
  useEffect(() => {
    const newest = data.history[0]
    if (newest && newest.id !== lastHistoryId.current && pickingSlot.current) {
      if (pickingSlot.current === 'foreground') setForeground(newest.hex)
      else setBackground(newest.hex)
      pickingSlot.current = null
    }
    lastHistoryId.current = newest?.id
  }, [data.history])

  const fg = parseHex(foreground)!
  const bg = parseHex(background)!
  const result = checkContrast(fg, bg)
  const pick = (slot: Slot): void => {
    pickingSlot.current = slot
    void api.startPicker()
  }

  const checks = [
    { label: 'Normal text', detail: 'AA 4.5 · AAA 7', aa: result.aaNormal, aaa: result.aaaNormal },
    { label: 'Large text', detail: 'AA 3 · AAA 4.5', aa: result.aaLarge, aaa: result.aaaLarge },
    { label: 'UI components', detail: 'AA 3', aa: result.aaUi, aaa: null }
  ]

  return (
    <div className="view">
      <ViewHeader onBack={back} title="Contrast" />
      <div className="view__body contrast">
        <div className="contrast__preview" style={{ background, color: foreground }}>
          <div className="contrast__ratio">{formatRatio(result.ratio)}</div>
          <div className="contrast__sample-large">Large text sample</div>
          <div className="contrast__sample">The quick brown fox jumps over the lazy dog.</div>
        </div>

        <div className="contrast__slots">
          <ColorSlot label="Text" value={foreground} onChange={setForeground} onPick={() => pick('foreground')} />
          <IconButton
            label="Swap colors"
            className="contrast__swap"
            onClick={() => {
              setForeground(background)
              setBackground(foreground)
            }}
          >
            <ArrowUpDown size={15} />
          </IconButton>
          <ColorSlot label="Background" value={background} onChange={setBackground} onPick={() => pick('background')} />
        </div>

        <ul className="contrast__checks">
          {checks.map((check) => (
            <li key={check.label}>
              <div>
                <div className="contrast__check-label">{check.label}</div>
                <div className="contrast__check-detail">{check.detail}</div>
              </div>
              <Badge label="AA" pass={check.aa} />
              {check.aaa !== null ? <Badge label="AAA" pass={check.aaa} /> : <span className="badge badge--empty" />}
            </li>
          ))}
        </ul>

        {data.history.length > 0 && (
          <div className="contrast__recent">
            <div className="section__title">Recent colors</div>
            <div className="swatch-row">
              {data.history.slice(0, 10).map((color) => (
                <Swatch
                  key={color.id}
                  hex={color.hex}
                  size={22}
                  title={`${color.hex}\nClick: text · Alt-click: background`}
                  onClick={(event) => (event.altKey ? setBackground(color.hex) : setForeground(color.hex))}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Badge({ label, pass }: { label: string; pass: boolean }) {
  return (
    <span className={['badge', pass ? 'badge--pass' : 'badge--fail'].join(' ')}>
      {pass ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
      {label}
    </span>
  )
}

function ColorSlot({ label, value, onChange, onPick }: { label: string; value: string; onChange: (hex: string) => void; onPick: () => void }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const commit = (): void => {
    const parsed = parseColor(text)
    if (parsed) onChange(toHex(parsed))
    else setText(value)
  }
  return (
    <div className="color-slot">
      <Swatch hex={value} size={34} radius={9} title={label} />
      <div className="color-slot__fields">
        <span className="color-slot__label">{label}</span>
        <input
          className="color-slot__input mono"
          value={text}
          aria-label={`${label} color`}
          spellCheck={false}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => event.key === 'Enter' && commit()}
        />
      </div>
      <IconButton label={`Pick ${label.toLowerCase()} color`} onClick={onPick}>
        <Pipette size={15} />
      </IconButton>
    </div>
  )
}
