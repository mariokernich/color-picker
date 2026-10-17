import { useEffect, useState } from 'react'
import { Contrast, Copy, Trash2 } from 'lucide-react'
import {
  HSVA,
  hslToRgb,
  hsvToRgb,
  parseColor,
  parseHex,
  RGBA,
  rgbToHsl,
  rgbToHsv,
  round,
  toHex
} from '@shared/color'
import { COLOR_FORMATS } from '@shared/formats'
import type { CollectionId } from '@shared/types'
import { ColorEditor } from '../components/ColorEditor'
import { Button, IconButton, Segmented, ViewHeader } from '../components/controls'
import { useApp } from '../lib/app'

type ChannelMode = 'rgb' | 'hsl' | 'hsb'

export function ColorView({ collection, colorId }: { collection: CollectionId; colorId: string }) {
  const { data, dispatch, back, push, copyText } = useApp()
  const colors = collection === 'history' ? data.history : data.palettes.find((p) => p.id === collection)?.colors
  const color = colors?.find((item) => item.id === colorId)
  const paletteName = data.palettes.find((p) => p.id === collection)?.name ?? 'History'

  const [hsva, setHsva] = useState<HSVA>(() => rgbToHsv(parseHex(color?.hex ?? '#000') ?? { r: 0, g: 0, b: 0, a: 1 }))
  const [mode, setMode] = useState<ChannelMode>('rgb')
  const rgba = hsvToRgb(hsva)
  const hex = toHex(rgba)

  // Follow external changes without losing hue/saturation of greys while editing.
  useEffect(() => {
    if (color && color.hex !== toHex(hsvToRgb(hsva))) {
      setHsva(rgbToHsv(parseHex(color.hex)!))
    }
  }, [color?.hex])

  useEffect(() => {
    if (!color) back()
  }, [color, back])
  if (!color) return null

  const update = (next: HSVA): void => {
    setHsva(next)
    const nextHex = toHex(hsvToRgb(next))
    if (nextHex !== color.hex) dispatch({ type: 'updateColor', collection, colorId, hex: nextHex })
  }
  const updateRgba = (next: RGBA): void => {
    const nextHsv = rgbToHsv(next)
    // Keep the hue when the new color is grey.
    update(nextHsv.s === 0 ? { ...nextHsv, h: hsva.h } : nextHsv)
  }

  return (
    <div className="view">
      <ViewHeader
        onBack={back}
        title={<span className="view-header__subtitle">{paletteName}</span>}
        actions={
          <>
            <IconButton label="Check Contrast" onClick={() => push({ name: 'contrast', foreground: hex })}>
              <Contrast size={16} />
            </IconButton>
            <IconButton
              label="Delete Color"
              onClick={() => {
                dispatch({ type: 'deleteColors', collection, colorIds: [colorId] })
                back()
              }}
            >
              <Trash2 size={16} />
            </IconButton>
          </>
        }
      />
      <div className="view__body color-view">
        <div className="color-view__hero">
          <div className="color-view__swatch" style={{ background: `linear-gradient(${hex}, ${hex}), var(--checker)` }} />
          <div className="color-view__meta">
            <input
              key={color.id}
              className="title-input"
              placeholder="Untitled color"
              defaultValue={color.name ?? ''}
              aria-label="Color name"
              onBlur={(event) => dispatch({ type: 'updateColor', collection, colorId, name: event.target.value })}
              onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
            />
            <HexInput value={hex} onCommit={updateRgba} />
          </div>
        </div>

        <ColorEditor value={hsva} onChange={update} />

        <div className="channels">
          <Segmented
            label="Channel mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'rgb', label: 'RGB' },
              { value: 'hsl', label: 'HSL' },
              { value: 'hsb', label: 'HSB' }
            ]}
          />
          <ChannelInputs mode={mode} rgba={rgba} hsva={hsva} onRgba={updateRgba} onHsva={update} />
        </div>

        <div className="format-list">
          {COLOR_FORMATS.map((format) => {
            const value = format.format(rgba)
            return (
              <button key={format.id} type="button" className="format-row" onClick={() => copyText(value)} title="Copy">
                <span className="format-row__label">
                  {format.group === 'CSS' || format.group === 'Design' ? format.label : `${format.group} ${format.label}`}
                </span>
                <span className="format-row__value mono">{value}</span>
                <Copy size={13} className="format-row__icon" />
              </button>
            )
          })}
        </div>

        <Button size="sm" variant="ghost" onClick={() => copyText(hex)}>
          Copy {hex}
        </Button>
      </div>
    </div>
  )
}

function HexInput({ value, onCommit }: { value: string; onCommit: (color: RGBA) => void }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const commit = (): void => {
    const parsed = parseColor(text)
    if (parsed) onCommit(parsed)
    else setText(value)
  }
  return (
    <input
      className="input mono hex-input"
      value={text}
      aria-label="Color value"
      spellCheck={false}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => event.key === 'Enter' && commit()}
    />
  )
}

interface ChannelInputsProps {
  mode: ChannelMode
  rgba: RGBA
  hsva: HSVA
  onRgba: (color: RGBA) => void
  onHsva: (color: HSVA) => void
}

function ChannelInputs({ mode, rgba, hsva, onRgba, onHsva }: ChannelInputsProps) {
  const alpha = { label: 'A', value: round(rgba.a * 100), max: 100 }
  let fields: { label: string; value: number; max: number }[]
  let apply: (values: number[]) => void
  if (mode === 'rgb') {
    fields = [
      { label: 'R', value: rgba.r, max: 255 },
      { label: 'G', value: rgba.g, max: 255 },
      { label: 'B', value: rgba.b, max: 255 }
    ]
    apply = ([r, g, b, a]) => onRgba({ r, g, b, a: a / 100 })
  } else if (mode === 'hsl') {
    const hsl = rgbToHsl(rgba)
    fields = [
      { label: 'H', value: round(hsl.s === 0 ? hsva.h : hsl.h), max: 360 },
      { label: 'S', value: round(hsl.s), max: 100 },
      { label: 'L', value: round(hsl.l), max: 100 }
    ]
    apply = ([h, s, l, a]) => onRgba(hslToRgb({ h, s, l, a: a / 100 }))
  } else {
    fields = [
      { label: 'H', value: round(hsva.h), max: 360 },
      { label: 'S', value: round(hsva.s), max: 100 },
      { label: 'B', value: round(hsva.v), max: 100 }
    ]
    apply = ([h, s, v, a]) => onHsva({ h, s, v, a: a / 100 })
  }
  const all = [...fields, alpha]
  return (
    <div className="channel-inputs">
      {all.map((field, index) => (
        <label key={field.label} className="channel-input">
          <input
            type="number"
            className="input mono"
            min={0}
            max={field.max}
            value={field.value}
            onChange={(event) => {
              const number = Number(event.target.value)
              if (isNaN(number)) return
              const values = all.map((item) => item.value)
              values[index] = Math.min(field.max, Math.max(0, number))
              apply(values)
            }}
          />
          <span>{field.label}</span>
        </label>
      ))}
    </div>
  )
}
