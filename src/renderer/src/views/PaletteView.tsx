import { DragEvent, useEffect, useRef, useState } from 'react'
import { MoreHorizontal, Pipette } from 'lucide-react'
import { normalizeHex } from '@shared/state'
import { useConfirm } from '../components/Confirm'
import { Button, IconButton, ViewHeader } from '../components/controls'
import { useMenu } from '../components/Menu'
import { isColorDrag, readDraggedColor, Swatch } from '../components/Swatch'
import { api } from '../lib/api'
import { useApp } from '../lib/app'
import { colorMenuItems } from '../lib/colorMenu'
import { paletteMenuItems } from '../lib/paletteMenu'

export function PaletteView({ id }: { id: string }) {
  const app = useApp()
  const { data, dispatch, push, back, copyHex } = app
  const openMenu = useMenu()
  const confirm = useConfirm()
  const palette = data.palettes.find((item) => item.id === id)
  const [renaming, setRenaming] = useState(false)
  const [newColor, setNewColor] = useState('')
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming) nameRef.current?.select()
  }, [renaming])

  useEffect(() => {
    if (!palette) back()
  }, [palette, back])
  if (!palette) return null

  const active = data.activePaletteId === palette.id
  const newHex = normalizeHex(newColor)

  const addColor = (): void => {
    if (!newHex) return
    dispatch({ type: 'addToPalette', paletteId: palette.id, hexes: [newHex] })
    setNewColor('')
  }

  const onDrop = (event: DragEvent, index: number): void => {
    event.preventDefault()
    event.stopPropagation()
    setDropIndex(null)
    const dragged = readDraggedColor(event)
    if (!dragged) return
    if (dragged.collection === palette.id) {
      dispatch({ type: 'reorderColor', collection: palette.id, colorId: dragged.colorId, toIndex: index })
    } else {
      dispatch({ type: 'moveColor', from: dragged.collection, to: palette.id, colorId: dragged.colorId, copy: event.altKey })
    }
  }

  return (
    <div className="view">
      <ViewHeader
        onBack={back}
        title={
          renaming ? (
            <input
              ref={nameRef}
              className="title-input"
              defaultValue={palette.name}
              aria-label="Palette name"
              onBlur={(event) => {
                dispatch({ type: 'renamePalette', paletteId: palette.id, name: event.target.value })
                setRenaming(false)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
                if (event.key === 'Escape') setRenaming(false)
              }}
            />
          ) : (
            <button type="button" className="title-button" title="Rename" onClick={() => setRenaming(true)}>
              {palette.name}
            </button>
          )
        }
        actions={
          <IconButton
            label="Palette Actions"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect()
              openMenu(
                { x: rect.right - 200, y: rect.bottom + 4 },
                paletteMenuItems(app, confirm, palette, () => setRenaming(true))
              )
            }}
          >
            <MoreHorizontal size={17} />
          </IconButton>
        }
      />

      <div className="view__body">
        <div className="palette-actions">
          <Button
            size="sm"
            variant={active ? 'primary' : 'secondary'}
            onClick={() => dispatch({ type: 'setActivePalette', paletteId: active ? null : palette.id })}
            title="When collecting, every picked color is also added to this palette"
          >
            {active ? 'Collecting picked colors' : 'Collect picked colors'}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              dispatch({ type: 'setActivePalette', paletteId: palette.id })
              void api.startPicker()
            }}
          >
            <Pipette size={14} /> Pick
          </Button>
        </div>

        <div
          className="palette-grid"
          onDragOver={(event) => {
            if (!isColorDrag(event)) return
            event.preventDefault()
            setDropIndex(palette.colors.length)
          }}
          onDragLeave={() => setDropIndex(null)}
          onDrop={(event) => onDrop(event, palette.colors.length)}
        >
          {palette.colors.map((color, index) => (
            <div
              key={color.id}
              className={['palette-color', dropIndex === index && 'palette-color--drop'].filter(Boolean).join(' ')}
              onDragOver={(event) => {
                if (!isColorDrag(event)) return
                event.preventDefault()
                event.stopPropagation()
                setDropIndex(index)
              }}
              onDrop={(event) => onDrop(event, index)}
            >
              <Swatch
                hex={color.hex}
                size={56}
                radius={12}
                title={`${color.hex}\nClick to copy · Double-click to edit`}
                drag={{ collection: palette.id, colorId: color.id }}
                onClick={() => copyHex(color.hex)}
                onDoubleClick={() => push({ name: 'color', collection: palette.id, colorId: color.id })}
                onContextMenu={(event) => {
                  event.preventDefault()
                  openMenu({ x: event.clientX, y: event.clientY }, colorMenuItems(app, palette.id, color))
                }}
              />
              <span className="palette-color__name">{color.name ?? ''}</span>
              <span className="palette-color__hex mono">{color.hex}</span>
            </div>
          ))}
          {palette.colors.length === 0 && (
            <div className="empty empty--wide">
              <p>Pick colors, drag them here from the history, or add a value below.</p>
            </div>
          )}
        </div>

        <form
          className="add-color"
          onSubmit={(event) => {
            event.preventDefault()
            addColor()
          }}
        >
          <span className="add-color__preview" style={{ background: newHex ?? 'transparent' }} />
          <input
            className="input mono"
            placeholder="Add color: #5B4EF0, rgb(…), hsl(…)"
            value={newColor}
            onChange={(event) => setNewColor(event.target.value)}
            aria-label="Add color"
            spellCheck={false}
          />
          <Button type="submit" size="sm" disabled={!newHex}>
            Add
          </Button>
        </form>
      </div>
    </div>
  )
}
