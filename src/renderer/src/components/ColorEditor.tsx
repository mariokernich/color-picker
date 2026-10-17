import { KeyboardEvent, PointerEvent, useRef } from 'react'
import { HSVA, hsvToRgb, toHex } from '@shared/color'

interface ColorEditorProps {
  value: HSVA
  onChange: (value: HSVA) => void
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

/** Drag handling shared by the saturation/brightness area and the sliders. */
function useDrag(onMove: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null)
  const update = (event: PointerEvent): void => {
    const rect = ref.current!.getBoundingClientRect()
    onMove(clamp((event.clientX - rect.left) / rect.width, 0, 1), clamp((event.clientY - rect.top) / rect.height, 0, 1))
  }
  return {
    ref,
    onPointerDown: (event: PointerEvent) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      update(event)
    },
    onPointerMove: (event: PointerEvent) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event)
    }
  }
}

function arrowDelta(event: KeyboardEvent, step: number): { x: number; y: number } | null {
  const amount = event.shiftKey ? step * 10 : step
  switch (event.key) {
    case 'ArrowLeft':
      return { x: -amount, y: 0 }
    case 'ArrowRight':
      return { x: amount, y: 0 }
    case 'ArrowUp':
      return { x: 0, y: amount }
    case 'ArrowDown':
      return { x: 0, y: -amount }
    default:
      return null
  }
}

export function ColorEditor({ value, onChange }: ColorEditorProps) {
  const opaque = toHex(hsvToRgb({ ...value, a: 1 }))
  const hueColor = toHex(hsvToRgb({ h: value.h, s: 100, v: 100, a: 1 }))

  const area = useDrag((x, y) => onChange({ ...value, s: x * 100, v: (1 - y) * 100 }))
  const hue = useDrag((x) => onChange({ ...value, h: x * 360 }))
  const alpha = useDrag((x) => onChange({ ...value, a: Math.round(x * 100) / 100 }))

  return (
    <div className="color-editor">
      <div
        {...area}
        className="color-editor__area"
        style={{ backgroundColor: hueColor }}
        role="slider"
        tabIndex={0}
        aria-label="Saturation and brightness"
        aria-valuetext={`Saturation ${Math.round(value.s)}%, brightness ${Math.round(value.v)}%`}
        onKeyDown={(event) => {
          const delta = arrowDelta(event, 1)
          if (!delta) return
          event.preventDefault()
          onChange({ ...value, s: clamp(value.s + delta.x, 0, 100), v: clamp(value.v + delta.y, 0, 100) })
        }}
      >
        <div
          className="color-editor__thumb"
          style={{ left: `${value.s}%`, top: `${100 - value.v}%`, background: opaque }}
        />
      </div>
      <div
        {...hue}
        className="color-editor__slider color-editor__slider--hue"
        role="slider"
        tabIndex={0}
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(value.h)}
        onKeyDown={(event) => {
          const delta = arrowDelta(event, 1)
          if (!delta) return
          event.preventDefault()
          onChange({ ...value, h: clamp(value.h + delta.x + delta.y, 0, 360) })
        }}
      >
        <div className="color-editor__knob" style={{ left: `${(value.h / 360) * 100}%`, background: hueColor }} />
      </div>
      <div
        {...alpha}
        className="color-editor__slider color-editor__slider--alpha"
        role="slider"
        tabIndex={0}
        aria-label="Opacity"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value.a * 100)}
        onKeyDown={(event) => {
          const delta = arrowDelta(event, 0.01)
          if (!delta) return
          event.preventDefault()
          onChange({ ...value, a: clamp(Math.round((value.a + delta.x + delta.y) * 100) / 100, 0, 1) })
        }}
      >
        <div className="color-editor__alpha-fill" style={{ background: `linear-gradient(to right, transparent, ${opaque})` }} />
        <div className="color-editor__knob" style={{ left: `${value.a * 100}%`, background: opaque }} />
      </div>
    </div>
  )
}
