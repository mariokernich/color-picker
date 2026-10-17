import { CSSProperties, DragEvent, MouseEvent } from 'react'
import { isLight, parseHex } from '@shared/color'
import type { CollectionId } from '@shared/types'

export const COLOR_DRAG_TYPE = 'application/x-color-picker-color'

export interface DraggedColor {
  collection: CollectionId
  colorId: string
}

interface SwatchProps {
  hex: string
  size?: number
  radius?: number
  title?: string
  selected?: boolean
  drag?: DraggedColor
  className?: string
  style?: CSSProperties
  onClick?: (event: MouseEvent) => void
  onDoubleClick?: (event: MouseEvent) => void
  onContextMenu?: (event: MouseEvent) => void
  onDragOver?: (event: DragEvent) => void
  onDrop?: (event: DragEvent) => void
}

/** A color chip. Translucent colors are drawn over a checkerboard. */
export function Swatch({ hex, size = 28, radius, title, selected, drag, className, style, ...handlers }: SwatchProps) {
  const color = parseHex(hex)
  const translucent = color !== null && color.a < 1
  return (
    <button
      type="button"
      className={['swatch', selected && 'swatch--selected', color && isLight(color) && 'swatch--light', className]
        .filter(Boolean)
        .join(' ')}
      title={title ?? hex}
      aria-label={title ?? hex}
      draggable={Boolean(drag)}
      onDragStart={(event) => {
        if (!drag) return
        event.dataTransfer.setData(COLOR_DRAG_TYPE, JSON.stringify(drag))
        event.dataTransfer.setData('text/plain', hex)
        event.dataTransfer.effectAllowed = 'copyMove'
      }}
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? Math.round(size / 4),
        background: translucent ? `linear-gradient(${hex}, ${hex}), var(--checker)` : hex,
        ...style
      }}
      {...handlers}
    />
  )
}

export function readDraggedColor(event: DragEvent): DraggedColor | null {
  try {
    const raw = event.dataTransfer.getData(COLOR_DRAG_TYPE)
    return raw ? (JSON.parse(raw) as DraggedColor) : null
  } catch {
    return null
  }
}

export function isColorDrag(event: DragEvent): boolean {
  return event.dataTransfer.types.includes(COLOR_DRAG_TYPE)
}
